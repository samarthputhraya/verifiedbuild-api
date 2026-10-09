"""Settings read from environment variables.

Locally they come from .env (`uvicorn ... --env-file .env`); on Cloud Run from env.yaml.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    github_token: str
    supabase_url: str
    supabase_service_key: str
    admin_key: str
    demo_mode: str  # "cached" turns on demo_cache.py; anything else means live


def _load() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", ""),
        github_token=os.getenv("GITHUB_TOKEN", ""),
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_key=os.getenv("SUPABASE_SERVICE_KEY", ""),
        admin_key=os.getenv("ADMIN_KEY", ""),
        demo_mode=os.getenv("DEMO_MODE", ""),
    )


settings = _load()
