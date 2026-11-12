"""Narration script. {spoken|display} lets the TTS pronounce a term one way
while captions show it another. *word* marks a highlighted technical keyword."""
TITLE = "TypeScript 7 broke Angular's compiler, so Angular is rewriting it in Rust"
VOICE = "af_heart"
SPEED = 1.06
SENTENCES = [
    ("*TypeScript* *seven* just *broke* Angular's *compiler.* So Angular is rewriting part of it, in *Rust.*", 0.4),
    ("Here's why. TypeScript seven is the *native* rewrite, in *Go.* Much faster. But it shipped without the *transformer* *API.*", 0.38),
    ("And Angular's compiler, {N|*ngc,*} {G|} {C,|} plugged straight into that API, to turn your *decorators* and *templates* into JavaScript.", 0.38),
    ("So the team built {N|*ngp,*} {G|} {P,|} the Angular *preprocessor.* A *Rust* front end, built on {O|*Oxc,*} {X|} {C,|} scans your files in *parallel,* finds every *component,* and resolves its *metadata.*", 0.38),
    ("Then it hands off. *Type* *checking* and bundling go to tools like {T|*tsgo,*} {S|} {go,|} *esbuild,* or *Rolldown.*", 0.38),
    ("Early community *benchmarks* show builds up to *three* *times* faster.", 0.38),
    ("But it's still in *beta.* For production, stay on {N|*ngc*} {G|} {C|} for now.", 0.42),
    ("The lesson? Your framework is only as *fast* as the *tools* underneath it. And those tools are going *native.*", 0.0),
]
