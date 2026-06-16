import type { Suite } from "./types.js";

// Extended test pack: more tests, various context lengths, harder cases.
// Each item carries a stable `_seed` key so db.ts can insert it idempotently
// (additive across versions — existing databases get new items on restart).

type PackItem = { suite: Suite; task_group: string; config: any };

/* ---------- haystack generator (varied filler around a planted fact) ---------- */
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

function haystack(o: {
  key: string; group: string; chars: number; salt?: number;
  facts: string[];                 // planted lines (needle first, then distractors)
  question: string; answer: any; extractor: string; grader: string;
  grader_args?: any; guide?: any;
}): PackItem {
  const body = filler(o.chars, o.salt ?? 1);
  const cut = Math.floor(body.length * 0.6);   // plant the needle ~60% in (hardest spot)
  const prompt =
    `Read the following document, then answer the question at the end.\n\n` +
    `${body.slice(0, cut)}\n\n${o.facts.join(" ")}\n\n${body.slice(cut)}\n\n---\n${o.question}`;
  const config: any = { prompt, answer: o.answer, extractor: o.extractor, grader: o.grader, _seed: o.key };
  if (o.grader_args) config.grader_args = o.grader_args;
  if (o.guide) config._guide = o.guide;
  return { suite: "deterministic", task_group: o.group, config };
}

const recallGuide = (label: string) => ({
  title: `Find a fact buried in ${label} of text`,
  highScoreMeans: `It reliably pulls the right detail out of a ${label} document or chat history without losing or confusing it. Compare the ~1k / 4k / 12k / 30k groups to see where the model's recall starts to slip as input grows.`,
});

/* ---------- long-document QA (one passage, many factual questions) ---------- */
const AURORA = `Aurora-DB is a distributed analytical database first released as version 1.0 in 2021; the current stable line is version 3.2, shipped in March 2024. It is written entirely in Rust and exposes a SQL-like query language called AQL. By default the server listens on port 7400 and stores data in shards capped at 512 GB each. A single cluster supports up to 64 nodes, and the default replication factor is 3, meaning every shard is kept on three separate nodes. Aurora-DB was founded by Dr. Lena Voss, a former systems researcher, and is maintained by a team of about forty contributors. Its columnar storage engine, codenamed Basalt, compresses cold partitions to roughly one fifth of their original size. Authentication uses short-lived tokens that expire after 15 minutes by default, and audit logs are retained for 90 days. The project is licensed under Apache 2.0 and publishes a new minor release roughly every four months.`;

function auroraQA(key: string, question: string, answer: any, extractor: string, grader: string, guide?: any): PackItem {
  return { suite: "deterministic", task_group: "longdoc-qa", config: { prompt: `${AURORA}\n\n---\nBased only on the document above: ${question}`, answer, extractor, grader, _seed: key, ...(guide ? { _guide: guide } : {}) } };
}

/* ---------- assemble pack ---------- */
const det = (key: string, group: string, prompt: string, answer: any, extractor: string, grader: string, extra: any = {}): PackItem =>
  ({ suite: "deterministic", task_group: group, config: { prompt, answer, extractor, grader, _seed: key, ...extra } });

// single tool call (skill + format + one verified curl)
const ag = (key: string, group: string, skills: string, prompt: string, expect: any, format: any, guide?: any): PackItem =>
  ({ suite: "agentic", task_group: group, config: { skills, prompt, expect, format, _seed: key, ...(guide ? { _guide: guide } : {}) } });

// multi-step chain: mock API returns scripted responses; verify the call sequence
const chain = (key: string, group: string, skills: string, prompt: string, api: any[], steps: any[], guide?: any): PackItem =>
  ({ suite: "agentic", task_group: group, config: { skills, prompt, api, steps, _seed: key, ...(guide ? { _guide: guide } : {}) } });

const BASH = "```bash\\s*\\ncurl";

