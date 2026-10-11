import json, os, subprocess, difflib, re
from dotenv import load_dotenv
load_dotenv(r"C:\Users\samar\OneDrive\Documents\tricity\.env")
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials
tok = subprocess.run("gcloud auth print-access-token", capture_output=True, text=True, shell=True).stdout.strip()
g = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location="global", credentials=Credentials(tok))
d = json.load(open("movie/src/narration.json"))
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", " ")).split()
for s in d["scenes"]:
    audio = open(os.path.join("movie/public", s["file"]), "rb").read()
    r = g.models.generate_content(model="gemini-3.5-flash", contents=[types.Part.from_bytes(data=audio, mime_type="audio/wav"), "Transcribe this audio exactly, word for word. Output only the transcript."])
    heard = r.text.strip()
    ratio = difflib.SequenceMatcher(None, norm(s["text"]), norm(heard)).ratio()
    print(f"{s['key']:10s} {ratio:.2f}  {'' if ratio > 0.93 else 'HEARD: ' + heard}", flush=True)
