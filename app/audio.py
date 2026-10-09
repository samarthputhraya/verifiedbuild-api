"""Answer audio: base64 from the browser -> 16 kHz mono wav for Gemini.

Browsers record different formats (Chrome webm, Safari mp4, Firefox ogg). We convert every
recording to 16 kHz mono wav with ffmpeg (about 0.1 s). In our tests Gemini answered wav in
5-10 s, while some other formats hung until the timeout.
"""

import base64
import binascii
import logging
import os
import subprocess
import tempfile

from app.errors import ApiError

log = logging.getLogger("verifiedbuild")

MAX_SECONDS = 125  # 2 minutes plus a little slack


def _unreadable() -> ApiError:
    return ApiError("AUDIO_UNREADABLE", "We couldn't play that recording. Please record again, or type your answer.", 422)


def prepare(audio_base64: str) -> bytes:
    """Returns wav bytes ready to send to Gemini."""
    try:
        data = base64.b64decode(audio_base64.split(",", 1)[-1], validate=False)
    except (binascii.Error, ValueError):
        raise _unreadable()
    if len(data) < 1000:  # a few hundred bytes is a header with no sound
        raise _unreadable()
    return _to_wav(data)


def _to_wav(data: bytes) -> bytes:
    # A temp file, not a pipe: mp4/m4a keep their index at the end of the file, which a pipe can't seek to.
    with tempfile.NamedTemporaryFile(delete=False) as f:
        f.write(data)
        src = f.name
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", src, "-t", str(MAX_SECONDS),
             "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
            capture_output=True, timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.error("ffmpeg failed to run: %s", exc)
        raise _unreadable()
    finally:
        os.unlink(src)
    if result.returncode != 0 or len(result.stdout) < 1000:
        log.warning("ffmpeg could not convert audio: %s", result.stderr.decode(errors="replace")[:300])
        raise _unreadable()
    return result.stdout
