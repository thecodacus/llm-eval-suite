import { Fragment, useEffect, useState } from "react";
import { api, LbRow, Result, Run } from "../api";
import { Icon } from "../icons";

const PassMark = ({ p }: { p: number | null }) =>
  p == null ? <Icon name="palette" size={15} className="muted" />
    : p ? <Icon name="check" size={16} style={{ color: "var(--green)" }} />
        : <Icon name="x" size={16} style={{ color: "var(--red)" }} />;

export default function Results({ onReview, onExplain }: { onReview: (id: number) => void; onExplain: (group: string) => void }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const promptOf = (r: Result) => { try { return r.item_config ? JSON.parse(r.item_config).prompt : ""; } catch { return ""; } };

  const removeRun = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete run #${id}? Its results are removed permanently.`)) return;
    await api.deleteRun(id);
    const next = runs.filter((r) => r.id !== id);
    setRuns(next);
    if (sel === id) {
      if (next.length) setSel(next[0].id);
      else { setSel(null); setRun(null); setResults([]); setLb([]); }
    }
  };

  useEffect(() => { api.runs().then((r) => { setRuns(r); if (!sel && r.length) setSel(r[0].id); }); }, []);

  // poll the selected run while it's running
  useEffect(() => {
    if (sel == null) return;
    let stop = false;
    const tick = async () => {
      const { run, results } = await api.run(sel);
      if (stop) return;
      setRun(run); setResults(results);
      if (run.suite !== "subjective") setLb(await api.leaderboard(sel).catch(() => []));
      if (run.status === "running") setTimeout(tick, 1500);
      else api.runs().then(setRuns);
    };
    tick();
    return () => { stop = true; };
  }, [sel]);

  const models = run ? [...new Set(results.map((r) => r.model_id))] : [];
  const groups = run ? [...new Set(results.map((r) => r.task_group))] : [];
  const cell = (m: string, g: string) => lb.find((x) => x.model_id === m && x.task_group === g);

  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
      <div className="panel" style={{ width: 240, flexShrink: 0 }}>
        <h2>Runs</h2>
        {runs.map((r) => (
          <div key={r.id} className={`chip ${sel === r.id ? "on" : ""}`} style={{ display: "flex", width: "100%", marginBottom: 6, gap: 6, alignItems: "center" }} onClick={() => setSel(r.id)}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{r.id} {r.suite}</span>
            <span className={r.status === "done" ? "pass" : r.status === "error" ? "fail" : "muted"}>{r.status}</span>
            <button title="Delete run" onClick={(e) => removeRun(r.id, e)}
              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", display: "inline-flex", padding: 2 }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
        {!runs.length && <p className="muted">No runs yet.</p>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!run ? <div className="panel muted">Select a run.</div> : (
          <>
            <div className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>Run #{run.id} · {run.suite} · <span className={run.status === "running" ? "muted" : "pass"}>{run.status}</span></h2>
                {run.suite === "subjective" && <button className="btn" onClick={() => onReview(run.id)}><Icon name="eye" size={15} /> Open blinded review</button>}
              </div>
              <p className="muted" style={{ fontSize: 13 }}>{new Date(run.created_at).toLocaleString()}</p>
            </div>

            {run.suite !== "subjective" && lb.length > 0 && (
              <div className="panel">
                <h2>Leaderboard (pass% · tok/s)</h2>
                <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
                  Click a test name to learn what it measures and whether the score matters for you.
                </p>
                <table>
                  <thead><tr><th>model</th>{groups.map((g) => (
                    <th key={g}><a style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }} title="What does this test mean?" onClick={() => onExplain(g)}>{g} <Icon name="info" size={12} /></a></th>
                  ))}<th>overall</th></tr></thead>
                  <tbody>
                    {models.map((m) => {
                      const rows = lb.filter((x) => x.model_id === m);
                      const p = rows.reduce((a, x) => a + x.pass, 0), n = rows.reduce((a, x) => a + x.n, 0);
                      return (
                        <tr key={m}>
                          <td>{m}</td>
                          {groups.map((g) => { const c = cell(m, g); return (
                            <td key={g}>{c ? <span className={c.pct >= 50 ? "pass" : "fail"}>{c.pct}% <span className="muted">({c.pass}/{c.n}{c.avg_tok_s ? ` · ${c.avg_tok_s}t/s` : ""})</span></span> : "—"}</td>
                          ); })}
                          <td><b>{n ? Math.round((1000 * p) / n) / 10 : 0}%</b></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="panel">
              <h2>Results / logs ({results.length})</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Click any row to see the exact prompt, the model's full output, and why it passed or failed.</p>
              <table>
                <thead><tr><th></th><th>model</th><th>group</th><th>detail</th><th>tok/s</th><th>sec</th></tr></thead>
                <tbody>
                  {results.map((r) => (
                    <Fragment key={r.id}>
                      <tr style={{ cursor: "pointer" }} onClick={() => toggle(r.id)}>
                        <td><PassMark p={r.passed} /></td>
                        <td>{r.model_id}</td>
                        <td>{r.task_group}</td>
                        <td className="mono muted" style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.detail}>
                          <Icon name={open.has(r.id) ? "chevron-down" : "chevron-right"} size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{r.detail}</td>
                        <td className="muted">{r.tok_per_s ? r.tok_per_s.toFixed(1) : "—"}</td>
                        <td className="muted">{r.total_s ? r.total_s.toFixed(1) : "—"}</td>
                      </tr>
                      {open.has(r.id) && (
                        <tr>
                          <td colSpan={6} style={{ background: "var(--bg)" }}>
                            {promptOf(r) && (<><div className="muted" style={{ fontSize: 12 }}>Prompt</div><pre className="mono" style={{ fontSize: 12, marginBottom: 8 }}>{promptOf(r)}</pre></>)}
                            <div className="muted" style={{ fontSize: 12 }}>{r.passed == null ? "Result" : r.passed ? "Passed because" : "Failed because"}</div>
                            <pre className="mono" style={{ fontSize: 12, marginBottom: 8, color: r.passed === 0 ? "var(--red)" : "var(--text)" }}>{r.detail || "—"}</pre>
                            <div className="muted" style={{ fontSize: 12 }}>Model output</div>
                            <pre className="mono" style={{ fontSize: 12, maxHeight: 300, overflow: "auto" }}>{r.output || "(empty)"}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
