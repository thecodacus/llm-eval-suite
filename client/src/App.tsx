import { useState } from "react";
import Models from "./pages/Models";
import RunPage from "./pages/Run";
import Results from "./pages/Results";
import Review from "./pages/Review";
import Guide from "./pages/Guide";
import Dashboard from "./pages/Dashboard";
import Build from "./pages/Build";

type Tab = "guide" | "dashboard" | "run" | "results" | "build" | "models";

export default function App() {
  const [tab, setTab] = useState<Tab>("guide");
  const [reviewRun, setReviewRun] = useState<number | null>(null);
  const [guideGroup, setGuideGroup] = useState<string | null>(null);

  const go = (t: Tab) => { setReviewRun(null); setGuideGroup(null); setTab(t); };
  const openGuide = (group: string) => { setReviewRun(null); setGuideGroup(group); setTab("guide"); };

  const LABELS: Record<Tab, string> = {
    guide: "Guide", dashboard: "Dashboard", run: "Run", results: "Results", build: "Build", models: "Models",
  };

  return (
    <>
      <header className="top">
        <h1>🧪 LLM Eval Suite</h1>
        <nav className="row">
          {(["guide", "dashboard", "run", "results", "build", "models"] as Tab[]).map((t) => (
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
        ) : tab === "dashboard" ? (
          <Dashboard onExplain={openGuide} />
        ) : tab === "run" ? (
          <RunPage onStarted={() => setTab("results")} />
        ) : tab === "results" ? (
          <Results onReview={(id) => setReviewRun(id)} onExplain={openGuide} />
        ) : tab === "build" ? (
          <Build />
        ) : (
          <Models />
        )}
      </main>
    </>
  );
}
