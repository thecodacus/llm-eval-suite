# LLM Eval Suite

A self-hosted web app for testing local LLMs against any OpenAI-compatible
server (LM Studio, Ollama, llama-server). React + Vite + TypeScript frontend,
Fastify + better-sqlite3 backend, one Docker image, CI-built on GHCR.

Three test families, one UI:

| Suite | Graded by | Volume | What it measures |
|---|---|---|---|
| **Deterministic** | machine (no judge) | high | exact answers: math, code (runs it), extraction, classification, structured JSON |
| **Agentic** | machine (no judge) | medium | follow an exact reply format **and** emit a working `curl` to a local API, verified by a built-in capture server |
| **Subjective** | you, blinded | low | writing quality etc. — outputs staged A/B/C, names hidden until you pick |

Every run records correctness **and** speed (tok/s).

## Run it (server)
```bash
docker compose up -d                 # defaults to port 8080
PORT=9000 docker compose up -d        # or pick any port
# open http://<your-server>:<PORT>
```
The port is set by the **`PORT`** env var (default `8080`) — it controls both the
container's listen port and the published host port. SQLite lives in the `eval-data`
volume (`/data/evals.db`); models you add and runs you make persist across restarts.
The container can reach model servers on the host via `host.docker.internal`.

Or pull directly (set the port on both sides):
```bash
docker run -d -e PORT=9000 -p 9000:9000 -v eval-data:/data \
  --add-host host.docker.internal:host-gateway \
  ghcr.io/thecodacus/llm-eval-suite:latest
```

### Deploy with Portainer (Stack)
The GHCR image is **public**, so no registry credentials are needed. In Portainer:
**Stacks → Add stack → Web editor**, paste the YAML below, then **Deploy the stack**.
Open `http://<your-server>:8080`.

```yaml
services:
  llm-eval-suite:
    image: ghcr.io/thecodacus/llm-eval-suite:latest
    container_name: llm-eval-suite
    environment:
      - PORT=${PORT:-8080}                   # the app listens on this port
    ports:
      - "${PORT:-8080}:${PORT:-8080}"
    volumes:
      - eval-data:/data      # SQLite db persists here
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"   # lets the app reach LM Studio/Ollama on the host

volumes:
  eval-data:
```

**Changing the port:** in Portainer, add an environment variable **`PORT`** (e.g. `9000`)
in the stack's *Environment variables* section before deploying — it drives both the
container's listen port and the published port. Leave it unset to use `8080`.

Notes:
- **Reaching your models:** point each model's `base_url` (in the Models tab) at
  `http://host.docker.internal:1234/v1` (LM Studio) or `:11434/v1` (Ollama) to hit
  servers running on the Docker host. If your model server runs in another container,
  use its service/container name instead.
- **Updating:** to redeploy a new build, in the stack hit **Pull and redeploy** (or
  enable Portainer's image-polling). Pin to a specific build by replacing `:latest`
  with a tag like `:sha-6650f4d`.
- **Data safety:** the named volume `eval-data` keeps your models, runs, and verdicts
  across redeploys.

## Use it
1. **Models** tab — add each candidate (id, `base_url`, model name). Seeded with examples.
2. **Run** tab — pick a suite, the models, optionally specific task groups, hit run.
3. **Results** tab — live leaderboard (pass% · tok/s) for deterministic/agentic; for
   subjective, open the blinded review and click winners.

## Import hard public benchmarks
Pull real "models struggle" benchmarks from HuggingFace — great yardsticks for
quant/family comparisons (hard reasoning degrades first under quantization).

**In the app:** Build tab → **Import benchmark** → pick GPQA Diamond / MMLU-Pro /
AIME 2025 → Import. The server fetches from HuggingFace at run time.

**Or via CLI** (`tools/import_hf.py`, pure stdlib — no `datasets`/`pandas`):
```bash
python tools/import_hf.py --dataset gpqa                     # GPQA Diamond (198, PhD science) → mc letter
python tools/import_hf.py --dataset mmlu_pro --limit 100     # MMLU-Pro, sampled across all domains
python tools/import_hf.py --dataset aime                     # 30 AIME 2025 problems → numeric
python tools/import_hf.py --dataset gpqa --base http://your-server:8080   # target a remote instance
```

Notes:
- Imported items are keyed with `_import` (not `_seed`), so they **persist across
  redeploys** and are never touched by seed reconciliation. Re-running is idempotent.
- AIME → `numeric`; GPQA / MMLU-Pro → the `mc_letter` extractor + `exact`. Each lands
  as its own task group (`aime-2025`, `gpqa-diamond`, `mmlu-pro`) on the Dashboard.
- MMLU-Pro is category-ordered, so it's **stratified-sampled** across all domains.
- Fetched into **your** instance at run time (needs outbound internet to
  huggingface.co) rather than baked into the image — datasets carry their own
  licenses (AIME's is non-commercial).

## Develop locally
```bash
cd server && npm install && npm run dev   # API on :8080 (DB_PATH=./data/evals.db)
cd client && npm install && npm run dev   # Vite on :5173, proxies /api -> :8080
```
Set `DB_PATH` to control where SQLite is written (defaults to `/data/evals.db`).

## CI / images
`.github/workflows/docker.yml` builds and pushes to **GHCR** on every push to
`main` (tag `latest`), on `v*` tags (semver), and on manual dispatch — using
GitHub's runners, so you never build locally. Image:
`ghcr.io/thecodacus/llm-eval-suite`.

## Architecture
```
server/  Fastify API + SQLite + eval engine
  src/eval/  client.ts extractors.ts graders.ts agentic.ts
  src/runner.ts   executes a run across a suite, writes results
  src/seed.ts     default models + task banks (first boot)
client/  React/Vite/TS SPA (Run · Results · Models · blinded Review)
Dockerfile  3-stage: build client → build server → slim runtime (node+python3+curl)
```

### Safety
The agentic suite executes model-written `curl`. It runs with **no shell**
(tokenized argv), must be a lone `curl`, must target the in-process capture
server (other hosts refused, not run), and filesystem flags (`-o`, `-T`, `@file`…)
are rejected. The `code_tests` grader runs model-written Python in a temp file
subprocess. Both are fine for trusted local models; add a sandbox before pointing
them at adversarial output.
