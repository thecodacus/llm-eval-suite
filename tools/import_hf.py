#!/usr/bin/env python3
"""Import hard public benchmarks from HuggingFace into a running LLM Eval Suite.

Pulls rows via HuggingFace's dataset-viewer HTTP API (no `datasets`/`pandas`
needed — pure stdlib) and POSTs them to the suite's /api/items/bulk endpoint.

Items are keyed with `_import` (NOT `_seed`), so they persist across redeploys
and are never touched by the seed reconciliation. Re-running is idempotent.

Usage:
    python tools/import_hf.py --dataset gpqa            # GPQA Diamond (198)
    python tools/import_hf.py --dataset mmlu_pro --limit 100   # sampled across all domains
    python tools/import_hf.py --dataset aime            # 30 AIME 2025 problems
    python tools/import_hf.py --dataset aime --base http://your-server:8080

Datasets carry their own licenses (AIME's is non-commercial) — this pulls them
into YOUR instance at runtime rather than baking them into the repo/image.
"""
import argparse
import json
import urllib.parse
import urllib.request

VIEWER = "https://datasets-server.huggingface.co/rows"
SIZE = "https://datasets-server.huggingface.co/size"

LETTERS = "ABCDEFGHIJ"


def fetch_rows(dataset, config, split, limit, offset=0):
    """Page through the dataset-viewer API (max 100 rows/call)."""
    out = []
    while len(out) < limit:
        n = min(100, limit - len(out))
        qs = urllib.parse.urlencode({"dataset": dataset, "config": config,
                                     "split": split, "offset": offset + len(out), "length": n})
        with urllib.request.urlopen(f"{VIEWER}?{qs}", timeout=60) as r:
            batch = json.loads(r.read()).get("rows", [])
        if not batch:
            break
        out += [b["row"] for b in batch]
    return out[:limit]


def fetch_size(dataset, config, split):
    try:
        qs = urllib.parse.urlencode({"dataset": dataset, "config": config, "split": split})
        with urllib.request.urlopen(f"{SIZE}?{qs}", timeout=30) as r:
            splits = json.loads(r.read()).get("size", {}).get("splits", [])
        hit = next((x for x in splits if x.get("split") == split), splits[0] if splits else {})
        return hit.get("num_rows", 0)
    except Exception:
        return 0


def fetch_stratified(dataset, config, split, limit):
    """Spread the sample across the dataset (some sets are ordered by category)."""
    total = fetch_size(dataset, config, split)
    if not total or total <= limit:
        return fetch_rows(dataset, config, split, limit)
    windows = min(limit, 20)
    per = -(-limit // windows)  # ceil
    out = []
    for i in range(windows):
        if len(out) >= limit:
            break
        out += fetch_rows(dataset, config, split, per, (i * total) // windows)
    return out[:limit]


# ---- per-dataset adapters: (dataset, config, split, convert(row, i) -> item) ----

def aime_item(row, i):
    return {
        "suite": "deterministic", "task_group": "aime-2025",
        "config": {
            "prompt": row["problem"] + "\n\nSolve the problem. The answer is an integer. "
                      "Show your reasoning, then end your reply with '#### <integer>'.",
            "answer": str(row["answer"]).strip(),
            "extractor": "boxed", "grader": "numeric", "thinking": True,
            "_import": f"aime2025-{i}",
            "_guide": {"title": "AIME olympiad math (2025)",
                       "highScoreMeans": "It solves competition-level math with an exact integer answer — brutal multi-step reasoning that separates real reasoning models from the rest. 2025 set = low contamination."},
        },
    }


def gpqa_item(row, i):
    # question already contains the a) b) c) d) options inline; answer is a letter
    return {
        "suite": "deterministic", "task_group": "gpqa-diamond",
        "config": {
            "prompt": row["question"] + "\n\nPick the single best option from the final A/B/C/D list above. "
                      "Think it through, then end your reply with 'Answer: X' where X is that CAPITAL letter (A, B, C, or D).",
            "answer": str(row["answer"]).strip().upper(),
            "extractor": "mc_letter", "grader": "exact", "thinking": True,
            "_import": f"gpqa-{i}",
            "_guide": {"title": "GPQA Diamond — PhD-level science",
                       "highScoreMeans": "It answers graduate-level bio/physics/chem questions that stump non-expert humans even with Google. A real test of deep reasoning, not recall."},
        },
    }


def mmlu_pro_item(row, i):
    opts = "\n".join(f"{LETTERS[j]}. {o}" for j, o in enumerate(row["options"]))
    return {
        "suite": "deterministic", "task_group": "mmlu-pro",
        "config": {
            "prompt": f"{row['question']}\n\n{opts}\n\nThink it through, then end your reply with "
                      "'Answer: <letter>'.",
            "answer": str(row["answer"]).strip().upper(),
            "extractor": "mc_letter", "grader": "exact", "thinking": True,
            "_import": f"mmlupro-{row.get('question_id', i)}",
            "_guide": {"title": "MMLU-Pro — hard reasoning MCQ",
                       "highScoreMeans": "10-option, reasoning-heavy questions across many domains — far harder than plain MMLU. Shows breadth of knowledge under real distractor pressure."},
        },
    }


ADAPTERS = {
    "aime": {"dataset": "yentinglin/aime_2025", "config": "default", "split": "train", "convert": aime_item, "default_limit": 30},
    "gpqa": {"dataset": "fingertap/GPQA-Diamond", "config": "default", "split": "test", "convert": gpqa_item, "default_limit": 198},
    "mmlu_pro": {"dataset": "TIGER-Lab/MMLU-Pro", "config": "default", "split": "test", "convert": mmlu_pro_item, "default_limit": 100, "stratified": True},
}


def post_bulk(base, items):
    body = json.dumps({"items": items}).encode()
    req = urllib.request.Request(f"{base.rstrip('/')}/api/items/bulk", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, choices=list(ADAPTERS))
    ap.add_argument("--base", default="http://localhost:8080", help="eval suite base URL")
    ap.add_argument("--limit", type=int, help="how many items to import")
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true", help="convert but don't POST; print a sample")
    args = ap.parse_args()

    a = ADAPTERS[args.dataset]
    limit = args.limit or a["default_limit"]

    if a.get("stratified"):
        rows = fetch_stratified(a["dataset"], a["config"], a["split"], limit)
    else:
        rows = fetch_rows(a["dataset"], a["config"], a["split"], limit, args.offset)

    items = [a["convert"](r, i) for i, r in enumerate(rows)]
    print(f"prepared {len(items)} items from {a['dataset']}")

    if args.dry_run:
        print(json.dumps(items[0]["config"], indent=2)[:1200])
        return

    res = post_bulk(args.base, items)
    print(f"imported: +{res.get('added', 0)} new, {res.get('skipped', 0)} already present")


if __name__ == "__main__":
    main()
