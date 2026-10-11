"""Narration for the Proofolio demo video, version 2: one Gemini 2.5 Pro TTS clip per scene, plus a second music bed.

Each scene has `text` (burned-in captions, written as it should read) and `say` (what the voice is sent, spelled for
pronunciation). Writes movie/public/vo/vNN.wav, movie/public/music_problem.wav and movie/src/narration.json.
Usage: python narration2.py [voice] [--only key,key] [--no-music]
"""
import base64, json, os, subprocess, sys, wave, time
from concurrent.futures import ThreadPoolExecutor
import httpx
from dotenv import load_dotenv
load_dotenv(r"C:\Users\samar\OneDrive\Documents\tricity\.env")
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "movie", "public", "vo")
os.makedirs(OUT, exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith("--")]
VOICE = args[0] if args else "Charon"
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv[1:] if a.startswith("--only=")), None)
STYLE = ("Read this as the narrator of a polished product demo video for hackathon judges: warm, clear and confident, "
         "at a lively but unhurried pace, with short natural pauses between sentences. Read exactly the text after the colon: ")

# (key, caption text, spoken text or None when it's the same)
SCENES = [
    ("problem", "A recruiter's first look at a résumé lasts 7.4 seconds, and 84% of developers use or plan to use AI tools. So every GitHub looks impressive. Real builders get filtered out by keywords, hackathon wins are taken on trust, and 74% of Indian recruiters say qualified talent got harder to find.",
     "A recruiter's first look at a résumé lasts seven point four seconds, and eighty-four percent of developers use, or plan to use, AI tools. So every GitHub looks impressive. Real builders get filtered out by keywords, hackathon wins are taken on trust, and seventy-four percent of Indian recruiters say qualified talent got harder to find."),
    ("solution", "Nobody asks: do you understand the code you're showing? Proofolio does. Students answer five questions about their own code, and get matched on verified skills, interests and hackathon performance.", None),
    ("signup", "Here's the live app. Gemini reads claimed skills from a résumé, and a hackathon win, like our team's at ARGONYX '26, stays a claim until a viva verifies it.",
     "Here's the live app. Gemini reads claimed skills from a résumé, and a hackathon win, like our team's at Argonyx twenty-six, stays a claim until a viva verifies it."),
    ("reading", "Proofolio reads the repo and asks about real lines of code. On this team repo, only about the files this student changed.", None),
    ("voice", "Answer out loud or typed, in any language. We score understanding, not accent, and a vague answer gets one follow-up.", None),
    ("report", "Every score comes with evidence: their own words beside the code. Claims they didn't show count for nothing. The hackathon is now verified.", None),
    ("match", "The match is a plain formula: 60% verified skills, 25% interests, 15% verified hackathons. With consent, the recruiter sees the applicant arrive, ranked, with every answer beside its code.",
     "The match is a plain formula: sixty percent verified skills, twenty-five percent interests, fifteen percent verified hackathons. With consent, the recruiter sees the applicant arrive, ranked, with every answer beside its code."),
    ("arch", "One FastAPI service on Cloud Run runs every AI step for the web app, dashboard and Android app. Questions are checked against real files; in our tests, repeat scoring never moved more than a point.",
     "One Fast A.P.I. service on Cloud Run runs every A.I. step for the web app, dashboard and Android app. Questions are checked against real files; in our tests, repeat scoring never moved more than a point."),
    ("business", "Students use it free: one viva, reused on every application. Companies get fewer, better interviews, and pay ₹2,999 per role, the price of one Internshala listing. Placement cells pay per batch, platforms like Promtal per candidate, and a viva costs us about ₹6 in AI.",
     "Students use it free: one viva, reused on every application. Companies get fewer, better interviews, and pay two thousand nine hundred and ninety-nine rupees per role, the price of one Intern-shaala listing. Placement cells pay per batch, platforms like Promtal per candidate, and a viva costs us about six rupees in A.I."),
    ("close", "Profiles, listings, AI-verified matching, apply and a recruiter shortlist: all live today. Proofolio. Show what you can really build.", None),
]

tok = subprocess.run("gcloud auth print-access-token", capture_output=True, text=True, shell=True).stdout.strip()
proj = os.environ["GOOGLE_CLOUD_PROJECT"]
g = genai.Client(vertexai=True, project=proj, location="global", credentials=Credentials(tok))


def tts(text, path, voice=VOICE, style=STYLE):
    for attempt in range(4):
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
            time.sleep(8)
    raise RuntimeError("TTS failed for " + path)


def one(i_scene):
    i, (key, text, say) = i_scene
    path = os.path.join(OUT, f"w{i:02d}.wav")
    spoken = (say or text).replace("Proofolio", "Proof-olio")
    secs = tts(spoken, path)
    print(f"{key:10s} {secs:5.1f}s", flush=True)
    return {"key": key, "file": f"vo/w{i:02d}.wav", "text": text, "say": spoken, "seconds": round(secs, 3)}


if __name__ == "__main__":
    meta_path = os.path.join(HERE, "movie", "src", "narration.json")
    old_meta = None
    old = {s["key"]: s for s in json.load(open(meta_path))["scenes"]} if ONLY and os.path.exists(meta_path) else {}
    todo = [(i, s) for i, s in enumerate(SCENES, 1) if not ONLY or s[0] in ONLY]
    with ThreadPoolExecutor(3) as ex:
        done = {m["key"]: m for m in ex.map(one, todo)}
    def existing(i, sc):
        if sc[0] in old: return old[sc[0]]
        path = os.path.join(OUT, f"w{i:02d}.wav")
        with wave.open(path) as w: secs = w.getnframes() / w.getframerate()
        return {"key": sc[0], "file": f"vo/w{i:02d}.wav", "text": sc[1], "say": (sc[2] or sc[1]).replace("Proofolio", "Proof-olio"), "seconds": round(secs, 3)}
    meta = [done.get(sc[0]) or existing(i, sc) for i, sc in enumerate(SCENES, 1)]
    json.dump({"voice": VOICE, "scenes": meta}, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("total", round(sum(m["seconds"] for m in meta), 1), "s")

    if "--no-music" not in sys.argv:
        # A quieter, thoughtful bed for the problem section; the bright bed (music.wav) takes over at the solution
        url = f"https://us-central1-aiplatform.googleapis.com/v1/projects/{proj}/locations/us-central1/publishers/google/models/lyria-002:predict"
        body = {"instances": [{"prompt": "Minimal, thoughtful technology documentary underscore. Soft pulsing synth, low warm pads, sparse felt piano notes, slow steady tempo around 90 BPM, a sense of a problem being considered, restrained and clean, even energy so it loops, no vocals.",
                                "negative_prompt": "vocals, singing, drums, harsh, distorted, horror, sudden changes, cheerful", "seed": 7}], "parameters": {}}
        r = httpx.post(url, json=body, headers={"Authorization": f"Bearer {tok}"}, timeout=240)
        r.raise_for_status()
        open(os.path.join(HERE, "movie", "public", "music_problem.wav"), "wb").write(base64.b64decode(r.json()["predictions"][0]["bytesBase64Encoded"]))
        print("music ok")
