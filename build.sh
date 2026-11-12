#!/usr/bin/env bash
# End-to-end build of one episode: EP=<episode folder> ./build.sh
#   sources: src/episodes/$EP/{script.py,cues.py,index.html,scene.js}   outputs: episodes/$EP/
set -euo pipefail
cd "$(dirname "$0")"
: "${EP:?set EP=<episode folder name>}"
export EP
python3 src/tts.py                       # voiceover.wav, captions.srt, timings.json
python3 "src/episodes/$EP/cues.py"       # cues.json (visual cues + SFX events)
python3 src/sfx.py                       # sfx.wav, mix.wav (voice + quiet non-musical SFX)
rm -rf frames && node src/render.mjs     # frames/f00000.jpg ...
ffmpeg -y -loglevel error -framerate 60 -i frames/f%05d.jpg -i "episodes/$EP/mix.wav" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "episodes/$EP/video.mp4"
echo "done -> episodes/$EP/video.mp4"
