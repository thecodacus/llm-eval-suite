export interface ModelRow {
  id: string;
  base_url: string;
  model: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  timeout_s: number;
  thinking: number; // 0/1
}

export type Suite = "deterministic" | "agentic" | "subjective";

export interface ItemRow {
  id: number;
  suite: Suite;
  task_group: string; // "math", "code", "notify", "write", ...
  config: string;     // JSON blob; shape depends on suite (see eval modules)
}

export interface RunRow {
  id: number;
  created_at: string;
  suite: Suite;
  status: "running" | "done" | "error";
  model_ids: string;  // JSON array
}

export interface ResultRow {
  id: number;
  run_id: number;
  model_id: string;
  item_id: number;
  task_group: string;
  passed: number | null;   // null for subjective
  detail: string;
  output: string;
  tok_per_s: number | null;
  total_s: number | null;
}

export interface Completion {
  text: string;
  totalS: number;
  promptTokens: number | null;
  completionTokens: number | null;
  tokPerS: number | null;
  error?: string;
}
