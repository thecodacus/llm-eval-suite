import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { db } from "./db.js";
import { startRun } from "./runner.js";
import { EXTRACTOR_CATALOG, GRADER_CATALOG, SUITE_CATALOG } from "./catalog.js";
import { importBenchmark, IMPORT_CATALOG } from "./import.js";
import type { ModelRow, ItemRow, Suite } from "./types.js";

const app = Fastify({ logger: false });

/* ---------------- catalog (verify methods for the Test Builder) ---------------- */
app.get("/api/catalog", async () => ({
  suites: SUITE_CATALOG, extractors: EXTRACTOR_CATALOG, graders: GRADER_CATALOG,
  benchmarks: IMPORT_CATALOG,
}));

/* ---------------- import hard benchmarks from HuggingFace (server-side) ---------------- */
function bulkInsert(items: Array<{ suite: string; task_group: string; config: any }>) {
  const findImport = db.prepare("SELECT 1 FROM items WHERE json_extract(config,'$._import') = ?");
  const ins = db.prepare("INSERT INTO items (suite,task_group,config) VALUES (?,?,?)");
  let added = 0, skipped = 0;
  db.transaction(() => {
    for (const it of items) {
      const cfg = typeof it.config === "string" ? JSON.parse(it.config) : it.config;
      if (cfg._import && findImport.get(cfg._import)) { skipped++; continue; }
      ins.run(it.suite, it.task_group, JSON.stringify(cfg));
      added++;
    }
  })();
  return { added, skipped };
}

app.post("/api/import", async (req, reply) => {
  const { dataset, limit } = req.body as { dataset: string; limit?: number };
  let items;
  try {
    items = await importBenchmark(dataset, { limit });
  } catch (e: any) {
    reply.code(502);
    return { error: `import failed: ${e?.message ?? e}. (Needs outbound internet to huggingface.co.)` };
  }
  const { added, skipped } = bulkInsert(items);
  return { added, skipped, total: items.length };
});

/* ---------------- models ---------------- */
app.get("/api/models", async () => db.prepare("SELECT * FROM models ORDER BY id").all());

app.post("/api/models", async (req, reply) => {
  const m = req.body as any;
  db.prepare(
    `INSERT INTO models (id,base_url,model,api_key,temperature,max_tokens,timeout_s,thinking)
     VALUES (@id,@base_url,@model,@api_key,@temperature,@max_tokens,@timeout_s,@thinking)
     ON CONFLICT(id) DO UPDATE SET base_url=@base_url,model=@model,api_key=@api_key,
       temperature=@temperature,max_tokens=@max_tokens,timeout_s=@timeout_s,thinking=@thinking`
  ).run({
    id: m.id, base_url: m.base_url, model: m.model, api_key: m.api_key ?? "not-needed",
    temperature: m.temperature ?? 0, max_tokens: m.max_tokens ?? 2048,
    timeout_s: m.timeout_s ?? 180, thinking: m.thinking ? 1 : 0,
  });
  reply.code(201);
  return { ok: true };
});

app.delete("/api/models/:id", async (req) => {
  db.prepare("DELETE FROM models WHERE id=?").run((req.params as any).id);
  return { ok: true };
});

/* ---------------- items ---------------- */
app.get("/api/items", async (req) => {
  const suite = (req.query as any).suite as Suite | undefined;
  return suite
    ? db.prepare("SELECT * FROM items WHERE suite=? ORDER BY task_group,id").all(suite)
    : db.prepare("SELECT * FROM items ORDER BY suite,task_group,id").all();
});

app.post("/api/items", async (req, reply) => {
  const it = req.body as any;
  const info = db.prepare("INSERT INTO items (suite,task_group,config) VALUES (?,?,?)").run(
    it.suite, it.task_group, typeof it.config === "string" ? it.config : JSON.stringify(it.config)
  );
  reply.code(201);
  return { id: info.lastInsertRowid };
});

// Bulk import (used by tools/import_hf.py). Idempotent by config._import so
// re-running skips dupes. NOTE: uses _import (not _seed) so seed reconciliation
// never treats these as retired seed items and deletes them on redeploy.
app.post("/api/items/bulk", async (req, reply) => {
  const items = ((req.body as any)?.items ?? []) as any[];
  reply.code(201);
  return bulkInsert(items);
});

app.put("/api/items/:id", async (req) => {
  const it = req.body as any;
  db.prepare("UPDATE items SET suite=?, task_group=?, config=? WHERE id=?").run(
    it.suite, it.task_group, typeof it.config === "string" ? it.config : JSON.stringify(it.config),
    (req.params as any).id
  );
  return { ok: true };
});

app.delete("/api/items/:id", async (req) => {
  db.prepare("DELETE FROM items WHERE id=?").run((req.params as any).id);
  return { ok: true };
});

/* ---------------- runs ---------------- */
app.post("/api/runs", async (req, reply) => {
  const { suite, modelIds, taskGroups } = req.body as { suite: Suite; modelIds: string[]; taskGroups?: string[] };
  const models = db.prepare(`SELECT * FROM models WHERE id IN (${modelIds.map(() => "?").join(",")})`).all(...modelIds) as ModelRow[];
  let items = db.prepare("SELECT * FROM items WHERE suite=?").all(suite) as ItemRow[];
  if (taskGroups?.length) items = items.filter((i) => taskGroups.includes(i.task_group));
  if (!models.length || !items.length) {
    reply.code(400);
    return { error: "no models or no items matched" };
  }
  const info = db.prepare("INSERT INTO runs (created_at,suite,status,model_ids) VALUES (?,?,?,?)").run(
    new Date().toISOString(), suite, "running", JSON.stringify(modelIds)
  );
  const runId = Number(info.lastInsertRowid);
  startRun(runId, suite, models, items);
  reply.code(201);
  return { runId };
});

