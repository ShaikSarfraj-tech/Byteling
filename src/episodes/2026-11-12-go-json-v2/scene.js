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
const MY = 1.95, SLOT = 0.45, REST = 0.84, TOP = 3.3;      // machine centre, slot centre, value rest height, feed height

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
  const add = (k, g) => { scene.add(g); O[k] = g; return g; };
  const tok = (k, txt, col, edge, w = 2.2) => add(k, slab(w, 0.3, 1.0, col, { label: txt, mono: true, labelColor: '#ffffff', edge, emissive: col, labelH: 0.15 }));

  add('m1', slab(3.0, 0.8, 1.8, 0x475569, { label: 'encoding/json · v1', mono: true, labelColor: '#e2e8f0', edge: 0xa9b6d3, labelH: 0.2 }));
  add('m2', slab(3.0, 0.8, 1.8, 0x0e7490, { label: 'encoding/json/v2', mono: true, labelColor: '#d5fbff', edge: 0x5ee6ff, emissive: 0x0e7490, labelH: 0.22 }));
  add('shell', slab(3.5, 1.2, 2.2, 0x94a3b8, { edge: 0xe2e8f0 })); O.shell.userData.mat.depthWrite = false; O.shell.userData.mat.side = THREE.DoubleSide;
  O.slots = ['Admin bool', 'Role string', 'Tags []string'].map((n) => { const s = slab(2.6, 0.5, 1.5, 0x24406f, { label: n, mono: true, labelColor: '#9fc4ff', edge: 0x5b8def, labelH: 0.17 }); s.position.set(0, SLOT, 0); scene.add(s); return s; });
  tok('tokA', '"ADMIN": true', 0x7c3aed, 0xc4b5fd); tok('tokB', '"ADMIN": true', 0x7c3aed, 0xc4b5fd);
  tok('valA', 'true', 0xb45309, 0xfbbf24, 1.2);
  tok('tokR1', '"role": "user"', 0x0f766e, 0x5eead4); tok('tokR2', '"role": "admin"', 0xb91c1c, 0xff8a8a);
  tok('valR1', '"user"', 0x0f766e, 0x5eead4, 1.4); tok('valR2', '"admin"', 0xb91c1c, 0xff8a8a, 1.4);
  tok('nilv', 'nil', 0x475569, 0xa9b6d3, 1.1);
  tok('outNull', '"tags": null', 0xb91c1c, 0xff8a8a); tok('outArr', '"tags": []', 0x15803d, 0x86efac);
  O.bugs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshBasicMaterial({ color: 0xff4d4d }), 12); scene.add(O.bugs);

  const cyan = '#5ee6ff', grn = '#4ade80', red = '#ff5a5a', org = '#ffb347', gray = '#a9b6d3';
  const below = V(0, SLOT - 0.02, 0.8);
  O.t = {
    bugsT: tag('silent bugs', V(0, MY + 0.75, 0.5), { color: red, cls: 'big' }),
    ga: tag('stable in Go 1.27', V(0, MY + 0.75, 0.5), { color: cyan, cls: 'big' }),
    a1: tag('v1: "ADMIN" filled Admin<small>case-insensitive match</small>', below.clone(), { color: org, ay: 0.5 }),
    a2: tag('v2: no exact match<small>field stays untouched</small>', below.clone(), { color: cyan, ay: 0.5 }),
    r1: tag('v1: last one wins<small>no error, no warning</small>', below.clone(), { color: org, ay: 0.5 }),
    r2: tag('v2 error: duplicate name', below.clone(), { color: red, ay: 0.5, cls: 'big' }),
    n1: tag('v1: null, not an array', V(0, TOP + 0.25, 0.5), { color: red }),
    n2: tag('v2: always an array ✓', V(0, TOP + 0.25, 0.5), { color: grn }),
    eng: tag('v1 API · v2 engine', V(0, MY + 0.85, 0.6), { color: cyan, cls: 'big' }),
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
const pulse = (t, a, d = 0.7) => P(t, a, 0.12) * (1 - P(t, a + 0.12, d));
// token falls into the machine and is absorbed
function feed(g, t, a, x = 0) { const k = P(t, a, 0.6, (v) => v * v); g.position.set(x, lerp(TOP, MY + 0.5, k), 0); g.rotation.z = 0; g.scale.setScalar(1 - 0.55 * P(t, a + 0.45, 0.2)); return P(t, a, 0.2) * (1 - P(t, a + 0.55, 0.12)); }
// value drops out of the machine into the struct field
function emit(g, t, a) { const k = P(t, a, 0.5, (v) => v * v); g.position.set(0, lerp(MY - 0.5, REST, k), 0); g.scale.setScalar(0.6 + 0.4 * P(t, a, 0.3)); return P(t, a, 0.15); }

function frame(t) {
  const c = C;
  const [cp, cl] = camAt(t); camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld(true);
  O.dust.rotation.y = t * 0.012;

  // ---------- which engine is running: 0 = v1, 1 = v2
  const m = clamp(P(t, c.fixes - 0.1, 0.5) - P(t, c.p1 - 0.2, 0.4) + P(t, c.p1v2 - 0.1, 0.4) - P(t, c.p2 - 0.2, 0.4)
    + P(t, c.p2v2 - 0.1, 0.4) - P(t, c.p3 - 0.2, 0.4) + P(t, c.p3v2 - 0.1, 0.4));
  const err = pulse(t, c.error - 0.05, 0.9), shake = err * Math.sin(t * 70) * 0.05;
  for (const g of [O.m1, O.m2]) { g.position.set(shake, MY, 0); g.scale.setScalar(1 + 0.04 * pulse(t, c.fixes, 0.6)); }
  fade(O.m1, 1 - m); fade(O.m2, m);
  O.m2.userData.mat.emissive.set(err > 0.05 ? 0xff2020 : 0x0e7490);
  O.m2.userData.mat.emissiveIntensity = 0.5 + 1.6 * pulse(t, c.fixes, 1.0) + 1.4 * pulse(t, c.v2w, 1.0) + 2.5 * err + 1.2 * pulse(t, c.twice, 1.0);
  $('flash').style.opacity = err * 0.25;
  const sh = P(t, c.classic - 0.1, 0.6, back) * (1 - P(t, c.end + 0.2, 0.6));
  O.shell.position.set(0, MY, 0); O.shell.scale.setScalar(0.8 + 0.2 * sh); fade(O.shell, clamp(sh), { fill: 0.12, edge: 0.9 }); O.shell.userData.mat.depthWrite = false;

  // ---------- bugs crawling over the old package
  const bg = P(t, c.hiding - 0.3, 0.4) * (1 - P(t, c.fixes - 0.05, 0.35)); O.bugs.visible = bg > 0.01;
  for (let i = 0; i < 12; i++) {
    const a = t * (0.5 + rnd(i) * 0.6) + i * 2.1; _p.set(Math.sin(a) * 1.3, MY + Math.sin(a * 1.7 + i) * 0.3, 0.93);
    _s.setScalar(Math.max(0.0001, bg * P(t, c.hiding - 0.3 + i * 0.08, 0.25, back))); O.bugs.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.bugs.instanceMatrix.needsUpdate = true;

  // ---------- struct field slots
  const w1 = win(t, c.p1 + 0.2, c.p2 - 0.3), w2 = win(t, c.p2 + 0.2, c.p3 - 0.3), w3 = win(t, c.p3 + 0.2, c.fast - 0.2);
  [w1, w2, w3].forEach((o, i) => fade(O.slots[i], o));

  // ---------- problem 1: case-insensitive match
  fade(O.tokA, feed(O.tokA, t, c.wrong - 0.15) * w1);
  fade(O.valA, emit(O.valA, t, c.silently + 0.1) * (1 - P(t, c.p1v2 - 0.1, 0.3)) * w1);
  { const a = c.p1v2 + 0.35, k = P(t, a, 0.5, (v) => v * v), b = P(t, a + 0.5, 0.7, eout);
    O.tokB.position.set(b * 2.4, lerp(TOP, MY + 0.56, k) + Math.sin(b * Math.PI) * 0.6, b * 0.6); O.tokB.rotation.z = -b * 0.9;
    fade(O.tokB, P(t, a, 0.2) * (1 - P(t, a + 0.75, 0.4)) * w1); }

  // ---------- problem 2: duplicate keys
  const v1dup = 1 - P(t, c.p2v2 - 0.1, 0.3);
  fade(O.tokR1, Math.max(feed(O.tokR1, t, c.dup - 0.05) * v1dup, 0));
  fade(O.valR1, emit(O.valR1, t, c.dup + 0.55) * (1 - P(t, c.v1b + 1.1, 0.25)) * w2);
  fade(O.tokR2, feed(O.tokR2, t, c.v1b + 0.05) * v1dup);
  fade(O.valR2, emit(O.valR2, t, c.v1b + 0.7) * v1dup * w2);
  if (t >= c.p2v2 + 0.1) {                                   // v2: both tokens are refused above the machine
    const a = P(t, c.p2v2 + 0.15, 0.4, back);
    O.tokR1.position.set(-0.25 + shake, MY + 0.62, 0); O.tokR2.position.set(0.25 + shake, MY + 0.98, 0);
    for (const g of [O.tokR1, O.tokR2]) { g.scale.setScalar(0.7 + 0.3 * a); g.rotation.z = 0; fade(g, clamp(a) * w2); }
  }

  // ---------- problem 3: nil slice → null vs []
  { const up = P(t, c.written - 0.25, 0.5, eio); O.nilv.position.set(0, lerp(REST, MY - 0.5, up), 0); O.nilv.scale.setScalar(1 - 0.5 * P(t, c.written + 0.1, 0.2));
    fade(O.nilv, P(t, c.nil - 0.2, 0.3) * (1 - P(t, c.written + 0.15, 0.15)) * w3);
    const o1 = P(t, c.null - 0.2, 0.5, eout); O.outNull.position.set(0, lerp(MY + 0.5, TOP - 0.25, o1), 0);
    fade(O.outNull, P(t, c.null - 0.2, 0.15) * (1 - P(t, c.p3v2, 0.3)) * w3);
    const o2 = P(t, c.writes, 0.5, eout); O.outArr.position.set(0, lerp(MY + 0.5, TOP - 0.25, o2), 0);
    fade(O.outArr, P(t, c.writes, 0.15) * w3);
    O.outArr.userData.mat.emissiveIntensity = 0.6 + 1.5 * pulse(t, c.empty, 0.9); }

  // ---------- tags
  const g = O.t;
  pop(g.bugsT, t, c.bugs, c.go127 - 0.1); pop(g.ga, t, c.ga, c.p1 - 0.2);
  pop(g.a1, t, c.fill, c.p1v2 - 0.1); pop(g.a2, t, c.exact, c.p2 - 0.3);
  pop(g.r1, t, c.accepted, c.p2v2 - 0.1); pop(g.r2, t, c.returns, c.p3 - 0.3);
  pop(g.n1, t, c.null + 0.2, c.p3v2 - 0.05); pop(g.n2, t, c.empty, c.fast - 0.2);
  pop(g.eng, t, c.engine, c.end + 0.1);
  for (const tg of tags) placeTag(tg);

  // ---------- headline (hook)
  $('head').style.opacity = win(t, 0.12, c.p1 - 0.3, 0.25, 0.3);
  const h1 = P(t, 0.2, 0.45, back); $('hl').style.transform = `scale(${0.7 + 0.3 * h1})`; $('hl').style.opacity = P(t, 0.2, 0.2);
  const hx = P(t, c.bugs, 0.3, back); $('hx').style.display = 'inline-block'; $('hx').style.opacity = P(t, c.bugs - 0.05, 0.1); $('hx').style.transform = `scale(${0.5 + 0.5 * hx})`;
  const h2 = P(t, c.go127 - 0.1, 0.4, back); $('hl2').style.opacity = P(t, c.go127 - 0.1, 0.2); $('hl2').style.transform = `translateY(${(1 - h2) * 30}px) scale(${0.8 + 0.2 * h2})`;

  // ---------- code card
  let tv = 0, ttl = '', body = '';
  if (t >= c.p1 && t < c.p2) {
    tv = win(t, c.p1 + 0.3, c.p2 - 0.3); ttl = 'user.go';
    body = `type User struct {\n  Admin bool <span class="cy">\`json:"admin"\`</span>\n}\n<span class="d">// input</span>  {"<span class="${t >= c.case ? 'hl' : ''}">ADMIN</span>": true}`;
  } else if (t >= c.p2 && t < c.p3) {
    tv = win(t, c.p2 + 0.3, c.p3 - 0.3); ttl = 'input.json'; const h = t >= c.dup ? 'hl' : '';
    body = `{\n  "<span class="${h}">role</span>": "user",\n  "<span class="${h}">role</span>": "admin"\n}`;
  } else if (t >= c.p3 && t < c.fast) {
    tv = win(t, c.p3 + 0.3, c.fast - 0.25); ttl = 'post.go';
    body = `Tags []string  <span class="d">// nil slice</span>\n<span class="d">// output</span>\n`;
    body += t >= c.writes + 0.3 ? `<span class="gr">{"tags": []}</span>` : (t >= c.null ? `<span class="rd">{"tags": null}</span>` : '');
  } else if (t >= c.imports - 0.4 && t < c.end + 0.2) {
    tv = win(t, c.imports - 0.3, c.end - 0.1); ttl = 'main.go';
    body = `${typed('import "encoding/json"', t, c.imports - 0.2, 0.7)}${t >= c.work ? '  <span class="gr">✓ still works</span>' : ''}\n`;
    body += t >= c.classic ? `<span class="d">// same API, same behavior</span>\n` : '\n';
    body += t >= c.engine - 0.3 ? `<span class="cy">// new v2 engine underneath</span>` : '';
  }
  const te = $('term'); te.style.opacity = tv; te.style.transform = `translateY(${(1 - tv) * -30}px) scale(${0.96 + 0.04 * tv})`;
  if (tv > 0) { $('tt').textContent = ttl; $('tp').innerHTML = body; }

  // ---------- benchmark panel
  const cv = win(t, c.faster - 0.2, c.best - 0.2); const ce = $('cmp'); ce.style.opacity = cv; ce.style.transform = `translateY(${(1 - cv) * -30}px)`;
  if (cv > 0) {
    const a = P(t, c.faster, 0.5, eio), b = P(t, c.bench, c.twice - c.bench + 0.3, eio);
    $('b1').style.width = a * 50 + '%'; $('b2').style.width = b * 100 + '%';
    $('v1').textContent = a >= 1 ? '1×' : ''; $('v2').textContent = t >= c.twice ? '≈ 2×' : '';
  }

  // ---------- takeaway
  $('fin').style.opacity = P(t, c.move - 0.2, 0.3);
  const fa = P(t, c.move - 0.2, 0.4, back); $('fa').style.transform = `scale(${0.8 + 0.2 * fa})`;
  for (const [id, a2] of [['fp1', c.strict - 0.05], ['fp2', c.strict + 0.45]]) { const k = P(t, a2, 0.35, back); $(id).style.opacity = P(t, a2, 0.12); $(id).style.transform = `scale(${0.6 + 0.4 * k})`; }
  $('fch').style.opacity = P(t, c.surprising, 0.4);

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
  const c = C, L = V(0, 2.1, 0);
  KEYS = [
    { t0: 0, t1: 0, pos: V(4.0, 3.4, 8.0), look: V(0, 2.4, 0) },
    { t0: 0, t1: c.meet, pos: V(-1.4, 3.1, 7.8), look: V(0, 2.4, 0), e: (k) => k * (2 - k) },
    { t0: c.meet - 0.2, t1: c.meet + 1.2, pos: V(1.6, 3.0, 7.4), look: V(0, 2.3, 0) },
    { t0: c.p1 - 0.2, t1: c.p1 + 1.2, pos: V(-2.2, 3.6, 8.4), look: L },
    { t0: c.p1v2 - 0.2, t1: c.p1v2 + 1.0, pos: V(1.2, 3.5, 8.4), look: L },
    { t0: c.p2 - 0.2, t1: c.p2 + 1.2, pos: V(2.3, 3.6, 8.4), look: L },
    { t0: c.p2v2 - 0.2, t1: c.p2v2 + 1.0, pos: V(-1.0, 3.5, 8.2), look: L },
    { t0: c.p3 - 0.2, t1: c.p3 + 1.2, pos: V(-2.3, 3.6, 8.4), look: L },
    { t0: c.p3v2 - 0.2, t1: c.p3v2 + 1.0, pos: V(1.0, 3.5, 8.2), look: L },
    { t0: c.fast - 0.2, t1: c.fast + 1.2, pos: V(2.2, 3.2, 8.2), look: V(0, 2.4, 0) },
    { t0: c.best - 0.2, t1: c.best + 1.2, pos: V(-2.0, 3.3, 8.4), look: V(0, 2.5, 0) },
    { t0: c.end - 0.2, t1: c.end + 1.8, pos: V(3.0, 4.0, 9.8), look: V(0, 3.1, 0) },
  ];
  frame(0);
  return C.duration;
};
window.renderFrame = (t) => frame(t);
