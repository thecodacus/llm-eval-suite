import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type GradeResult = { passed: boolean; detail: string };
export type Grader = (pred: unknown, gold: unknown, args?: any) => GradeResult;

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

// Parse a value as a number iff it cleanly looks like one (number, or a numeric
// string). Lets JSON comparisons treat 58.20 (string) and 58.2 (number) as equal.
const NUMERIC = /^[-+]?\d[\d,]*(\.\d+)?$/;
function asNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && NUMERIC.test(v.trim())) return parseFloat(v.replace(/,/g, ""));
  return null;
}

const exact: Grader = (pred, gold) => {
  const p = norm(pred), g = norm(gold);
  return { passed: p === g, detail: `pred=${JSON.stringify(p)} gold=${JSON.stringify(g)}` };
};

const numeric: Grader = (pred, gold, args) => {
  const tol = args?.tol ?? 1e-6;
  const p = parseFloat(String(pred).replace(/,/g, ""));
  const g = parseFloat(String(gold).replace(/,/g, ""));
  if (Number.isNaN(p)) return { passed: false, detail: `unparseable pred=${JSON.stringify(pred)}` };
  const ok = Math.abs(p - g) <= tol + tol * Math.abs(g);
  return { passed: ok, detail: `pred=${p} gold=${g}` };
};

const contains: Grader = (pred, gold) => {
  const hay = norm(pred);
  const needles = Array.isArray(gold) ? gold : [gold];
  const missing = needles.filter((n) => !hay.includes(norm(n)));
  return { passed: missing.length === 0, detail: missing.length ? `missing=${missing}` : "all present" };
};

export function subsetMatch(exp: any, got: any, path = "json"): string[] {
  const fails: string[] = [];
  if (exp && typeof exp === "object" && !Array.isArray(exp)) {
    if (!got || typeof got !== "object") return [`${path}: expected object, got ${typeof got}`];
    for (const k of Object.keys(exp)) {
      if (!(k in got)) fails.push(`${path}.${k}: missing`);
      else if (exp[k] === "__PRESENT__") {
        if (!got[k]) fails.push(`${path}.${k}: present but empty`);
      } else fails.push(...subsetMatch(exp[k], got[k], `${path}.${k}`));
    }
  } else {
    const en = asNumber(exp), gn = asNumber(got);
    const mismatch = en !== null && gn !== null
      ? Math.abs(en - gn) > 1e-9          // both numeric → compare by value
      : norm(exp) !== norm(got);          // otherwise → case-insensitive string
    if (mismatch) fails.push(`${path}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(got)}`);
  }
  return fails;
}

const jsonMatch: Grader = (pred, gold, args) => {
  let p: any = pred;
  if (Array.isArray(p)) p = p.length ? p[0] : null;
  if (!p || typeof p !== "object") return { passed: false, detail: `not an object` };
  const keys: string[] = args?.keys ?? Object.keys(gold as object);
  const sub: any = {};
  for (const k of keys) sub[k] = (gold as any)[k];
  const fails = subsetMatch(sub, p);
  return { passed: fails.length === 0, detail: fails.length ? fails.join("; ") : "keys match" };
};

/** Runs model-written Python against a gold assert snippet. Needs python3 in the image. */
const codeTests: Grader = (pred, gold, args) => {
  const timeout = (args?.timeout ?? 15) * 1000;
  const dir = mkdtempSync(join(tmpdir(), "ct-"));
  const path = join(dir, "t.py");
  writeFileSync(path, `${pred}\n\n${gold}\nprint('OK')\n`);
  try {
    const r = spawnSync("python3", [path], { encoding: "utf8", timeout });
    if (r.error) return { passed: false, detail: String((r.error as any).code ?? r.error) };
    if (r.status === 0 && r.stdout.includes("OK")) return { passed: true, detail: "tests passed" };
    const err = (r.stderr || r.stdout || "nonzero exit").trim().split("\n").pop() || "";
    return { passed: false, detail: err.slice(0, 200) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const GRADERS: Record<string, Grader> = {
  exact,
  numeric,
  contains,
  json_match: jsonMatch,
  code_tests: codeTests,
};
