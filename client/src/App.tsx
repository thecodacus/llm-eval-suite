import { useState } from "react";
import Models from "./pages/Models";
import RunPage from "./pages/Run";
import Results from "./pages/Results";
import Review from "./pages/Review";
import Guide from "./pages/Guide";

type Tab = "run" | "results" | "guide" | "models";

export default function App() {
  const [tab, setTab] = useState<Tab>("guide");
  const [reviewRun, setReviewRun] = useState<number | null>(null);
  // when opening the guide deep-linked to a specific test group (from the leaderboard)
  const [guideGroup, setGuideGroup] = useState<string | null>(null);

  const go = (t: Tab) => { setReviewRun(null); setGuideGroup(null); setTab(t); };
  const openGuide = (group: string) => { setReviewRun(null); setGuideGroup(group); setTab("guide"); };

  const LABELS: Record<Tab, string> = { run: "Run", results: "Results", guide: "Guide", models: "Models" };

  return (
    <>
      <header className="top">
        <h1>🧪 LLM Eval Suite</h1>
        <nav className="row">
          {(["guide", "run", "results", "models"] as Tab[]).map((t) => (
            <button key={t} className={tab === t && !reviewRun ? "active" : ""} onClick={() => go(t)}>
              {LABELS[t]}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {reviewRun ? (
          <Review runId={reviewRun} onBack={() => setReviewRun(null)} />
        ) : tab === "guide" ? (
          <Guide initialGroup={guideGroup} onClear={() => setGuideGroup(null)} />
        ) : tab === "run" ? (
          <RunPage onStarted={() => setTab("results")} />
        ) : tab === "results" ? (
          <Results onReview={(id) => setReviewRun(id)} onExplain={openGuide} />
        ) : (
          <Models />
        )}
      </main>
    </>
  );
}
