// Server-side benchmark importer. Pulls hard public benchmarks from HuggingFace's
// dataset-viewer HTTP API at runtime (not baked into the repo — respects dataset
// licenses) and converts rows into test items. Backs POST /api/import.

const VIEWER = "https://datasets-server.huggingface.co/rows";
const SIZE = "https://datasets-server.huggingface.co/size";
const LETTERS = "ABCDEFGHIJ";

type Row = Record<string, any>;
export interface ImportItem { suite: "deterministic"; task_group: string; config: any; }

async function fetchRows(dataset: string, config: string, split: string, limit: number, offset = 0): Promise<Row[]> {
  const out: Row[] = [];
  while (out.length < limit) {
    const n = Math.min(100, limit - out.length);
    const qs = new URLSearchParams({ dataset, config, split, offset: String(offset + out.length), length: String(n) });
    const res = await fetch(`${VIEWER}?${qs}`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`HF dataset-viewer ${res.status} for ${dataset}`);
    const batch = ((await res.json()) as any).rows ?? [];
    if (!batch.length) break;
    out.push(...batch.map((b: any) => b.row));
  }
  return out.slice(0, limit);
}

async function fetchSize(dataset: string, config: string, split: string): Promise<number> {
  try {
    const res = await fetch(`${SIZE}?${new URLSearchParams({ dataset, config, split })}`, { signal: AbortSignal.timeout(30000) });
    const splits = ((await res.json()) as any)?.size?.splits ?? [];
    return (splits.find((x: any) => x.split === split) ?? splits[0])?.num_rows ?? 0;
  } catch { return 0; }
}

// Some datasets (MMLU-Pro) are ordered by category, so a first-N slice is all one
// domain. Spread the sample across the whole dataset for real diversity.
async function fetchStratified(dataset: string, config: string, split: string, limit: number): Promise<Row[]> {
  const total = await fetchSize(dataset, config, split);
  if (!total || total <= limit) return fetchRows(dataset, config, split, limit);
  const windows = Math.min(limit, 20);
  const per = Math.ceil(limit / windows);
  const out: Row[] = [];
  for (let i = 0; i < windows && out.length < limit; i++) {
    out.push(...(await fetchRows(dataset, config, split, per, Math.floor((i * total) / windows))));
  }
  return out.slice(0, limit);
}

function aimeItem(row: Row, i: number): ImportItem {
  return {
    suite: "deterministic", task_group: "aime-2025",
    config: {
      prompt: row.problem + "\n\nSolve the problem. The answer is an integer. Show your reasoning, then end your reply with '#### <integer>'.",
      answer: String(row.answer).trim(), extractor: "boxed", grader: "numeric", thinking: true,
      _import: `aime2025-${i}`,
      _guide: { title: "AIME olympiad math (2025)", highScoreMeans: "Competition-level math with an exact integer answer — brutal multi-step reasoning that separates real reasoning models from the rest. 2025 = low contamination, and quantization tends to break this first." },
    },
  };
}

function gpqaItem(row: Row, i: number): ImportItem {
  return {
    suite: "deterministic", task_group: "gpqa-diamond",
    config: {
      prompt: row.question + "\n\nPick the single best option from the final A/B/C/D list above. Think it through, then end your reply with 'Answer: X' where X is that CAPITAL letter (A, B, C, or D).",
      answer: String(row.answer).trim().toUpperCase(), extractor: "mc_letter", grader: "exact", thinking: true,
      _import: `gpqa-${i}`,
      _guide: { title: "GPQA Diamond — PhD-level science", highScoreMeans: "Graduate-level bio/physics/chem questions that stump non-expert humans even with Google. Deep reasoning, not recall — a sharp yardstick for how much a quant degrades." },
    },
  };
}

function mmluProItem(row: Row, i: number): ImportItem {
  const opts = (row.options as any[]).map((o, j) => `${LETTERS[j]}. ${o}`).join("\n");
  return {
    suite: "deterministic", task_group: "mmlu-pro",
    config: {
      prompt: `${row.question}\n\n${opts}\n\nThink it through, then end your reply with 'Answer: <letter>'.`,
      answer: String(row.answer).trim().toUpperCase(), extractor: "mc_letter", grader: "exact", thinking: true,
      _import: `mmlupro-${row.question_id ?? i}`,
      _guide: { title: "MMLU-Pro — hard reasoning MCQ", highScoreMeans: "10-option, reasoning-heavy questions across many domains — far harder than plain MMLU, with real distractor pressure. Sampled across all domains." },
    },
  };
}

const ADAPTERS: Record<string, { dataset: string; config: string; split: string; convert: (r: Row, i: number) => ImportItem; defaultLimit: number; stratified?: boolean }> = {
  aime: { dataset: "yentinglin/aime_2025", config: "default", split: "train", convert: aimeItem, defaultLimit: 30 },
  gpqa: { dataset: "fingertap/GPQA-Diamond", config: "default", split: "test", convert: gpqaItem, defaultLimit: 198 },
  mmlu_pro: { dataset: "TIGER-Lab/MMLU-Pro", config: "default", split: "test", convert: mmluProItem, defaultLimit: 100, stratified: true },
};

export const IMPORT_CATALOG = Object.entries(ADAPTERS).map(([id, a]) => ({ id, dataset: a.dataset, defaultLimit: a.defaultLimit }));

export async function importBenchmark(key: string, opts: { limit?: number; offset?: number } = {}): Promise<ImportItem[]> {
  const a = ADAPTERS[key];
  if (!a) throw new Error(`unknown benchmark '${key}'`);
  const limit = opts.limit ?? a.defaultLimit;
  const rows = a.stratified
    ? await fetchStratified(a.dataset, a.config, a.split, limit)
    : await fetchRows(a.dataset, a.config, a.split, limit, opts.offset ?? 0);
  return rows.map((r, i) => a.convert(r, i));
}
