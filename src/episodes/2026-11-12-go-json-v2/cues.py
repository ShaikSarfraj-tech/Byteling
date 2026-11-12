"""Named visual cues + SFX events for the Go json/v2 short."""
import json, os
from pathlib import Path
OUT = Path(__file__).resolve().parents[3] / "episodes" / os.environ["EP"]
T = json.loads((OUT / "timings.json").read_text())
S = [s["start"] for s in T["sentences"]]
def w(si, text, nth=0):
    hits = [x["start"] for x in T["words"] if x["sentence"] == si and x["text"].rstrip(".,?:!").lower() == text.lower()]
    return hits[nth]
c = dict(
    hiding=w(0, "hiding"), bugs=w(0, "bugs"), go127=w(0, "1.27"), fixes=w(0, "fixes"),
    meet=S[1], v2w=w(1, "json/v2"), ga=w(1, "generally"),
    p1=S[2], old=w(2, "old"), case=w(2, "case"), wrong=w(2, "wrong"), silently=w(2, "silently"), fill=w(2, "fill"),
    p1v2=w(2, "V2"), exact=w(2, "exact"),
    p2=S[3], dup=w(3, "Duplicate"), v1b=w(3, "V1"), accepted=w(3, "accepted"), p2v2=w(3, "V2"), returns=w(3, "returns"), error=w(3, "error"),
    p3=S[4], nil=w(4, "nil"), written=w(4, "written"), null=w(4, "null"), broke=w(4, "broke"), p3v2=w(4, "V2"), writes=w(4, "writes"), empty=w(4, "empty"),
    fast=S[5], faster=w(5, "faster"), bench=w(5, "benchmarks"), twice=w(5, "twice"),
    best=S[6], imports=w(6, "imports"), work=w(6, "work"), classic=w(6, "classic"), engine=w(6, "engine"), behavior=w(6, "behavior"),
    end=S[7], upgrade=w(7, "upgrade"), move=w(7, "move"), strict=w(7, "Strict"), surprising=w(7, "surprising"),
    duration=T["duration"],
)
sfx = []
def add(kind, t, **k): sfx.append(dict(type=kind, t=round(t, 3), **k))
for k in ("meet", "p1", "p2", "p3", "fast", "best", "end"): add("whoosh", c[k] - 0.05)
add("pops", c["hiding"], dur=1.2); add("power", c["fixes"])
for k in ("go127", "v2w", "case", "fill", "exact", "dup", "accepted", "nil", "null", "empty", "bench", "twice",
          "work", "engine", "upgrade", "strict", "surprising"): add("click", c[k] + 0.05)
add("thud", c["wrong"] + 0.5, gain=0.7); add("thud", c["silently"] + 0.5, gain=0.6); add("zap", c["exact"] - 0.25, gain=0.4)
add("thud", c["dup"] + 0.6, gain=0.6); add("thud", c["v1b"] + 0.7, gain=0.6); add("zap", c["error"], gain=0.8)
add("thud", c["written"] + 0.3, gain=0.6); add("power", c["p3v2"] + 0.3, gain=0.7); add("power", c["classic"] + 0.3, gain=0.7)
add("type", c["imports"] - 0.2, dur=0.7)
(OUT / "cues.json").write_text(json.dumps(dict(c=c, sfx=sorted(sfx, key=lambda e: e["t"])), indent=1))
print(len(sfx), "sfx events")
