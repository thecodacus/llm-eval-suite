import { useEffect, useMemo, useState } from "react";
import { api, Dashboard as DashboardData } from "../api";
import { groupGuide } from "../guide";
import { Icon } from "../icons";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ZAxis, Cell, LabelList,
} from "recharts";

const PALETTE = ["#00bcd4", "#7c8cf8", "#34d399", "#f2994a", "#bb6bd9", "#56ccf2", "#ff6b9d", "#ffd166"];
const axis = { fill: "#9aa1ab", fontSize: 12 };
const GRID = "#333333";
const AXIS_LINE = "#3a3a3a";

export default function Dashboard({ onExplain }: { onExplain: (group: string) => void }) {
  const [d, setD] = useState<DashboardData | null>(null);

  useEffect(() => { api.dashboard().then(setD).catch(console.error); }, []);

  const models = useMemo(() => (d ? d.byModel.map((m) => m.model_id) : []), [d]);
  const colorOf = (id: string) => PALETTE[Math.max(0, models.indexOf(id)) % PALETTE.length];
  const groups = useMemo(() => (d ? [...new Set(d.byModelGroup.map((x) => x.task_group))] : []), [d]);
  const cell = (m: string, g: string) => d?.byModelGroup.find((x) => x.model_id === m && x.task_group === g);

  if (!d) return <div className="panel muted">Loading…</div>;
  if (!d.totals.graded_results) {
    return (
      <div className="panel">
        <h2>No scores yet</h2>
        <p className="muted">Run a deterministic or agentic suite from the <b>Run</b> tab — charts appear here once there are graded results.</p>
      </div>
    );
  }

  const bubble = d.byModel.filter((m) => m.avg_tok_s != null).map((m) => ({
    x: m.avg_tok_s, y: m.pct, z: m.n, name: m.model_id,
  }));

  // per-group rows for the small-multiples ("score by model" for each group)
  const perGroup = groups.map((g) => ({
    group: g,
    rows: models.map((m) => cell(m, g)).filter(Boolean) as NonNullable<ReturnType<typeof cell>>[],
  })).filter((x) => x.rows.length);

  return (
    <>
      <div className="row" style={{ gap: 12, marginBottom: 4 }}>
        <Stat label="Models scored" value={d.byModel.length} />
        <Stat label="Test types" value={groups.length} />
        <Stat label="Graded results" value={d.totals.graded_results} />
        <Stat label="Runs recorded" value={d.totals.runs} />
      </div>

      <div className="panel">
        <h2 className="sm"><Icon name="trophy" /> Overall score by model</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Pass rate across all auto-graded tests recorded so far.</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={d.byModel} margin={{ left: 0, right: 10, top: 18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis type="category" dataKey="model_id" tick={axis} stroke={AXIS_LINE} interval={0} />
            <YAxis type="number" domain={[0, 100]} tick={axis} stroke={AXIS_LINE} unit="%" />
            <Tooltip {...tt} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: any, _n, p: any) => [`${v}%  (${p.payload.pass}/${p.payload.n})`, "pass"]} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={90} isAnimationActive={false}>
              {d.byModel.map((m) => <Cell key={m.model_id} fill={colorOf(m.model_id)} />)}
              <LabelList dataKey="pct" position="top" fill="#ececec" fontSize={12} formatter={(v: any) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2 className="sm"><Icon name="gauge" /> Speed vs. score</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Top-right is best: fast <i>and</i> accurate. Bubble size = number of tests. Each bubble is a model.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 20 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis type="number" dataKey="x" name="speed" unit=" t/s" tick={axis} stroke={GRID}
              label={{ value: "tokens / sec  →  faster", position: "insideBottom", offset: -10, fill: "#7d8590", fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name="score" unit="%" domain={[0, 100]} tick={axis} stroke={GRID}
              label={{ value: "pass %", angle: -90, position: "insideLeft", fill: "#7d8590", fontSize: 12 }} />
            <ZAxis type="number" dataKey="z" range={[80, 700]} name="tests" />
            <Tooltip {...tt} cursor={{ strokeDasharray: "3 3" }}
              formatter={(v: any, n: any) => [n === "speed" ? `${v} t/s` : n === "score" ? `${v}%` : v, n]}
              labelFormatter={() => ""} />
            <Scatter data={bubble} isAnimationActive={false}>
              {bubble.map((b) => <Cell key={b.name} fill={colorOf(b.name)} fillOpacity={0.8} />)}
              <LabelList dataKey="name" position="top" fill="#ececec" fontSize={11} fontWeight={500} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2 className="sm"><Icon name="chart" /> Hardest tests (lowest pass rate)</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Averaged across all models — shows where models struggle. Click a bar's test in the table below to learn what it means.</p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={[...d.byGroup].sort((a, b) => a.pct - b.pct)} margin={{ left: 0, right: 10, top: 18, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis type="category" dataKey="task_group" tick={{ ...axis, fontSize: 11 }} stroke={AXIS_LINE} interval={0} angle={-40} textAnchor="end" height={70} />
            <YAxis type="number" domain={[0, 100]} tick={axis} stroke={AXIS_LINE} unit="%" />
            <Tooltip {...tt} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: any) => [`${v}%`, "pass"]} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} fill="#56ccf2" maxBarSize={48} isAnimationActive={false}>
              <LabelList dataKey="pct" position="top" fill="#ececec" fontSize={11} formatter={(v: any) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2 className="sm"><Icon name="chart" /> Score by model — per test group</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>One chart per group. Click a title for what the test means.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginTop: 12 }}>
          {perGroup.map(({ group, rows }) => (
            <div key={group} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 12px 6px" }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <a style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }} onClick={() => onExplain(group)} title={groupGuide(group).title}>{group}</a>
                <span className="muted" style={{ fontSize: 11 }}>{rows[0]?.n} items</span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={rows} margin={{ left: -22, right: 4, top: 14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="model_id" tick={{ ...axis, fontSize: 10 }} stroke={AXIS_LINE} interval={0} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ ...axis, fontSize: 10 }} stroke={AXIS_LINE} width={30} unit="%" />
                  <Tooltip {...tt} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: any, _n, p: any) => [`${v}%  (${p.payload.pass}/${p.payload.n})`, "pass"]} />
                  <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                    {rows.map((r) => <Cell key={r.model_id} fill={colorOf(r.model_id)} />)}
                    <LabelList dataKey="pct" position="top" fill="#ececec" fontSize={10} formatter={(v: any) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2 className="sm"><Icon name="dashboard" /> Score heatmap (model × test)</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Greener = higher pass rate. Click a test name for what it means.</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>model</th>{groups.map((g) => (
              <th key={g}><a style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={() => onExplain(g)} title={groupGuide(g).title}>{g} <Icon name="info" size={12} /></a></th>
            ))}</tr></thead>
            <tbody>
              {models.map((m) => (
                <tr key={m}>
                  <td style={{ fontWeight: 500 }}>{m}</td>
                  {groups.map((g) => {
                    const c = cell(m, g);
                    return (
                      <td key={g} style={c ? { background: `rgba(52,211,153,${(c.pct / 100) * 0.82 + 0.06})`, textAlign: "center", color: c.pct > 48 ? "#06281c" : "#ececec", fontWeight: 600, borderRadius: 6 } : { textAlign: "center" }}
                        title={c ? `${c.pass}/${c.n}${c.avg_tok_s ? ` · ${c.avg_tok_s} t/s` : ""}` : "no data"}>
                        {c ? `${c.pct}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const tt = {
  contentStyle: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#ececec", fontFamily: "JetBrains Mono, monospace", fontSize: 12 },
  labelStyle: { color: "#ececec" },
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel" style={{ flex: 1, minWidth: 120, margin: 0, textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
