"""Turns the captured frames into constant-30fps videos and writes the edit's timeline.

capture/student/*.jpg + student.json  -> movie/public/student.mp4
capture/recruiter/*.jpg + recruiter.json -> movie/public/recruiter.mp4
capture/markers.json -> movie/src/timeline.json (each marker in seconds from the start of its video)
"""
import json, os, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, "capture")
PUB = os.path.join(HERE, "movie", "public")
os.makedirs(PUB, exist_ok=True)
markers = json.load(open(os.path.join(CAP, "markers.json")))
timeline = {}
for name in ["landing", "student", "recruiter"]:
    meta = json.load(open(os.path.join(CAP, f"{name}.json")))
    frames = [f for f in meta["frames"] if os.path.exists(f["file"]) and os.path.getsize(f["file"]) > 0]
    t0 = frames[0]["t"]
    lst = os.path.join(CAP, f"{name}_list.txt")
    with open(lst, "w") as fh:
        for i, f in enumerate(frames):
            nxt = frames[i + 1]["t"] if i + 1 < len(frames) else meta["end"]
            fh.write(f"file '{f['file'].replace(os.sep, '/')}'\nduration {max(0.001, nxt - f['t']):.4f}\n")
        fh.write(f"file '{frames[-1]['file'].replace(os.sep, '/')}'\n")
    out = os.path.join(PUB, f"{name}.mp4")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-fps_mode", "cfr", "-r", "30", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-movflags", "+faststart", out], check=True)
    dur = meta["end"] - t0
    timeline[name] = {"duration": round(dur, 3), "fps": round(len(frames) / dur, 1),
                      "markers": {m["name"]: round(m["t"] - t0, 3) for m in markers if t0 - 1 <= m["t"] <= meta["end"] + 1}}
    print(name, f"{len(frames)} frames, {dur:.1f}s, {len(frames)/dur:.1f} fps ->", out)
voice = json.load(open(os.path.join(CAP, "q1_voice.json")))
timeline["answer_q1_seconds"] = round(voice["seconds"], 3)
timeline["answer_q1_text"] = voice["text"]
shutil.copy(os.path.join(CAP, "answer_q1.wav"), os.path.join(PUB, "answer_q1.wav"))
json.dump(timeline, open(os.path.join(HERE, "movie", "src", "timeline.json"), "w"), indent=1)
print(json.dumps(timeline, indent=1)[:1500])
