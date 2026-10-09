"""Settings read from environment variables.

Locally they come from .env (`uvicorn ... --env-file .env`); on Cloud Run from env.yaml.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str  # set = Gemini Developer API; empty = Vertex AI with the runtime's Google identity
    gemini_model: str
    gemini_audio_model: str  # speech to text for voice answers
    google_cloud_project: str
    google_cloud_location: str
    github_token: str
    supabase_url: str
    supabase_service_key: str  # empty = in-memory store (local runs and tests only)
    admin_key: str
    demo_mode: str  # "cached" turns on demo_cache.py; anything else means live


def _load() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "") or "gemini-3.8-flash",
        gemini_audio_model=os.getenv("GEMINI_AUDIO_MODEL", "") or "gemini-3.5-flash",
        google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT", ""),
        google_cloud_location=os.getenv("GOOGLE_CLOUD_LOCATION", "") or "global",
        github_token=os.getenv("GITHUB_TOKEN", ""),
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_service_key=os.getenv("SUPABASE_SERVICE_KEY", ""),
        admin_key=os.getenv("ADMIN_KEY", ""),
        demo_mode=os.getenv("DEMO_MODE", ""),
    )


settings = _load()
