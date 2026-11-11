#!/usr/bin/env bash
# Downloads the local (offline) models used for the voiceover and caption alignment.
set -euo pipefail
mkdir -p "$(dirname "$0")/models" && cd "$(dirname "$0")/models"
curl -fL -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -fL -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
curl -fL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-gigaspeech-2023-12-12.tar.bz2 | tar xj
