"""Narration script. {spoken|display} lets the TTS pronounce a term one way
while captions show it another. *word* marks a highlighted technical keyword."""
TITLE = "A Docker container is not a tiny VM"
VOICE = "af_heart"
SPEED = 1.06
# (text, pause_after_seconds)
SENTENCES = [
    ("A *Docker* *container* is not a tiny *virtual* *machine.*", 0.22),
    ("It's just a *Linux* *process,* wearing a disguise.", 0.42),
    ("A virtual machine boots a full *guest* *operating* *system,* with its own *kernel.* Heavy, and slow.", 0.38),
    ("A container skips all of that. It *shares* the host's *kernel,* and relies on three kernel features.", 0.38),
    ("One: *namespaces.* They control what the process can *see.* Inside, it thinks it's *process* *ID* *one,* with its own *network* and *hostname.*", 0.38),
    ("Two: {C|*cgroups.*} {groups.|} They limit what it can *use.* Half a *CPU,* five hundred megabytes of *RAM.* Exceed the memory, and the kernel *kills* it.", 0.38),
    ("Three: a *layered* *filesystem.* Your *image* is a stack of *read-only* layers, with one thin *writable* layer on top.", 0.38),
    ("Don't believe me? Run {P|*ps*} {S|} on the *host.* Your container is right there, an ordinary *process.*", 0.38),
    ("That's why containers start in a *fraction* of a *second,* and one server can run *hundreds* of them.", 0.45),
    ("A container isn't a machine. It's a *process* with *boundaries.*", 0.0),
]
