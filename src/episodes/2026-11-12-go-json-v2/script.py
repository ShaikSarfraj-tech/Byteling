"""Narration script. {spoken|display} lets the TTS pronounce a term one way
while captions show it another. *word* marks a highlighted technical keyword."""
TITLE = "Go 1.27 finally fixes encoding/json (json/v2)"
VOICE = "af_heart"
SPEED = 1.06
SENTENCES = [
    ("Go's *JSON* package has been quietly *hiding* *bugs* for years. Go {one|*1.27*} {twenty-seven|} finally *fixes* it.", 0.4),
    ("Meet {jason|*json/v2,*} {vee|} {two,|} now generally available.", 0.38),
    ("Problem one. The old package matched field names *case* *insensitively.* So a wrong key could silently fill your field. {Vee|V2} {two|} needs an *exact* match.", 0.38),
    ("Problem two. *Duplicate* keys. {Vee|V1} {one|} silently accepted them. {Vee|V2} {two|} returns an *error.*", 0.38),
    ("Problem three. A *nil* *slice* was written as *null,* and broke your front end. {Vee|V2} {two|} writes an *empty* *array.*", 0.38),
    ("It's also *faster.* Early benchmarks report decoding around *twice* as fast.", 0.38),
    ("The best part? Your old *imports* still work. The classic package now runs on the *new* *engine,* with the old behavior.", 0.4),
    ("So upgrade, then move to {vee|*v2*} {two|} one package at a time. *Strict* by default beats *surprising* by default.", 0.0),
]
