import type { Suite } from "./types.js";

export const seedModels = [
  { id: "qwen3.5-9b", base_url: "http://host.docker.internal:1234/v1", model: "qwen3.5-9b-instruct", api_key: "not-needed", temperature: 0, max_tokens: 2048, timeout_s: 180, thinking: 1 },
  { id: "gemma4-e4b", base_url: "http://host.docker.internal:1234/v1", model: "gemma-4-e4b-it", api_key: "not-needed", temperature: 0, max_tokens: 2048, timeout_s: 180, thinking: 0 },
  { id: "olmo3-7b", base_url: "http://host.docker.internal:11434/v1", model: "olmo3:7b-instruct", api_key: "not-needed", temperature: 0, max_tokens: 2048, timeout_s: 180, thinking: 0 },
];

type Seed = { suite: Suite; task_group: string; config: any };

export const seedItems: Seed[] = [
  // ---- deterministic: math ----
  { suite: "deterministic", task_group: "math", config: { prompt: "A train leaves Station A at 9:00 AM going east at 60 mph. Another leaves Station B at 9:30 AM going west at 80 mph. Stations are 280 miles apart. How many miles from Station A do they meet? Give just the number.", answer: "90", extractor: "last_number", grader: "numeric", thinking: true } },
  { suite: "deterministic", task_group: "math", config: { prompt: "Natalia sold clips to 48 friends in April, then half as many in May. How many clips altogether? End with '#### <number>'.", answer: "72", extractor: "boxed", grader: "numeric", thinking: true } },
  { suite: "deterministic", task_group: "math", config: { prompt: "What is 17 * 24? Give just the number.", answer: "408", extractor: "last_number", grader: "numeric" } },
  { suite: "deterministic", task_group: "math", config: { prompt: "A rectangle is 7 cm by 12 cm. Area in square cm? Give just the number.", answer: "84", extractor: "last_number", grader: "numeric" } },

  // ---- deterministic: code ----
  { suite: "deterministic", task_group: "code", config: { prompt: "Write a Python function `is_palindrome(s)` returning True if the string is a palindrome ignoring case, spaces, punctuation. Return only the code.", answer: "assert is_palindrome('A man, a plan, a canal: Panama')\nassert not is_palindrome('hello')\nassert is_palindrome('')", extractor: "code_block", grader: "code_tests" } },
  { suite: "deterministic", task_group: "code", config: { prompt: "Write a Python function `two_sum(nums, target)` returning indices of the two numbers adding to target. Return only the code.", answer: "r = two_sum([2,7,11,15], 9)\nassert sorted(r) == [0,1]", extractor: "code_block", grader: "code_tests" } },
  { suite: "deterministic", task_group: "code", config: { prompt: "Write a Python function `fizzbuzz(n)` returning a list 1..n with 'Fizz'/'Buzz'/'FizzBuzz' rules, else the number as string. Return only the code.", answer: "assert fizzbuzz(5) == ['1','2','Fizz','4','Buzz']\nassert fizzbuzz(15)[-1] == 'FizzBuzz'", extractor: "code_block", grader: "code_tests" } },

  // ---- deterministic: extract ----
  { suite: "deterministic", task_group: "extract", config: { prompt: "Output ONLY the email: 'reach me at sarah.chen@acme.co.uk after 5pm'.", answer: "sarah.chen@acme.co.uk", extractor: "raw", grader: "exact" } },
  { suite: "deterministic", task_group: "extract", config: { prompt: "Output ONLY the order total as a number: 'Your order #4821 came to $129.50 including tax.'", answer: "129.50", extractor: "last_number", grader: "numeric" } },
  { suite: "deterministic", task_group: "extract", config: { prompt: "Output ONLY a JSON object with keys store, total from: 'Receipt — BlueMart, TOTAL 58.20'.", answer: { store: "BlueMart", total: "58.20" }, extractor: "json_block", grader: "json_match" } },

  // ---- deterministic: classify ----
  { suite: "deterministic", task_group: "classify", config: { prompt: "Sentiment as one word (positive/negative/neutral), reply ONLY that word:\n'the battery life ruined an otherwise decent phone.'", answer: ["negative"], extractor: "raw", grader: "contains" } },
  { suite: "deterministic", task_group: "classify", config: { prompt: "Spam or ham? Reply ONLY 'spam' or 'ham':\n'CONGRATS!! You won a $1000 gift card, click here now!!!'", answer: ["spam"], extractor: "raw", grader: "contains" } },

  // ---- deterministic: toolcall (structured JSON, no execution) ----
  { suite: "deterministic", task_group: "toolcall", config: { prompt: "Output ONLY a JSON object: a call to set_timer with duration_minutes=10 and label='tea'. Shape {\"name\":...,\"args\":{...}}.", answer: { name: "set_timer" }, extractor: "json_block", grader: "json_match", grader_args: { keys: ["name"] }, system: "You output only valid JSON." } },

  // ---- agentic: skill + exact format + real curl ----
  { suite: "agentic", task_group: "notify", config: {
      skills: "You are an automation agent with access to a local HTTP API at {BASE_URL}.\n\n# Skill: notify\n  Endpoint: POST {BASE_URL}/api/notify\n  Required headers: Content-Type: application/json, X-Auth: token-abc123\n  JSON body: {\"channel\": <string, no leading #>, \"priority\": \"low\"|\"normal\"|\"high\", \"message\": <string>}\n\n# Output format — follow EXACTLY:\nLine 1: THOUGHT: <one sentence>\nThen a single fenced ```bash code block with exactly one curl command.\nFinal line: STATUS: SENT",
      prompt: "The deploy to production just failed. Alert the ops channel with high priority.",
      format: { must_match: ["^THOUGHT: .+", "```bash\\s*\\ncurl", "^STATUS: SENT\\s*$"] },
      expect: { method: "POST", path: "/api/notify", headers: { "content-type": "application/json", "x-auth": "token-abc123" }, json: { channel: "ops", priority: "high", message: "__PRESENT__" } } } },
  { suite: "agentic", task_group: "search", config: {
      skills: "You can call a local API at {BASE_URL}.\n\n# Skill: search\n  Endpoint: GET {BASE_URL}/api/search\n  Query params: q (text), limit (integer). No auth.\n\n# Output format — follow EXACTLY:\nA single fenced ```bash code block with exactly one curl command. No other text.",
      prompt: "Find the 5 most relevant articles about vector databases.",
      format: { must_match: ["^```bash\\s*\\ncurl", "```\\s*$"], must_not_match: ["THOUGHT", "STATUS"] },
      expect: { method: "GET", path: "/api/search", query: { q: "vector databases", limit: "5" } } } },

  // ---- subjective: human-judged, blinded ----
  { suite: "subjective", task_group: "write", config: { prompt: "Rewrite this email to sound more professional but still warm, under 100 words:\n\nhey, just wanted to follow up on the thing we talked about last week. i still haven't heard back and the deadline is friday so getting nervous. let me know if u need anything from my end. otherwise i'll assume we're good and ship it monday. thanks", note: "professional tone shift, warmth kept, under 100 words, not stiff" } },
  { suite: "subjective", task_group: "write", config: { prompt: "Give 10 YouTube title ideas for a channel about running AI models on old hardware. Each must feel genuinely different. No clickbait like 'you won't believe'.", note: "real divergence, creativity, follows the no-clickbait constraint" } },
  { suite: "subjective", task_group: "write", config: { prompt: "Explain what a vector embedding is to a smart 12-year-old in ~4 sentences. No jargon.", note: "accurate, jargon-free, analogy lands" } },
];
