import type { Suite } from "./types.js";

// Extended test pack — HARD deterministic tests (varied context length + tough cases),
// plus agentic single-calls and tool-call chaining. Each item carries a stable `_seed`
// key; db.ts reconciles by that key (insert new, delete retired) so existing databases
// swap in the latest set on restart without touching user-created tests.

type PackItem = { suite: Suite; task_group: string; config: any };

/* ---------- haystack generator (facts scattered through varied filler) ---------- */
const SENTENCES = [
  "The platform team closed {n} support tickets during the sprint review.",
  "Average request latency held steady near {n} milliseconds across all regions.",
  "After the migration, {n} legacy records were reconciled without manual edits.",
  "The on-call rotation logged {n} pages, most of them auto-resolved.",
  "Quarterly spend on infrastructure came to roughly {n} thousand dollars.",
  "Cache hit rate improved to {n} percent once the new policy shipped.",
  "Documentation now covers {n} public endpoints with examples for each.",
  "The load test sustained {n} concurrent sessions before throughput plateaued.",
  "A backlog of {n} feature requests was triaged into the next two cycles.",
  "Nightly backups completed in about {n} minutes on the primary cluster.",
  "The design review surfaced {n} edge cases worth covering in tests.",
  "Customer churn dipped by {n} basis points after the onboarding revamp.",
  "Build times dropped to {n} seconds with the new caching layer.",
  "The incident postmortem listed {n} contributing factors and three fixes.",
  "Telemetry showed {n} unique devices connecting during peak hours.",
  "The data pipeline processed {n} million events without backpressure.",
  "Roughly {n} percent of traffic now flows through the edge proxy.",
  "The release notes mentioned {n} bug fixes and a handful of improvements.",
  "Storage usage grew by {n} gigabytes month over month.",
  "The team agreed to cap pull requests at {n} files for easier review.",
];

function filler(targetChars: number, salt: number): string {
  const out: string[] = [];
  let i = 0, len = 0;
  while (len < targetChars) {
    const tmpl = SENTENCES[(i + salt) % SENTENCES.length];
    const s = tmpl.replace("{n}", String(((i * 37 + salt * 13) % 900) + 100));
    out.push(s);
    len += s.length + 1;
    if (i % 4 === 3) { out.push("\n\n"); len += 2; }
    i++;
  }
  return out.join(" ");
}

// scatter the planted facts evenly through the filler so it's not a single findable block
function haystack(o: {
  key: string; group: string; chars: number; salt?: number;
  facts: string[]; question: string; answer: any; extractor: string; grader: string;
  grader_args?: any; guide?: any;
}): PackItem {
  const body = filler(o.chars, o.salt ?? 1);
  const n = o.facts.length;
  const chunk = Math.floor(body.length / (n + 1));
  const parts: string[] = [];
  for (let i = 0; i < n; i++) { parts.push(body.slice(i * chunk, (i + 1) * chunk)); parts.push(` ${o.facts[i]} `); }
  parts.push(body.slice(n * chunk));
  const prompt = `Read the following document, then answer the question at the end.\n\n${parts.join("")}\n\n---\n${o.question}`;
  const config: any = { prompt, answer: o.answer, extractor: o.extractor, grader: o.grader, _seed: o.key };
  if (o.grader_args) config.grader_args = o.grader_args;
  if (o.guide) config._guide = o.guide;
  return { suite: "deterministic", task_group: o.group, config };
}

const recallGuide = (label: string) => ({
  title: `Find & use facts in ${label} of text`,
  highScoreMeans: `It reliably locates the right details in a ${label} document — and here it must also combine or reason over them, not just copy one line. Compare the ~1k / 4k / 12k / 30k groups to see where the model breaks down as context grows.`,
});

