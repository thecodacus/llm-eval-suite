import { useState } from "react";
import Models from "./pages/Models";
import RunPage from "./pages/Run";
import Results from "./pages/Results";
import Review from "./pages/Review";

type Tab = "run" | "results" | "models";

export default function App() {
  const [tab, setTab] = useState<Tab>("run");
  // Review is opened from Results with a runId; null = not reviewing
  const [reviewRun, setReviewRun] = useState<number | null>(null);

  return (
    <>
      <header className="top">
        <h1>🧪 LLM Eval Suite</h1>
        <nav className="row">
          {(["run", "results", "models"] as Tab[]).map((t) => (
            <button key={t} className={tab === t && !reviewRun ? "active" : ""}
              onClick={() => { setReviewRun(null); setTab(t); }}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {reviewRun ? (
          <Review runId={reviewRun} onBack={() => setReviewRun(null)} />
        ) : tab === "run" ? (
          <RunPage onStarted={() => setTab("results")} />
        ) : tab === "results" ? (
          <Results onReview={(id) => setReviewRun(id)} />
        ) : (
          <Models />
        )}
      </main>
    </>
  );
}
