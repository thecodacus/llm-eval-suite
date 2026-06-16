import { useEffect, useMemo, useState } from "react";
import { api, Item, Model, Suite } from "../api";

const SUITES: { id: Suite; label: string; blurb: string }[] = [
  { id: "deterministic", label: "Deterministic", blurb: "Auto-graded, high volume. Pass/fail, no judge." },
  { id: "agentic", label: "Agentic", blurb: "Skill + exact format + real curl to a local API, verified." },
  { id: "subjective", label: "Subjective", blurb: "You judge, blinded side-by-side. No scoring." },
];

export default function Run({ onStarted }: { onStarted: () => void }) {
  const [models, setModels] = useState<Model[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suite, setSuite] = useState<Suite>("deterministic");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.models().then(setModels); }, []);
  useEffect(() => { api.items(suite).then((it) => { setItems(it); setGroups(new Set()); }); }, [suite]);

  const allGroups = useMemo(() => [...new Set(items.map((i) => i.task_group))], [items]);
  const selectedItems = items.filter((i) => !groups.size || groups.has(i.task_group));

  const toggle = (set: Set<string>, k: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); fn(n);
  };

  const start = async () => {
    if (!picked.size) return alert("pick at least one model");
    setBusy(true);
    try {
      await api.startRun(suite, [...picked], groups.size ? [...groups] : undefined);
      onStarted();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel">
        <h2>1 · Suite</h2>
        <div className="row">
          {SUITES.map((s) => (
            <div key={s.id} className={`chip ${suite === s.id ? "on" : ""}`} onClick={() => setSuite(s.id)} style={{ flexDirection: "column", alignItems: "flex-start", padding: "8px 14px" }}>
              <b>{s.label}</b><span className="muted" style={{ fontSize: 12 }}>{s.blurb}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>2 · Models</h2>
        {models.length === 0 && <p className="muted">No models yet — add some in the Models tab.</p>}
        <div className="row">
          {models.map((m) => (
            <span key={m.id} className={`chip ${picked.has(m.id) ? "on" : ""}`} onClick={() => toggle(picked, m.id, setPicked)}>
              {picked.has(m.id) ? "✓ " : ""}{m.id}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>3 · Task groups <span className="muted">({selectedItems.length} items)</span></h2>
        <div className="row">
          {allGroups.map((g) => (
            <span key={g} className={`chip ${groups.has(g) ? "on" : ""}`} onClick={() => toggle(groups, g, setGroups)}>{g}</span>
          ))}
          {!allGroups.length && <span className="muted">no items for this suite</span>}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          None selected = run all groups. New here? The <b>Guide</b> tab explains what each test means for you.
        </p>
      </div>

      <button className="btn" disabled={busy || !picked.size || !selectedItems.length} onClick={start}>
        {busy ? "Starting…" : `Run ${suite} · ${picked.size} model(s) × ${selectedItems.length} items`}
      </button>
    </>
  );
}
