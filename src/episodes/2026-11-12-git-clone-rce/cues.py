"""Named visual cues + SFX events for the Git security-release short."""
import json, os
from pathlib import Path
OUT = Path(__file__).resolve().parents[3] / "episodes" / os.environ["EP"]
T = json.loads((OUT / "timings.json").read_text())
S = [s["start"] for s in T["sentences"]]
def w(si, text, nth=0):
    hits = [x["start"] for x in T["words"] if x["sentence"] == si and x["text"].rstrip(".,?:!").lower() == text.lower()]
    return hits[nth]
c = dict(
    code=w(0, "hacker's"), news=S[1], six=w(1, "six"), high=w(1, "high"),
    trick=S[2], writes=w(2, "writes"), checks=w(2, "checks"), nothing=w(2, "nothing"), dotgit=w(2, ".git"),
    att=S[3], long=w(3, "extremely"), trunc=w(3, "truncated"), passes=w(3, "passes"), written=w(3, "written"),
    shorter=w(3, "shorter"), dotgit2=w(3, ".git"),
    sub=S[4], submodule=w(4, "submodule"), symlink=w(4, "symlink"), folder=w(4, "folder"), hooks=w(4, "hooks"),
    run=S[5], uses=w(5, "uses"), runs=w(5, "attacker's"), laptop=w(5, "laptop"), ci=w(5, "CI"),
    flag=S[6], flagw=w(6, "--recurse-submodules"), pipelines=w(6, "pipelines"), agents=w(6, "agents"),
    fix=S[7], update=w(7, "update"), ver=w(7, "2.56.1"), backport=w(7, "backport"),
    wk=S[8], clone=w(8, "Clone"), inspect=w(8, "inspect"), mods=w(8, ".gitmodules"),
    end=S[9], stranger=w(9, "stranger"), treat=w(9, "Treat"), duration=T["duration"],
)
sfx = []
def add(kind, t, **k): sfx.append(dict(type=kind, t=round(t, 3), **k))
for k in ("news", "trick", "att", "sub", "run", "flag", "fix", "wk", "end"): add("whoosh", c[k] - 0.05)
add("type", 0.3, dur=2.0)
for i in range(3): add("thud", c["writes"] + i * 0.35 + 0.6, gain=0.7)
add("zap", c["nothing"] + 0.3, gain=0.5)
for k in ("code", "six", "high", "checks", "dotgit", "long", "passes", "shorter", "submodule", "symlink", "hooks",
          "laptop", "ci", "flagw", "pipelines", "agents", "backport", "mods", "stranger", "treat"): add("click", c[k] + 0.05)
add("power", c["trunc"]); add("thud", c["dotgit2"] + 0.25)
add("alarm", c["uses"], dur=c["runs"] - c["uses"]); add("zap", c["runs"] + 0.1)
add("power", c["update"] + 0.3); add("type", c["update"], dur=0.6); add("click", c["ver"] + 0.1)
add("type", c["clone"], dur=0.7); add("type", c["inspect"], dur=0.8)
(OUT / "cues.json").write_text(json.dumps(dict(c=c, sfx=sorted(sfx, key=lambda e: e["t"])), indent=1))
print(len(sfx), "sfx events")
