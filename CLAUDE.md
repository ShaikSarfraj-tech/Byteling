# Byteling — standing instructions

The owner's YouTube channel is **Bytelink**. This repo produces its tech shorts.

## When the user says "start"
Do the whole job without asking for assets or confirmation:
1. Pick and research a fresh topic (software engineering, Docker/K8s/DevOps, Java/Spring, React/Node/TS,
   microservices, system design, databases, APIs/auth/security, AWS/CI-CD, AI/LLMs, real recent dev news).
   Do not repeat a topic already in `episodes/`. Never fabricate facts or news.
2. Create `src/episodes/<date>-<slug>/` (copy the latest episode as a template) and write a 45–60 s script
   with a hook in the first 3 s (`script.py`).
3. Generate voiceover, word-level captions + SRT, cues, SFX, 3D animation, and render the MP4
   (`./fetch_models.sh` once, then `EP=<date>-<slug> ./build.sh`; rewrite `scene.js`/`cues.py` for the topic).
4. Verify the MP4 (ffprobe + frame contact sheet), write `script.md` (with sources) and
   `youtube-metadata.md` in `episodes/<date>-<slug>/`
   (title, description, hashtags, tags, category Science & Technology).
5. Commit and push, then upload to the Bytelink YouTube channel if this session has YouTube access.
   If it does not, say so plainly and hand over the MP4 + metadata.

## Hard rules
- Halal-conscious audio: NO music, beats, melodies or pitched tones. Voice + quiet noise-based SFX only.
- 1080×1920, 60 fps, MP4, word-by-word captions kept clear of the visuals.
- Publish slots: every day at 7 pm and 9 pm (owner's local time).
