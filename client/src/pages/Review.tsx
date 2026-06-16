import { useEffect, useState } from "react";
import { api } from "../api";

interface Card { label: string; modelId: string; output: string; tokPerS: number | null; }
interface Block { itemId: number; prompt: string; note: string; cards: Card[]; }

export default function Review({ runId, onBack }: { runId: number; onBack: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [picks, setPicks] = useState<Record<number, { winner: string; notes: string }>>({});

  useEffect(() => {
    api.review(runId).then(({ blocks, verdicts }) => {
      setBlocks(blocks);
      const p: Record<number, { winner: string; notes: string }> = {};
      for (const v of verdicts) p[v.item_id] = { winner: v.winner_model_id, notes: v.notes };
      setPicks(p);
    });
  }, [runId]);

  const choose = async (b: Block, modelId: string) => {
    const next = { ...picks, [b.itemId]: { winner: modelId, notes: picks[b.itemId]?.notes ?? "" } };
    setPicks(next);
    await api.saveVerdict(runId, b.itemId, modelId, next[b.itemId].notes);
  };
  const note = async (b: Block, notes: string) => {
    const next = { ...picks, [b.itemId]: { winner: picks[b.itemId]?.winner ?? "", notes } };
    setPicks(next);
    await api.saveVerdict(runId, b.itemId, next[b.itemId].winner || null, notes);
  };

  const judged = Object.values(picks).filter((p) => p.winner).length;

  return (
    <>
      <div className="panel row" style={{ justifyContent: "space-between" }}>
        <h2>Blinded review · run #{runId} <span className="muted">— names hidden until you pick</span></h2>
        <div className="row">
          <span className="muted">{judged}/{blocks.length} judged</span>
          <button className="btn ghost" onClick={onBack}>← back</button>
        </div>
      </div>

      {blocks.map((b) => {
        const pick = picks[b.itemId];
        return (
          <div className="panel" key={b.itemId}>
            <pre style={{ marginBottom: 6 }}>{b.prompt}</pre>
            {b.note && <p className="muted" style={{ fontSize: 13 }}>Judge on: {b.note}</p>}
            <div className="cards">
              {b.cards.map((c) => {
                const won = pick?.winner === c.modelId;
                return (
                  <div key={c.label} className={`card ${won ? "win" : ""}`} onClick={() => choose(b, c.modelId)}>
                    <b>{c.label}</b>{c.tokPerS ? <span className="muted"> · {c.tokPerS.toFixed(1)} t/s</span> : null}
                    <pre className="out">{c.output}</pre>
                    {pick && <div className="reveal">= {c.modelId}</div>}
                  </div>
                );
              })}
            </div>
            <textarea placeholder="notes (optional)…" style={{ width: "100%", marginTop: 10 }}
              value={pick?.notes ?? ""} onChange={(e) => note(b, e.target.value)} />
          </div>
        );
      })}
    </>
  );
}
