import { useEffect, useMemo, useState } from "react";
import { api, Catalog, Item, Suite } from "../api";
import { Icon } from "../icons";
import Modal from "../components/Modal";

const parseKV = (text: string) =>
  Object.fromEntries(text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

interface FormState {
  id?: number;
  suite: Suite;
  task_group: string;
  prompt: string; extractor: string; grader: string; answer: string;
  graderArgs: string; system: string; thinking: boolean;
  skills: string; mustMatch: string; method: string; path: string;
  headers: string; query: string; json: string;
  note: string;
  guideTitle: string; guideMeaning: string;
}

const blank: FormState = {
  suite: "deterministic", task_group: "", prompt: "", extractor: "raw", grader: "exact",
  answer: "", graderArgs: "", system: "", thinking: false,
  skills: "You can call a local API at {BASE_URL}.\n\n# Skill: <name>\n  Endpoint: POST {BASE_URL}/api/<path>\n  ...\n\n# Output format — follow EXACTLY:\n...",
  mustMatch: "```bash\\s*\\ncurl", method: "POST", path: "/api/", headers: "", query: "", json: "",
  note: "", guideTitle: "", guideMeaning: "",
};

const SUITE_LABEL: Record<string, string> = { deterministic: "Auto-graded", agentic: "Agentic", subjective: "Subjective" };
const BENCH_LABEL: Record<string, string> = { gpqa: "GPQA Diamond", mmlu_pro: "MMLU-Pro", aime: "AIME 2025" };
const PAGE = 12;

export default function Build() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FormState>(blank);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const warn = (text: string) => setMsg({ text, ok: false });

  const [suiteF, setSuiteF] = useState<"all" | Suite>("all");
  const [groupF, setGroupF] = useState<string>("all");
  const [page, setPage] = useState(0);

  // benchmark import
  const [impOpen, setImpOpen] = useState(false);
  const [impDs, setImpDs] = useState("gpqa");
  const [impLimit, setImpLimit] = useState<number | "">("");
  const [impBusy, setImpBusy] = useState(false);
  const [impMsg, setImpMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = () => api.items().then(setItems);
  useEffect(() => { api.catalog().then(setCat); load(); }, []);

  const grader = cat?.graders.find((g) => g.id === f.grader);
  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));
  const allGroups = useMemo(() => [...new Set(items.map((i) => i.task_group))], [items]);

  // filtering + pagination
  const filtered = useMemo(() => items.filter((i) =>
    (suiteF === "all" || i.suite === suiteF) && (groupF === "all" || i.task_group === groupF)
  ), [items, suiteF, groupF]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => { setPage(0); }, [suiteF, groupF]);
  const groupsForSuite = useMemo(() =>
    [...new Set(items.filter((i) => suiteF === "all" || i.suite === suiteF).map((i) => i.task_group))],
    [items, suiteF]);

  const pickGrader = (id: string) => {
    const g = cat?.graders.find((x) => x.id === id);
    set({ grader: id, extractor: g?.suggestExtractor ?? f.extractor });
  };

  function buildConfig(): any {
    const guide = f.guideTitle || f.guideMeaning
      ? { _guide: { title: f.guideTitle || undefined, highScoreMeans: f.guideMeaning || undefined } } : {};
    if (f.suite === "subjective") return { prompt: f.prompt, note: f.note || undefined, ...guide };
    if (f.suite === "agentic") {
      const expect: any = { method: f.method, path: f.path };
      if (f.headers.trim()) expect.headers = parseKV(f.headers);
      if (f.query.trim()) expect.query = parseKV(f.query);
      if (f.json.trim()) expect.json = JSON.parse(f.json);
      return { skills: f.skills, prompt: f.prompt, format: { must_match: lines(f.mustMatch) }, expect, ...guide };
    }
    let answer: any = f.answer;
    if (grader?.answerType === "list") answer = f.answer.split(",").map((s) => s.trim()).filter(Boolean);
    else if (grader?.answerType === "json") answer = JSON.parse(f.answer);
    const cfg: any = { prompt: f.prompt, extractor: f.extractor, grader: f.grader, answer, ...guide };
    if (f.system.trim()) cfg.system = f.system;
    if (f.thinking) cfg.thinking = true;
    if (f.graderArgs.trim()) cfg.grader_args = JSON.parse(f.graderArgs);
    return cfg;
  }

  const openNew = () => { setF({ ...blank, suite: suiteF === "all" ? "deterministic" : suiteF, task_group: groupF === "all" ? "" : groupF }); setMsg(null); setOpen(true); };

  const openEdit = (it: Item) => {
    const c = JSON.parse(it.config);
    const base: FormState = { ...blank, id: it.id, suite: it.suite, task_group: it.task_group, prompt: c.prompt ?? "" };
    base.guideTitle = c._guide?.title ?? ""; base.guideMeaning = c._guide?.highScoreMeans ?? "";
    if (it.suite === "deterministic") Object.assign(base, {
      extractor: c.extractor ?? "raw", grader: c.grader ?? "exact",
      answer: Array.isArray(c.answer) ? c.answer.join(", ") : typeof c.answer === "object" ? JSON.stringify(c.answer) : String(c.answer ?? ""),
      graderArgs: c.grader_args ? JSON.stringify(c.grader_args) : "", system: c.system ?? "", thinking: !!c.thinking,
    });
    if (it.suite === "agentic") Object.assign(base, {
      skills: c.skills ?? "", mustMatch: (c.format?.must_match ?? []).join("\n"),
      method: c.expect?.method ?? "POST", path: c.expect?.path ?? "/api/",
      headers: Object.entries(c.expect?.headers ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"),
      query: Object.entries(c.expect?.query ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"),
      json: c.expect?.json ? JSON.stringify(c.expect.json, null, 2) : "",
    });
    if (it.suite === "subjective") base.note = c.note ?? "";
    setF(base); setMsg(null); setOpen(true);
  };

  const save = async () => {
    setMsg(null);
    if (!f.task_group.trim()) return warn("Give the test a group name");
    if (!f.prompt.trim()) return warn("Prompt is required");
    let config: any;
    try { config = buildConfig(); } catch (e: any) { return warn(`Invalid JSON in a field: ${e.message}`); }
    try {
      if (f.id) await api.updateItem(f.id, f.suite, f.task_group.trim(), config);
      else await api.createItem(f.suite, f.task_group.trim(), config);
      setOpen(false); load();
    } catch (e: any) { warn(e.message); }
  };

  const del = async (id: number) => { if (confirm(`Delete test #${id}?`)) { await api.deleteItem(id); load(); } };

  const bench = cat?.benchmarks?.find((b) => b.id === impDs);
  const runImport = async () => {
    setImpBusy(true); setImpMsg(null);
    try {
      const r = await api.importBenchmark(impDs, impLimit === "" ? undefined : Number(impLimit));
      setImpMsg({ text: `Imported ${r.added} new (${r.skipped} already present) from ${BENCH_LABEL[impDs] ?? impDs}.`, ok: true });
      load();
    } catch (e: any) { setImpMsg({ text: e.message, ok: false }); }
    finally { setImpBusy(false); }
  };

  return (
    <>
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="sm">Tests <span className="muted">({filtered.length}{filtered.length !== items.length ? ` of ${items.length}` : ""})</span></h2>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => { setImpMsg(null); setImpOpen(true); }}><Icon name="book" size={15} /> Import benchmark</button>
            <button className="btn" onClick={openNew}><Icon name="plus" size={15} /> Add test</button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {(["all", "deterministic", "agentic", "subjective"] as const).map((s) => (
            <span key={s} className={`chip ${suiteF === s ? "on" : ""}`} onClick={() => { setSuiteF(s); setGroupF("all"); }}>
              {s === "all" ? "All suites" : SUITE_LABEL[s]}
            </span>
          ))}
          <span className="muted" style={{ marginLeft: 6 }}>group</span>
          <select value={groupF} onChange={(e) => setGroupF(e.target.value)}>
            <option value="all">all groups</option>
            {groupsForSuite.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead><tr><th>suite</th><th>group</th><th>prompt</th><th style={{ width: 90 }}></th></tr></thead>
          <tbody>
            {pageItems.map((it) => {
              const c = JSON.parse(it.config);
              return (
                <tr key={it.id}>
                  <td className="muted">{SUITE_LABEL[it.suite]}</td>
                  <td><b>{it.task_group}</b> <span className="muted">#{it.id}</span></td>
                  <td className="mono muted" style={{ maxWidth: 460, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.prompt}>{c.prompt}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <button className="btn ghost" style={{ padding: "5px 9px" }} onClick={() => openEdit(it)}><Icon name="pencil" size={13} /></button>
                      <button className="btn ghost" style={{ padding: "5px 9px" }} onClick={() => del(it.id)}><Icon name="trash" size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!pageItems.length && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 24 }}>No tests match this filter.</td></tr>}
          </tbody>
        </table>

        {pageCount > 1 && (
          <div className="pager">
            <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>Page {page + 1} of {pageCount}</span>
            <button className="btn ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <Icon name="chevron-right" size={14} style={{ transform: "rotate(180deg)" }} /> Prev
            </button>
            <button className="btn ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next <Icon name="chevron-right" size={14} />
            </button>
          </div>
        )}
      </div>

      <Modal open={impOpen} onClose={() => setImpOpen(false)} title="Import a hard benchmark">
        <p className="muted" style={{ fontSize: 13 }}>
          Pulls the benchmark from HuggingFace into this instance at run time (not stored in the repo). These are where quantization degrades first — ideal for quant/family comparisons. Needs outbound internet to huggingface.co.
        </p>
        <div style={{ marginTop: 12 }}>
          <Label>Benchmark</Label>
          <select value={impDs} onChange={(e) => setImpDs(e.target.value)} style={{ width: "100%" }}>
            {(cat?.benchmarks ?? []).map((b) => <option key={b.id} value={b.id}>{BENCH_LABEL[b.id] ?? b.id} — {b.dataset}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <Label>How many <span className="muted">(blank = default {bench?.defaultLimit}; MMLU-Pro is sampled across all domains)</span></Label>
          <input type="number" value={impLimit} onChange={(e) => setImpLimit(e.target.value === "" ? "" : Number(e.target.value))} placeholder={String(bench?.defaultLimit ?? "")} style={{ width: 220 }} />
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={impBusy} onClick={runImport}><Icon name="book" size={15} /> {impBusy ? "Importing…" : "Import"}</button>
          <button className="btn ghost" onClick={() => setImpOpen(false)}>Close</button>
          {impMsg && <span className={impMsg.ok ? "pass" : "fail"} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name={impMsg.ok ? "check" : "warn"} size={15} />{impMsg.text}</span>}
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title={f.id ? `Edit test #${f.id}` : "Add a test"}>
        <div className="row">
          {(cat?.suites ?? []).map((s) => (
            <span key={s.id} className={`chip ${f.suite === s.id ? "on" : ""}`} title={s.desc} onClick={() => set({ suite: s.id as Suite })}>{s.label}</span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>{cat?.suites.find((s) => s.id === f.suite)?.desc}</p>

        <div style={{ marginTop: 14 }}>
          <Label>Test group <span className="muted">(scores group by this; e.g. "my-emails")</span></Label>
          <input list="groups" value={f.task_group} onChange={(e) => set({ task_group: e.target.value })} placeholder="group name" style={{ width: "100%" }} />
          <datalist id="groups">{allGroups.map((g) => <option key={g} value={g} />)}</datalist>
        </div>

        <div style={{ marginTop: 12 }}>
          <Label>{f.suite === "agentic" ? "Task (what you ask the model to do)" : "Prompt"}</Label>
          <textarea value={f.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={3} style={{ width: "100%" }} placeholder="What the model is asked…" />
        </div>

        {f.suite === "deterministic" && (
          <>
            <div className="row" style={{ marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <Label>Verify method</Label>
                <select value={f.grader} onChange={(e) => pickGrader(e.target.value)} style={{ width: "100%" }}>
                  {cat?.graders.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <Label>Read answer from</Label>
                <select value={f.extractor} onChange={(e) => set({ extractor: e.target.value })} style={{ width: "100%" }}>
                  {cat?.extractors.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
            </div>
            {grader && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{grader.desc}</p>}
            <div style={{ marginTop: 12 }}>
              <Label>Expected answer</Label>
              <textarea value={f.answer} onChange={(e) => set({ answer: e.target.value })} rows={grader?.id === "code_tests" ? 3 : 1}
                style={{ width: "100%" }} placeholder={grader?.answerHint} className={grader?.answerType === "json" || grader?.id === "code_tests" ? "mono" : ""} />
              <p className="muted" style={{ fontSize: 12 }}>{grader?.answerHint}</p>
            </div>
            <details style={{ marginTop: 6 }}>
              <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>Advanced (system prompt, thinking, grader args)</summary>
              <div style={{ marginTop: 8 }}>
                <Label>System prompt (optional)</Label>
                <input value={f.system} onChange={(e) => set({ system: e.target.value })} style={{ width: "100%" }} />
                <label className="chip" style={{ marginTop: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={f.thinking} onChange={(e) => set({ thinking: e.target.checked })} /> add step-by-step preamble (thinking models)
                </label>
                <div style={{ marginTop: 8 }}>
                  <Label>grader_args JSON (optional, e.g. {"{"}"keys":["name"]{"}"})</Label>
                  <input value={f.graderArgs} onChange={(e) => set({ graderArgs: e.target.value })} className="mono" style={{ width: "100%" }} />
                </div>
              </div>
            </details>
          </>
        )}

        {f.suite === "agentic" && (
          <>
            <div style={{ marginTop: 12 }}>
              <Label>Skill / instructions <span className="muted">(use {"{BASE_URL}"} — replaced with the test server)</span></Label>
              <textarea value={f.skills} onChange={(e) => set({ skills: e.target.value })} rows={6} className="mono" style={{ width: "100%" }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Label>Required reply format — one regex per line (all must match)</Label>
              <textarea value={f.mustMatch} onChange={(e) => set({ mustMatch: e.target.value })} rows={3} className="mono" style={{ width: "100%" }} />
            </div>
            <div className="panel" style={{ marginTop: 12, background: "var(--bg)", boxShadow: "none" }}>
              <Label>Expected API call (the curl must match this)</Label>
              <div className="row" style={{ marginTop: 6 }}>
                <select value={f.method} onChange={(e) => set({ method: e.target.value })}>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}
                </select>
                <input value={f.path} onChange={(e) => set({ path: e.target.value })} placeholder="/api/notify" style={{ flex: 1 }} />
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <Label>Required headers <span className="muted">(key: value per line)</span></Label>
                  <textarea value={f.headers} onChange={(e) => set({ headers: e.target.value })} rows={2} className="mono" style={{ width: "100%" }} placeholder="x-auth: token-abc123" />
                </div>
                <div style={{ flex: 1 }}>
                  <Label>Required query <span className="muted">(key: value per line)</span></Label>
                  <textarea value={f.query} onChange={(e) => set({ query: e.target.value })} rows={2} className="mono" style={{ width: "100%" }} placeholder="limit: 5" />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Label>Required JSON body <span className="muted">(use "__PRESENT__" for "any non-empty value")</span></Label>
                <textarea value={f.json} onChange={(e) => set({ json: e.target.value })} rows={3} className="mono" style={{ width: "100%" }} placeholder='{"channel":"ops","message":"__PRESENT__"}' />
              </div>
            </div>
          </>
        )}

        {f.suite === "subjective" && (
          <div style={{ marginTop: 12 }}>
            <Label>What to judge on (shown to you during review)</Label>
            <input value={f.note} onChange={(e) => set({ note: e.target.value })} style={{ width: "100%" }} placeholder="e.g. tone, accuracy, follows the constraint" />
          </div>
        )}

        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>Plain-language Guide entry (optional — appears in the Guide tab)</summary>
          <div style={{ marginTop: 8 }}>
            <Label>Friendly title</Label>
            <input value={f.guideTitle} onChange={(e) => set({ guideTitle: e.target.value })} style={{ width: "100%" }} placeholder="e.g. Drafting my customer emails" />
            <div style={{ marginTop: 8 }}>
              <Label>What a high score means for you</Label>
              <textarea value={f.guideMeaning} onChange={(e) => set({ guideMeaning: e.target.value })} rows={2} style={{ width: "100%" }} placeholder="In plain terms, what this score tells you about your real use case." />
            </div>
          </div>
        </details>

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn" onClick={save}><Icon name={f.id ? "pencil" : "plus"} size={15} /> {f.id ? "Update test" : "Add test"}</button>
          <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
          {msg && <span className={msg.ok ? "pass" : "fail"} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name={msg.ok ? "check" : "warn"} size={15} />{msg.text}</span>}
        </div>
      </Modal>
    </>
  );
}

function Label({ children }: { children: any }) {
  return <div style={{ fontSize: 13, marginBottom: 4 }}>{children}</div>;
}
