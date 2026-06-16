import { useEffect, useMemo, useState } from "react";
import { api, Catalog, Item, Suite } from "../api";

// helpers to parse the friendly form fields into stored config shapes
const parseKV = (text: string) =>
  Object.fromEntries(text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

interface FormState {
  id?: number;
  suite: Suite;
  task_group: string;
  // deterministic
  prompt: string; extractor: string; grader: string; answer: string;
  graderArgs: string; system: string; thinking: boolean;
  // agentic
  skills: string; mustMatch: string; method: string; path: string;
  headers: string; query: string; json: string;
  // subjective
  note: string;
  // optional layman guide override (shown in the Guide tab for custom tests)
  guideTitle: string; guideMeaning: string;
}

const blank: FormState = {
  suite: "deterministic", task_group: "", prompt: "", extractor: "raw", grader: "exact",
  answer: "", graderArgs: "", system: "", thinking: false,
  skills: "You can call a local API at {BASE_URL}.\n\n# Skill: <name>\n  Endpoint: POST {BASE_URL}/api/<path>\n  ...\n\n# Output format — follow EXACTLY:\n...",
  mustMatch: "```bash\\s*\\ncurl", method: "POST", path: "/api/", headers: "", query: "", json: "",
  note: "", guideTitle: "", guideMeaning: "",
};

export default function Build({ onSaved }: { onSaved?: () => void }) {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [f, setF] = useState<FormState>(blank);
  const [msg, setMsg] = useState("");

  const load = () => api.items().then(setItems);
  useEffect(() => { api.catalog().then(setCat); load(); }, []);

  const grader = cat?.graders.find((g) => g.id === f.grader);
  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));
  const groups = useMemo(() => [...new Set(items.map((i) => i.task_group))], [items]);

  // when grader changes, suggest its natural extractor
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
    // deterministic
    let answer: any = f.answer;
    if (grader?.answerType === "list") answer = f.answer.split(",").map((s) => s.trim()).filter(Boolean);
    else if (grader?.answerType === "json") answer = JSON.parse(f.answer);
    const cfg: any = { prompt: f.prompt, extractor: f.extractor, grader: f.grader, answer, ...guide };
    if (f.system.trim()) cfg.system = f.system;
    if (f.thinking) cfg.thinking = true;
    if (f.graderArgs.trim()) cfg.grader_args = JSON.parse(f.graderArgs);
    return cfg;
  }

  const save = async () => {
    setMsg("");
    if (!f.task_group.trim()) return setMsg("⚠ give the test a group name");
    if (!f.prompt.trim()) return setMsg("⚠ prompt is required");
    let config: any;
    try { config = buildConfig(); } catch (e: any) { return setMsg(`⚠ invalid JSON in a field: ${e.message}`); }
    try {
      if (f.id) await api.updateItem(f.id, f.suite, f.task_group.trim(), config);
      else await api.createItem(f.suite, f.task_group.trim(), config);
      setMsg("✓ saved"); setF({ ...blank, suite: f.suite, task_group: f.task_group });
      load(); onSaved?.();
    } catch (e: any) { setMsg(`⚠ ${e.message}`); }
  };

  const edit = (it: Item) => {
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
    setF(base); window.scrollTo(0, 0);
  };

  const del = async (id: number) => { await api.deleteItem(id); load(); };

  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="panel">
          <h2>{f.id ? `Edit test #${f.id}` : "Add a test"}</h2>

          <div className="row">
            {(cat?.suites ?? []).map((s) => (
              <span key={s.id} className={`chip ${f.suite === s.id ? "on" : ""}`} title={s.desc}
                onClick={() => set({ suite: s.id as Suite })}>{s.label}</span>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
            {cat?.suites.find((s) => s.id === f.suite)?.desc}
          </p>

          <div style={{ marginTop: 14 }}>
            <Label>Test group <span className="muted">(scores group by this; e.g. "my-emails")</span></Label>
            <input list="groups" value={f.task_group} onChange={(e) => set({ task_group: e.target.value })}
              placeholder="group name" style={{ width: "100%" }} />
            <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
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
              <div className="panel" style={{ marginTop: 12, background: "var(--bg)" }}>
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

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={save}>{f.id ? "Update test" : "Add test"}</button>
            {f.id && <button className="btn ghost" onClick={() => setF(blank)}>Cancel edit</button>}
            {msg && <span className={msg.startsWith("✓") ? "pass" : "fail"}>{msg}</span>}
          </div>
        </div>
      </div>

      <div className="panel" style={{ width: 320, flexShrink: 0 }}>
        <h2>Your tests ({items.length})</h2>
        {["deterministic", "agentic", "subjective"].map((suite) => {
          const rows = items.filter((i) => i.suite === suite);
          if (!rows.length) return null;
          return (
            <div key={suite} style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", margin: "6px 0" }}>{suite}</div>
              {rows.map((it) => {
                const c = JSON.parse(it.config);
                return (
                  <div key={it.id} style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
                    <div style={{ fontSize: 13 }}><b>{it.task_group}</b> <span className="muted">#{it.id}</span></div>
                    <div className="muted mono" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.prompt}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <button className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => edit(it)}>edit</button>
                      <button className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => del(it.id)}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Label({ children }: { children: any }) {
  return <div style={{ fontSize: 13, marginBottom: 4 }}>{children}</div>;
}
