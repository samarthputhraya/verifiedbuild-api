"""Writes one answer for the recorded sample viva. Input: a JSON file {question, snippet, file, kind, out}.

kind "voice": a short spoken answer in Hinglish (Latin script), saved as speech to out.wav and its text to out.txt
kind "good":  a clear typed answer in English, saved to out.txt
"""
import json, os, subprocess, sys, wave
from dotenv import load_dotenv
load_dotenv(r"C:\Users\samar\OneDrive\Documents\tricity\.env")
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials

job = json.load(open(sys.argv[1], encoding="utf-8"))
tok = subprocess.run("gcloud auth print-access-token", capture_output=True, text=True, shell=True).stdout.strip()
g = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location="global", credentials=Credentials(tok))
base = f"Question: {job['question']}\nCode ({job['file']}):\n{job['snippet']}"
if job["kind"] == "voice":
    p = ("You wrote this code. Answer this viva question out loud, as a college student in India, in natural Hinglish "
         "(Hindi and English mixed, Hindi written in Latin letters). 2 to 3 sentences, about 45 words, specific to the code, "
         "first person, no preamble, no markdown.\n" + base)
else:
    p = ("You wrote this code. Answer this viva question clearly in English, 2 to 3 sentences, about 60 words, specific to "
         "the actual code, first person, no preamble, no markdown.\n" + base)
text = g.models.generate_content(model="gemini-3.8-flash", contents=p).text.strip().replace("\n", " ")
open(job["out"] + ".txt", "w", encoding="utf-8").write(text)
if job["kind"] == "voice":
    style = ("Say this like a college student explaining their own code to an examiner: natural, relaxed and a little informal, "
             "Indian English accent, Hindi words pronounced naturally. Say exactly: ")
    r = g.models.generate_content(model="gemini-2.5-pro-tts", contents=style + text,
        config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Leda")))))
    data = r.candidates[0].content.parts[0].inline_data.data
    with wave.open(job["out"] + ".wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
    print(json.dumps({"text": text, "seconds": len(data) / 2 / 24000}))
else:
    print(json.dumps({"text": text}))
