# Demo video (2:24)

How the Proofolio demo video was made. Everything shown from the product is recorded from the live app; nothing is mocked up.

**What it covers, in order:** the problem, with sourced numbers (Ladders 2018: 7.4 s first look at a résumé; Stack Overflow Developer Survey 2025: 84% of developers use or plan to use AI tools; LinkedIn research reported by People Matters, Jan 2026: 74% of Indian recruiters say qualified talent got harder to find) → what Proofolio does and how it maps to the Promtal brief → the live app end to end, including the recruiter dashboard → architecture and why the score can be trusted → who gains, who pays, unit economics → the brief, checked off. A longer 4:32 cut was made first; the submission site asks for about 2 minutes.

- **Footage:** `scripts/record.mjs` drives the live site with Playwright and records it from Chrome's screencast:
  - the landing page;
  - a labelled sample student ("Kavya (sample)", college "Sample profile, AI-written answers") signs up on our own GitHub account with a sample résumé PDF the recorder makes (it says "SAMPLE RESUME" at the top);
  - adds a hackathon our team really did (GuruGraph, Best UI/UX at ARGONYX '26, team of 3) and verifies it with a viva on `samarthputhraya/Guru-Graph`, a team repo with three authors, so the questions are about the files the account changed;
  - answers question 1 out loud, gets a follow-up on question 2, sees the report and applies to Promtal, while a second window records the recruiter dashboard receiving the application.
- **The answers:** written by Gemini (`scripts/make_answer.py`). The spoken one is in Hinglish, spoken by Gemini 2.5 Pro TTS and fed to the app's real microphone path, so the transcript in the video is the app's own.
- **Narration:** `scripts/narration.py`, Gemini 2.5 Pro TTS (voice "Charon"), one clip per scene, sped up 8% with ffmpeg `atempo`. Each scene has a caption text and a spoken text (numbers and names spelled for the voice). `scripts/check_vo.py` transcribes each clip back and compares it with the spoken text.
- **Music:** Lyria 2 on Vertex AI: a restrained bed under the problem and a brighter one from "Proofolio does", each looped under the voice and lowered while anyone speaks.
- **Edit:** Remotion (`src/Main.tsx`): scene lengths follow the narration, footage is trimmed and re-timed to fit, captions are burned in, and the audio is normalised to −16 LUFS with ffmpeg afterwards.
- **Numbers in the business section:** pricing is our proposal; Internshala's ₹2,999 single-listing price is from internshala.com/blog (Sep 2026). AI cost per viva is the median of the 6 finished vivas in the live database (`python -m scripts.stats --price-in 1.5 --price-out 7.5`): $0.071, at the Gemini 3.8 Flash list price as published by third-party trackers.

The scripts were run from one working folder laid out as `narration.py`, `make_answer.py`, `build_capture.py` and `check_vo.py` next to `movie/` (this Remotion project, with its assets in `movie/public/`) and `rec/record.mjs`, with a Python venv one level up. The footage, voice clips and music aren't committed; the scripts regenerate them. Versions: Remotion 4.0.528, React 18.3.1, Playwright 1.55.0.

Running the recorder creates a "Kavya (sample)" student on the live database, adds the ARGONYX '26 hackathon to it, and applies it to Promtal.
