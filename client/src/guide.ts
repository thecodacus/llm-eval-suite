// Plain-language explainers so non-experts know what each test means for THEM.
// Keyed by task_group. Scores aggregate per group, so that's the unit people care about.

export interface SuiteMeta { key: string; label: string; emoji: string; blurb: string; }

export const SUITES: Record<string, SuiteMeta> = {
  deterministic: {
    key: "deterministic", label: "Auto-graded", emoji: "✅",
    blurb: "Objective tests with one right answer. The computer checks them — no opinion involved, just pass or fail. These run in high volume.",
  },
  agentic: {
    key: "agentic", label: "Doing things (agents)", emoji: "🤖",
    blurb: "Tests whether the model can follow exact instructions AND correctly operate a tool/API — the foundation of AI that actually does things instead of just talking.",
  },
  subjective: {
    key: "subjective", label: "Quality (you judge)", emoji: "🎨",
    blurb: "Taste a script can't measure. The model's outputs are shown side-by-side with names hidden, and you pick the best. Removes brand bias so you judge on quality alone.",
  },
};

export interface GroupGuide {
  suite: string;
  emoji: string;
  title: string;
  tagline: string;
  whatItChecks: string;
  highScoreMeans: string;        // the key line: what a high score buys you in real life
  examples: string[];            // day-to-day tasks this maps to
  relevance: string;             // who should care / who can ignore it
}

export const GROUPS: Record<string, GroupGuide> = {
  math: {
    suite: "deterministic", emoji: "🧮", title: "Everyday math & word problems",
    tagline: "Can it get the number right?",
    whatItChecks: "We give it arithmetic and short word problems (totals, rates, areas, multi-step questions) and check that it lands on the exact correct number.",
    highScoreMeans: "You can trust it with 'figure out the number' tasks without reaching for a calculator to double-check — splitting a bill, working out a discount, scaling a recipe, sanity-checking an invoice.",
    examples: ["Splitting a restaurant bill", "Working out a sale discount or tax", "Scaling a recipe up or down", "Checking if an invoice total adds up", "Unit conversions"],
    relevance: "Matters if you use AI for money, budgeting, spreadsheets, or planning. You can ignore it if you only use it for writing and chat.",
  },
  code: {
    suite: "deterministic", emoji: "💻", title: "Writing working code",
    tagline: "Does the code it writes actually run?",
    whatItChecks: "We ask it to write small programs, then we actually run that code against hidden tests. It only passes if the code genuinely works — not if it merely looks correct.",
    highScoreMeans: "It writes code that works the first time, so you spend less time debugging the AI's mistakes. A model that scores low here will give you confident-looking code that quietly breaks.",
    examples: ["Automating a repetitive chore (renaming files, cleaning a CSV)", "A quick script or spreadsheet formula", "Fixing a bug in your own code", "Glue code between two apps"],
    relevance: "Critical if you code or want to automate things. Completely ignorable if you never touch code.",
  },
  extract: {
    suite: "deterministic", emoji: "🔍", title: "Pulling out the right info",
    tagline: "Can it read a document and grab the exact fact?",
    whatItChecks: "We give it messy text — a receipt line, an email, a sentence — and ask it to pull out one specific thing (an email address, a total, a date) precisely.",
    highScoreMeans: "It reliably reads your documents and grabs the facts you need without inventing, garbling, or 'almost' getting them. Low scores here mean you'll have to re-check everything it pulls.",
    examples: ["Pulling totals off receipts and bills", "Getting contacts out of long emails", "Turning a paragraph into a tidy table", "Reading dates/amounts from messages"],
    relevance: "Important for paperwork, data entry, expense tracking, and organizing notes. Minor if you mostly chat.",
  },
  classify: {
    suite: "deterministic", emoji: "🏷️", title: "Sorting things into buckets",
    tagline: "Can it label text consistently?",
    whatItChecks: "We give it text and a fixed set of labels — positive/negative, spam/not-spam, which language — and check it picks the right one.",
    highScoreMeans: "It can triage and sort streams of text for you the same way every time, instead of being right 7 times out of 10.",
    examples: ["Sorting your inbox", "Flagging angry customer reviews", "Tagging notes or tickets by topic", "Filtering spam"],
    relevance: "Useful if you deal with lots of incoming messages, reviews, or tickets. Skip if you don't.",
  },
  toolcall: {
    suite: "deterministic", emoji: "🧩", title: "Clean structured output (JSON)",
    tagline: "Can it produce the exact format other software needs?",
    whatItChecks: "We ask it to output well-formed JSON with the right shape — the kind apps and automations require. We check the structure and values are correct.",
    highScoreMeans: "It can plug into other software and automations without breaking them. This is the plumbing behind 'AI that does things' — get it wrong and the whole automation jams.",
    examples: ["Feeding the model's output into another app", "Building a workflow that needs structured data", "Connecting AI to a calendar, sheet, or database"],
    relevance: "Crucial if you want AI to drive other tools or automations. Minor if you only chat with it.",
  },
  notify: {
    suite: "agentic", emoji: "📣", title: "Following rules and acting correctly",
    tagline: "Can it follow your format AND take the right action?",
    whatItChecks: "We hand it a 'skill' (instructions for using an API) and a task. It must (1) reply in the EXACT format we asked, and (2) produce a real command that we actually run and verify. It only passes if BOTH are right.",
    highScoreMeans: "It can be trusted as an assistant that does things — sends the message, files the ticket, hits the API — by your rules, instead of just describing what it would do. A model can be 'smart' and still fail here, which makes it useless as an agent.",
    examples: ["An AI that actually sends the Slack/email alert", "Filing a support ticket from a description", "Triggering a smart-home action", "Calling your internal API correctly"],
    relevance: "Essential if you're building or relying on AI agents, assistants, or automations. Less relevant if you only want a chatbot.",
  },
  search: {
    suite: "agentic", emoji: "🛰️", title: "Building the right tool request",
    tagline: "Can it turn your ask into a correct API call?",
    whatItChecks: "Given a tool's instructions, it must construct the exact request (right endpoint, right parameters) for what you asked — and we verify the call that actually goes out.",
    highScoreMeans: "It correctly translates plain requests into precise tool actions (the right query, the right filters), so the automation fetches what you meant — not something close-but-wrong.",
    examples: ["'Find the 5 newest reports on X' → the right search query", "Looking things up in a connected database", "Fetching data with the correct filters"],
    relevance: "Matters for agents and integrations that query tools on your behalf.",
  },
  write: {
    suite: "subjective", emoji: "✍️", title: "Writing & ideas (you decide)",
    tagline: "Whose writing do YOU actually prefer?",
    whatItChecks: "There's no automatic score. The model rewrites an email, brainstorms ideas, or explains a concept; you read each model's version side-by-side with names hidden and pick the best.",
    highScoreMeans: "A high pick-rate means YOU personally find its writing best — which is the only thing that matters for your own day-to-day writing. The blind test stops a brand name from swaying you.",
    examples: ["Drafting and softening emails", "Brainstorming titles or social posts", "Explaining something simply", "Matching a tone or voice"],
    relevance: "Important if you use AI for writing and communication. The score is purely your taste — there's no 'objectively right' here.",
  },
};

