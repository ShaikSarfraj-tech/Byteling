"""Generate voiceover (Kokoro TTS, local), word-level timings (ASR forced
alignment with sherpa-onnx), SRT captions and timings.json."""
import json, re, sys, difflib
from pathlib import Path
import numpy as np, soundfile as sf
import os
ROOT = Path(__file__).resolve().parent.parent
EP = os.environ["EP"]
sys.path.insert(0, str(ROOT / "src" / "episodes" / EP))
import script as S
OUT = ROOT / "episodes" / EP; OUT.mkdir(parents=True, exist_ok=True)
M = ROOT / "models"
SR = 24000
LEAD_IN = 0.25

def parse(text):
    """-> list of dict(spoken, display, kw)"""
    toks = []
    for raw in text.split():
        m = re.fullmatch(r"\{(.*)\|(.*)\}", raw)
        spoken, display = (m.group(1), m.group(2)) if m else (raw, raw)
        kw = "*" in display or "*" in spoken
        toks.append(dict(spoken=spoken.replace("*", ""), display=display.replace("*", ""), kw=kw))
    return toks

def trim(x, thr=0.004, pad=0.02):
    env = np.abs(x); idx = np.where(env > thr)[0]
    if len(idx) == 0: return x
    a = max(0, idx[0] - int(pad * SR)); b = min(len(x), idx[-1] + int(pad * SR))
    return x[a:b]

def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())

def main():
    from kokoro_onnx import Kokoro
    import sherpa_onnx
    kok = Kokoro(str(M / "kokoro-v1.0.onnx"), str(M / "voices-v1.0.bin"))
    d = next(M.glob("sherpa-onnx-zipformer-*"))
    f = lambda pat: str(next(p for p in d.glob(pat) if "int8" not in p.name))
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f("encoder*.onnx"), decoder=f("decoder*.onnx"), joiner=f("joiner*.onnx"),
        tokens=str(d / "tokens.txt"), num_threads=4, decoding_method="greedy_search")

    audio = [np.zeros(int(LEAD_IN * SR), dtype=np.float32)]
    t = LEAD_IN; words = []; sentences = []
    for si, (text, pause) in enumerate(S.SENTENCES):
        toks = parse(text)
        spoken = " ".join(tk["spoken"] for tk in toks)
        x, sr = kok.create(spoken, voice=S.VOICE, speed=S.SPEED, lang="en-us")
        assert sr == SR
        x = trim(x.astype(np.float32)); dur = len(x) / SR
        # --- ASR alignment
        st = rec.create_stream(); st.accept_waveform(SR, np.concatenate([x, np.zeros(SR // 2, np.float32)]))
        rec.decode_stream(st); r = st.result
        rw = []  # recognised words (norm, start)
        for tok, ts in zip(r.tokens, r.timestamps):
            if tok[:1] in ("\u2581", " ") or not rw: rw.append([tok.replace("\u2581", "").strip(), ts])
            else: rw[-1][0] += tok.strip()
        rw = [(norm(w), ts) for w, ts in rw if norm(w)]
        sw = [norm(tk["spoken"]) for tk in toks]
        starts = [None] * len(toks)
        sm = difflib.SequenceMatcher(a=sw, b=[w for w, _ in rw], autojunk=False)
        for a, b, n in sm.get_matching_blocks():
            for k in range(n): starts[a + k] = rw[b + k][1]
        matched = sum(s is not None for s in starts)
        # transducer emits a little after the word onset; calibrate on the first word
        starts[0] = 0.0
        # enforce monotonic, then interpolate gaps by character weight
        last = 0.0
        for i, s in enumerate(starts):
            if s is not None:
                if s < last: starts[i] = None
                else: last = s
        anchors = [(i, s) for i, s in enumerate(starts) if s is not None] + [(len(toks), dur)]
        for (i0, s0), (i1, s1) in zip(anchors, anchors[1:]):
            wts = [len(sw[k]) + 1 for k in range(i0, i1)]; tot = sum(wts); acc = 0
            for k in range(i0, i1):
                starts[k] = s0 + (s1 - s0) * acc / tot; acc += wts[k - i0]
        print(f"[{si}] {dur:5.2f}s matched {matched}/{len(toks)} :: {' '.join(w for w,_ in rw)}")
        sent_words = []
        for i, tk in enumerate(toks):
            end = starts[i + 1] if i + 1 < len(toks) else dur
            if not tk["display"]:           # merged into previous display word
                sent_words[-1]["end"] = round(t + end, 3); continue
            sent_words.append(dict(text=tk["display"], kw=tk["kw"], start=round(t + starts[i], 3),
                                   end=round(t + end, 3), sentence=si))
        words += sent_words
        sentences.append(dict(index=si, start=round(t, 3), end=round(t + dur, 3),
                              text=" ".join(w["text"] for w in sent_words)))
        audio += [x, np.zeros(int(pause * SR), dtype=np.float32)]
        t += dur + int(pause * SR) / SR
    audio.append(np.zeros(int(0.9 * SR), dtype=np.float32))
    y = np.concatenate(audio); y = y / np.max(np.abs(y)) * 0.89
    sf.write(OUT / "voiceover.wav", y, SR, subtype="PCM_16")
    total = len(y) / SR

    # --- caption chunks: <=3 words / break at punctuation
    chunks = []; cur = []
    for i, w in enumerate(words):
        cur.append(i)
        nxt = words[i + 1] if i + 1 < len(words) else None
        chars = sum(len(words[k]["text"]) for k in cur)
        if (nxt is None or re.search(r"[.,?!:]$", w["text"]) or len(cur) >= 3
                or chars + len(nxt["text"]) > 20 or nxt["sentence"] != w["sentence"]):
            chunks.append(cur); cur = []
    # don't leave one tiny orphan word when it can join the previous chunk
    caps = [dict(start=words[c[0]]["start"], end=words[c[-1]]["end"], words=c) for c in chunks]
    for a, b in zip(caps, caps[1:]): a["end"] = min(b["start"], a["end"] + 0.35)
    caps[-1]["end"] = min(total, caps[-1]["end"] + 0.6)

    def ts(x):
        ms = int(round(x * 1000)); return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"
    # SRT: sentence-ish lines (group caption chunks up to ~42 chars)
    srt = []; grp = []
    def flush():
        if grp:
            srt.append((caps[grp[0]]["start"], caps[grp[-1]]["end"],
                        " ".join(words[k]["text"] for g in grp for k in caps[g]["words"])))
            grp.clear()
    for ci, c in enumerate(caps):
        txt = " ".join(words[k]["text"] for k in c["words"])
        curlen = sum(len(words[k]["text"]) + 1 for g in grp for k in caps[g]["words"])
        if grp and (curlen + len(txt) > 42 or words[c["words"][0]]["sentence"] != words[caps[grp[-1]]["words"][0]]["sentence"]):
            flush()
        grp.append(ci)
        if re.search(r"[.?!]$", txt): flush()
    flush()
    (OUT / "captions.srt").write_text("".join(f"{i}\n{ts(a)} --> {ts(b)}\n{t_}\n\n" for i, (a, b, t_) in enumerate(srt, 1)))
    (OUT / "timings.json").write_text(json.dumps(dict(duration=round(total, 3), sentences=sentences, words=words, captions=caps), indent=1))
    print("duration", total, "words", len(words), "captions", len(caps), "srt", len(srt))

main()