/* ---------- long-document QA (synthesis + arithmetic over a passage) ---------- */
const AURORA = `Aurora-DB is a distributed analytical database first released as version 1.0 in 2021; the current stable line is version 3.2, shipped in March 2024. It is written entirely in Rust and exposes a SQL-like query language called AQL. By default the server listens on port 7400 and stores data in shards capped at 512 GB each. A single cluster supports up to 64 nodes, and the default replication factor is 3, meaning every shard is kept on three separate nodes. Aurora-DB was founded by Dr. Lena Voss. Its columnar engine compresses cold partitions to roughly one fifth of their size. Authentication uses short-lived tokens that expire after 15 minutes by default, and audit logs are retained for 90 days. A new minor release ships roughly every four months.`;

function auroraQA(key: string, question: string, answer: any, extractor: string, grader: string, guide?: any): PackItem {
  return { suite: "deterministic", task_group: "longdoc-qa", config: { prompt: `${AURORA}\n\n---\nUsing only the document above, compute the answer. ${question}`, answer, extractor, grader, thinking: true, _seed: key, ...(guide ? { _guide: guide } : {}) } };
}

/* ---------- builders ---------- */
const det = (key: string, group: string, prompt: string, answer: any, extractor: string, grader: string, extra: any = {}): PackItem =>
  ({ suite: "deterministic", task_group: group, config: { prompt, answer, extractor, grader, _seed: key, ...extra } });

const ag = (key: string, group: string, skills: string, prompt: string, expect: any, format: any, guide?: any): PackItem =>
  ({ suite: "agentic", task_group: group, config: { skills, prompt, expect, format, _seed: key, ...(guide ? { _guide: guide } : {}) } });

const chain = (key: string, group: string, skills: string, prompt: string, api: any[], steps: any[], guide?: any): PackItem =>
  ({ suite: "agentic", task_group: group, config: { skills, prompt, api, steps, _seed: key, ...(guide ? { _guide: guide } : {}) } });

const BASH = "```bash\\s*\\ncurl";
const TH = { thinking: true };
const mathGuide = { title: "Hard math & number theory", highScoreMeans: "It solves genuinely tricky problems — combinatorics, modular arithmetic, multi-step counting — and lands the EXACT answer. This is where weaker models fall apart even though they breeze through simple arithmetic." };

