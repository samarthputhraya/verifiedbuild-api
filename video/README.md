# Demo video (2:33)

How the Proofolio demo video was made. Everything on screen is recorded from the live app; nothing is mocked up.

- **Footage:** `scripts/record.mjs` drives the live site with Playwright and records it from Chrome's screencast: a labelled sample student ("Kavya (sample)") signs up, verifies `samarthputhraya/kavach`, answers question 1 out loud, gets a follow-up on question 2, sees the report and applies to Promtal, while a second window records the recruiter dashboard receiving the application.
- **The spoken answer:** written by Gemini in Hinglish (`scripts/make_answer.py`), spoken by Gemini 2.5 Pro TTS, and fed to the app's real microphone path, so the transcript in the video is the app's own.
- **Narration:** `scripts/narration.py`, Gemini 2.5 Pro TTS (voice "Charon"), one clip per scene; `scripts/check_vo.py` transcribes each clip back and compares it with the script. The brand name is sent to the voice as "Proof-olio" so it's pronounced proof-OH-lee-oh.
- **Music:** Lyria 2 on Vertex AI (one 33 s clip, looped under the voice and lowered while anyone speaks).
- **Edit:** Remotion (`src/Main.tsx`): scene lengths follow the narration, footage is trimmed and re-timed to fit, captions are burned in, and the audio is normalised to −16 LUFS with ffmpeg afterwards.

The scripts were run from one working folder laid out as `narration.py`, `make_answer.py`, `build_capture.py` and `check_vo.py` next to `movie/` (this Remotion project, with its assets in `movie/public/`) and `rec/record.mjs`. The footage, voice clips and music aren't committed; the scripts regenerate them. Versions: Remotion 4.0.528, React 18.3.1, Playwright 1.55.0.

Running the recorder creates a "Kavya (sample)" student on the live database and applies it to Promtal.
