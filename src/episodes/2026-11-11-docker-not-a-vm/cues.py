"""Derive named visual cues + the SFX event list from the word timings, so
animation and sound are both locked to the narration."""
import json
from pathlib import Path
import os
OUT = Path(__file__).resolve().parents[3] / "episodes" / os.environ["EP"]
T = json.loads((OUT / "timings.json").read_text())
S = [s["start"] for s in T["sentences"]]
def w(si, text, nth=0):
    hits = [x["start"] for x in T["words"] if x["sentence"] == si and x["text"].strip(".,?:!").lower() == text.lower()]
    return hits[nth]
c = dict(
    hook_not=w(0, "not"), reveal=S[1], linux=w(1, "Linux"), disguise=w(1, "disguise"),
    vm=S[2], vm_hw=w(2, "virtual"), vm_hyp=w(2, "machine"), vm_box=w(2, "boots"), vm_guest=w(2, "guest"),
    vm_app=w(2, "system"), vm_kernel=w(2, "kernel"), vm_heavy=w(2, "Heavy"), vm_slow=w(2, "slow"),
    ct=S[3], skips=w(3, "skips"), shares=w(3, "shares"), three=w(3, "three"),
    ns=S[4], ns_word=w(4, "namespaces"), see=w(4, "see"), inside=w(4, "Inside"), pid1=w(4, "process", 1),
    net=w(4, "network"), hostname=w(4, "hostname"),
    cg=S[5], cg_word=w(5, "cgroups"), limit=w(5, "limit"), cpu=w(5, "Half"), ram=w(5, "five"),
    exceed=w(5, "Exceed"), kill=w(5, "kills"),
    fs=S[6], fs_word=w(6, "layered"), image=w(6, "image"), stack=w(6, "stack"), ro=w(6, "read-only"),
    writable=w(6, "writable"),
    ps=S[7], run=w(7, "Run"), there=w(7, "right"), ordinary=w(7, "ordinary"),
    scale=S[8], start=w(8, "start"), fraction=w(8, "fraction"), server=w(8, "server"), hundreds=w(8, "hundreds"),
    end=S[9], isnt=w(9, "isn't"), process=w(9, "process"), boundaries=w(9, "boundaries"),
    duration=T["duration"],
)
sfx = []
def add(kind, t, **k): sfx.append(dict(type=kind, t=round(t, 3), **k))
for k in ("reveal", "vm", "ct", "ns", "cg", "fs", "ps", "scale", "end"): add("whoosh", c[k] - 0.05)
for k in ("vm_hw", "vm_hyp", "vm_guest", "vm_app", "vm_kernel"): add("thud", c[k] + 0.30)
for i in range(3): add("thud", c["image"] + i * 0.42 + 0.32, gain=0.8)
add("thud", c["writable"] + 0.32, gain=0.6)
for k in ("hook_not", "linux", "vm_heavy", "vm_slow", "shares", "pid1", "net", "hostname", "cpu", "ram", "ro",
          "there", "ordinary", "fraction", "process", "boundaries"): add("click", c[k] + 0.05)
for i in range(3): add("click", c["three"] + i * 0.16 + 0.1)
for k in ("ns_word", "cg_word", "fs_word"): add("power", c[k])
add("type", c["inside"], dur=0.45); add("type", c["limit"], dur=1.9); add("type", c["run"], dur=1.0)
add("alarm", c["exceed"] + 0.2, dur=c["kill"] - c["exceed"] - 0.2)
add("zap", c["kill"])
add("power", c["scale"] + 0.3)
add("pops", c["start"], dur=c["hundreds"] + 0.7 - c["start"])
(OUT / "cues.json").write_text(json.dumps(dict(c=c, sfx=sorted(sfx, key=lambda e: e["t"])), indent=1))
print(len(sfx), "sfx events")
