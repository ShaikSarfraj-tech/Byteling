"""Synthesise subtle NON-MUSICAL sound effects (filtered noise only: clicks,
key taps, whooshes, thuds) and mix them far below the voiceover."""
import json
from pathlib import Path
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
OUT = Path(__file__).resolve().parent.parent / "output"
SR = 48000
rng = np.random.default_rng(7)
cues = json.loads((OUT / "cues.json").read_text())
voice, vsr = sf.read(OUT / "voiceover.wav", dtype="float32")
# resample 24k -> 48k (linear interp of a band-limited signal is fine at 2x; use polyphase for quality)
from scipy.signal import resample_poly
voice = resample_poly(voice, SR, vsr).astype(np.float32)
N = len(voice)
bed = np.zeros((N, 2), dtype=np.float32)

def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, hi): return sosfilt(butter(2, hi, btype="low", fs=SR, output="sos"), x)
def noise(n): return rng.standard_normal(n).astype(np.float32)
def place(x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    x = x[: N - i] * gain
    bed[i:i + len(x), 0] += x * (1 - max(0, pan)); bed[i:i + len(x), 1] += x * (1 + min(0, pan))

def click():
    n = int(0.03 * SR); e = np.exp(-np.arange(n) / (0.004 * SR))
    return bp(noise(n), 1800, 6500) * e * 0.9
def key():
    n = int(0.045 * SR); e = np.exp(-np.arange(n) / (0.006 * SR))
    f = rng.uniform(1200, 2400)
    return (bp(noise(n), f, f * 2.6) * e * 0.7 + lp(noise(n), 300) * e * 0.5)
def thud():
    n = int(0.28 * SR); e = np.exp(-np.arange(n) / (0.05 * SR))
    return lp(noise(n), 140) * e * 3.2 + bp(noise(n), 500, 1500) * np.exp(-np.arange(n) / (0.008 * SR)) * 0.25
def whoosh(dur=0.7):
    n = int(dur * SR); x = noise(n); out = np.zeros(n, dtype=np.float32)
    # sweep a band-pass upwards by cross-fading 6 fixed bands (airy, unpitched)
    k = np.linspace(0, 1, n)
    for j in range(6):
        c = j / 5; band = bp(x, 250 * 2 ** (c * 3.2), 600 * 2 ** (c * 3.2))
        out += band * np.exp(-((k - (0.15 + 0.7 * c)) ** 2) / 0.02)
    return out * np.sin(np.pi * k) ** 1.5 * 0.9
def power(dur=0.5):
    n = int(dur * SR); k = np.linspace(0, 1, n)
    return lp(noise(n), 220) * k ** 2 * np.exp(-((k - 1) * 3) ** 2) * 2.2 + bp(noise(n), 3000, 7000) * np.exp(-((k - 0.95) / 0.04) ** 2) * 0.35
def zap():
    n = int(0.4 * SR); e = np.exp(-np.arange(n) / (0.07 * SR))
    gate = (np.sin(2 * np.pi * 38 * np.arange(n) / SR + rng.uniform(0, 6, n).cumsum() * 0.02) > 0).astype(np.float32)
    return bp(noise(n), 700, 5000) * e * (0.35 + 0.65 * gate) * 1.2 + lp(noise(n), 120) * e * 3.0

for ev in cues["sfx"]:
    t, g = ev["t"], ev.get("gain", 1.0); pan = float(rng.uniform(-0.25, 0.25))
    if ev["type"] == "click": place(click(), t, 0.55 * g, pan)
    elif ev["type"] == "thud": place(thud(), t, 0.8 * g, pan * 0.4)
    elif ev["type"] == "whoosh": place(whoosh(), t - 0.2, 0.5 * g, pan)
    elif ev["type"] == "power": place(power(), t - 0.35, 0.6 * g)
    elif ev["type"] == "zap": place(zap(), t, 0.8 * g)
    elif ev["type"] == "type":
        tt = t
        while tt < t + ev["dur"]:
            place(key(), tt, float(rng.uniform(0.3, 0.5)), float(rng.uniform(-0.2, 0.2))); tt += float(rng.uniform(0.045, 0.1))
    elif ev["type"] == "alarm":   # irregular dry ticks, speeding up (no pitch)
        tt = t; step = 0.2
        while tt < t + ev["dur"]:
            place(click(), tt, 0.4); tt += step; step = max(0.07, step * 0.82)
    elif ev["type"] == "pops":
        tt = t; k = 0
        while tt < t + ev["dur"]:
            u = (tt - t) / ev["dur"]
            place(click() * 0.6 + thud()[: int(0.03 * SR)] * 0.5, tt, float(rng.uniform(0.18, 0.34)), float(rng.uniform(-0.6, 0.6)))
            tt += float(rng.uniform(0.03, 0.16)) * (1.4 - u)

def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
# SFX bed sits >= ~20 dB under the narration
target = db(voice[np.abs(voice) > 0.02]) - 21
active = bed[np.abs(bed).max(axis=1) > 1e-4]
bed *= 10 ** ((target - db(active)) / 20)
bed = np.clip(bed, -0.25, 0.25)
sf.write(OUT / "sfx.wav", bed, SR, subtype="PCM_16")
mix = bed + voice[:, None]
mix = np.clip(mix, -0.98, 0.98)
sf.write(OUT / "mix.wav", mix, SR, subtype="PCM_16")
print(f"voice {db(voice[np.abs(voice)>0.02]):.1f} dBFS | sfx(active) {db(bed[np.abs(bed).max(axis=1)>1e-4]):.1f} dBFS | peak sfx {np.abs(bed).max():.3f}")
