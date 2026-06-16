// Describes the prebuilt verify methods so the Test Builder UI can present them
// with plain-language help. Kept in sync with eval/extractors.ts and eval/graders.ts.

export const EXTRACTOR_CATALOG = [
  { id: "raw", label: "Whole reply", desc: "Use the model's entire reply as the answer." },
  { id: "last_number", label: "Last number", desc: "Pull the last number found anywhere in the reply." },
  { id: "boxed", label: "Final / boxed answer", desc: "Pull a \\boxed{…}, a '#### x', or an 'Answer: x' value." },
  { id: "code_block", label: "Code block", desc: "Pull the fenced ``` code block (falls back to whole reply)." },
  { id: "json_block", label: "JSON in reply", desc: "Parse the first JSON object/array in the reply." },
];

export const GRADER_CATALOG = [
  {
    id: "exact", label: "Exact match",
    desc: "The extracted answer must exactly equal your expected text (case-insensitive).",
    answerHint: "The exact expected text, e.g. canberra",
    answerType: "string", suggestExtractor: "raw",
  },
  {
    id: "numeric", label: "Number match",
    desc: "The answer, read as a number, must equal your expected number (tiny rounding tolerance).",
    answerHint: "The expected number, e.g. 408",
    answerType: "string", suggestExtractor: "last_number",
  },
  {
    id: "contains", label: "Contains all keywords",
    desc: "The answer must contain every one of these words/phrases (case-insensitive).",
    answerHint: "Comma-separated required substrings, e.g. negative",
    answerType: "list", suggestExtractor: "raw",
  },
  {
    id: "json_match", label: "JSON fields match",
    desc: "The reply's JSON must include these fields with these values (deep subset).",
    answerHint: 'A JSON object of required fields, e.g. {"store":"BlueMart"}',
    answerType: "json", suggestExtractor: "json_block",
  },
  {
    id: "code_tests", label: "Code runs & passes tests",
    desc: "We run the model's code against your test snippet (Python). It must pass.",
    answerHint: "Python assertions using the function, e.g. assert f(2)==4",
    answerType: "string", suggestExtractor: "code_block",
  },
];

export const SUITE_CATALOG = [
  { id: "deterministic", label: "Auto-graded", desc: "One right answer, checked by a verify method you pick. No judge." },
  { id: "agentic", label: "Doing things (agent)", desc: "Model must follow an exact reply format AND emit a correct curl call we run + verify." },
  { id: "subjective", label: "Quality (you judge)", desc: "No auto-score — outputs are shown blind and you pick the winner." },
];