app.get("/api/runs", async () => db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 50").all());

app.delete("/api/runs/:id", async (req) => {
  const id = (req.params as any).id;
  const tx = db.transaction((rid: string) => {
    db.prepare("DELETE FROM results WHERE run_id=?").run(rid);
    db.prepare("DELETE FROM verdicts WHERE run_id=?").run(rid);
    db.prepare("DELETE FROM runs WHERE id=?").run(rid);
  });
  tx(id);
  return { ok: true };
});

app.get("/api/runs/:id", async (req) => {
  const id = (req.params as any).id;
  const run = db.prepare("SELECT * FROM runs WHERE id=?").get(id);
  // join the item config so the UI can show the exact prompt in expanded log rows
  const results = db.prepare(
    `SELECT r.*, i.config AS item_config FROM results r
     LEFT JOIN items i ON i.id = r.item_id WHERE r.run_id=? ORDER BY r.id`
  ).all(id);
  return { run, results };
});

// Leaderboard: pass% + avg tok/s per (model x task_group) for a run
app.get("/api/runs/:id/leaderboard", async (req) => {
  const id = (req.params as any).id;
  return db.prepare(
    `SELECT model_id, task_group,
            SUM(passed) AS pass, COUNT(*) AS n,
            ROUND(100.0*SUM(passed)/COUNT(*),1) AS pct,
            ROUND(AVG(tok_per_s),1) AS avg_tok_s
     FROM results WHERE run_id=? AND passed IS NOT NULL
     GROUP BY model_id, task_group ORDER BY model_id, task_group`
  ).all(id);
});

/* ---------------- subjective review + verdicts ---------------- */
app.get("/api/runs/:id/review", async (req) => {
  const id = (req.params as any).id;
  const rows = db.prepare("SELECT * FROM results WHERE run_id=? ORDER BY item_id").all(id) as any[];
  const byItem = new Map<number, any>();
  for (const r of rows) {
    if (!byItem.has(r.item_id)) {
      const item = db.prepare("SELECT * FROM items WHERE id=?").get(r.item_id) as any;
      const cfg = JSON.parse(item.config);
      byItem.set(r.item_id, { itemId: r.item_id, prompt: cfg.prompt, note: cfg.note ?? "", cards: [] });
    }
    byItem.get(r.item_id).cards.push({ modelId: r.model_id, output: r.output, tokPerS: r.tok_per_s });
  }
  // blind: shuffle deterministically by item so labels A/B/C don't leak ordering
  const blocks = [...byItem.values()].map((b) => {
    const cards = b.cards.map((c: any, i: number) => ({ label: String.fromCharCode(65 + i), ...c }));
    return { ...b, cards };
  });
  const verdicts = db.prepare("SELECT * FROM verdicts WHERE run_id=?").all(id);
  return { blocks, verdicts };
});

app.post("/api/runs/:id/verdicts", async (req) => {
  const id = (req.params as any).id;
  const { itemId, winnerModelId, notes } = req.body as any;
  db.prepare(
    `INSERT INTO verdicts (run_id,item_id,winner_model_id,notes) VALUES (?,?,?,?)
     ON CONFLICT(run_id,item_id) DO UPDATE SET winner_model_id=excluded.winner_model_id, notes=excluded.notes`
  ).run(id, itemId, winnerModelId ?? null, notes ?? "");
  return { ok: true };
});

/* ---------------- dashboard (aggregate across all recorded auto-graded runs) ---------------- */
app.get("/api/dashboard", async () => {
  // Only count results whose parent run still exists — a run deleted mid-flight
  // can leave orphaned result rows that must not pollute the aggregate scores.
  const LIVE = "passed IS NOT NULL AND run_id IN (SELECT id FROM runs)";
  const byModelGroup = db.prepare(
    `SELECT model_id, task_group,
            SUM(passed) AS pass, COUNT(*) AS n,
            ROUND(100.0*SUM(passed)/COUNT(*),1) AS pct,
            ROUND(AVG(tok_per_s),1) AS avg_tok_s
     FROM results WHERE ${LIVE}
     GROUP BY model_id, task_group`
  ).all();
  const byModel = db.prepare(
    `SELECT model_id,
            SUM(passed) AS pass, COUNT(*) AS n,
            ROUND(100.0*SUM(passed)/COUNT(*),1) AS pct,
            ROUND(AVG(tok_per_s),1) AS avg_tok_s
     FROM results WHERE ${LIVE}
     GROUP BY model_id ORDER BY pct DESC`
  ).all();
  const byGroup = db.prepare(
    `SELECT task_group,
            ROUND(100.0*SUM(passed)/COUNT(*),1) AS pct, COUNT(*) AS n
     FROM results WHERE ${LIVE}
     GROUP BY task_group ORDER BY pct DESC`
  ).all();
  const totals = db.prepare(
    `SELECT COUNT(DISTINCT run_id) AS runs, COUNT(*) AS graded_results
     FROM results WHERE ${LIVE}`
  ).get();
  return { byModel, byModelGroup, byGroup, totals };
});

app.get("/api/health", async () => ({ ok: true }));

/* ---------------- static frontend ---------------- */
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "public");
if (existsSync(publicDir)) {
  await app.register(fastifyStatic, { root: publicDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) return reply.code(404).send({ error: "not found" });
    return reply.sendFile("index.html"); // SPA fallback
  });
}

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: "0.0.0.0" }).then(() => console.log(`listening on :${port}`));
