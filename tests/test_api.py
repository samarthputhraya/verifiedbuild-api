"""The whole student and recruiter flow through the API, checked against the contract examples."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
ADMIN = {"X-Admin-Key": "test-admin"}
SIGNUP = {"name": "Asha Rao", "email": "asha@example.com", "college": "KITS Warangal",
          "github_username": "asharao", "interests": ["saas", "data"], "skills": ["React", "Python"]}


def same_shape(ours, example, path="$"):
    """Same keys and types as the example, all the way down. None on either side matches anything."""
    if ours is None or example is None:
        return
    if isinstance(example, dict):
        assert isinstance(ours, dict), path
        if path.endswith(".skills") or path.endswith(".languages") or path.endswith(".required_skills"):
            return  # maps keyed by skill tag or language: the keys vary
        assert set(ours) == set(example), f"{path}: {sorted(set(ours) ^ set(example))}"
        for k in example:
            same_shape(ours[k], example[k], f"{path}.{k}")
    elif isinstance(example, list):
        assert isinstance(ours, list), path
        if example and ours:
            for item in ours:
                same_shape(item, example[0], f"{path}[]")
    else:
        number = (int, float)
        assert isinstance(ours, number) if isinstance(example, number) and not isinstance(example, bool) \
            else type(ours) is type(example), f"{path}: {ours!r} vs {example!r}"


def example(name):
    return json.loads((EXAMPLES / f"{name}.json").read_text(encoding="utf-8"))


def answer(client, session_id, qid, text, follow=False):
    return client.post(f"/api/viva/{session_id}/answer", json={
        "question_id": qid, "is_follow_up": follow, "mode": "text", "answer_text": text, "duration_s": 50, "pasted": False})


def test_full_flow_matches_contract():
    with TestClient(app) as c:
        r = c.get("/api/health")
        assert r.json() == example("get_health")

        r = c.post("/api/students", json=SIGNUP)
        assert r.status_code == 201
        same_shape(r.json(), example("post_students"))
        assert r.json()["claimed_from"] == "chips"
        assert r.json()["claimed_skills"] == [{"name": "React", "tag": "frontend"}, {"name": "Python", "tag": "backend"}]
        sid = r.json()["student_id"]

        same_shape(c.get("/api/github/asharao/repos").json(), example("get_github_repos"))

        r = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/expense-split"})
        assert r.status_code == 201
        a = r.json()
        same_shape(a, example("post_analyze"))
        assert len(a["questions"]) == 5
        assert all("rubric" not in q for q in a["questions"])
        assert [q["difficulty"] for q in a["questions"]] == ["easy", "easy", "medium", "medium", "hard"]
        assert a["questions"][0]["snippet"].startswith("line 40 of")
        session = a["session_id"]

        # Apply before the viva is done
        assert c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": True}).status_code == 409

        # q1: weak answer -> follow-up, the question stays open
        r = answer(c, session, "q1", "not sure")
        same_shape(r.json(), example("post_viva_answer"))
        assert r.json()["follow_up"] and r.json()["next_question_id"] is None and not r.json()["done"]
        state = c.get(f"/api/viva/{session}").json()
        same_shape(state, example("get_viva"))
        assert state["pending_follow_up"]["question_id"] == "q1" and state["current_question_id"] == "q1"
        assert answer(c, session, "q1", "again").status_code == 409  # first answer can't be resent
        r = answer(c, session, "q1", "a good second try", follow=True)
        assert r.json()["follow_up"] is None and r.json()["next_question_id"] == "q2"
        assert answer(c, session, "q1", "third", follow=True).status_code == 409

        for qid in ["q2", "q3", "q4", "q5"]:
            r = answer(c, session, qid, "a good answer")
        assert r.json()["done"] is True and r.json()["next_question_id"] is None
        assert c.get(f"/api/viva/{session}").json()["status"] == "done"

        rep = c.get(f"/api/report/{sid}").json()
        same_shape(rep, example("get_report"))
        assert rep["status"] == "done"
        assert rep["overall"] == 80  # every question ends at 8: q1 is max(3, 8)
        assert rep["evidence"][0]["had_follow_up"] is True and rep["evidence"][0]["score"] == 8
        levels = {row["name"]: row["level"] for row in rep["claimed_vs_verified"]}
        assert levels == {"React": "strong", "Python": "strong", "security": "strong"}
        assert [m["match"] for m in rep["matches"]] == sorted((m["match"] for m in rep["matches"]), reverse=True)

        same_shape(c.get("/api/listings").json(), example("get_listings"))
        assert len(c.get("/api/listings").json()["listings"]) == 6

        assert c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": False}).status_code == 400
        r = c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": True})
        assert r.status_code == 201
        same_shape(r.json(), example("post_apply"))
        assert c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": True}).json()["error"]["code"] == "ALREADY_APPLIED"

        assert c.get("/api/admin/verify").status_code == 401
        assert c.get("/api/admin/verify", headers=ADMIN).json() == {"ok": True}
        sl = c.get("/api/admin/shortlist/l-promtal-backend", headers=ADMIN).json()
        same_shape(sl, example("get_admin_shortlist"))
        assert sl["candidates"][0]["answer_modes"] == {"voice": 0, "text": 5, "pasted": 0}

        csv_text = c.get("/api/admin/shortlist/l-promtal-backend/csv", headers=ADMIN).text
        header, row = csv_text.strip().split("\n")
        assert header == (EXAMPLES / "get_admin_shortlist.csv").read_text(encoding="utf-8").split("\n")[0]
        assert row.startswith("1,Asha Rao,KITS Warangal,asharao,asharao/expense-split,")


def test_errors_use_the_contract_shape():
    with TestClient(app) as c:
        r = c.post("/api/students", json={**SIGNUP, "github_username": "nobody"})
        assert r.status_code == 404 and r.json()["error"]["code"] == "GITHUB_USER_NOT_FOUND"
        r = c.post("/api/students", json={**SIGNUP, "interests": ["cooking"]})
        assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION"
        sid = c.post("/api/students", json=SIGNUP).json()["student_id"]
        r = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "someoneelse/repo"})
        assert r.status_code == 400 and r.json()["error"]["code"] == "REPO_NOT_OWNED"
        r = c.get("/api/viva/not-a-session")
        assert r.status_code == 404 and set(r.json()["error"]) == {"code", "message"}
        r = c.post("/api/students", content=b"x" * 100, headers={"Content-Length": str(11 * 1024 * 1024), "Content-Type": "application/json"})
        assert r.status_code == 413
