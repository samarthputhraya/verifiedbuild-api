"""The whole student and recruiter flow through the API, checked against the contract examples."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
ADMIN = {"X-Admin-Key": "test-admin"}
SIGNUP = {"name": "Asha Rao", "email": "asha@example.com", "college": "KITS Warangal",
          "github_username": "asharao", "interests": ["saas", "data"], "skills": ["React", "Python"]}
HACKATHON = {"event": "HackX", "year": 2026, "result": "finalist", "team_size": 3, "repo_full_name": "asharao/expense-split"}


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


def finish_viva(client, session_id):
    """Answer all 5 questions well (the fake scorer gives 8 to answers containing 'good')."""
    for qid in ["q1", "q2", "q3", "q4", "q5"]:
        r = answer(client, session_id, qid, "a good answer")
    assert r.json()["done"] is True


def test_full_flow_matches_contract():
    with TestClient(app) as c:
        assert c.get("/api/health").json() == example("get_health")

        r = c.post("/api/students", json=SIGNUP)
        assert r.status_code == 201
        same_shape(r.json(), example("post_students"))
        assert r.json()["claimed_from"] == "chips"
        assert r.json()["claimed_skills"] == [{"name": "React", "tag": "frontend"}, {"name": "Python", "tag": "backend"}]
        sid = r.json()["student_id"]

        same_shape(c.get("/api/github/asharao/repos").json(), example("get_github_repos"))

        # A hackathon entry is only a claim until a viva on its repo is finished
        r = c.post(f"/api/students/{sid}/hackathons", json=HACKATHON)
        assert r.status_code == 201
        same_shape(r.json(), example("post_hackathon"))
        assert r.json()["verified"] is False and r.json()["viva_score"] is None
        hid = r.json()["hackathon_id"]

        r = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/expense-split"})
        assert r.status_code == 201
        a = r.json()
        same_shape(a, example("post_analyze"))
        assert len(a["questions"]) == 5
        assert all("rubric" not in q for q in a["questions"])
        assert [q["difficulty"] for q in a["questions"]] == ["easy", "easy", "medium", "medium", "hard"]
        assert a["questions"][0]["snippet"].startswith("line 40 of")
        assert a["contribution"] == {"team_repo": False, "your_commits": 2, "focus_files": []}  # solo repo: no focus
        session = a["session_id"]

        rep = c.get(f"/api/report/{sid}").json()
        assert rep["viva_in_progress"] == {"session_id": session, "repo_full_name": "asharao/expense-split", "answered": 0, "total": 5}

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
        assert rep["status"] == "done" and rep["viva_in_progress"] is None
        assert rep["overall"] == 80  # every question ends at 8: q1 is max(3, 8)
        assert rep["evidence"][0]["had_follow_up"] is True and rep["evidence"][0]["score"] == 8
        assert rep["evidence"][0]["snippet"].startswith("line 40 of") and rep["evidence"][0]["repo_full_name"] == "asharao/expense-split"
        levels = {row["name"]: row["level"] for row in rep["claimed_vs_verified"]}
        assert levels == {"React": "strong", "Python": "strong", "security": "strong"}
        assert rep["hackathons"][0]["verified"] is True and rep["hackathons"][0]["viva_score"] == 80
        assert "verified hackathon: Finalist at HackX 2026 (viva 80)" in rep["matches"][0]["why"]
        assert [m["match"] for m in rep["matches"]] == sorted((m["match"] for m in rep["matches"]), reverse=True)

        same_shape(c.get("/api/listings").json(), example("get_listings"))
        assert len(c.get("/api/listings").json()["listings"]) == 6

        assert c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": False}).status_code == 400
        r = c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": True})
        assert r.status_code == 201
        same_shape(r.json(), example("post_apply"))
        promtal = next(m for m in rep["matches"] if m["listing_id"] == "l-promtal-backend")
        assert r.json()["match"] == promtal["match"]
        assert c.post("/api/apply", json={"student_id": sid, "listing_id": "l-promtal-backend", "share_consent": True}).json()["error"]["code"] == "ALREADY_APPLIED"

        assert c.get("/api/admin/verify").status_code == 401
        assert c.get("/api/admin/verify", headers=ADMIN).json() == {"ok": True}
        sl = c.get("/api/admin/shortlist/l-promtal-backend", headers=ADMIN).json()
        same_shape(sl, example("get_admin_shortlist"))
        mine = next(x for x in sl["candidates"] if x["student_id"] == sid)
        assert mine["answer_modes"] == {"voice": 0, "text": 5, "pasted": 0}
        assert mine["hackathons"] == [{"event": "HackX", "year": 2026, "result": "finalist", "viva_score": 80}]

        csv_text = c.get("/api/admin/shortlist/l-promtal-backend/csv", headers=ADMIN).text
        lines = csv_text.strip().split("\n")
        assert lines[0] == (EXAMPLES / "get_admin_shortlist.csv").read_text(encoding="utf-8").split("\n")[0]
        row = next(line for line in lines[1:] if ",asharao," in line)
        assert row.endswith(",Finalist HackX 2026 (viva 80)")

        r = c.delete(f"/api/students/{sid}/hackathons/{hid}")
        assert r.json() == example("delete_hackathon")
        assert c.get(f"/api/report/{sid}").json()["hackathons"] == []
        assert c.delete(f"/api/students/{sid}/hackathons/{hid}").json()["error"]["code"] == "HACKATHON_NOT_FOUND"


def test_team_repo_viva_focuses_on_the_students_files():
    with TestClient(app) as c:
        sid = c.post("/api/students", json=SIGNUP).json()["student_id"]
        # A teammate's repo with commits by the student is allowed, and the viva targets the files they changed
        r = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "teammate/hack-app"})
        assert r.status_code == 201, r.text
        contribution = r.json()["contribution"]
        assert contribution["team_repo"] is True and contribution["your_commits"] == 1
        assert set(contribution["focus_files"]) == {"server/settle.ts", "api/auth.py"}
        # A hackathon on that repo can be added; one on a repo with none of the student's commits can't
        assert c.post(f"/api/students/{sid}/hackathons", json={**HACKATHON, "repo_full_name": "teammate/hack-app"}).status_code == 201
        r = c.post(f"/api/students/{sid}/hackathons", json={**HACKATHON, "repo_full_name": "stranger/other"})
        assert r.status_code == 400 and r.json()["error"]["code"] == "REPO_NOT_OWNED"
        r = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "stranger/other"})
        assert r.status_code == 400 and r.json()["error"]["code"] == "REPO_NOT_OWNED"


def test_report_combines_finished_vivas_across_repos():
    with TestClient(app) as c:
        sid = c.post("/api/students", json=SIGNUP).json()["student_id"]
        s1 = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/expense-split"}).json()["session_id"]
        finish_viva(c, s1)
        s2 = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/loan-risk-ml"}).json()["session_id"]
        finish_viva(c, s2)
        s3 = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/third"}).json()["session_id"]
        answer(c, s3, "q1", "a good answer")

        rep = c.get(f"/api/report/{sid}").json()
        assert rep["status"] == "done"
        assert len(rep["evidence"]) == 10  # both finished vivas count; the unfinished one doesn't
        assert {e["repo_full_name"] for e in rep["evidence"]} == {"asharao/expense-split", "asharao/loan-risk-ml"}
        assert rep["repo"] == {"full_name": "asharao/loan-risk-ml"}  # the latest finished viva
        assert rep["viva_in_progress"] == {"session_id": s3, "repo_full_name": "asharao/third", "answered": 1, "total": 5}

        # Redoing a repo replaces its old viva instead of counting twice
        s4 = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/expense-split"}).json()["session_id"]
        finish_viva(c, s4)
        rep = c.get(f"/api/report/{sid}").json()
        assert len(rep["evidence"]) == 10 and rep["viva_in_progress"] is None


def test_voice_answers_are_transcribed_then_scored_like_text(monkeypatch):
    from app import audio, gemini
    monkeypatch.setattr(audio, "prepare", lambda b64: b"RIFF fake wav")
    monkeypatch.setattr(gemini, "transcribe", lambda wav: ("a good spoken answer", {"model": "fake-audio", "calls": 1, "tokens_in": 1, "tokens_out": 1, "latency_ms": 1}))
    with TestClient(app) as c:
        sid = c.post("/api/students", json=SIGNUP).json()["student_id"]
        session = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "asharao/expense-split"}).json()["session_id"]
        r = c.post(f"/api/viva/{session}/answer", json={"question_id": "q1", "mode": "voice", "audio_base64": "AAAA", "audio_mime": "audio/webm", "duration_s": 30})
        assert r.status_code == 200
        assert r.json()["transcript"] == "a good spoken answer" and r.json()["follow_up"] is None
        monkeypatch.setattr(gemini, "transcribe", lambda wav: ("", {}))
        r = c.post(f"/api/viva/{session}/answer", json={"question_id": "q2", "mode": "voice", "audio_base64": "AAAA", "audio_mime": "audio/webm"})
        assert r.status_code == 422 and r.json()["error"]["code"] == "EMPTY_ANSWER"


def test_errors_use_the_contract_shape():
    with TestClient(app) as c:
        r = c.post("/api/students", json={**SIGNUP, "github_username": "nobody"})
        assert r.status_code == 404 and r.json()["error"]["code"] == "GITHUB_USER_NOT_FOUND"
        r = c.post("/api/students", json={**SIGNUP, "interests": ["cooking"]})
        assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION"
        sid = c.post("/api/students", json=SIGNUP).json()["student_id"]
        r = c.post("/api/analyze", json={"student_id": sid, "repo_full_name": "someoneelse/repo"})
        assert r.status_code == 400 and r.json()["error"]["code"] == "REPO_NOT_OWNED"
        r = c.post(f"/api/students/{sid}/hackathons", json={**HACKATHON, "result": "champion"})
        assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION"
        r = c.get("/api/viva/not-a-session")
        assert r.status_code == 404 and set(r.json()["error"]) == {"code", "message"}
        r = c.post("/api/students", content=b"x" * 100, headers={"Content-Length": str(11 * 1024 * 1024), "Content-Type": "application/json"})
        assert r.status_code == 413


def test_web_pages_are_served_and_api_errors_stay_json():
    with TestClient(app) as c:
        r = c.get("/")
        assert r.status_code == 200 and "text/html" in r.headers["content-type"] and "recruiter dashboard" in r.text
        r = c.get("/recruiter/")
        assert r.status_code == 200 and "/recruiter/app.js" in r.text
        assert "Content-Security-Policy" in r.text
        assert c.get("/recruiter/app.js").status_code == 200
        assert c.get("/fonts/plex-sans-400.woff2").status_code == 200
        r = c.get("/api/nope")
        assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
        assert c.get("/docs").status_code == 200

