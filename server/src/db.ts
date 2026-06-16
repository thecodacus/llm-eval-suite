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

// Extended packs: insert additively, idempotent by the stable `_seed` key, so
// existing databases pick up new tests on restart without wiping or duplicating.
const findSeed = db.prepare("SELECT 1 FROM items WHERE json_extract(config,'$._seed') = ?");
const insPack = db.prepare("INSERT INTO items (suite,task_group,config) VALUES (?,?,?)");
const packTx = db.transaction(() => {
  let added = 0;
  for (const it of seedPackItems) {
    if (!it.config._seed || findSeed.get(it.config._seed)) continue;
    insPack.run(it.suite, it.task_group, JSON.stringify(it.config));
    added++;
  }
  if (added) console.log(`seeded ${added} new pack items`);
});
packTx();
