import http from "node:http";
import { spawn } from "node:child_process";
import { subsetMatch } from "./graders.js";

/** Capture server: the "local API" the model's curl must hit. */
export interface Capture {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  bodyRaw: string;
  bodyJson: unknown;
}

export class CaptureServer {
  private server!: http.Server;
  private captures: Capture[] = [];
  baseUrl = "";

  async start(): Promise<string> {
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    const addr = this.server.address() as any;
    this.baseUrl = `http://127.0.0.1:${addr.port}`;
    return this.baseUrl;
  }

  stop() {
    this.server?.close();
  }

  reset() {
    this.captures = [];
  }

  last(): Capture | null {
    return this.captures.length ? this.captures[this.captures.length - 1] : null;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || "/", this.baseUrl);
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let bodyJson: unknown = null;
      try { bodyJson = raw ? JSON.parse(raw) : null; } catch { bodyJson = null; }
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => (query[k] = v));
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = String(v);
      this.captures.push({ method: req.method || "", path: url.pathname, query, headers, bodyRaw: raw, bodyJson });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  }
}

/** Filesystem-touching curl flags we refuse to run. */
const FS_FLAGS = new Set(["-o", "--output", "-O", "--remote-name", "-T", "--upload-file", "-K", "--config", "--data-binary"]);

/** Minimal POSIX-ish argv tokenizer (handles quotes); no shell involved. */
export function tokenize(cmd: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) {
    if (m[1] !== undefined) out.push(m[1].replace(/\\(.)/g, "$1"));
    else if (m[2] !== undefined) out.push(m[2]);
    else out.push(m[3]);
  }
  return out;
}

export function extractCurl(reply: string): string | null {
  const fence = reply.match(/```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/);
  let chunk = (fence ? fence[1] : reply).replace(/\\\n/g, " ");
  const m = chunk.match(/curl[\s\S]*/);
  return m ? m[0].trim() : null;
}

/** Run a single curl safely: no shell, curl-only, must target the capture server.
 *  ASYNC on purpose — the capture server shares this event loop, so a blocking
 *  spawnSync here would deadlock (curl waits on a server that can't respond). */
export function runCurl(cmd: string, baseUrl: string): Promise<{ ran: boolean; detail: string }> {
  const argv = tokenize(cmd);
  if (!argv.length || !argv[0].endsWith("curl")) return Promise.resolve({ ran: false, detail: "not a curl command" });
  const bad = argv.filter((a) => FS_FLAGS.has(a) || a.startsWith("@"));
  if (bad.length) return Promise.resolve({ ran: false, detail: `rejected: filesystem flag ${bad}` });
  const urls = argv.slice(1).filter((a) => a.startsWith("http://") || a.startsWith("https://"));
  if (!urls.length) return Promise.resolve({ ran: false, detail: "no URL in curl" });
  if (!urls.every((u) => u.startsWith(baseUrl))) return Promise.resolve({ ran: false, detail: `curl targets non-test host: ${urls}` });
  return new Promise((resolve) => {
    const child = spawn(argv[0], ["-s", ...argv.slice(1)], { stdio: "ignore" });
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve({ ran: false, detail: "curl timeout" }); }, 15000);
    child.on("error", (e) => { clearTimeout(timer); resolve({ ran: false, detail: `curl exec failed: ${e}` }); });
    child.on("close", () => { clearTimeout(timer); resolve({ ran: true, detail: "curl executed" }); });
  });
}

export function checkFormat(reply: string, fmt: any): string[] {
  const fails: string[] = [];
  for (const p of fmt?.must_match ?? []) if (!new RegExp(p, "ms").test(reply)) fails.push(`format: missing /${p}/`);
  for (const p of fmt?.must_not_match ?? []) if (new RegExp(p, "ms").test(reply)) fails.push(`format: forbidden /${p}/`);
  return fails;
}

export function matchRequest(cap: Capture | null, exp: any): string[] {
  if (!cap) return ["request: nothing reached the server"];
  const fails: string[] = [];
  if (exp.method && cap.method.toUpperCase() !== exp.method.toUpperCase())
    fails.push(`method: expected ${exp.method}, got ${cap.method}`);
  if (exp.path && cap.path.replace(/\/$/, "") !== exp.path.replace(/\/$/, ""))
    fails.push(`path: expected ${exp.path}, got ${cap.path}`);
  for (const [k, v] of Object.entries(exp.query ?? {})) {
    const gv = cap.query[k];
    if (gv == null) fails.push(`query.${k}: missing`);
    else if (String(gv).toLowerCase() !== String(v).toLowerCase()) fails.push(`query.${k}: expected ${v}, got ${gv}`);
  }
  for (const [k, v] of Object.entries(exp.headers ?? {})) {
    const gv = cap.headers[k.toLowerCase()];
    if (gv == null) fails.push(`header.${k}: missing`);
    else if (v !== "*" && !gv.toLowerCase().includes(String(v).toLowerCase())) fails.push(`header.${k}: expected ~${v}, got ${gv}`);
  }
  if (exp.json) fails.push(...subsetMatch(exp.json, cap.bodyJson));
  return fails;
}
