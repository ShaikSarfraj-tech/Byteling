# Byteling

Fully programmatic tech shorts (YouTube Shorts / Instagram Reels): script, AI voiceover,
word-synced captions, 3D animation and sound design are all generated from code. **No music** —
only narration and quiet, unpitched sound effects (clicks, key taps, whooshes, thuds).

## Episode 1 — "A Docker container is not a tiny VM"

| Deliverable | File |
| --- | --- |
| Final video (1080×1920, 60 fps, H.264/AAC) | `output/docker-container-is-not-a-vm.mp4` |
| Script + fact check | `output/script.md` |
| Voiceover | `output/voiceover.wav` |
| Subtitles | `output/captions.srt` |
| Word-level timings / cue sheet | `output/timings.json`, `output/cues.json` |
| SFX stem / final mix | `output/sfx.wav`, `output/mix.wav` |

## How it works

1. `src/script.py` — the narration (keywords marked for caption highlighting).
2. `src/tts.py` — local neural TTS (Kokoro) per sentence, then ASR forced alignment (sherpa-onnx)
   for word-level timings; writes the WAV, SRT and `timings.json`.
3. `src/cues.py` — turns word timings into named visual cues and SFX events, so every transition
   lands on the spoken word.
4. `src/sfx.py` — synthesises noise-based effects and mixes them ~20 dB under the voice.
5. `src/video/` — a deterministic three.js scene + HTML overlay (`renderFrame(t)`).
6. `src/render.mjs` — headless Chromium renders every frame; `build.sh` muxes with ffmpeg.

## Rebuild

```bash
pip install -r requirements.txt && npm install
./fetch_models.sh     # ~650 MB of local models (not committed)
./build.sh
```
Requires ffmpeg, Node 22+, Playwright with Chromium, and the Inter + JetBrains Mono fonts.
