FROM python:3.11-slim

# ffmpeg converts browser audio (Chrome records webm) to wav for Gemini
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only what the app needs, so .env or keys can never end up in the image
COPY app ./app
COPY seed ./seed
COPY web ./web

# Cloud Run sets $PORT (8080 by default)
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
