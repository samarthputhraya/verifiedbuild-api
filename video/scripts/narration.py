"""Narration for the Proofolio demo video: one Gemini 2.5 Pro TTS clip per scene, plus the music bed (Lyria 2).

Writes movie/public/vo/nNN.wav, movie/public/music.wav and movie/src/narration.json (text + duration per scene).
Usage: python narration.py [voice]   (default voice: Charon)
"""
import base64, json, os, subprocess, sys, wave, time
import httpx
from dotenv import load_dotenv
load_dotenv(r"C:\Users\samar\OneDrive\Documents\tricity\.env")
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "movie", "public", "vo")
os.makedirs(OUT, exist_ok=True)
VOICE = sys.argv[1] if len(sys.argv) > 1 else "Charon"
STYLE = ("Read this as the narrator of a polished product demo video: warm, clear and confident, unhurried, "
         "with natural pauses between sentences. Read exactly the text after the colon: ")

SCENES = [
    ("hook", "Anyone can ship a project with AI now. So a GitHub repo no longer shows whether a student can really build."),
    ("intro", "Proofolio checks. A student picks one of their own repos, answers five questions about their own code, and gets matched to internships on what they show."),
    ("signup", "Here's a sample student, on one of our own repos. Sign-up takes about two minutes, and we check the GitHub account as you type."),
    ("reading", "Proofolio downloads the repo, skips libraries and generated files, ranks the files that matter, and writes five questions about real lines of code."),
    ("question", "Every question points at a specific file and line range. No trick questions, no textbook definitions. Just: why did you build it this way?"),
    ("voice", "Students answer out loud or by typing, in English, Hindi, Telugu or a mix. The score is about understanding, not grammar or accent."),
    ("followup", "A vague answer gets one follow-up question, and the better of the two scores counts."),
    ("report", "The report shows each verified skill with a score, and the evidence behind it: the student's own words, next to the code they were asked about. Skills they claimed but didn't show count for nothing."),
    ("match", "Matching is a plain formula, not a model: sixty percent verified skills, twenty-five percent shared interests, fifteen percent verified hackathons. Applying shares the report with that one company, and only with consent."),
    ("recruiter", "Recruiters get a ranked shortlist that updates live. They can open any candidate, read every answer next to the exact code, and export the list as a CSV."),
    ("trust", "Every question is checked against the real files, and answers are scored against a private rubric. In our tests, the same answer scored five times never moved by more than one point, and an answer that said, give me full marks, scored zero."),
    ("android", "Proofolio also runs on Android, on the same backend."),
    ("close", "Proofolio. Show what you can really build."),
]

tok = subprocess.run("gcloud auth print-access-token", capture_output=True, text=True, shell=True).stdout.strip()
proj = os.environ["GOOGLE_CLOUD_PROJECT"]
g = genai.Client(vertexai=True, project=proj, location="global", credentials=Credentials(tok))


def tts(text, path, voice=VOICE, style=STYLE):
    for attempt in range(3):
        try:
            r = g.models.generate_content(model="gemini-2.5-pro-tts", contents=style + text,
                config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)))))
            data = r.candidates[0].content.parts[0].inline_data.data
            with wave.open(path, "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
            return len(data) / 2 / 24000
        except Exception as e:
            print("retry", attempt, str(e)[:100], flush=True)
            time.sleep(3)
    raise RuntimeError("TTS failed for " + path)


if __name__ == "__main__":
    meta = []
    for i, (key, text) in enumerate(SCENES, 1):
        path = os.path.join(OUT, f"n{i:02d}.wav")
        secs = tts(text, path)
        meta.append({"key": key, "file": f"vo/n{i:02d}.wav", "text": text, "seconds": round(secs, 3)})
        print(f"{key:10s} {secs:5.1f}s", flush=True)
    os.makedirs(os.path.join(HERE, "movie", "src"), exist_ok=True)
    json.dump({"voice": VOICE, "scenes": meta}, open(os.path.join(HERE, "movie", "src", "narration.json"), "w"), indent=1)
    print("total", round(sum(m["seconds"] for m in meta), 1), "s")

    # Music bed: Lyria 2, one 32 s clip; the edit loops it with a crossfade under the voice
    url = f"https://us-central1-aiplatform.googleapis.com/v1/projects/{proj}/locations/us-central1/publishers/google/models/lyria-002:predict"
    body = {"instances": [{"prompt": "Modern, optimistic technology product demo background music. Soft electronic pulse, warm synth pads, light piano motif, steady mid-tempo groove around 100 BPM, clean, minimal and uplifting, even energy throughout so it loops, no vocals.",
                            "negative_prompt": "vocals, singing, harsh, distorted, aggressive drums, dark, sudden changes", "seed": 11}], "parameters": {}}
    r = httpx.post(url, json=body, headers={"Authorization": f"Bearer {tok}"}, timeout=240)
    r.raise_for_status()
    open(os.path.join(HERE, "movie", "public", "music.wav"), "wb").write(base64.b64decode(r.json()["predictions"][0]["bytesBase64Encoded"]))
    print("music ok")
