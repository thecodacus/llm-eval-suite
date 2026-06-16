import { useEffect, useMemo, useState } from "react";
import { api, Item } from "../api";
import { SUITES, resolveGuide, explainItem } from "../guide";
import { Icon } from "../icons";

export default function Guide({ initialGroup, onClear }: { initialGroup?: string | null; onClear?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(initialGroup ?? null);

  useEffect(() => { api.items().then(setItems); }, []);
  useEffect(() => { if (initialGroup) setSelected(initialGroup); }, [initialGroup]);

  // group names present in the data, in a stable suite order
  const bySuite = useMemo(() => {
    const order = ["deterministic", "agentic", "subjective"];
    const map: Record<string, string[]> = {};
    for (const it of items) (map[it.suite] ||= []).push(it.task_group);
    for (const s of Object.keys(map)) map[s] = [...new Set(map[s])];
    return order.filter((s) => map[s]).map((s) => ({ suite: s, groups: map[s] }));
  }, [items]);

  if (selected) {
    return <Detail group={selected} items={items.filter((i) => i.task_group === selected)}
      onBack={() => { setSelected(null); onClear?.(); }} />;
  }

  return (
    <>
      <div className="panel">
        <h2>What these tests mean for you</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Each test maps to something you'd actually do with an AI. A high score on a test
          tells you the model is reliable at that real-world job — and if a test doesn't match
          how you'll use it, you can safely ignore its score. Click any test to read the details.
        </p>
      </div>

      {bySuite.map(({ suite, groups }) => {
        const sm = SUITES[suite];
        return (
          <div className="panel" key={suite}>
            <h2 className="sm"><Icon name={sm?.icon ?? "flask"} size={20} /> {sm?.label}</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>{sm?.blurb}</p>
            <div className="cards" style={{ marginTop: 14 }}>
              {groups.map((g) => {
                const gItems = items.filter((i) => i.task_group === g);
                const gg = resolveGuide(g, gItems);
                const n = gItems.length;
                return (
                  <div className="card" key={g} onClick={() => setSelected(g)}>
                    <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
                      <span className="icon-tile"><Icon name={gg.icon} size={22} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{gg.title}</div>
                        <div className="muted" style={{ fontSize: 12.5 }}>{gg.tagline}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, margin: "10px 0 8px" }}>{gg.whatItChecks}</div>
                    <div className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      {n} test{n === 1 ? "" : "s"} · read more <Icon name="chevron-right" size={13} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {!items.length && <div className="panel muted">Loading tests…</div>}
    </>
  );
}

function Detail({ group, items, onBack }: { group: string; items: Item[]; onBack: () => void }) {
  const gg = resolveGuide(group, items);
  const sm = SUITES[gg.suite];
  return (
    <>
      <div className="panel row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
          <span className="icon-tile" style={{ width: 52, height: 52 }}><Icon name={gg.icon} size={26} /></span>
          <div>
            <h2 className="sm" style={{ fontSize: 20, marginBottom: 2 }}>{gg.title}</h2>
            <div className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name={sm?.icon ?? "flask"} size={14} /> {sm?.label} · {gg.tagline}
            </div>
          </div>
        </div>
        <button className="btn ghost" onClick={onBack}><Icon name="chevron-right" size={15} style={{ transform: "rotate(180deg)" }} /> all tests</button>
      </div>

      <div className="panel">
        <h2 className="sm">What this test checks</h2>
        <p>{gg.whatItChecks}</p>
      </div>

      <div className="panel" style={{ borderLeft: "3px solid var(--green)", background: "var(--green-soft)" }}>
        <h2 className="sm"><Icon name="badge-check" style={{ color: "var(--green)" }} /> What a high score means for you</h2>
        <p style={{ fontSize: 15 }}>{gg.highScoreMeans}</p>
        {gg.examples.length > 0 && (
          <>
            <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>Real things this maps to:</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {gg.examples.map((e, i) => <li key={i} style={{ fontSize: 14 }}>{e}</li>)}
            </ul>
          </>
        )}
      </div>

      <div className="panel" style={{ borderLeft: "3px solid var(--accent)", background: "var(--accent-soft)" }}>
        <h2 className="sm"><Icon name="target" style={{ color: "var(--accent)" }} /> Is this score relevant to you?</h2>
        <p>{gg.relevance}</p>
      </div>

      <div className="panel">
        <h2 className="sm">The actual tests we run ({items.length})</h2>
        <p className="muted" style={{ fontSize: 13 }}>Exactly what the model is asked, and what counts as passing.</p>
        {items.map((it) => {
          const cfg = JSON.parse(it.config);
          const ex = explainItem(it.suite, cfg);
          return (
            <div key={it.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>We ask:</div>
              <pre style={{ fontSize: 13 }}>{ex.ask}</pre>
              <div style={{ fontSize: 13, marginTop: 8 }}><span className="pass">Passes when ·</span> <span className="muted">{ex.pass}</span></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
