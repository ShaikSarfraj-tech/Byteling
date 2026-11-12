// Deterministic, time-driven scene: window.renderFrame(t) draws the exact frame for time t.
import * as THREE from '/node_modules/three/build/three.module.js';

const EP = new URLSearchParams(location.search).get('ep');
const W = 1080, H = 1920, VOFF = 190;           // VOFF lifts the 3D subject above the caption zone
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eout = (k) => 1 - Math.pow(1 - k, 3);
const back = (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const P = (t, a, d = 0.5, e = eout) => e(clamp((t - a) / d));     // 0→1 starting at a, lasting d
const win = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(P(t, a, fi), 1 - P(t, b, fo)); // visible in [a,b]
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

let C, T, renderer, scene, camera;
const O = {};          // 3D objects
const tags = [];       // DOM tags anchored to 3D points

// ───────────────────────── helpers
function textPlane(text, { h = 0.2, color = '#ffffff', font = "800 96px Inter", mono = false } = {}) {
  const cv = document.createElement('canvas'); const cx = cv.getContext('2d');
  const f = mono ? "700 96px 'JetBrains Mono'" : font;
  cx.font = f; const tw = Math.ceil(cx.measureText(text).width) + 40;
  cv.width = tw; cv.height = 140; cx.font = f; cx.fillStyle = color; cx.textBaseline = 'middle'; cx.textAlign = 'center';
  cx.fillText(text, tw / 2, 74);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h * tw / 140, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  m.renderOrder = 5; return m;
}
function slab(w, h, d, color, { label, labelColor = '#eaf2ff', edge = 0x9fc4ff, emissive = 0x000000, labelH, mono } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25, transparent: true, emissive, emissiveIntensity: 0.6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); g.add(mesh);
  const em = new THREE.LineBasicMaterial({ color: edge, transparent: true });
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), em));
  let lm = null;
  if (label) { const p = textPlane(label, { h: labelH || Math.min(h * 0.5, 0.26), color: labelColor, mono }); p.position.set(0, 0, d / 2 + 0.006); g.add(p); lm = p.material; }
  g.userData = { mat, em, lm, base: 1, w, h, d };
  return g;
}
function fade(g, o, { fill = 1, edge = 0.85, label = 1 } = {}) {
  const u = g.userData; g.visible = o > 0.004;
  u.mat.opacity = o * fill; u.mat.depthWrite = o * fill > 0.95; u.em.opacity = o * edge; if (u.lm) u.lm.opacity = o * label;
}
function glowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
  const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(cv);
}
function tag(html, pos, { color = '#5ee6ff', cls = '', ax = 0.5, ay = 1 } = {}) {
  const el = document.createElement('div'); el.className = 'tag ' + cls; el.style.setProperty('--c', color); el.innerHTML = html;
  $('tags').appendChild(el); const o = { el, pos, ax, ay, o: 0, s: 1, dy: 0 }; tags.push(o); return o;
}
const _v = new THREE.Vector3();
function placeTag(g) {
  if (g.o < 0.01) { g.el.style.opacity = 0; return; }
  _v.copy(g.pos).project(camera);
  const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H + g.dy;
  const w = g.el.offsetWidth, h = g.el.offsetHeight;
  const px = clamp(x - w * g.ax * g.s, 24, W - w * g.s - 24);
  g.el.style.opacity = g.o; g.el.style.transform = `translate(${px.toFixed(1)}px,${(y - h * g.ay * g.s).toFixed(1)}px) scale(${g.s.toFixed(3)})`;
}
const pop = (g, t, a, b = 1e9) => { const k = P(t, a, 0.32, back); g.o = Math.min(P(t, a, 0.15), 1 - P(t, b, 0.3)); g.s = 0.6 + 0.4 * k; g.dy = (1 - P(t, a, 0.4)) * 22; };

// ───────────────────────── world
const RW = 2.6, RH = 1.7, RD = 1.6, RY = 1.35;              // repo working tree
const GATE = 3.0;                                           // height of the path-check gate
const bez = (a, b, c, k, out) => out.set(
  (1 - k) * (1 - k) * a[0] + 2 * (1 - k) * k * b[0] + k * k * c[0],
  (1 - k) * (1 - k) * a[1] + 2 * (1 - k) * k * b[1] + k * k * c[1],
  (1 - k) * (1 - k) * a[2] + 2 * (1 - k) * k * b[2] + k * k * c[2]);
