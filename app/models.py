"""Request bodies and fixed vocabularies, matching API_CONTRACT.md.

Responses are plain dicts built in each module, in the exact shapes of examples/*.json.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

TAGS = ["backend", "frontend", "data", "ai_ml", "devops", "security"]
INTERESTS = ["ai", "data", "web", "mobile", "saas", "fintech", "edtech", "hrtech", "security", "devtools", "growth", "healthcare"]

MAX_RESUME_B64 = 7_000_000  # about 5 MB of PDF
MAX_AUDIO_B64 = 9_000_000   # about 6.5 MB; 2 minutes of browser audio is far less


class StudentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    college: str = Field(min_length=1, max_length=150)
    github_username: str = Field(min_length=1, max_length=39)
    interests: list[str] = Field(max_length=12)
    skills: list[str] | None = Field(default=None, max_length=30)  # only used when there's no resume
    resume_base64: str | None = Field(default=None, max_length=MAX_RESUME_B64)
    resume_mime: str | None = None

    @field_validator("name", "email", "college", "github_username")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("can't be empty")
        return v

    @field_validator("interests")
    @classmethod
    def _known_interests(cls, v: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(i.strip().lower() for i in v))
        unknown = [i for i in cleaned if i not in INTERESTS]
        if unknown:
            raise ValueError(f"unknown interest {unknown[0]!r}; use one of {', '.join(INTERESTS)}")
        return cleaned


class AnalyzeRequest(BaseModel):
    student_id: str
    repo_full_name: str = Field(min_length=3, max_length=140)


class AnswerRequest(BaseModel):
    question_id: str
    is_follow_up: bool = False
    mode: Literal["voice", "text"]
    answer_text: str | None = Field(default=None, max_length=6000)
    audio_base64: str | None = Field(default=None, max_length=MAX_AUDIO_B64)
    audio_mime: str | None = None
    duration_s: int | None = Field(default=None, ge=0, le=3600)
    pasted: bool = False


class ApplyRequest(BaseModel):
    student_id: str
    listing_id: str
    share_consent: bool
