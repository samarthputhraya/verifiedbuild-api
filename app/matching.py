"""Match score between a student and a listing. Deterministic and explainable: no LLM.

    skill_fit        = sum(w_t * verified_t / 100) / sum(w_t)     verified skills only
    interest_overlap = |interests & tags| / |interests | tags|     (Jaccard)
    match            = round(100 * (0.7 * skill_fit + 0.3 * interest_overlap))

Claimed-only skills never count. Only skills verified in the viva do. That is the product.
"""


def round_half_up(x: float) -> int:
    return int(x + 0.5)


def score(skills: dict[str, int], interests: list[str], listing: dict) -> dict:
    weights: dict[str, float] = listing["required_skills"]
    total_w = sum(weights.values()) or 1.0
    skill_fit = sum(w * skills.get(tag, 0) / 100 for tag, w in weights.items()) / total_w

    mine, theirs = set(interests), set(listing["tags"])
    union = mine | theirs
    shared = sorted(mine & theirs)
    overlap = len(shared) / len(union) if union else 0.0

    return {
        "match": round_half_up(100 * (0.7 * skill_fit + 0.3 * overlap)),
        "why": _why(skills, weights, total_w, shared),
    }


def _why(skills, weights, total_w, shared) -> str:
    contributions = [(w * skills.get(tag, 0), tag) for tag, w in weights.items() if skills.get(tag, 0) > 0]
    if contributions:
        _, tag = max(contributions)
        first = f"Verified {tag} {skills[tag]} covers {round_half_up(100 * weights[tag] / total_w)}% of this role"
    else:
        needs = ", ".join(f"{tag} {round_half_up(100 * w / total_w)}%" for tag, w in sorted(weights.items(), key=lambda kv: -kv[1]))
        first = f"No verified skills for this role yet (it needs {needs})"
    second = f"shared interests: {', '.join(shared)}" if shared else "no shared interests"
    return f"{first}; {second}."


def match_all(skills: dict[str, int], interests: list[str], listings: list[dict], applied_ids: set[str]) -> list[dict]:
    rows = []
    for listing in listings:
        s = score(skills, interests, listing)
        rows.append({
            "listing_id": listing["id"], "title": listing["title"], "venture": listing["venture"],
            "match": s["match"], "why": s["why"], "applied": listing["id"] in applied_ids,
        })
    rows.sort(key=lambda r: -r["match"])
    return rows
