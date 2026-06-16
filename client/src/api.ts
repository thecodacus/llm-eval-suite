export type Suite = "deterministic" | "agentic" | "subjective";

export interface Model {
  id: string;
  base_url: string;
  model: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  timeout_s: number;
  thinking: number;
}
export interface Item { id: number; suite: Suite; task_group: string; config: string; }
export interface Run { id: number; created_at: string; suite: Suite; status: string; model_ids: string; }
export interface Result {
  id: number; run_id: number; model_id: string; item_id: number; task_group: string;
  passed: number | null; detail: string; output: string; tok_per_s: number | null; total_s: number | null;
  item_config?: string;
}
export interface LbRow { model_id: string; task_group: string; pass: number; n: number; pct: number; avg_tok_s: number | null; }

export interface Catalog {
  suites: { id: string; label: string; desc: string }[];
  extractors: { id: string; label: string; desc: string }[];
  graders: { id: string; label: string; desc: string; answerHint: string; answerType: string; suggestExtractor: string }[];
}
export interface Dashboard {
  byModel: { model_id: string; pass: number; n: number; pct: number; avg_tok_s: number | null }[];
  byModelGroup: { model_id: string; task_group: string; pass: number; n: number; pct: number; avg_tok_s: number | null }[];
  byGroup: { task_group: string; pct: number; n: number }[];
  totals: { runs: number; graded_results: number };
}

async function j<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  models: () => j<Model[]>("/api/models"),
  saveModel: (m: Partial<Model>) => j("/api/models", { method: "POST", body: JSON.stringify(m) }),
  deleteModel: (id: string) => j(`/api/models/${id}`, { method: "DELETE" }),
  items: (suite?: Suite) => j<Item[]>(`/api/items${suite ? `?suite=${suite}` : ""}`),
  catalog: () => j<Catalog>("/api/catalog"),
  createItem: (suite: Suite, task_group: string, config: any) =>
    j<{ id: number }>("/api/items", { method: "POST", body: JSON.stringify({ suite, task_group, config }) }),
  updateItem: (id: number, suite: Suite, task_group: string, config: any) =>
    j(`/api/items/${id}`, { method: "PUT", body: JSON.stringify({ suite, task_group, config }) }),
  deleteItem: (id: number) => j(`/api/items/${id}`, { method: "DELETE" }),
  dashboard: () => j<Dashboard>("/api/dashboard"),
  startRun: (suite: Suite, modelIds: string[], taskGroups?: string[]) =>
    j<{ runId: number }>("/api/runs", { method: "POST", body: JSON.stringify({ suite, modelIds, taskGroups }) }),
  runs: () => j<Run[]>("/api/runs"),
  deleteRun: (id: number) => j(`/api/runs/${id}`, { method: "DELETE" }),
  run: (id: number) => j<{ run: Run; results: Result[] }>(`/api/runs/${id}`),
  leaderboard: (id: number) => j<LbRow[]>(`/api/runs/${id}/leaderboard`),
  review: (id: number) => j<{ blocks: any[]; verdicts: any[] }>(`/api/runs/${id}/review`),
  saveVerdict: (id: number, itemId: number, winnerModelId: string | null, notes: string) =>
    j(`/api/runs/${id}/verdicts`, { method: "POST", body: JSON.stringify({ itemId, winnerModelId, notes }) }),
};
