"""Numbers for the pitch, read from the live database.

    python -m scripts.stats
    python -m scripts.stats --labels seed/labelled_set.json

Needs SUPABASE_URL and SUPABASE_SERVICE_KEY (read from .env).

--labels points at a JSON file mapping a repo ("owner/name") to "built" (the owner built it and
understands it) or "not_built" (the owner didn't build it). It gives the score gap between the groups.

Default prices are gemini-3.8-flash on Vertex AI as listed by third-party price trackers in
October 2026 (USD per million tokens). Check Google's rate card and pass --price-in / --price-out.
"""

import argparse
import json
import math
import statistics
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from app import db, report  # noqa: E402  (after load_dotenv so settings see .env)


def _median(xs):
    return statistics.median(xs) if xs else None


def _p90(xs):
    """Nearest-rank 90th percentile: the value 90% of runs are at or below."""
    return sorted(xs)[math.ceil(0.9 * len(xs)) - 1] if xs else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", help="JSON file: {\"owner/repo\": \"built\" | \"not_built\"}")
    ap.add_argument("--price-in", type=float, default=0.75, help="USD per 1M input tokens")
    ap.add_argument("--price-out", type=float, default=3.75, help="USD per 1M output tokens (incl. thinking)")
    args = ap.parse_args()
    if db.using_memory():
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY first: the in-memory store has no data.")

    students = db.select("students")
    labels = json.load(open(args.labels, encoding="utf-8")) if args.labels else {}
    labels = {k.lower(): v for k, v in labels.items()}

    done, gaps, surprises, viva_minutes, costs, by_label = [], 0, 0, [], [], {"built": [], "not_built": []}
    for st in students:
        s = report.summary(st["id"])
        if s["status"] != "done":
            continue
        done.append(s["overall"])
        claimed_tags = {c["tag"] for c in st["claimed_skills"]}
        if any(report.level(s["skills"].get(t)) == "not_verified" for t in claimed_tags):
            gaps += 1
        if any(score >= report.PARTIAL and tag not in claimed_tags for tag, score in s["skills"].items()):
            surprises += 1

        answers = db.select("viva_answers", session_id=s["session"]["id"])
        times = [datetime.fromisoformat(a["created_at"]) for a in answers]
        start = datetime.fromisoformat(s["session"]["created_at"])
        viva_minutes.append((max(times) - start).total_seconds() / 60)

        analysis = db.get("repo_analyses", s["session"]["analysis_id"]) or {}
        usages = [analysis.get("ai_usage") or {}] + [a.get("ai_usage") or {} for a in answers]
        tokens_in = sum(u.get("tokens_in", 0) for u in usages)
        tokens_out = sum(u.get("tokens_out", 0) for u in usages)
        costs.append((tokens_in * args.price_in + tokens_out * args.price_out) / 1e6)

        label = labels.get((analysis.get("repo_full_name") or "").lower())
        if label in by_label:
            by_label[label].append(s["overall"])

    analyses = db.select("repo_analyses")
    analyze_s = [a["ai_usage"]["total_ms"] / 1000 for a in analyses if (a.get("ai_usage") or {}).get("total_ms")]
    answer_s = [a["ai_usage"]["latency_ms"] / 1000 for a in db.select("viva_answers") if (a.get("ai_usage") or {}).get("latency_ms")]

    n = len(done)
    print(f"Students signed up:          {len(students)}")
    print(f"Vivas finished:              {n}")
    if n:
        print(f"Median overall score:        {_median(done)}")
        print(f"Claimed a skill, then scored below 40 on it:   {gaps}/{n} ({100 * gaps / n:.0f}%)")
        print(f"Showed a skill they didn't claim (40+):        {surprises}/{n} ({100 * surprises / n:.0f}%)")
        print(f"Median viva time:            {_median(viva_minutes):.1f} min")
        print(f"Median AI cost per viva:     ${_median(costs):.3f}  (at ${args.price_in}/${args.price_out} per 1M tokens)")
    if analyze_s:
        print(f"Analyze time:                median {_median(analyze_s):.1f}s, p90 {_p90(analyze_s):.1f}s ({len(analyze_s)} runs)")
    if answer_s:
        print(f"Answer scoring time:         median {_median(answer_s):.1f}s, p90 {_p90(answer_s):.1f}s ({len(answer_s)} answers)")
    if labels:
        b, nb = by_label["built"], by_label["not_built"]
        print(f"Labelled set: built {len(b)} vivas, mean {round(statistics.mean(b)) if b else 'n/a'}; "
              f"not built {len(nb)} vivas, mean {round(statistics.mean(nb)) if nb else 'n/a'}")
        if b and nb:
            print(f"Score gap (built - not built): {statistics.mean(b) - statistics.mean(nb):.0f} points")


if __name__ == "__main__":
    main()
