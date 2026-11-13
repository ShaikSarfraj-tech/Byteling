# Byteling

Fully programmatic tech shorts (YouTube Shorts / Instagram Reels): script, AI voiceover,
word-synced captions, 3D animation and sound design are all generated from code. **No music** —
only narration and quiet, unpitched sound effects (clicks, key taps, whooshes, thuds).

## Episodes

Each episode has sources in `src/episodes/<name>/` (`script.py`, `cues.py`, `index.html`, `scene.js`)
and deliverables in `episodes/<name>/`:

| File | What |
| --- | --- |
| `video.mp4` | Final short (1080×1920, 60 fps, H.264/AAC) |
| `script.md` | Script + fact check / sources |
| `voiceover.wav` | AI voiceover |
| `captions.srt` | Subtitles |
| `youtube-metadata.md` | SEO title, description, tags, settings |
| `thumbnail.png` | 1080×1920 thumbnail (`EP=<name> node src/render.mjs --thumb`, text in `thumb.json`) |
| `timings.json`, `cues.json`, `sfx.wav`, `mix.wav` | Word timings, cue sheet, SFX stem, final mix |

- `2026-11-11-docker-not-a-vm` — "A Docker container is not a tiny VM"
- `2026-11-12-git-clone-rce` — "One git clone could run a hacker's code" (Git 2.56.1 security release)
- `2026-11-12-angular-rust-compiler` — "TypeScript 7 broke Angular's compiler" (ngp, the Rust preprocessor)
- `2026-11-12-go-json-v2` — "Go 1.27 finally fixes encoding/json" (json/v2)
- `2026-11-13-microsoft-365-outage` — "Why Outlook and Teams went down worldwide" (health checks, cascading failure)

## How it works

1. `script.py` — the narration (keywords marked for caption highlighting).
2. `src/tts.py` — local neural TTS (Kokoro) per sentence, then ASR forced alignment (sherpa-onnx)
   for word-level timings; writes the WAV, SRT and `timings.json`.
3. `cues.py` — turns word timings into named visual cues and SFX events, so every transition
   lands on the spoken word.
4. `src/sfx.py` — synthesises noise-based effects and mixes them ~20 dB under the voice.
5. `index.html` + `scene.js` — a deterministic three.js scene + HTML overlay (`renderFrame(t)`).
6. `src/render.mjs` — headless Chromium renders every frame; `build.sh` muxes with ffmpeg.

## Rebuild

```bash
pip install -r requirements.txt && npm install
./fetch_models.sh     # ~650 MB of local models (not committed)
EP=2026-11-12-git-clone-rce ./build.sh
```
Requires ffmpeg, Node 22+, Playwright with Chromium, and the Inter + JetBrains Mono fonts.
