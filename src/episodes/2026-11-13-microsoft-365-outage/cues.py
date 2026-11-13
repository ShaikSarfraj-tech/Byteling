"""Named visual cues + SFX events for the Microsoft 365 outage short."""
import json, os
from pathlib import Path
OUT = Path(__file__).resolve().parents[3] / "episodes" / os.environ["EP"]
T = json.loads((OUT / "timings.json").read_text())
S = [s["start"] for s in T["sentences"]]
def w(si, text, nth=0):
    hits = [x["start"] for x in T["words"] if x["sentence"] == si and x["text"].rstrip(".,?:!").lower() == text.lower()]
    return hits[nth]
c = dict(
    teams=w(0, "Teams"), down=w(0, "down"), world=w(0, "world"), notattack=w(0, "not"),
    news=S[1], m365=w(1, "365"), failing=w(1, "failing"), seventy=w(1, "seventy"),
    expl=S[2], spike=w(2, "traffic"), failed=w(2, "Failed"), health=w(2, "health"),
    lb=S[3], balancer=w(3, "load"), asking=w(3, "asking"), alive=w(3, "alive"), stops=w(3, "stops"), pulled=w(3, "pulled"),
    one=S[4], dies=w(4, "dies"), many=w(4, "many"), atonce=w(4, "once"), allp=w(4, "all"),
    now=S[5], fewer=w(5, "fewer"), overload=w(5, "overload"), slow=w(5, "slow"), failing2=w(5, "failing"),
    casc=S[6], cascading=w(6, "cascading"),
    inv=S[7], root=w(7, "root"), investigated=w(7, "investigated"),
    end=S[8], hc=w(8, "Health"), decide=w(8, "decide"), fail=w(8, "fail"), carefully=w(8, "carefully"),
    duration=T["duration"],
)
sfx = []
def add(kind, t, **k): sfx.append(dict(type=kind, t=round(t, 3), **k))
for k in ("news", "expl", "lb", "one", "now", "inv", "end"): add("whoosh", c[k] - 0.05)
add("zap", c["down"], gain=0.8); add("thud", c["down"] + 0.35)
for i in range(5): add("click", c["m365"] + 0.25 + i * 0.3)
for k in ("teams", "notattack", "seventy", "spike", "failed", "balancer", "alive", "stops", "dies", "fewer",
          "root", "investigated", "hc", "fail", "carefully"): add("click", c[k] + 0.05)
add("pops", c["asking"], dur=1.6); add("thud", c["pulled"] + 0.35, gain=0.7)
add("pops", c["many"], dur=1.4); add("thud", c["allp"] + 0.5); add("alarm", c["overload"], dur=c["failing2"] - c["overload"] + 0.5)
for i in range(4): add("thud", c["failing2"] + 0.1 + i * 0.22, gain=0.8)
add("zap", c["cascading"] + 0.2); add("power", c["cascading"] - 0.1)
(OUT / "cues.json").write_text(json.dumps(dict(c=c, sfx=sorted(sfx, key=lambda e: e["t"])), indent=1))
print(len(sfx), "sfx events")
