"""Write env.yaml (Cloud Run settings) from .env, so the two never drift apart. Both are git-ignored.

Standard library only, so it runs with any Python.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_AUDIO_MODEL", "GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION",
        "GITHUB_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ADMIN_KEY", "DEMO_MODE"]

values = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

lines = ["# Cloud Run settings, generated from .env by scripts/env_to_yaml.py. Never commit."]
lines += [f"{k}: {json.dumps(values.get(k) or '')}" for k in KEYS]
(ROOT / "env.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("env.yaml written. Empty:", ", ".join(k for k in KEYS if not values.get(k)) or "none")
