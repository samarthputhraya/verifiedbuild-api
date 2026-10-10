"""Match score between a student and a listing. Deterministic and explainable: no LLM.

    skill_fit        = sum(w_t * verified_t / 100) / sum(w_t)     verified skills only
    interest_overlap = |interests & tags| / |interests | tags|     (Jaccard)
    hackathon        = best verified hackathon: viva score / 100 x result weight
                       (winner 1.0, finalist 0.8, participant 0.6)
    match            = round(100 * (0.6 * skill_fit + 0.25 * interest_overlap + 0.15 * hackathon))

Claimed skills and claimed hackathons count for nothing until a viva verifies them. That is the product.
"""

SKILL_W, INTEREST_W, HACKATHON_W = 0.6, 0.25, 0.15
RESULT_WEIGHT = {"winner": 1.0, "finalist": 0.8, "participant": 0.6}
RESULT_LABEL = {"winner": "Winner", "finalist": "Finalist", "participant": "Participant"}


def round_half_up(x: float) -> int:
    return int(x + 0.5)


def hackathon_signal(hackathons: list[dict]) -> tuple[float, dict | None]:
    """(value 0-1, the entry it came from) for the best verified hackathon. Unverified entries count 0."""
    best, best_entry = 0.0, None
    for h in hackathons:
        if h["verified"] and h["viva_score"] is not None:
            value = h["viva_score"] / 100 * RESULT_WEIGHT[h["result"]]
            if value > best:
                best, best_entry = value, h
    return best, best_entry


def score(skills: dict[str, int], interests: list[str], listing: dict,
          hackathon: tuple[float, dict | None] = (0.0, None)) -> dict:
    weights: dict[str, float] = listing["required_skills"]
    total_w = sum(weights.values()) or 1.0
    skill_fit = sum(w * skills.get(tag, 0) / 100 for tag, w in weights.items()) / total_w

    mine, theirs = set(interests), set(listing["tags"])
    union = mine | theirs
    shared = sorted(mine & theirs)
    overlap = len(shared) / len(union) if union else 0.0

    h_value, h_entry = hackathon
    return {
        "match": round_half_up(100 * (SKILL_W * skill_fit + INTEREST_W * overlap + HACKATHON_W * h_value)),
        "why": _why(skills, weights, total_w, shared, h_entry),
    }


def _why(skills, weights, total_w, shared, h_entry) -> str:
    contributions = [(w * skills.get(tag, 0), tag) for tag, w in weights.items() if skills.get(tag, 0) > 0]
    if contributions:
        _, tag = max(contributions)
        parts = [f"Verified {tag} {skills[tag]} covers {round_half_up(100 * weights[tag] / total_w)}% of this role"]
    else:
        needs = ", ".join(f"{tag} {round_half_up(100 * w / total_w)}%" for tag, w in sorted(weights.items(), key=lambda kv: -kv[1]))
        parts = [f"No verified skills for this role yet (it needs {needs})"]
    parts.append(f"shared interests: {', '.join(shared)}" if shared else "no shared interests")
    if h_entry:
        parts.append(f"verified hackathon: {RESULT_LABEL[h_entry['result']]} at {h_entry['event']} {h_entry['year']} (viva {h_entry['viva_score']})")
    return "; ".join(parts) + "."


def match_all(skills: dict[str, int], interests: list[str], listings: list[dict], applied_ids: set[str],
              hackathon: tuple[float, dict | None] = (0.0, None)) -> list[dict]:
    rows = []
    for listing in listings:
        s = score(skills, interests, listing, hackathon)
        rows.append({
            "listing_id": listing["id"], "title": listing["title"], "venture": listing["venture"],
            "match": s["match"], "why": s["why"], "applied": listing["id"] in applied_ids,
        })
    rows.sort(key=lambda r: -r["match"])
    return rows