export const seedPackItems: PackItem[] = [
  /* ===== hard math (competition / number theory) ===== */
  det("hm-divneither", "math", "How many positive integers strictly less than 1000 are divisible by neither 3 nor 7? Show working, then end with '#### <number>'.", "571", "boxed", "numeric", { ...TH, _guide: mathGuide }),
  det("hm-mod", "math", "What is the remainder when 7^100 is divided by 13? Show working, then end with '#### <number>'.", "9", "boxed", "numeric", TH),
  det("hm-sigma", "math", "What is the sum of all positive divisors of 360 (including 1 and 360)? End with '#### <number>'.", "1170", "boxed", "numeric", TH),
  det("hm-mississippi", "math", "How many distinct arrangements are there of the letters in the word MISSISSIPPI? End with '#### <number>'.", "34650", "boxed", "numeric", TH),
  det("hm-units", "math", "What is the units digit of 3^2024? End with '#### <number>'.", "1", "boxed", "numeric", TH),
  det("hm-trailing", "math", "What is the smallest positive integer n such that n! ends in exactly 3 trailing zeros? End with '#### <number>'.", "15", "boxed", "numeric", TH),
  det("hm-handshake", "math", "At a party every pair of people shook hands exactly once, for 66 handshakes total. How many people were there? End with '#### <number>'.", "12", "boxed", "numeric", TH),
  det("hm-clock", "math", "What is the smaller angle, in degrees, between the hour and minute hands of a clock at exactly 3:15? End with '#### <number>'.", "7.5", "boxed", "numeric", TH),

  /* ===== hard reasoning (logic traps / puzzles) ===== */
  det("hr-bat", "reasoning", "A bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How many CENTS does the ball cost? End with '#### <number>'.", "5", "boxed", "numeric", { ...TH, _guide: { title: "Logic puzzles & traps", highScoreMeans: "It resists the obvious-but-wrong answer and reasons carefully through classic traps and constraint puzzles — a good proxy for not being fooled on your own tricky questions." } }),
  det("hr-widgets", "reasoning", "If 5 machines take 5 minutes to make 5 widgets, how many minutes do 100 machines take to make 100 widgets? End with '#### <number>'.", "5", "boxed", "numeric", TH),
  det("hr-balls", "reasoning", "You have 9 identical-looking balls; exactly one is heavier. Using a balance scale, what is the minimum number of weighings that GUARANTEES finding the heavy ball? End with '#### <number>'.", "2", "boxed", "numeric", TH),
  det("hr-labels", "reasoning", "Three boxes labeled 'Apples', 'Oranges', and 'Mixed' each have a WRONG label. You draw one fruit from the box labeled 'Mixed' and it is an apple. Which single fruit does that box (labeled 'Mixed') actually contain? End with '#### <fruit>'.", ["apple"], "boxed", "contains", TH),
  det("hr-knave", "reasoning", "Knights always tell the truth; knaves always lie. A says 'B is a knave.' B says 'A and I are the same type.' What is B? End with '#### knight' or '#### knave'.", ["knave"], "boxed", "contains", TH),
  det("hr-ages", "reasoning", "A father is 4 times as old as his son. In 20 years he will be twice as old as his son. How old is the father NOW? End with '#### <number>'.", "40", "boxed", "numeric", TH),
  det("hr-overtake", "reasoning", "In a race you pass the runner in 2nd place just before the finish. What place do you finish in? End with '#### <number>'.", "2", "boxed", "numeric", TH),
  det("hr-lookandsay", "reasoning", "The sequence is: 1, 11, 21, 1211, 111221, ... What is the NEXT term? End with '#### <number>'.", ["312211"], "boxed", "contains", TH),

  /* ===== hard code (real algorithms, thorough hidden tests) ===== */
  det("hc-edit", "code-hard", "Write a Python function `edit_distance(a, b)` returning the Levenshtein edit distance between two strings. Return only the code.", "assert edit_distance('kitten','sitting')==3\nassert edit_distance('','abc')==3\nassert edit_distance('abc','abc')==0\nassert edit_distance('sunday','saturday')==3", "code_block", "code_tests", { _guide: { title: "Real algorithms, edge cases", highScoreMeans: "It implements non-trivial algorithms (edit distance, LIS, n-queens, wildcard match) that actually pass thorough tests including edge cases — the gap between code that looks right and code you can ship." } }),
  det("hc-lis", "code-hard", "Write a Python function `lis_length(nums)` returning the length of the longest strictly increasing subsequence. Return only the code.", "assert lis_length([10,9,2,5,3,7,101,18])==4\nassert lis_length([])==0\nassert lis_length([7,7,7])==1\nassert lis_length([1,2,3,4])==4", "code_block", "code_tests"),
  det("hc-coins", "code-hard", "Write a Python function `min_coins(coins, amount)` returning the fewest coins that sum to amount, or -1 if impossible. Return only the code.", "assert min_coins([1,2,5],11)==3\nassert min_coins([2],3)==-1\nassert min_coins([1],0)==0\nassert min_coins([186,419,83,408],6249)==20", "code_block", "code_tests"),
  det("hc-nqueens", "code-hard", "Write a Python function `nqueens(n)` returning the number of distinct solutions to the n-queens problem. Return only the code.", "assert nqueens(1)==1\nassert nqueens(4)==2\nassert nqueens(6)==4\nassert nqueens(8)==92", "code_block", "code_tests"),
  det("hc-wildcard", "code-hard", "Write a Python function `is_match(s, p)` for wildcard matching where '?' matches any single char and '*' matches any sequence (including empty). Return only the code.", "assert is_match('aa','a')==False\nassert is_match('aa','*')==True\nassert is_match('cb','?a')==False\nassert is_match('adceb','*a*b')==True\nassert is_match('acdcb','a*c?b')==False", "code_block", "code_tests"),
  det("hc-wordbreak", "code-hard", "Write a Python function `can_break(s, words)` returning True if s can be segmented into a space-separated sequence of words from the list `words`. Return only the code.", "assert can_break('leetcode',['leet','code'])==True\nassert can_break('applepenapple',['apple','pen'])==True\nassert can_break('catsandog',['cats','dog','sand','and','cat'])==False", "code_block", "code_tests"),
  det("hc-canfinish", "code-hard", "Write a Python function `can_finish(n, prereqs)` returning True if all n courses (0..n-1) can be completed given prerequisite pairs [a,b] meaning b must come before a (i.e. the directed graph has no cycle). Return only the code.", "assert can_finish(2,[[1,0]])==True\nassert can_finish(2,[[1,0],[0,1]])==False\nassert can_finish(3,[[1,0],[2,1]])==True\nassert can_finish(3,[[0,1],[1,2],[2,0]])==False", "code_block", "code_tests"),

  /* ===== hard extraction (multi-hop / requires computation or disambiguation) ===== */
  det("he-sumtop2", "extract", "From the list below, output ONLY the sum of the TWO largest invoice amounts (a single number).\n\nInvoices: #A 1240, #B 980, #C 3120, #D 1750, #E 2890.", "6010", "last_number", "numeric", { _guide: { title: "Multi-hop extraction", highScoreMeans: "It doesn't just copy a value — it finds the RIGHT values among distractors and combines them. Tests careful reading plus a computation, which trips up models that pattern-match instead of reasoning." } }),
  det("he-reporter", "extract", "Two people are mentioned. Output ONLY the email of the person who REPORTED the bug (not the one who fixed it).\n\n'The crash was reported by dana@acme.io; it was fixed by sam@acme.io the following day.'", "dana@acme.io", "raw", "exact"),
  det("he-nthword", "extract", "Output ONLY the 8th word of this sentence: 'The quick brown fox jumps over the lazy dog today.'", ["lazy"], "raw", "contains"),
  det("he-datecalc", "extract", "An event started on 2026-03-10 and ran for 25 days, counting the start day as day 1. Output ONLY the end date in YYYY-MM-DD form.", ["2026-04-03"], "raw", "contains"),
  det("he-conditional", "extract", "Output ONLY the price (a number) of the item that is BOTH in stock AND under $50.\n\nWidget: $30, out of stock. Gadget: $45, in stock. Gizmo: $80, in stock. Doohickey: $20, out of stock.", "45", "last_number", "numeric"),

  /* ===== logical deduction (replaces easy sentiment classify) ===== */
  det("hd-syllogism", "deduction", "All bloops are razzies. All razzies are lazzies. Does it follow that all bloops are lazzies? Reply with ONLY the word YES or NO.", ["yes"], "raw", "contains", { _guide: { title: "Logical deduction", highScoreMeans: "It judges whether a conclusion VALIDLY follows — distinguishing real entailment from plausible-sounding fallacies. Useful wherever you need the model to reason rigorously rather than agreeably." } }),
  det("hd-fallacy", "deduction", "Some cats are black. Some black things are cars. Does it follow that some cats are cars? Reply with ONLY the word YES or NO.", ["no"], "raw", "contains"),
  det("hd-tollens", "deduction", "Rule: 'If it rains, the match is cancelled.' The match was NOT cancelled. Can we conclude it did not rain? Reply with ONLY the word YES or NO.", ["yes"], "raw", "contains"),
  det("hd-consequent", "deduction", "Rule: 'If it rains, the ground gets wet.' The ground is wet. Can we conclude that it rained? Reply with ONLY the word YES or NO.", ["no"], "raw", "contains"),
  det("hd-ordering", "deduction", "Five runners finished a race. Dave beat Alice. Alice beat Bob. Carol finished right after Bob. Eve finished last. Who finished 2nd? End with '#### <name>'.", ["alice"], "boxed", "contains", TH),

  /* ===== structured extraction (parse + compute → JSON) ===== */
  det("hj-order", "json-extract", "Parse the order and output ONLY a JSON object with keys item_count (number of distinct line items), total (sum of qty*unit_price across all lines), currency.\n\nOrder ABC (USD): 3x Widget @ 4.50; 2x Gadget @ 12.00; 5x Bolt @ 0.20.", { item_count: 3, total: 38.5, currency: "USD" }, "json_block", "json_match", { _guide: { title: "Parse messy text into computed JSON", highScoreMeans: "It extracts fields AND derives values (counts, sums) into clean structured output — the real test of feeding model output into other software." } }),
  det("hj-evenodd", "json-extract", "Output ONLY a JSON object {even_sum, odd_count} for the list [4, 7, 10, 3, 8, 5]: even_sum is the sum of the even numbers; odd_count is how many numbers are odd.", { even_sum: 22, odd_count: 3 }, "json_block", "json_match"),
  det("hj-logs", "json-extract", "From the two log lines below, output ONLY a JSON object {total_latency_ms, error_count}: sum of all latency_ms, and the count of lines with status >= 500.\n\n[09:01] status=200 latency_ms=120\n[09:02] status=503 latency_ms=890", { total_latency_ms: 1010, error_count: 1 }, "json_block", "json_match"),
  det("hj-contact", "json-extract", "Output ONLY a JSON object {name, skill_count} for: 'Engineer Maya Lopez lists Python, Rust, and Go as her languages.'", { name: "Maya Lopez", skill_count: 3 }, "json_block", "json_match"),

  /* ===== table QA (conditional aggregation / joins) ===== */
  det("ht-condsum", "table-qa", "What is the total revenue (price*qty) for rows in the 'North' region ONLY? Number only.\n\n| region | price | qty |\n|---|---|---|\n| North | 10 | 3 |\n| South | 20 | 5 |\n| North | 8 | 10 |\n| East | 15 | 2 |", "110", "last_number", "numeric", { _guide: { title: "Compute over tables", highScoreMeans: "It filters, joins, and aggregates tabular data correctly — conditional sums, second-highest, lookups across two tables — so you can trust it with real spreadsheet questions, not just single-cell reads." } }),
  det("ht-filtercount", "table-qa", "How many products are BOTH priced above 50 AND have stock below 10? Number only.\n\n| product | price | stock |\n|---|---|---|\n| A | 60 | 5 |\n| B | 40 | 3 |\n| C | 80 | 20 |\n| D | 55 | 9 |", "2", "last_number", "numeric"),
  det("ht-secondmax", "table-qa", "Which region has the SECOND highest total sales? One word.\n\n| region | sales |\n|---|---|\n| North | 4200 |\n| South | 5100 |\n| East | 5099 |\n| West | 3000 |", ["east"], "raw", "contains"),
  det("ht-join", "table-qa", "Output ONLY the name of the person with the highest score, joining the two tables by id.\n\nNames:\n1,Ann\n2,Bob\n3,Cara\nScores:\n1,88\n2,95\n3,91", ["bob"], "raw", "contains"),
  det("ht-avgcond", "table-qa", "What is the average price of the IN-STOCK items only? Number only.\n\n| item | price | in_stock |\n|---|---|---|\n| A | 10 | yes |\n| B | 20 | no |\n| C | 30 | yes |\n| D | 50 | yes |", "30", "last_number", "numeric"),

  /* ===== in-context learning (abstract / non-obvious rules) ===== */
  det("hi-factorial", "in-context", "Follow the pattern.\n1 -> 1\n2 -> 2\n3 -> 6\n4 -> 24\nWhat is the output for 6? Reply with only the number.", "720", "last_number", "numeric", { _guide: { title: "Induce a non-obvious rule", highScoreMeans: "It infers the underlying RULE from a few examples (factorials, digit sums, ciphers) — not the surface pattern — and applies it correctly. This is what makes few-shot prompting reliable for you." } }),
  det("hi-digitsum", "in-context", "Follow the pattern.\n12 -> 3\n23 -> 5\n47 -> 11\n99 -> 18\nWhat is the output for 56? Reply with only the number.", "11", "last_number", "numeric"),
  det("hi-caesar", "in-context", "These map plaintext to a shift cipher: 'abc' -> 'def', 'hello' -> 'khoor'. Decode 'zruog' back to plaintext. Output only the decoded word.", ["world"], "raw", "contains"),
  det("hi-revlen", "in-context", "Follow the pattern.\n'cat' -> 'tac3'\n'dog' -> 'god3'\n'bird' -> 'drib4'\nWhat is the output for 'fish'? Output only the result.", ["hsif4"], "raw", "contains"),
  det("hi-pairsum", "in-context", "Follow the pattern.\n[1,2] -> 3\n[4,5,6] -> 15\n[10] -> 10\n[2,2,2,2] -> 8\nWhat is the output for [7,3,5]? Reply with only the number.", "15", "last_number", "numeric"),

  /* ===== long-context: harder (multi-needle aggregation, rules, distractors) ===== */
  haystack({ key: "hrec-1k", group: "recall-1k", chars: 1000, salt: 3, facts: ["The alpha reading was recorded as 318.", "The beta reading was recorded as 207.", "The gamma reading was recorded as 145."], question: "Add together the alpha, beta, and gamma readings stated in the document. Reply with only the number.", answer: "670", extractor: "last_number", grader: "numeric", guide: recallGuide("~1,000 characters (short)") }),
  haystack({ key: "hrec-4k", group: "recall-4k", chars: 4000, salt: 12, facts: ["The access code for door 1 is RED-11.", "The access code for door 2 is BLUE-22.", "The access code for door 3 is GOLD-33.", "The access code for door 4 is JADE-44.", "The access code for door 5 is GREY-55."], question: "What is the access code for door 4 (not any other door)? Reply with only the code.", answer: ["JADE-44"], extractor: "raw", grader: "contains", guide: recallGuide("~4,000 characters (medium)") }),
  haystack({ key: "hrec-12k", group: "recall-12k", chars: 12000, salt: 7, facts: ["Policy: any refund greater than 500 dollars requires manager approval.", "A customer has requested a refund of 640 dollars."], question: "Per the policy stated in the document, does this refund require manager approval? Reply with ONLY the word YES or NO.", answer: ["yes"], extractor: "raw", grader: "contains", guide: recallGuide("~12,000 characters (long)") }),
  haystack({ key: "hrec-30k", group: "recall-30k", chars: 30000, salt: 11, facts: ["The primary key fragment is K7.", "The secondary key fragment is M3."], question: "Concatenate the primary key fragment followed immediately by the secondary key fragment (e.g. AABB) and reply with only the result.", answer: ["K7M3"], extractor: "raw", grader: "contains", guide: recallGuide("~30,000 characters (very long)") }),

  /* ===== long-document QA (synthesis + arithmetic) ===== */
  auroraQA("ha-replicated", "How many GB does ONE fully-replicated shard occupy at the maximum shard size and default replication factor? End with '#### <number>'.", "1536", "boxed", "numeric", { title: "Reason over a long document", highScoreMeans: "It doesn't just recall a fact — it combines several facts from the passage and computes the answer. The real test of whether it UNDERSTOOD a document versus skimmed it." }),
  auroraQA("ha-releases", "How many minor releases ship in 2 years if one ships roughly every four months? End with '#### <number>'.", "6", "boxed", "numeric"),
  auroraQA("ha-ratio", "How many times longer is the audit-log retention than the default token lifetime, expressed in minutes-to-minutes ratio as a single number? (Hint: 90 days vs 15 minutes.) End with '#### <number>'.", "8640", "boxed", "numeric"),
  auroraQA("ha-capacity", "If all 64 nodes each hold one shard at the maximum shard size, what is the total cluster capacity in GB BEFORE replication? End with '#### <number>'.", "32768", "boxed", "numeric"),

  /* ===== strict constraints (precise format + computation) ===== */
  det("hcon-evenmath", "constraints", "Output ONLY a JSON object {sum, product} computed over the EVEN numbers in [3, 4, 5, 6, 7, 8]: sum is their sum, product is their product.", { sum: 18, product: 192 }, "json_block", "json_match", { _guide: { title: "Follow precise instructions exactly", highScoreMeans: "It does EXACTLY what was asked — right keys, right computation, nothing extra — even when the instruction is fussy and requires a calculation. Essential when output feeds software that breaks on any deviation." } }),
  det("hcon-reverse", "constraints", "Output ONLY a JSON object {reversed, length} for the word 'algorithm': reversed is the string reversed, length is its character count.", { reversed: "mhtirogla", length: 9 }, "json_block", "json_match"),
  det("hcon-minbool", "constraints", "Output ONLY a JSON object {all_positive, min} for the list [4, -2, 7, 9]: all_positive is a boolean, min is the smallest value.", { all_positive: "false", min: "-2" }, "json_block", "json_match"),
  det("hcon-count", "constraints", "Output ONLY a JSON object {count} = how many numbers in [15, 22, 8, 40, 13, 27] are strictly greater than 20.", { count: 3 }, "json_block", "json_match"),

  /* ===== agentic single tool-calls (kept) ===== */
  ag("tool-put", "tools",
    "Local API at {BASE_URL}.\n# Skill: update profile\n  PUT {BASE_URL}/api/users/88\n  Header: Authorization: Bearer tok-77\n  JSON body: {\"display_name\": <string>, \"timezone\": <string>}\n# Output: one ```bash curl block only.",
    "Update user 88's display name to 'Sam Rivera' and timezone to 'Asia/Kolkata'.",
    { method: "PUT", path: "/api/users/88", headers: { authorization: "Bearer tok-77" }, json: { display_name: "Sam Rivera", timezone: "Asia/Kolkata" } },
    { must_match: [BASH] },
    { title: "Operate a tool/API correctly", highScoreMeans: "It picks the right method, path, headers, and body to drive an API — varied verbs, auth, query and JSON. This is what makes an AI assistant actually do things, not just describe them." }),
  ag("tool-delete", "tools",
    "Local API at {BASE_URL}.\n# Skill: revoke session\n  DELETE {BASE_URL}/api/sessions/{id}\n  Header: X-Admin-Key: ak-9920\n# Output: one ```bash curl block only.",
    "Revoke the session with id 'sess-AB12'.",
    { method: "DELETE", path: "/api/sessions/sess-AB12", headers: { "x-admin-key": "ak-9920" } },
    { must_match: [BASH] }),
  ag("tool-query", "tools",
    "Local API at {BASE_URL}.\n# Skill: list orders\n  GET {BASE_URL}/api/orders\n  Query: status (string), since (YYYY-MM-DD), limit (int)\n  Header: Authorization: Bearer tok-77\n# Output: one ```bash curl block only.",
    "List up to 20 shipped orders since 2026-01-01.",
    { method: "GET", path: "/api/orders", query: { status: "shipped", since: "2026-01-01", limit: "20" }, headers: { authorization: "Bearer tok-77" } },
    { must_match: [BASH] }),
  ag("tool-nested", "tools",
    "Local API at {BASE_URL}.\n# Skill: create event\n  POST {BASE_URL}/api/events\n  JSON body: {\"title\": <string>, \"attendees\": [<email>,...], \"reminder\": {\"minutes\": <int>}}\n# Output: one ```bash curl block only.",
    "Create an event titled 'Launch sync' with attendees ana@x.io and rob@x.io, and a 15-minute reminder.",
    { method: "POST", path: "/api/events", json: { title: "Launch sync", reminder: { minutes: "15" } } },
    { must_match: [BASH] }),
  ag("tool-patch", "tools",
    "Local API at {BASE_URL}.\n# Skill: set ticket priority\n  PATCH {BASE_URL}/api/tickets/4501\n  JSON body: {\"priority\": \"low\"|\"normal\"|\"high\"|\"urgent\"}\n# Output: one ```bash curl block only.",
    "Bump ticket 4501 to urgent priority.",
    { method: "PATCH", path: "/api/tickets/4501", json: { priority: "urgent" } },
    { must_match: [BASH] }),

  /* ===== tool-call chaining (kept) ===== */
  chain("chain-notify", "chains",
    "Local API at {BASE_URL}.\n# Tools\n  GET {BASE_URL}/api/users?email=<email>  -> responds {\"id\": <number>}\n  POST {BASE_URL}/api/messages  body {\"user_id\": <number>, \"text\": <string>}  -> responds {\"sent\": true}\nFirst look up the user id by email, then send the message to that user_id.",
    "Send the message 'your order shipped' to the user with email sam@acme.io.",
    [{ when: { path: "/api/users" }, return: { id: 8842 } }, { when: { path: "/api/messages" }, return: { sent: true } }],
    [{ method: "GET", path: "/api/users", query: { email: "sam@acme.io" } }, { method: "POST", path: "/api/messages", json: { user_id: 8842, text: "__PRESENT__" } }],
    { title: "Chain tool calls together", highScoreMeans: "It uses the result of one API call to make the next — look up an id, then act on it — the core of any real multi-step agent. A model that aces single calls can still fall apart carrying data between steps." }),
  chain("chain-refund", "chains",
    "Local API at {BASE_URL}.\n# Tools\n  GET {BASE_URL}/api/orders/<id>  -> responds {\"order_id\": <number>, \"amount\": <number>}\n  POST {BASE_URL}/api/refunds  body {\"order_id\": <number>, \"amount\": <number>}  -> responds {\"refunded\": true}\nFetch the order first to learn its amount, then refund that exact amount.",
    "Refund order 5567 in full.",
    [{ when: { path: "/api/orders/5567" }, return: { order_id: 5567, amount: 4200 } }, { when: { path: "/api/refunds" }, return: { refunded: true } }],
    [{ method: "GET", path: "/api/orders/5567" }, { method: "POST", path: "/api/refunds", json: { order_id: 5567, amount: 4200 } }]),
  chain("chain-search", "chains",
    "Local API at {BASE_URL}.\n# Tools\n  GET {BASE_URL}/api/search?q=<text>  -> responds {\"results\": [{\"id\": <string>}, ...]}\n  GET {BASE_URL}/api/items/<id>  -> responds the item details\nSearch first, then fetch the details of the FIRST result's id.",
    "Find documents about 'vector search' and open the top result.",
    [{ when: { path: "/api/search" }, return: { results: [{ id: "DOC-7" }, { id: "DOC-9" }] } }, { when: { path: "/api/items/DOC-7" }, return: { id: "DOC-7", title: "Intro to vector search" } }],
    [{ method: "GET", path: "/api/search", query: { q: "vector search" } }, { method: "GET", path: "/api/items/DOC-7" }]),
  chain("chain-stock", "chains",
    "Local API at {BASE_URL}.\n# Tools\n  GET {BASE_URL}/api/stock/<sku>  -> responds {\"sku\": <string>, \"qty\": <number>}\n  POST {BASE_URL}/api/backorder  body {\"sku\": <string>}  -> responds {\"queued\": true}\n  POST {BASE_URL}/api/ship  body {\"sku\": <string>}  -> responds {\"shipped\": true}\nCheck stock first. If qty is 0, create a backorder; otherwise ship it.",
    "Fulfil the order for SKU 'WIDGET-9'.",
    [{ when: { path: "/api/stock/WIDGET-9" }, return: { sku: "WIDGET-9", qty: 0 } }, { when: { path: "/api/backorder" }, return: { queued: true } }],
    [{ method: "GET", path: "/api/stock/WIDGET-9" }, { method: "POST", path: "/api/backorder", json: { sku: "WIDGET-9" } }],
    { title: "Branch on a tool's response", highScoreMeans: "It reads what an API returned and picks the right next action (here: backorder because stock is 0). Conditional tool use is what separates a scripted bot from an agent that adapts." }),
];
