/** Pull a checkable answer out of a chatty small-model reply. */
export type Extractor = (text: string) => unknown;

const lastNumber: Extractor = (t) => {
  const m = t.match(/-?\d[\d,]*(?:\.\d+)?/g);
  return m ? m[m.length - 1].replace(/,/g, "") : null;
};

const boxed: Extractor = (t) => {
  let m = t.match(/\\boxed\{([^}]*)\}/);
  if (m) return m[1].trim();
  m = t.match(/####\s*(.+)/);
  if (m) return m[1].trim();
  m = t.match(/(?:final\s+)?answer\s*[:=]\s*(.+)/i);
  if (m) return m[1].split("\n")[0].trim().replace(/[.*\s]+$/, "");
  return null;
};

const codeBlock: Extractor = (t) => {
  const m = t.match(/```(?:python|py)?\s*\n([\s\S]*?)```/);
  return m ? m[1] : t.trim();
};

function firstBraced(s: string): string | null {
  const cands = [s.indexOf("{"), s.indexOf("[")].filter((i) => i !== -1);
  if (!cands.length) return null;
  const start = Math.min(...cands);
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

const jsonBlock: Extractor = (t) => {
  const fence = t.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  const candidate = fence ? fence[1] : t;
  for (const attempt of [candidate, firstBraced(candidate)]) {
    if (attempt == null) continue;
    try {
      return JSON.parse(attempt);
    } catch {
      /* try next */
    }
  }
  return null;
};

// Multiple-choice: pull the answer LETTER (A–J) robustly. Prefers an explicit
// marker ("Answer: C", "#### C", "(C)"), else the last standalone capital letter.
const mcLetter: Extractor = (t) => {
  let m = t.match(/(?:answer|option|choice)\s*(?:is|:|=)?\s*\(?([A-J])\b/i)
    || t.match(/####\s*\(?([A-J])\b/)
    || t.match(/\bthe answer is\s*\(?([A-J])\b/i);
  if (m) return m[1].toUpperCase();
  const all = t.match(/\b([A-J])\b/g);
  return all ? all[all.length - 1].toUpperCase() : null;
};

export const EXTRACTORS: Record<string, Extractor> = {
  raw: (t) => String(t).trim(),
  last_number: lastNumber,
  boxed,
  code_block: codeBlock,
  json_block: jsonBlock,
  mc_letter: mcLetter,
};
