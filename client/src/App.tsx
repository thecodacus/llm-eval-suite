import { useState } from "react";
import Models from "./pages/Models";
import RunPage from "./pages/Run";
import Results from "./pages/Results";
import Review from "./pages/Review";
import Guide from "./pages/Guide";
import Dashboard from "./pages/Dashboard";
import Build from "./pages/Build";
import { Icon } from "./icons";

type Tab = "guide" | "dashboard" | "run" | "results" | "build" | "models";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [reviewRun, setReviewRun] = useState<number | null>(null);
  const [guideGroup, setGuideGroup] = useState<string | null>(null);

  const go = (t: Tab) => { setReviewRun(null); setGuideGroup(null); setTab(t); };
  const openGuide = (group: string) => { setReviewRun(null); setGuideGroup(group); setTab("guide"); };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "run", label: "Run", icon: "play" },
    { id: "results", label: "Results", icon: "checks" },
    { id: "build", label: "Build", icon: "hammer" },
    { id: "models", label: "Models", icon: "server" },
    { id: "guide", label: "Guide", icon: "book" },
  ];

  return (
    <>
      <header className="top">
        <h1><span className="brand-badge"><Icon name="flask" size={20} /></span> LLM Eval Suite</h1>
        <nav className="row">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id && !reviewRun ? "active" : ""} onClick={() => go(t.id)}>
              <Icon name={t.icon} size={16} /> {t.label}
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
