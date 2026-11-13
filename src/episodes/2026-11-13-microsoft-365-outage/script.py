"""Narration script. {spoken|display} lets the TTS pronounce a term one way
while captions show it another. *word* marks a highlighted technical keyword."""
TITLE = "Why Outlook and Teams went down worldwide (failed health checks)"
VOICE = "am_michael"
SPEED = 1.04
SENTENCES = [
    ("*Outlook* and *Teams* just went *down* around the world. And Microsoft says it was *not* an attack.", 0.4),
    ("On November twelfth, Microsoft {three|*365*} {sixty-five|} started failing in more than *seventy* countries.", 0.38),
    ("The early explanation? Not a traffic spike. *Failed* server *health* *checks.*", 0.4),
    ("Here's what that means. A *load* *balancer* keeps asking every server: are you *alive?* If one stops answering, it gets *pulled* out of rotation.", 0.38),
    ("That's perfect when one server dies. But when *many* servers fail their checks at once, they *all* get pulled.", 0.38),
    ("Now the same traffic lands on far *fewer* machines. They *overload,* slow down, and start failing too.", 0.36),
    ("Engineers call that a *cascading* *failure.*", 0.4),
    ("Microsoft says the final *root* *cause* is still being investigated.", 0.4),
    ("The lesson? *Health* *checks* decide who gets traffic. Design them to *fail* *carefully.*", 0.0),
]
