import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seedModels, seedItems } from "./seed.js";
import { seedPackItems } from "./seed-pack.js";

const DB_PATH = process.env.DB_PATH || "/data/evals.db";

mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT 'not-needed',
  temperature REAL NOT NULL DEFAULT 0,
  max_tokens INTEGER NOT NULL DEFAULT 2048,
  timeout_s INTEGER NOT NULL DEFAULT 180,
  thinking INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suite TEXT NOT NULL,
  task_group TEXT NOT NULL,
  config TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  suite TEXT NOT NULL,
  status TEXT NOT NULL,
  model_ids TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  task_group TEXT NOT NULL,
  passed INTEGER,
  detail TEXT NOT NULL DEFAULT '',
  output TEXT NOT NULL DEFAULT '',
  tok_per_s REAL,
  total_s REAL
);
CREATE TABLE IF NOT EXISTS verdicts (
  run_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  winner_model_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
`);

// First-boot seed
const haveModels = (db.prepare("SELECT count(*) c FROM models").get() as any).c;
if (!haveModels) {
  const im = db.prepare(
    "INSERT INTO models (id,base_url,model,api_key,temperature,max_tokens,timeout_s,thinking) VALUES (@id,@base_url,@model,@api_key,@temperature,@max_tokens,@timeout_s,@thinking)"
  );
  const tx = db.transaction(() => seedModels.forEach((m) => im.run(m)));
  tx();
}
const haveItems = (db.prepare("SELECT count(*) c FROM items").get() as any).c;
if (!haveItems) {
  const ii = db.prepare("INSERT INTO items (suite,task_group,config) VALUES (@suite,@task_group,@config)");
  const tx = db.transaction(() =>
    seedItems.forEach((it) => ii.run({ suite: it.suite, task_group: it.task_group, config: JSON.stringify(it.config) }))
  );
  tx();
}

// Reconcile the seed pack by stable `_seed` key: insert items that are new and
// delete seed items whose key was retired. User-created tests (no `_seed`) are
// never touched. This lets us REPLACE the seeded test set across versions on
// restart without wiping data or duplicating.
const findSeed = db.prepare("SELECT 1 FROM items WHERE json_extract(config,'$._seed') = ?");
const insPack = db.prepare("INSERT INTO items (suite,task_group,config) VALUES (?,?,?)");
const allSeeded = db.prepare("SELECT id, json_extract(config,'$._seed') AS k FROM items WHERE json_extract(config,'$._seed') IS NOT NULL");
const delById = db.prepare("DELETE FROM items WHERE id = ?");
// One-time retirement of the original (pre-_seed) base deterministic tests that
// existing databases still have as plain rows. Matched by exact prompt so it can
// never hit a user's own test. Safe no-op once they're gone.
const LEGACY_PROMPTS = [
  "A train leaves Station A at 9:00 AM going east at 60 mph. Another leaves Station B at 9:30 AM going west at 80 mph. Stations are 280 miles apart. How many miles from Station A do they meet? Give just the number.",
  "Natalia sold clips to 48 friends in April, then half as many in May. How many clips altogether? End with '#### <number>'.",
  "What is 17 * 24? Give just the number.",
  "A rectangle is 7 cm by 12 cm. Area in square cm? Give just the number.",
  "Write a Python function `is_palindrome(s)` returning True if the string is a palindrome ignoring case, spaces, punctuation. Return only the code.",
  "Write a Python function `two_sum(nums, target)` returning indices of the two numbers adding to target. Return only the code.",
  "Write a Python function `fizzbuzz(n)` returning a list 1..n with 'Fizz'/'Buzz'/'FizzBuzz' rules, else the number as string. Return only the code.",
  "Output ONLY the email: 'reach me at sarah.chen@acme.co.uk after 5pm'.",
  "Output ONLY the order total as a number: 'Your order #4821 came to $129.50 including tax.'",
  "Output ONLY a JSON object with keys store, total from: 'Receipt — BlueMart, TOTAL 58.20'.",
  "Sentiment as one word (positive/negative/neutral), reply ONLY that word:\n'the battery life ruined an otherwise decent phone.'",
  "Spam or ham? Reply ONLY 'spam' or 'ham':\n'CONGRATS!! You won a $1000 gift card, click here now!!!'",
  "Output ONLY a JSON object: a call to set_timer with duration_minutes=10 and label='tea'. Shape {\"name\":...,\"args\":{...}}.",
];
const delByPrompt = db.prepare("DELETE FROM items WHERE suite='deterministic' AND json_extract(config,'$._seed') IS NULL AND json_extract(config,'$.prompt') = ?");

const packTx = db.transaction(() => {
  const desired = new Set(seedPackItems.map((it) => it.config._seed));
  let added = 0, removed = 0;
  for (const row of allSeeded.all() as Array<{ id: number; k: string }>) {
    if (!desired.has(row.k)) { delById.run(row.id); removed++; }
  }
  for (const it of seedPackItems) {
    if (findSeed.get(it.config._seed)) continue;
    insPack.run(it.suite, it.task_group, JSON.stringify(it.config));
    added++;
  }
  let retired = 0;
  for (const p of LEGACY_PROMPTS) retired += delByPrompt.run(p).changes;
  if (added || removed || retired) console.log(`seed reconcile: +${added} new, -${removed} retired, -${retired} legacy`);
});
packTx();