export function groupGuide(group: string): GroupGuide {
  return GROUPS[group] ?? {
    suite: "deterministic", emoji: "🧪", title: group,
    tagline: "Custom test group.",
    whatItChecks: "A custom set of test items you added.",
    highScoreMeans: "Higher pass rates mean the model handles these specific tasks more reliably.",
    examples: [], relevance: "Relevance depends on what you put in this group.",
  };
}

// ---- per-item plain explanation, derived from the item's stored config ----
const EXTRACTOR_PHRASE: Record<string, string> = {
  raw: "its reply",
  last_number: "the last number in its reply",
  boxed: "its final answer",
  code_block: "the code it writes",
  json_block: "the JSON in its reply",
};
const GRADER_PHRASE: Record<string, string> = {
  numeric: "that number equals",
  exact: "it exactly matches",
  contains: "it contains",
  json_match: "it includes the right fields:",
};

export interface ItemExplain { ask: string; pass: string; }

export function explainItem(suite: string, cfg: any): ItemExplain {
  if (suite === "subjective") {
    return {
      ask: cfg.prompt,
      pass: `No automatic score — you compare each model's answer blind and pick the best.${cfg.note ? ` Judge on: ${cfg.note}.` : ""}`,
    };
  }
  if (suite === "agentic") {
    const e = cfg.expect ?? {};
    const target = e.method && e.path ? ` (a ${e.method} call to ${e.path})` : "";
    return {
      ask: cfg.prompt,
      pass: `Passes only if the reply follows the exact required format AND the API call it writes is correct${target}.`,
    };
  }
  // deterministic
  if (cfg.grader === "code_tests") {
    return { ask: cfg.prompt, pass: "Passes if the code it writes actually runs and produces the correct results." };
  }
  const read = EXTRACTOR_PHRASE[cfg.extractor] ?? "its reply";
  const cmp = GRADER_PHRASE[cfg.grader] ?? "it matches";
  let ans = cfg.answer;
  if (Array.isArray(ans)) ans = ans.join(" + ");
  else if (ans && typeof ans === "object") ans = JSON.stringify(ans);
  return { ask: cfg.prompt, pass: `We read ${read}; it passes if ${cmp} “${ans}”.` };
}
