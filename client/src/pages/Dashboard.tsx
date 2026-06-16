import { useEffect, useMemo, useState } from "react";
import { api, Dashboard as DashboardData } from "../api";
import { groupGuide } from "../guide";
import { Icon } from "../icons";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ZAxis, Cell, LabelList,
} from "recharts";

const PALETTE = ["#eb5757", "#2d9cdb", "#27ae60", "#9b51e0", "#f2994a", "#56ccf2", "#bb6bd9", "#eb9757"];
const axis = { fill: "#8a92a6", fontSize: 12 };
const GRID = "#dde3ec";
const AXIS_LINE = "#cdd5e1";

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
        <ResponsiveContainer width="100%" height={Math.max(140, d.byModel.length * 46)}>
          <BarChart data={d.byModel} layout="vertical" margin={{ left: 20, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={axis} stroke={GRID} unit="%" />
            <YAxis type="category" dataKey="model_id" tick={axis} stroke={GRID} width={110} />
            <Tooltip {...tt} formatter={(v: any, _n, p: any) => [`${v}%  (${p.payload.pass}/${p.payload.n})`, "pass"]} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {d.byModel.map((m) => <Cell key={m.model_id} fill={colorOf(m.model_id)} />)}
              <LabelList dataKey="pct" position="right" fill="#2c2c2c" fontSize={12} formatter={(v: any) => `${v}%`} />
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
            <Scatter data={bubble}>
              {bubble.map((b) => <Cell key={b.name} fill={colorOf(b.name)} fillOpacity={0.8} />)}
              <LabelList dataKey="name" position="top" fill="#2c2c2c" fontSize={11} fontWeight={500} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2 className="sm"><Icon name="chart" /> Hardest tests (lowest pass rate)</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Averaged across all models — shows where models struggle. Click a bar's test in the table below to learn what it means.</p>
        <ResponsiveContainer width="100%" height={Math.max(140, d.byGroup.length * 40)}>
          <BarChart data={[...d.byGroup].sort((a, b) => a.pct - b.pct)} layout="vertical" margin={{ left: 20, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={axis} stroke={GRID} unit="%" />
            <YAxis type="category" dataKey="task_group" tick={axis} stroke={GRID} width={90} />
            <Tooltip {...tt} formatter={(v: any) => [`${v}%`, "pass"]} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} fill="#39c5cf">
              <LabelList dataKey="pct" position="right" fill="#2c2c2c" fontSize={12} formatter={(v: any) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
                      <td key={g} style={c ? { background: `rgba(39,174,96,${(c.pct / 100) * 0.8 + 0.08})`, textAlign: "center", color: c.pct > 55 ? "#fff" : "#2c2c2c", fontWeight: 600, borderRadius: 8 } : { textAlign: "center" }}
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
  contentStyle: { background: "#fff", border: "1px solid #dde3ec", borderRadius: 12, color: "#2c2c2c", boxShadow: "0 8px 24px -8px rgba(45,44,44,0.18)" },
  labelStyle: { color: "#2c2c2c" },
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel" style={{ flex: 1, minWidth: 120, margin: 0, textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
