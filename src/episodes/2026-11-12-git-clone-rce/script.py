"""Narration script. {spoken|display} lets the TTS pronounce a term one way
while captions show it another. *word* marks a highlighted technical keyword."""
TITLE = "One git clone could run a hacker's code (Git 2.56.1 security release)"
VOICE = "af_heart"
SPEED = 1.08
SENTENCES = [
    ("One *git* *clone* could run a *hacker's* *code* on your machine.", 0.35),
    ("This week, Git patched *six* *vulnerabilities.* The worst is rated *high* severity.", 0.38),
    ("Here's the trick. Before Git writes a file, it *checks* the *path,* so nothing can overwrite its own {dot|*.git*} {git|} data.", 0.36),
    ("But the attacker uses an *extremely* *long* *path.* Its length gets *truncated.* So it passes the check under its full name, then gets written under a shorter one: {dot|*.git*} {git.|}", 0.36),
    ("Inside a {sub|*submodule,*} {module,|} that file becomes a *symlink,* pointing at a folder of *malicious* *hooks.*", 0.36),
    ("When Git uses that folder, the *attacker's* *code* runs. On your laptop, or your *CI* runner.", 0.38),
    ("It only triggers with {recurse|*--recurse-submodules,*} {sub|} {modules,|} which pipelines and coding agents use all the time.", 0.38),
    ("The fix: *update* to Git {two|*2.56.1,*} {point|} {fifty-six|} {point|} {one,|} or a patched *backport.*", 0.36),
    ("Can't update yet? Clone *without* {sub|submodules} {modules|} first, and *inspect* {dot|*.gitmodules*} {git|} {modules.|}", 0.42),
    ("A repo is *code* from a *stranger.* Treat it that way.", 0.0),
]