const LINK = [[-0.6, 0.78, 0.36], [-0.5, 2.1, 0.75], [0.45, 1.95, 0.44]];
const FEED = [[-2.9, 2.1, -5.2], [-1.6, 5.2, -2.6], [0, 1.9, 0]];

function build() {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b16); scene.fog = new THREE.FogExp2(0x070b16, 0.03);
  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 300); camera.setViewOffset(W, H, 0, VOFF, W, H);
  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x0a0f20, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(5, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5ee6ff, 1.1); rim.position.set(-7, 4, -6); scene.add(rim);
  const grid = new THREE.GridHelper(400, 200, 0x24407a, 0x16223f); grid.position.y = -0.01; grid.material.transparent = true; grid.material.opacity = 0.75; scene.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x060a14 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);
  const N = 500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (rnd(i) - 0.5) * 44; pos[i * 3 + 1] = rnd(i + 900) * 12 + 0.2; pos[i * 3 + 2] = (rnd(i + 1800) - 0.6) * 60; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  O.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x7fb4ff, size: 0.05, transparent: true, opacity: 0.55 })); scene.add(O.dust);
  const gt = glowTex();
  const add = (k, g, p) => { if (p) { g.position.set(...p); g.userData.p = p; } scene.add(g); O[k] = g; return g; };
  const glass = (g) => { g.userData.mat.depthWrite = false; g.userData.mat.side = THREE.DoubleSide; g.userData.glass = true; return g; };

  add('plat', slab(4.4, 0.4, 3.6, 0x1b3a6b, { label: 'YOUR MACHINE', labelColor: '#9fc4ff', edge: 0x5b8def, labelH: 0.19 }), [0, 0.2, 0]);
  add('repo', glass(slab(RW, RH, RD, 0x3aa0ff, { edge: 0x5ee6ff })), [0, RY, 0]);
  add('vault', slab(0.85, 0.5, 0.95, 0x8a6508, { label: '.git/', labelColor: '#fff3c4', edge: 0xffd84a, emissive: 0xb8860b, labelH: 0.2, mono: true }), [0.7, 0.78, 0]);
  O.files = ['README.md', 'src/app.js', 'package.json'].map((n, i) => {
    const s = slab(0.95, 0.14, 0.85, [0x1d4ed8, 0x2563eb, 0x3b82f6][i], { label: n, mono: true, labelH: 0.09, edge: 0x93c5fd });
    s.userData.p = [0.7, 1.14 + i * 0.17, 0]; scene.add(s); return s;
  });
  add('bad', slab(0.95, 0.14, 0.85, 0xb91c1c, { label: '.git/config', mono: true, labelH: 0.09, edge: 0xff5a5a, emissive: 0xb91c1c }));
  add('subm', glass(slab(1.15, 1.0, 1.1, 0xb79cff, { edge: 0xc4b5fd })), [-0.6, 1.05, 0]);
  add('gitfile', slab(0.62, 0.16, 0.72, 0x0e7490, { label: '.git', mono: true, labelH: 0.11, edge: 0x5ee6ff }), [-0.6, 0.66, 0]);
  add('long', slab(3.0, 0.16, 0.72, 0xb45309, { label: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa…', mono: true, labelH: 0.1, edge: 0xfbbf24, emissive: 0xb45309 }));
  add('short', slab(0.62, 0.16, 0.72, 0xdc2626, { label: '.git', mono: true, labelH: 0.11, edge: 0xff8a8a, emissive: 0xdc2626 }));
  add('evil', slab(0.95, 0.42, 0.88, 0x7f1d1d, { label: 'hooks/', mono: true, labelColor: '#ffd0d0', edge: 0xff5a5a, emissive: 0xb91c1c, labelH: 0.17 }), [0.7, 1.95, 0]);
  add('gate', glass(slab(3.5, 0.1, 1.3, 0x5ee6ff, { edge: 0x5ee6ff, emissive: 0x5ee6ff })), [0, GATE, 0]);
  add('shield', glass(slab(RW + 0.55, RH + 0.5, RD + 0.55, 0x22c55e, { edge: 0x86efac, emissive: 0x16a34a })), [0, RY, 0]);

  O.link = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a5a }), 22); scene.add(O.link);
  O.feed = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0x5ee6ff }), 16); scene.add(O.feed);
  O.server = [0, 1, 2].map((i) => { const s = slab(1.5, 0.5, 1.5, 0x4a3a86, { label: i === 2 ? 'REMOTE' : null, labelColor: '#d6c8ff', edge: 0xb79cff, labelH: 0.2 }); s.position.set(-2.9, 0.25 + i * 0.6, -5.2); scene.add(s); return s; });
  O.cves = [0, 1, 2, 3, 4, 5].map(() => { const s = slab(0.3, 0.3, 0.3, 0xdc2626, { edge: 0xffb4b4, emissive: 0xdc2626 }); scene.add(s); return s; });

  // attacker process
  O.core = new THREE.Group(); scene.add(O.core);
  O.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xd41414, emissiveIntensity: 1.0, roughness: 0.3, flatShading: true }));
  O.coreWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.46, 1)), new THREE.LineBasicMaterial({ color: 0xffb4b4, transparent: true, opacity: 0.6 }));
  O.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0xff4040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); O.glow.scale.setScalar(2.6);
  O.coreLight = new THREE.PointLight(0xff4040, 0, 7);
  O.core.add(O.coreMesh, O.coreWire, O.glow, O.coreLight);

  const cyan = '#5ee6ff', pur = '#b79cff', org = '#ffb347', grn = '#4ade80', red = '#ff5a5a', yel = '#ffd84a';
  O.t = {
    warn: tag('⚠ runs attacker code?', V(0, 2.5, 0), { color: red, cls: 'big' }),
    gate: tag('path check', V(1.8, GATE, 0.65), { color: cyan, ax: 0, ay: 0.5 }),
    ok: tag('✓ allowed', V(-1.8, GATE, 0.65), { color: grn, ax: 1, ay: 0.5 }),
    blocked: tag('✖ blocked', V(-1.8, GATE, 0.65), { color: red, ax: 1, ay: 0.5, cls: 'big' }),
    prot: tag('protected', V(0.7, 0.5, 0.6), { color: yel, ay: 0 }),
    longT: tag('extremely long path', V(0, 4.15, 0), { color: org, cls: 'big' }),
    pass: tag('✓ check passed', V(-1.8, GATE, 0.65), { color: grn, ax: 1, ay: 0.5 }),
    wr: tag('written as .git', V(0, 0, 0), { color: red, ax: 0, ay: 0.5 }),
    subT: tag('submodule', V(-0.6, 1.62, 0.6), { color: pur }),
    sym: tag('symlink', V(-0.5, 2.0, 0.75), { color: red, ax: 1, ay: 1 }),
    hooksT: tag('malicious hooks', V(0.7, 2.24, 0.45), { color: red }),
    rce: tag('attacker code running', V(0, 3.62, 0), { color: red, cls: 'big' }),
    lap: tag('your laptop', V(-0.8, 3.05, 0.3), { color: red, ax: 1, ay: 0.5 }),
    cir: tag('your CI runner', V(0.8, 3.05, 0.3), { color: red, ax: 0, ay: 0.5 }),
    pipe: tag('CI pipelines', V(-0.75, 2.75, 0.3), { color: org, ax: 1, ay: 0.5 }),
    ag: tag('coding agents', V(0.75, 2.75, 0.3), { color: org, ax: 0, ay: 0.5 }),
    patched: tag('overlong paths rejected<small>Git 2.56.1 and patched backports</small>', V(0, GATE - 0.12, 0.7), { color: grn, ay: 0 }),
  };
}
// ───────────────────────── camera path (arrive between t0→t1, then drift)
let KEYS;
function camAt(t) {
  let p = KEYS[0].pos.clone(), l = KEYS[0].look.clone();
  for (let i = 1; i < KEYS.length; i++) {
    const k = KEYS[i]; if (t <= k.t0) break;
    const u = (k.e || eio)(clamp((t - k.t0) / (k.t1 - k.t0)));
    p.lerp(k.pos, u); l.lerp(k.look, u);
  }
  p.x += Math.sin(t * 0.43) * 0.16; p.y += Math.sin(t * 0.31 + 1) * 0.07; p.z += Math.cos(t * 0.37) * 0.14;
  return [p, l];
}

