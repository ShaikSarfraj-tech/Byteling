"""Named visual cues + SFX events for the Angular ngp / TypeScript 7 short."""
import json, os
from pathlib import Path
OUT = Path(__file__).resolve().parents[3] / "episodes" / os.environ["EP"]
T = json.loads((OUT / "timings.json").read_text())
S = [s["start"] for s in T["sentences"]]
def w(si, text, nth=0):
    hits = [x["start"] for x in T["words"] if x["sentence"] == si and x["text"].rstrip(".,?:!").lower() == text.lower()]
    return hits[nth]
c = dict(
    broke=w(0, "broke"), so=w(0, "So"), rust0=w(0, "Rust"),
    why=S[1], native=w(1, "native"), go=w(1, "Go"), faster=w(1, "faster"), without=w(1, "without"), api=w(1, "transformer"),
    ngc=S[2], ngcw=w(2, "ngc"), plugged=w(2, "plugged"), decorators=w(2, "decorators"), templates=w(2, "templates"), js=w(2, "JavaScript"),
    ngp=S[3], built=w(3, "built"), ngpw=w(3, "ngp"), rust=w(3, "Rust"), oxc=w(3, "Oxc"), scans=w(3, "scans"),
    parallel=w(3, "parallel"), component=w(3, "component"), metadata=w(3, "metadata"),
    hand=S[4], hands=w(4, "hands"), type=w(4, "Type"), bundling=w(4, "bundling"), tsgo=w(4, "tsgo"), esbuild=w(4, "esbuild"), rolldown=w(4, "Rolldown"),
    bench=S[5], benchmarks=w(5, "benchmarks"), three=w(5, "three"),
    beta=S[6], betaw=w(6, "beta"), production=w(6, "production"), stay=w(6, "stay"),
    end=S[7], fast=w(7, "fast"), tools=w(7, "tools", 1), native2=w(7, "native"), duration=T["duration"],
)
sfx = []
def add(kind, t, **k): sfx.append(dict(type=kind, t=round(t, 3), **k))
for k in ("why", "ngc", "ngp", "hand", "bench", "beta", "end"): add("whoosh", c[k] - 0.05)
add("whoosh", c["broke"] - 0.7); add("zap", c["broke"] + 0.05, gain=0.8); add("thud", c["broke"] + 0.35)
for k in ("rust0", "go", "faster", "api", "ngcw", "js", "rust", "oxc", "component", "metadata", "type", "bundling",
          "tsgo", "esbuild", "rolldown", "betaw", "production", "fast", "native2"): add("click", c[k] + 0.05)
add("thud", c["decorators"] + 0.45, gain=0.6); add("thud", c["templates"] + 0.45, gain=0.6)
add("thud", c["ngpw"] + 0.3); add("pops", c["scans"], dur=0.9); add("power", c["parallel"] + 0.3, gain=0.8)
add("pops", c["parallel"], dur=1.3); add("power", c["three"])
(OUT / "cues.json").write_text(json.dumps(dict(c=c, sfx=sorted(sfx, key=lambda e: e["t"])), indent=1))
print(len(sfx), "sfx events")