export const seedPackItems: PackItem[] = [
  /* ===== context-length recall: ~1k chars ===== */
  haystack({ key: "recall1k-a", group: "recall-1k", chars: 1000, salt: 3, facts: ["The deployment passphrase for the Helios cluster is QUARTZ-7731."], question: "What is the deployment passphrase for the Helios cluster? Reply with only the passphrase.", answer: ["QUARTZ-7731"], extractor: "raw", grader: "contains", guide: recallGuide("~1,000 characters (short)") }),
  haystack({ key: "recall1k-b", group: "recall-1k", chars: 1000, salt: 9, facts: ["Invoice #4471 was issued with a final balance of 18432 dollars.", "Invoice #4470 had a balance of 990 dollars.", "Invoice #4472 was voided."], question: "What is the final balance of invoice #4471? Reply with only the number.", answer: "18432", extractor: "last_number", grader: "numeric" }),

  /* ===== ~4k chars ===== */
  haystack({ key: "recall4k-a", group: "recall-4k", chars: 4000, salt: 5, facts: ["The rollback procedure requires entering the code DELTA-5520 within sixty seconds."], question: "What code does the rollback procedure require? Reply with only the code.", answer: ["DELTA-5520"], extractor: "raw", grader: "contains", guide: recallGuide("~4,000 characters (medium)") }),
  haystack({ key: "recall4k-b", group: "recall-4k", chars: 4000, salt: 12, facts: ["Server node-17 reported a peak temperature of 73 degrees.", "Server node-3 peaked at 61 degrees.", "Server node-17 was later replaced."], question: "What peak temperature did server node-17 report? Reply with only the number.", answer: "73", extractor: "last_number", grader: "numeric" }),

  /* ===== ~12k chars ===== */
  haystack({ key: "recall12k-a", group: "recall-12k", chars: 12000, salt: 7, facts: ["Per the contract, the early-termination fee is fixed at 21750 dollars."], question: "What is the early-termination fee in dollars? Reply with only the number.", answer: "21750", extractor: "last_number", grader: "numeric", guide: recallGuide("~12,000 characters (long)") }),
  haystack({ key: "recall12k-b", group: "recall-12k", chars: 12000, salt: 21, facts: ["The backup encryption key fingerprint ends in 9F-AC-30."], question: "What does the backup encryption key fingerprint end in? Reply with only the value.", answer: ["9F-AC-30"], extractor: "raw", grader: "contains" }),

  /* ===== ~30k chars ===== */
  haystack({ key: "recall30k-a", group: "recall-30k", chars: 30000, salt: 11, facts: ["The disaster-recovery site is located in building C, room 412, rack 9."], question: "Which rack number is the disaster-recovery site in? Reply with only the number.", answer: "9", extractor: "last_number", grader: "numeric", guide: recallGuide("~30,000 characters (very long)") }),
  haystack({ key: "recall30k-b", group: "recall-30k", chars: 30000, salt: 29, facts: ["The master service account is named svc-orion-prod-7."], question: "What is the name of the master service account? Reply with only the account name.", answer: ["svc-orion-prod-7"], extractor: "raw", grader: "contains" }),

  /* ===== long-document QA ===== */
  auroraQA("aurora-port", "what port does the server listen on by default? Number only.", "7400", "last_number", "numeric", { title: "Answer questions about a long document", highScoreMeans: "It reads a dense passage and answers factual questions correctly without inventing details — the core skill for summarizing reports, contracts, and docs you feed it." }),
  auroraQA("aurora-aql", "what is the query language called? One word.", ["AQL"], "raw", "contains"),
  auroraQA("aurora-repl", "what is the default replication factor? Number only.", "3", "last_number", "numeric"),
  auroraQA("aurora-founder", "who founded it? Full name.", ["Lena", "Voss"], "raw", "contains"),
  auroraQA("aurora-shard", "what is the maximum shard size in GB? Number only.", "512", "last_number", "numeric"),
  auroraQA("aurora-token", "how many minutes until an auth token expires by default? Number only.", "15", "last_number", "numeric"),

  /* ===== complex multi-step reasoning (end with #### answer) ===== */
  det("reason-tank", "reasoning", "A tank holds 240 liters. It is filled at 15 liters per minute while simultaneously draining at 5 liters per minute. Starting empty, how many minutes until it is full? Show working, then end with '#### <number>'.", "24", "boxed", "numeric", { thinking: true, _guide: { title: "Multi-step problem solving", highScoreMeans: "It can chain several steps without dropping or fumbling one — useful for planning, estimates, and any 'work it out' question where a single wrong step ruins the answer." } }),
  det("reason-ages", "reasoning", "Alice is twice as old as Bob. In 5 years, the sum of their ages will be 40. How old is Alice now? End with '#### <number>'.", "20", "boxed", "numeric", { thinking: true }),
  det("reason-interest", "reasoning", "You invest 1000 dollars at 10% simple annual interest. What is the total amount after 3 years? End with '#### <number>'.", "1300", "boxed", "numeric", { thinking: true }),
  det("reason-days", "reasoning", "If today is Tuesday, what day of the week is it 100 days from now? End with '#### <weekday>'.", ["thursday"], "boxed", "contains", { thinking: true }),
  det("reason-race", "reasoning", "In a race, you overtake the person in second place. What position are you in now? End with '#### <number>'.", "2", "boxed", "numeric", { thinking: true }),
  det("reason-trains", "reasoning", "Two trains are 300 km apart heading toward each other at 50 km/h and 100 km/h. How many hours until they meet? End with '#### <number>'.", "2", "boxed", "numeric", { thinking: true }),
  det("reason-eggs", "reasoning", "A recipe uses 3 eggs for 12 cookies. How many eggs are needed for 30 cookies? End with '#### <number>'.", "7.5", "boxed", "numeric", { thinking: true }),

  /* ===== harder code (run against hidden tests) ===== */
  det("code-roman", "code-hard", "Write a Python function `roman(n)` converting an integer 1..3999 to its Roman numeral string. Return only the code.", "assert roman(4)=='IV'\nassert roman(49)=='XLIX'\nassert roman(1994)=='MCMXCIV'", "code_block", "code_tests", { _guide: { title: "Tougher, algorithmic code", highScoreMeans: "It handles real algorithm problems (parsing, intervals, conversions) that actually run and pass edge-case tests — the difference between a model that writes plausible code and one you can trust." } }),
  det("code-balanced", "code-hard", "Write a Python function `is_balanced(s)` returning True if the brackets ()[]{} in s are correctly balanced and nested. Return only the code.", "assert is_balanced('([]{})')\nassert not is_balanced('([)]')\nassert is_balanced('')", "code_block", "code_tests"),
  det("code-merge", "code-hard", "Write a Python function `merge_intervals(intervals)` that merges overlapping [start,end] intervals and returns them sorted by start. Return only the code.", "assert merge_intervals([[1,3],[2,6],[8,10]])==[[1,6],[8,10]]\nassert merge_intervals([])==[]", "code_block", "code_tests"),
  det("code-rpn", "code-hard", "Write a Python function `rpn(tokens)` that evaluates a reverse-Polish-notation list of string tokens (ints and + - * /) and returns the integer result. Return only the code.", "assert rpn(['2','3','+','4','*'])==20\nassert rpn(['5','1','2','+','4','*','+','3','-'])==14", "code_block", "code_tests"),
  det("code-lcp", "code-hard", "Write a Python function `longest_common_prefix(strs)` returning the longest common prefix string of a list (or '' if none). Return only the code.", "assert longest_common_prefix(['flower','flow','flight'])=='fl'\nassert longest_common_prefix(['dog','car'])==''", "code_block", "code_tests"),
  det("code-spiral", "code-hard", "Write a Python function `spiral(matrix)` returning the elements of a 2D list in clockwise spiral order as a flat list. Return only the code.", "assert spiral([[1,2,3],[4,5,6],[7,8,9]])==[1,2,3,6,9,8,7,4,5]", "code_block", "code_tests"),

  /* ===== structured extraction from long, messy text ===== */
  det("json-refund", "json-extract", "From the support email below, output ONLY a JSON object with keys order_id, customer_email, amount_refunded.\n\n---\nHey team, forwarding this along. Customer wrote in pretty upset. Looks like order #A-90531 (placed last Tuesday) arrived damaged. I went ahead and approved a refund of $142.50 to their account. You can reach them at jordan.mills@example.org if needed. Note the original charge was $158.00 but shipping isn't refundable. Thanks!", { order_id: "A-90531", customer_email: "jordan.mills@example.org", amount_refunded: "142.50" }, "json_block", "json_match", { _guide: { title: "Pull structured data out of messy text", highScoreMeans: "It turns a rambling email or log into clean, correctly-typed fields — the backbone of automating data entry and feeding other tools." } }),
  det("json-log", "json-extract", "From the log line below, output ONLY a JSON object with keys status (number), latency_ms (number), endpoint (string).\n\n---\n[2026-06-16T09:12:44Z] INFO req=8831 method=POST endpoint=/api/v2/checkout status=503 latency_ms=1487 retries=2 region=ap-south-1", { status: "503", latency_ms: "1487", endpoint: "/api/v2/checkout" }, "json_block", "json_match"),
  det("json-contact", "json-extract", "From the signature below, output ONLY a JSON object with keys name, title, phone.\n\n---\nBest regards,\nDr. Priya Raman\nHead of Platform Engineering | Northwind Labs\nm: +1 (415) 555-0192 | priya@northwind.example | she/her", { name: "Dr. Priya Raman", title: "Head of Platform Engineering", phone: "+1 (415) 555-0192" }, "json_block", "json_match", { grader_args: { keys: ["name", "title"] } }),
  det("json-shipment", "json-extract", "From the notice below, output ONLY a JSON object with keys tracking, carrier, eta_days.\n\n---\nUpdate: your package (tracking 1Z999AA10123456784) shipped via UPS Ground this morning and is expected to arrive in about 4 business days. Weight 2.3kg.", { tracking: "1Z999AA10123456784", carrier: "UPS", eta_days: "4" }, "json_block", "json_match", { grader_args: { keys: ["tracking", "eta_days"] } }),

  /* ===== in-context learning (induce the pattern from examples) ===== */
  det("icl-len", "in-context", "Follow the pattern.\ncat -> 3\nhippo -> 5\nsun -> 3\nelephant -> 8\nWhat is the output for 'banana'? Reply with only the number.", "6", "last_number", "numeric", { _guide: { title: "Learn a pattern from examples", highScoreMeans: "It figures out the rule from a few examples and applies it to a new case — what makes few-shot prompting and 'show, don't tell' instructions actually work for you." } }),
  det("icl-linear", "in-context", "Follow the pattern.\n2 -> 5\n3 -> 7\n5 -> 11\n7 -> 15\nWhat is the output for 10? Reply with only the number.", "21", "last_number", "numeric"),
  det("icl-reverse", "in-context", "Follow the pattern.\nab -> ba\ncat -> tac\nhello -> olleh\nWhat is the output for 'world'? Reply with only the result.", ["dlrow"], "raw", "contains"),
  det("icl-fib", "in-context", "Continue the sequence: 1, 1, 2, 3, 5, 8, 13, ... What is the 10th term? Reply with only the number.", "55", "last_number", "numeric"),
  det("icl-initials", "in-context", "Follow the pattern.\n'John Smith' -> JS\n'Ada Lovelace' -> AL\n'Grace Brewster Hopper' -> GBH\nWhat is the output for 'Alan Mathison Turing'? Reply with only the result.", ["AMT"], "raw", "contains"),

  /* ===== table / data computation ===== */
  det("table-revenue", "table-qa", "Given this table, what is the total revenue (price times quantity) summed across all rows? Reply with only the number.\n\n| product | price | qty |\n|---|---|---|\n| A | 10 | 3 |\n| B | 25 | 2 |\n| C | 7 | 10 |\n| D | 100 | 1 |", "250", "last_number", "numeric", { _guide: { title: "Compute answers from a table", highScoreMeans: "It reads tabular data and does the arithmetic correctly — totals, maxes, lookups, filters — so you can trust it with spreadsheets and reports instead of re-checking by hand." } }),
  det("table-max", "table-qa", "Given this table, which region had the highest sales? Reply with only the region name.\n\n| region | sales |\n|---|---|\n| North | 4200 |\n| South | 5100 |\n| East | 3900 |\n| West | 5099 |", ["south"], "raw", "contains"),
  det("table-count", "table-qa", "Given this table, how many orders are over 100 dollars? Reply with only the number.\n\n| order | amount |\n|---|---|\n| 1 | 80 |\n| 2 | 150 |\n| 3 | 99 |\n| 4 | 240 |\n| 5 | 101 |", "3", "last_number", "numeric"),
  det("table-avg", "table-qa", "Given this table, what is the average score (mean) across all students? Reply with only the number.\n\n| student | score |\n|---|---|\n| A | 70 |\n| B | 80 |\n| C | 90 |\n| D | 60 |", "75", "last_number", "numeric"),
  det("table-lookup", "table-qa", "Given this table, what is the stock level for SKU 'KB-22'? Reply with only the number.\n\n| sku | stock |\n|---|---|\n| KB-21 | 14 |\n| KB-22 | 0 |\n| KB-23 | 57 |", "0", "last_number", "numeric"),

  /* ===== strict instruction following (verifiable via JSON shape) ===== */
  det("constr-person", "constraints", "Ignore any earlier formatting habits. Output ONLY a JSON object with keys name (string), age (number), active (boolean), for this person: 'Maria, 34 years old, account currently active'. No prose, no code fence needed.", { name: "Maria", age: "34", active: "true" }, "json_block", "json_match", { _guide: { title: "Follow precise instructions exactly", highScoreMeans: "It does exactly what you asked — right keys, right types, nothing extra — even when the instruction is fussy. Essential when its output feeds software that breaks on the smallest deviation." } }),
  det("constr-place", "constraints", "Output ONLY a JSON object with keys landmark, city, country for: 'The Eiffel Tower is a famous landmark in Paris, France.'", { landmark: "The Eiffel Tower", city: "Paris", country: "France" }, "json_block", "json_match", { grader_args: { keys: ["city", "country"] } }),
  det("constr-bool", "constraints", "Output ONLY a JSON object with keys in_stock (boolean) and count (number) for: 'We have 0 units left, so the item is out of stock.'", { in_stock: "false", count: "0" }, "json_block", "json_match"),
  det("constr-list", "constraints", "Output ONLY a JSON object with key colors whose value is a JSON array of the primary colors mentioned, lowercased, for: 'The flag uses Red, White and Blue.' (white is not primary; include only primaries).", { colors: ["red", "blue"] }, "json_block", "json_match"),

  /* ===== more single tool-calls (varied verbs / auth / shapes) ===== */
  ag("tool-put", "tools",
    "Local API at {BASE_URL}.\n# Skill: update profile\n  PUT {BASE_URL}/api/users/88\n  Header: Authorization: Bearer tok-77\n  JSON body: {\"display_name\": <string>, \"timezone\": <string>}\n# Output: one ```bash curl block only.",
    "Update user 88's display name to 'Sam Rivera' and timezone to 'Asia/Kolkata'.",
    { method: "PUT", path: "/api/users/88", headers: { authorization: "Bearer tok-77" }, json: { display_name: "Sam Rivera", timezone: "Asia/Kolkata" } },
    { must_match: [BASH] },
    { title: "Operate a tool/API correctly", highScoreMeans: "It picks the right method, path, headers, and body to drive an API — varied verbs (GET/POST/PUT/PATCH/DELETE), auth, query and JSON. This is what makes an AI assistant actually do things, not just describe them." }),
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

  /* ===== tool-call chaining (use one call's response in the next) ===== */
  chain("chain-notify", "chains",
    "Local API at {BASE_URL}.\n# Tools\n  GET {BASE_URL}/api/users?email=<email>  -> responds {\"id\": <number>}\n  POST {BASE_URL}/api/messages  body {\"user_id\": <number>, \"text\": <string>}  -> responds {\"sent\": true}\nFirst look up the user id by email, then send the message to that user_id.",
    "Send the message 'your order shipped' to the user with email sam@acme.io.",
    [{ when: { path: "/api/users" }, return: { id: 8842 } }, { when: { path: "/api/messages" }, return: { sent: true } }],
    [{ method: "GET", path: "/api/users", query: { email: "sam@acme.io" } }, { method: "POST", path: "/api/messages", json: { user_id: 8842, text: "__PRESENT__" } }],
    { title: "Chain tool calls together", highScoreMeans: "It can use the result of one API call to make the next — look up an id, then act on it — which is the core of any real multi-step agent. A model that aces single calls can still fall apart when it has to carry data between steps." }),
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