// ───────────────────────── text helpers
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const typed = (s, t, a, d) => s.slice(0, Math.floor(clamp((t - a) / d) * s.length));
const CUR = '<span class="cur"></span>';
const blink = (t) => (Math.floor(t * 2.5) % 2 ? CUR : '<span class="cur" style="opacity:0"></span>');

let capIdx = -2, capEls = [];
function captions(t) {
  const caps = T.captions; let idx = -1;
  for (let i = 0; i < caps.length; i++) if (t >= caps[i].start - 0.03 && t < caps[i].end) { idx = i; }
  const el = $('cap');
  if (idx !== capIdx) {
    capIdx = idx; el.innerHTML = ''; capEls = [];
    if (idx >= 0) for (const wi of caps[idx].words) {
      const w = T.words[wi]; const s = document.createElement('span'); s.textContent = w.text.replace(/[.,:]+$/, '');
      if (w.kw) s.className = 'kw'; if (s.textContent.length > 16) s.style.fontSize = Math.floor(92 * 16 / s.textContent.length) + 'px'; el.appendChild(s); capEls.push([s, w]);
    }
  }
  for (const [s, w] of capEls) {
    const a = P(t, w.start - 0.03, 0.14, back), on = t >= w.start - 0.03 && t < w.end;
    s.style.opacity = P(t, w.start - 0.03, 0.07);
    s.style.transform = `translateY(${((1 - a) * 26).toFixed(1)}px) scale(${(0.82 + 0.18 * a + (on ? 0.05 : 0)).toFixed(3)})`;
    s.style.color = w.kw ? '#ffd84a' : (on ? '#ffffff' : '#dfe7f7');
    s.style.textShadow = on ? `0 0 34px ${w.kw ? 'rgba(255,216,74,.75)' : 'rgba(94,230,255,.7)'}, 0 10px 30px rgba(0,0,0,.9)` : '0 10px 30px rgba(0,0,0,.9)';
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const drop = (g, t, a, { from = 2.2, d = 0.42, o = {} } = {}) => {
  const k = P(t, a, d, (x) => x * x), p = g.userData.p || [g.position.x, g.userData.y, g.position.z];
  const land = P(t, a + d, 0.25); const sq = Math.sin(land * Math.PI) * 0.06;
  g.position.set(p[0], p[1] + (1 - k) * from - sq * 0.5, p[2]); g.scale.set(1 + sq, 1 - sq * 1.5, 1 + sq); return P(t, a, 0.2);
};

// ───────────────────────── per-frame
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const pulse = (t, a, d = 0.7) => P(t, a, 0.12) * (1 - P(t, a + 0.12, d));
function fadeG(g, o, fill = 0.07, edge = 0.9) { fade(g, o, { fill, edge }); g.userData.mat.depthWrite = false; }

function frame(t) {
  const c = C;
  const [cp, cl] = camAt(t); camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld(true);
  O.dust.rotation.y = t * 0.012;

  const hacked = P(t, c.runs, 0.4) * (1 - P(t, c.ver, 0.5));          // machine compromised
  const fixed = P(t, c.update + 0.2, 0.7, back);

  // ---------- machine + repo
  fade(O.plat, 1, { label: 1 - P(t, c.news - 0.3, 0.5) });
  O.plat.userData.em.color.copy(_c1.set(0x5b8def)).lerp(_c2.set(0xff4040), hacked);
  O.plat.userData.mat.emissive.set(0xff2020); O.plat.userData.mat.emissiveIntensity = hacked * (0.35 + 0.2 * Math.sin(t * 9));
  const repoIn = P(t, 0.5, 1.6, eio);
  O.repo.scale.setScalar(0.5 + 0.5 * repoIn); fadeG(O.repo, repoIn, 0.06);
  O.repo.userData.em.color.copy(_c1.set(0x5ee6ff)).lerp(_c2.set(0xff5a5a), hacked * 0.8);
  fade(O.vault, P(t, 1.2, 0.6));
  O.vault.userData.mat.emissiveIntensity = 0.5 + 2.2 * pulse(t, c.dotgit, 1.2);

  // ---------- remote + packets (the clone)
  const srv = 1 - P(t, c.news + 0.3, 0.8);
  O.server.forEach((s) => fade(s, srv));
  O.feed.visible = srv > 0.02;
  for (let i = 0; i < 16; i++) {
    const k = ((t * 0.55 + i / 16) % 1); bez(FEED[0], FEED[1], FEED[2], k, _p);
    _s.setScalar(Math.max(0.0001, Math.sin(k * Math.PI) * srv * P(t, 0.25, 0.4))); O.feed.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.feed.instanceMatrix.needsUpdate = true;

  // ---------- six CVEs
  O.cves.forEach((s, i) => {
    const a = P(t, c.six + i * 0.07, 0.4, back) * (1 - P(t, c.trick - 0.25, 0.4)); const ang = i * Math.PI / 3 + t * 0.7;
    const big = i === 0 ? 1 + 1.1 * P(t, c.high - 0.2, 0.4, back) : 1 - 0.35 * P(t, c.high - 0.2, 0.4);
    s.position.set(Math.cos(ang) * 1.75, 3.1 + Math.sin(t * 1.3 + i) * 0.12, Math.sin(ang) * 1.2);
    s.rotation.set(t * 0.8 + i, t * 0.6, 0); s.scale.setScalar(Math.max(0.0001, a * big)); fade(s, clamp(a * 2));
    s.userData.mat.emissiveIntensity = i === 0 ? 0.6 + 1.5 * P(t, c.high - 0.2, 0.4) : 0.5;
  });

  // ---------- the path-check gate
  const gateOn = P(t, c.checks - 0.5, 0.5, back) * (1 - P(t, c.sub - 0.1, 0.5)) + fixed * (1 - P(t, c.end, 0.5));
  const gG = pulse(t, c.writes + 0.36) + pulse(t, c.writes + 0.71) + pulse(t, c.writes + 1.06) + pulse(t, c.passes + 0.45, 1.0) + fixed;
  const gR = pulse(t, c.nothing + 0.22, 1.1);
  _c1.set(0x5ee6ff).lerp(_c2.set(0x4ade80), clamp(gG)).lerp(_c2.set(0xff4040), clamp(gR));
  O.gate.userData.mat.color.copy(_c1); O.gate.userData.mat.emissive.copy(_c1); O.gate.userData.em.color.copy(_c1);
  O.gate.scale.set(0.6 + 0.4 * clamp(gateOn), 1, 0.6 + 0.4 * clamp(gateOn));
  fadeG(O.gate, clamp(gateOn), 0.28 + 0.4 * clamp(gG + gR), 1);

  // ---------- normal files pass, a direct write to .git is blocked
  const cleanup = 1 - P(t, c.end - 0.1, 0.4) * 0;
  O.files.forEach((s, i) => { const p = s.userData.p; fade(s, drop(s, t, c.writes + i * 0.35, { from: 4.5 - p[1], d: 0.62 }) * cleanup); });
  { const a = c.nothing - 0.15, k = P(t, a, 0.38, (x) => x * x), up = P(t, a + 0.38, 0.7);
    O.bad.position.set(0.3, lerp(4.6, GATE + 0.16, k) + up * 1.5, 0); O.bad.rotation.z = up * 0.5;
    fade(O.bad, P(t, a, 0.15) * (1 - P(t, a + 0.55, 0.5))); }

  // ---------- submodule and its .git file
  const subIn = P(t, c.att - 0.2, 0.7, back);
  O.subm.scale.setScalar(0.6 + 0.4 * subIn); fadeG(O.subm, clamp(subIn), 0.08 + 0.1 * pulse(t, c.submodule, 1.2));
  const landed = P(t, c.dotgit2 + 0.15, 0.25);
  fade(O.gitfile, clamp(subIn) * (1 - landed) + P(t, c.ver + 0.2, 0.5));

  // ---------- the overlong path: passes the check, is written as ".git"
  const lin = P(t, c.long - 0.15, 0.5, back), desc = P(t, c.passes, 1.0, eio), shr = P(t, c.written, 0.55, eio);
  const ly = lerp(3.5 + Math.sin(t * 2.2) * 0.04, 2.48, desc);
  const mv = P(t, c.shorter + 0.35, 0.9, eio); const gone = 1 - P(t, c.ver, 0.5);
  O.long.position.set(0, ly, 0); O.long.scale.set(lerp(1, 0.21, shr) * (0.7 + 0.3 * lin), 1, 1);
  fade(O.long, lin * (1 - P(t, c.written + 0.3, 0.3)));
  O.long.userData.mat.emissiveIntensity = 0.5 + 2.5 * pulse(t, c.trunc, 0.9);
  O.short.position.set(lerp(0, -0.6, mv), lerp(2.48, 0.66, mv) + Math.sin(mv * Math.PI) * 0.25, 0);
  fade(O.short, P(t, c.written + 0.25, 0.3) * gone);
  O.short.userData.mat.emissiveIntensity = 0.7 + 0.5 * Math.sin(t * 6);

  // ---------- symlink → malicious hooks
  const ev = P(t, c.symlink + 0.45, 0.45, back) * gone;
  O.evil.scale.setScalar(Math.max(0.0001, 0.5 + 0.5 * ev)); fade(O.evil, clamp(ev));
  O.evil.userData.mat.emissiveIntensity = 0.6 + 2.0 * pulse(t, c.hooks, 1.0) + 1.5 * P(t, c.uses, 0.5) * (0.5 + 0.5 * Math.sin(t * 14));
  const draw = P(t, c.symlink, 0.7) * gone; O.link.visible = draw > 0.01;
  const speed = 0.25 + 1.2 * P(t, c.uses, 0.4);
  for (let i = 0; i < 22; i++) {
    const k = ((i / 22 + t * speed * 0.2) % 1); bez(LINK[0], LINK[1], LINK[2], k, _p);
    _s.setScalar(k <= draw ? (0.7 + 0.6 * Math.sin(k * Math.PI)) * gone : 0.0001); O.link.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.link.instanceMatrix.needsUpdate = true;

  // ---------- attacker code runs
  const born = P(t, c.runs - 0.1, 0.7, back), rise = P(t, c.runs - 0.1, 0.8, eio), die = 1 - P(t, c.ver, 0.45);
  O.core.position.set(lerp(0.7, 0, rise), lerp(1.95, 3.05, rise) + Math.sin(t * 1.7) * 0.03, 0);
  const cs = born * die * (1 + Math.sin(t * 7) * 0.05); O.core.visible = cs > 0.002; O.core.scale.setScalar(Math.max(0.0001, cs));
  O.coreMesh.rotation.set(t * 0.7, t * 1.1, 0); O.coreWire.rotation.set(-t * 0.4, t * 0.5, t * 0.3);
  O.glow.material.opacity = 0.9 * clamp(cs); O.coreLight.intensity = 9 * clamp(cs);
  $('flash').style.opacity = pulse(t, c.runs, 0.5) * 0.3;

  // ---------- fix
  O.shield.scale.setScalar(0.7 + 0.3 * fixed); fadeG(O.shield, clamp(fixed), 0.08 + 0.05 * Math.sin(t * 2) ** 2);

  // ---------- tags
  const g = O.t;
  pop(g.warn, t, c.code, c.news - 0.15);
  pop(g.gate, t, c.checks, c.written - 0.1); pop(g.ok, t, c.writes + 0.45, c.nothing - 0.1);
  pop(g.blocked, t, c.nothing + 0.25, c.att - 0.1); pop(g.prot, t, c.dotgit, c.att + 0.2);
  pop(g.longT, t, c.long, c.passes + 0.2); g.longT.pos.y = ly + 0.3;
  pop(g.pass, t, c.passes + 0.5, c.shorter + 0.2);
  pop(g.wr, t, c.shorter, c.submodule - 0.1); g.wr.pos.set(O.short.position.x + 0.42, O.short.position.y, 0.4);
  pop(g.subT, t, c.submodule, c.uses - 0.1); pop(g.sym, t, c.symlink + 0.15, c.uses - 0.1); pop(g.hooksT, t, c.hooks - 0.25, c.uses + 0.2);
  pop(g.rce, t, c.runs + 0.45, c.flag - 0.1); pop(g.lap, t, c.laptop, c.flag - 0.1); pop(g.cir, t, c.ci, c.flag - 0.1);
  pop(g.pipe, t, c.pipelines, c.fix - 0.1); pop(g.ag, t, c.agents, c.fix - 0.1);
  pop(g.patched, t, c.ver + 0.5, c.clone - 0.2);
  for (const tg of tags) placeTag(tg);

  // ---------- headline (the news)
  $('head').style.opacity = win(t, c.news + 0.1, c.trick - 0.3, 0.3, 0.3);
  const h1 = P(t, c.six - 0.2, 0.4, back); $('hl').style.opacity = P(t, c.six - 0.2, 0.15); $('hl').style.transform = `scale(${0.7 + 0.3 * h1})`;
  const h2 = P(t, c.high - 0.5, 0.4, back); $('hl2').style.opacity = P(t, c.high - 0.5, 0.15); $('hl2').style.transform = `translateY(${(1 - h2) * 26}px) scale(${0.85 + 0.15 * h2})`;

  // ---------- terminal
  let tv = 0, ttl = '', body = '';
  const FLAG = '--recurse-submodules';
  if (t < c.news) {
    tv = win(t, 0.12, c.news - 0.3, 0.25, 0.3); ttl = 'terminal';
    const all = `git clone ${FLAG} \\\n    https://example.com/cool-repo`; const done = t >= 2.3;
    body = `<span class="p">$</span> ${esc(typed(all, t, 0.3, 2.0)).replace(FLAG, `<span class="or">${FLAG}</span>`)}${done ? blink(t) : CUR}`;
    if (!body.includes('\n')) body += '\n';
  } else if (t >= c.flag && t < c.fix) {
    tv = win(t, c.flag + 0.15, c.fix - 0.3); ttl = 'terminal';
    const on = t >= c.flagw - 0.05;
    body = `<span class="p">$</span> git clone <span class="${on ? 'hl' : 'or'}">${FLAG}</span> \\\n    https://example.com/cool-repo\n`;
    body += t >= c.pipelines ? `<span class="d"># CI jobs, build bots, AI agents…</span>` : '';
  } else if (t >= c.update - 0.4 && t < c.clone - 0.3) {
    tv = win(t, c.update - 0.3, c.clone - 0.6); ttl = 'terminal';
    body = `<span class="p">$</span> ${typed('git --version', t, c.update, 0.6)}${t < c.ver ? CUR : ''}\n`;
    body += t >= c.ver ? `<span class="hl">git version 2.56.1</span>\n` : '\n';
    body += t >= c.backport ? `<span class="d"># or: 2.55.1 2.54.1 2.53.1\n#     2.52.1 2.51.3 2.50.2</span>` : '\n';
  } else if (t >= c.clone - 0.3 && t < c.end) {
    tv = win(t, c.clone - 0.25, c.end - 0.3); ttl = 'terminal';
    body = `<span class="p">$</span> ${typed('git clone <repo-url>', t, c.clone, 0.7).replace('<', '&lt;')}${t < c.inspect ? blink(t) : ''}   <span class="d">${t >= c.clone + 0.9 ? '# no submodules' : ''}</span>\n`;
    body += t >= c.inspect ? `<span class="p">$</span> ${typed('cat .gitmodules', t, c.inspect, 0.8)}${t < c.mods + 0.4 ? CUR : ''}\n` : '\n';
    body += t >= c.mods + 0.4 ? `<span class="cy">[submodule "lib"]\n  url = https://example.com/lib</span>` : '\n';
  }
  const te = $('term'); te.style.opacity = tv; te.style.transform = `translateY(${(1 - tv) * -30}px) scale(${0.96 + 0.04 * tv})`;
  if (tv > 0) { $('tt').textContent = ttl; $('tp').innerHTML = body; }

  // ---------- truncation panel
  const gv = win(t, c.long - 0.2, c.sub - 0.25); const ge = $('gauges'); ge.style.opacity = gv; ge.style.transform = `translateY(${(1 - gv) * -30}px)`;
  if (gv > 0) {
    const grow = P(t, c.long, c.trunc - c.long - 0.1, eio), tr = t >= c.trunc;
    $('lf').style.width = (tr ? 4 + 96 * (1 - P(t, c.trunc, 0.18)) : grow * 100) + '%';
    $('lf').style.background = tr ? '#ff5a5a' : (grow > 0.8 ? 'linear-gradient(90deg,#ffb347,#ff5a5a)' : 'linear-gradient(90deg,#2dd4bf,#ffb347)');
    $('lv').innerHTML = tr ? '<span style="color:#ff5a5a">truncated</span>' : (grow > 0.8 ? '<span style="color:#ffb347">too long…</span>' : 'growing');
    $('ck').innerHTML = t >= c.passes + 0.5 ? '<span style="color:#ffb347">aaaaaaaa…aaaa</span> <span style="color:#4ade80">✓ ok</span>' : '<span style="color:#44506e">—</span>';
    $('wr').innerHTML = t >= c.shorter ? '<span style="color:#ff5a5a">.git  ✖ overwritten</span>' : '<span style="color:#44506e">—</span>';
    ge.style.borderColor = tr ? '#ff5a5a' : '#4a3320';
    if (tr && t < c.trunc + 0.4) ge.style.transform += ` translateX(${Math.sin(t * 70) * 5}px)`;
  }

  // ---------- takeaway
  $('fin').style.opacity = P(t, c.end + 0.15, 0.3);
  const fa = P(t, c.end + 0.15, 0.4, back); $('fa').style.transform = `scale(${0.8 + 0.2 * fa})`;
  for (const [id, a] of [['fp1', c.treat], ['fp2', c.treat + 0.5]]) { const k = P(t, a, 0.35, back); $(id).style.opacity = P(t, a, 0.12); $(id).style.transform = `scale(${0.6 + 0.4 * k})`; }
  $('fch').style.opacity = P(t, c.treat + 0.9, 0.4);

  $('prog').style.width = (t / c.duration * 100) + '%';
  captions(t);
  renderer.render(scene, camera);
}

// ───────────────────────── boot
window.init = async () => {
  const [tm, cu] = await Promise.all([fetch('../../../episodes/' + EP + '/timings.json').then((r) => r.json()), fetch('../../../episodes/' + EP + '/cues.json').then((r) => r.json())]);
  T = tm; C = cu.c;
  await Promise.all(["900 92px Inter", "800 96px Inter", "700 96px 'JetBrains Mono'", "500 37px 'JetBrains Mono'", "700 34px 'JetBrains Mono'"].map((f) => document.fonts.load(f)));
  build();
  const c = C;
  KEYS = [
    { t0: 0, t1: 0, pos: V(5.4, 4.4, 9.4), look: V(0, 1.6, 0) },
    { t0: 0, t1: c.news, pos: V(1.5, 3.6, 9.0), look: V(0, 1.7, 0), e: (k) => k * (2 - k) },
    { t0: c.news - 0.2, t1: c.news + 1.3, pos: V(-3.0, 3.9, 9.6), look: V(0, 2.5, 0) },
    { t0: c.trick - 0.2, t1: c.trick + 1.2, pos: V(2.4, 3.7, 8.6), look: V(0, 2.25, 0) },
    { t0: c.att - 0.2, t1: c.att + 1.2, pos: V(-2.2, 4.3, 10.3), look: V(0, 2.72, 0) },
    { t0: c.written - 0.2, t1: c.shorter + 0.6, pos: V(-1.2, 3.0, 7.0), look: V(-0.2, 1.75, 0) },
    { t0: c.sub - 0.2, t1: c.sub + 1.1, pos: V(0.6, 2.6, 5.9), look: V(0, 1.5, 0) },
    { t0: c.run - 0.1, t1: c.runs + 0.6, pos: V(2.6, 3.9, 8.8), look: V(0, 2.3, 0) },
    { t0: c.flag - 0.2, t1: c.flag + 1.3, pos: V(-2.2, 3.7, 8.8), look: V(0, 2.5, 0) },
    { t0: c.fix - 0.2, t1: c.fix + 1.2, pos: V(2.0, 3.6, 8.4), look: V(0, 2.3, 0) },
    { t0: c.wk - 0.2, t1: c.wk + 1.2, pos: V(-1.8, 3.4, 8.2), look: V(0, 2.3, 0) },
    { t0: c.end - 0.2, t1: c.end + 1.6, pos: V(3.4, 4.4, 10.0), look: V(0, 2.9, 0) },
  ];
  frame(0);
  return C.duration;
};
window.renderFrame = (t) => frame(t);
