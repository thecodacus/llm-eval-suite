import { db } from "./db.js";
import { complete } from "./eval/client.js";
import { EXTRACTORS } from "./eval/extractors.js";
import { GRADERS } from "./eval/graders.js";
import { CaptureServer, checkFormat, extractCurl, runCurl, matchRequest } from "./eval/agentic.js";
import type { ModelRow, ItemRow, Suite } from "./types.js";

const THINK_SYS = "Think step by step, then give the final answer.";
const SUBJECTIVE_TEMP = 0.7;

function log(runId: number, msg: string) {
  console.log(`[run ${runId}] ${new Date().toISOString()} ${msg}`);
}

const insResult = db.prepare(
  `INSERT INTO results (run_id,model_id,item_id,task_group,passed,detail,output,tok_per_s,total_s)
   VALUES (@run_id,@model_id,@item_id,@task_group,@passed,@detail,@output,@tok_per_s,@total_s)`
);
const setStatus = db.prepare("UPDATE runs SET status=? WHERE id=?");

/** Kick off a run in the background; returns immediately. Progress via run status + results rows. */
export function startRun(runId: number, suite: Suite, models: ModelRow[], items: ItemRow[]) {
  (async () => {
    const t0 = Date.now();
    log(runId, `START suite=${suite} models=[${models.map((m) => m.id).join(", ")}] items=${items.length} (${models.length * items.length} calls)`);
    try {
      if (suite === "agentic") await runAgentic(runId, models, items);
      else if (suite === "subjective") await runSubjective(runId, models, items);
      else await runDeterministic(runId, models, items);
      setStatus.run("done", runId);
      log(runId, `DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      log(runId, `ERROR ${e instanceof Error ? e.stack : String(e)}`);
      setStatus.run("error", runId);
    }
  })();
}

async function runDeterministic(runId: number, models: ModelRow[], items: ItemRow[]) {
  for (const model of models) {
    for (const item of items) {
      const cfg = JSON.parse(item.config);
      let sys: string | undefined = cfg.system;
      if (cfg.thinking && model.thinking) sys = (sys ? sys + "\n" : "") + THINK_SYS;
      const msgs = [...(sys ? [{ role: "system", content: sys }] : []), { role: "user", content: cfg.prompt }];
      const c = await complete(model, msgs);
      let passed = false, detail = c.error ? `API error: ${c.error}` : "";
      if (!c.error) {
        const pred = EXTRACTORS[cfg.extractor ?? "raw"](c.text);
        const g = GRADERS[cfg.grader](pred, cfg.answer, cfg.grader_args);
        passed = g.passed; detail = g.detail;
      }
      insResult.run({ run_id: runId, model_id: model.id, item_id: item.id, task_group: item.task_group, passed: passed ? 1 : 0, detail, output: c.text, tok_per_s: c.tokPerS, total_s: c.totalS });
      log(runId, `${model.id} ${item.task_group}#${item.id} ${passed ? "PASS" : "FAIL"} ${c.tokPerS ? c.tokPerS.toFixed(0) + "t/s " : ""}· ${detail}`.slice(0, 220));
    }
  }
}

async function runAgentic(runId: number, models: ModelRow[], items: ItemRow[]) {
  const cap = new CaptureServer();
  const base = await cap.start();
  try {
    for (const model of models) {
      for (const item of items) {
        const cfg = JSON.parse(item.config);
        cap.reset();
        const skills = String(cfg.skills).replaceAll("{BASE_URL}", base);
        const prompt = String(cfg.prompt).replaceAll("{BASE_URL}", base);

        let fails: string[], output: string, tokPerS: number | null, totalS: number;
        if (Array.isArray(cfg.steps)) {
          const r = await runChain(model, cfg, skills, prompt, base, cap);
          ({ fails, output, tokPerS, totalS } = r);
        } else {
          const c = await complete(model, [{ role: "system", content: skills }, { role: "user", content: prompt }]);
          fails = []; output = c.text; tokPerS = c.tokPerS; totalS = c.totalS;
          if (c.error) fails.push(`API error: ${c.error}`);
          else {
            fails.push(...checkFormat(c.text, cfg.format ?? {}));
            const cmd = extractCurl(c.text);
            if (!cmd) fails.push("curl: none found in reply");
            else { const r = await runCurl(cmd, base); if (!r.ran) fails.push(r.detail); }
            fails.push(...matchRequest(cap.last(), cfg.expect));
          }
        }
        insResult.run({ run_id: runId, model_id: model.id, item_id: item.id, task_group: item.task_group, passed: fails.length ? 0 : 1, detail: fails.join("; ") || "ok", output, tok_per_s: tokPerS, total_s: totalS });
        log(runId, `${model.id} ${item.task_group}#${item.id} ${fails.length ? "FAIL" : "PASS"} · ${fails.join("; ") || "ok"}`.slice(0, 220));
      }
    }
  } finally {
    cap.stop();
  }
}

const CHAIN_PROTOCOL =
  "\n\nProtocol: make exactly ONE API call per message, as a single curl command inside a ```bash code block. " +
  "After each call you will receive the API response as JSON — use values from it in later calls. " +
  "When the task is fully complete, reply with DONE and no curl.";

/** Multi-step agent loop: model calls the mock API, gets scripted responses, and
 *  chains them. Verifies the captured request sequence against cfg.steps. */
async function runChain(model: ModelRow, cfg: any, skills: string, prompt: string, base: string, cap: CaptureServer) {
  cap.setScript((cfg.api ?? []).map((r: any) => ({ when: r.when, return: r.return })));
  const conv: Array<{ role: string; content: string }> = [
    { role: "system", content: skills + CHAIN_PROTOCOL },
    { role: "user", content: prompt },
  ];
  const steps: any[] = cfg.steps;
  const maxSteps = cfg.max_steps ?? steps.length + 2;
  const fails: string[] = [];
  const parts: string[] = [];
  let totalS = 0, tokAcc = 0, tokN = 0;

  for (let i = 0; i < maxSteps; i++) {
    const c = await complete(model, conv);
    totalS += c.totalS;
    if (c.tokPerS) { tokAcc += c.tokPerS; tokN++; }
    if (c.error) { fails.push(`API error: ${c.error}`); break; }
    conv.push({ role: "assistant", content: c.text });
    parts.push(`» model:\n${c.text}`);
    const cmd = extractCurl(c.text);
    if (!cmd) break;                              // no more calls — model is done
    const r = await runCurl(cmd, base);
    if (!r.ran) { fails.push(`call ${cap.all().length + 1}: ${r.detail}`); break; }
    parts.push(`« response: ${r.body}`);
    conv.push({ role: "user", content: `API response:\n${r.body}` });
  }

  const caps = cap.all();
  if (caps.length !== steps.length) fails.push(`expected ${steps.length} call(s), model made ${caps.length}`);
  steps.forEach((step, i) => {
    if (caps[i]) matchRequest(caps[i], step).forEach((f) => fails.push(`step ${i + 1} ${f}`));
  });
  return { fails, output: parts.join("\n\n"), tokPerS: tokN ? tokAcc / tokN : null, totalS };
}

async function runSubjective(runId: number, models: ModelRow[], items: ItemRow[]) {
  for (const item of items) {
    const cfg = JSON.parse(item.config);
    const msgs = [...(cfg.system ? [{ role: "system", content: cfg.system }] : []), { role: "user", content: cfg.prompt }];
    for (const model of models) {
      const c = await complete(model, msgs, { temperature: SUBJECTIVE_TEMP });
      insResult.run({ run_id: runId, model_id: model.id, item_id: item.id, task_group: item.task_group, passed: null, detail: cfg.note ?? "", output: c.error ? `[ERROR] ${c.error}` : c.text, tok_per_s: c.tokPerS, total_s: c.totalS });
      log(runId, `${model.id} ${item.task_group}#${item.id} generated ${c.error ? "(ERROR " + c.error + ")" : c.text.length + " chars"}`);
    }
  }
}
