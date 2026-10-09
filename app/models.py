"""Request bodies, matching API_CONTRACT.md.

Response models get added here as each endpoint moves from its example JSON to real logic.
"""

from typing import Literal

from pydantic import BaseModel


class StudentCreate(BaseModel):
    name: str
    email: str
    college: str
    github_username: str
    interests: list[str]
    skills: list[str] | None = None  # only used when there's no resume
    resume_base64: str | None = None
    resume_mime: str | None = None


class AnalyzeRequest(BaseModel):
    student_id: str
    repo_full_name: str


class AnswerRequest(BaseModel):
    question_id: str
    is_follow_up: bool = False
    mode: Literal["voice", "text"]
    answer_text: str | None = None
    audio_base64: str | None = None
    audio_mime: str | None = None
    duration_s: int | None = None
    pasted: bool = False


class ApplyRequest(BaseModel):
    student_id: str
    listing_id: str
    share_consent: bool
