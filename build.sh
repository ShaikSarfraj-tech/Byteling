#!/usr/bin/env bash
# End-to-end build: script -> voiceover -> captions -> SFX -> frames -> MP4
set -euo pipefail
cd "$(dirname "$0")"
python3 src/tts.py          # output/voiceover.wav, captions.srt, timings.json
python3 src/cues.py         # output/cues.json (visual cues + SFX events)
python3 src/sfx.py          # output/sfx.wav, output/mix.wav (voice + quiet non-musical SFX)
node src/render.mjs         # frames/f00000.jpg ...
ffmpeg -y -loglevel error -framerate 60 -i frames/f%05d.jpg -i output/mix.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  output/docker-container-is-not-a-vm.mp4
echo "done -> output/docker-container-is-not-a-vm.mp4"
