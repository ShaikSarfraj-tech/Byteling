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
const COMP = [1, 4, 7, 12, 15, 18];                 // which files are Angular components
const filePos = (i, out) => out.set((i % 5 - 2) * 0.56, 1.95 + Math.floor(i / 5) * 0.4, 0);
const NGP_Y = 0.97;

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

  add('ts6', slab(3.4, 0.6, 2.2, 0x1e4fa3, { label: 'TypeScript 6', labelColor: '#dbe9ff', edge: 0x7fb4ff, labelH: 0.26 }));
  add('plug', slab(1.9, 0.22, 1.2, 0xa16207, { label: 'transformer API', mono: true, labelColor: '#fff3c4', edge: 0xffd84a, emissive: 0xa16207, labelH: 0.12 }));
  add('ts7', slab(3.4, 0.6, 2.2, 0x0e7490, { label: 'TypeScript 7 · Go', labelColor: '#d5fbff', edge: 0x5ee6ff, emissive: 0x0e7490, labelH: 0.26 }));
  add('ngc', slab(3.0, 0.6, 2.0, 0x9f1239, { label: 'ngc · Angular compiler', labelColor: '#ffd9e1', edge: 0xfb7185, emissive: 0x9f1239, labelH: 0.2 }));
  add('ngp', slab(3.0, 0.6, 2.0, 0xc2410c, { label: 'ngp · Angular preprocessor', labelColor: '#fff0dc', edge: 0xffb347, emissive: 0xc2410c, labelH: 0.18 }));
  add('dec', slab(1.5, 0.3, 0.9, 0x6d28d9, { label: '@Component', mono: true, labelColor: '#ede4ff', edge: 0xb79cff, labelH: 0.14 }));
  add('tpl', slab(1.5, 0.3, 0.9, 0x0f766e, { label: '<template>', mono: true, labelColor: '#d5fff6', edge: 0x5eead4, labelH: 0.14 }));
  add('js', slab(1.3, 0.34, 0.9, 0xa16207, { label: 'JavaScript', labelColor: '#fff3c4', edge: 0xffd84a, emissive: 0xa16207, labelH: 0.15 }));
  O.tools = [['tsgo', 0x0e7490, 0x5ee6ff], ['esbuild', 0x854d0e, 0xffd84a], ['Rolldown', 0x9a3412, 0xffb347]].map(([n, col, e], i) => {
    const s = slab(1.12, 0.5, 0.8, col, { label: n, mono: true, labelColor: '#ffffff', edge: e, emissive: col, labelH: 0.16 });
    s.userData.p = [(i - 1) * 1.25, 0.27, 2.25]; scene.add(s); return s;
  });
  O.files = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.3, 0.06), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.0 }), 20);
  O.files.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(O.files);
  O.beams = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.14), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true })); scene.add(m); return m; });
  O.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff9ec4 }), 24); scene.add(O.dots);
  O.flow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd84a }), 18); scene.add(O.flow);
  O.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.025, 0.025), new THREE.MeshBasicMaterial({ color: 0xbff4ff }), 16); scene.add(O.streaks);

  const cyan = '#5ee6ff', org = '#ffb347', grn = '#4ade80', red = '#ff5a5a', pink = '#ff9ec4', crim = '#fb7185';
  O.t = {
    broken: tag('✖ compiler broken', V(0, -0.05, 1.3), { color: red, cls: 'big', ay: 0 }),
    fastT: tag('native compiler<small>much faster builds</small>', V(0, -0.05, 1.3), { color: cyan, ay: 0, cls: 'big' }),
    noapi: tag('✖ no transformer API', V(0, -0.05, 1.3), { color: red, ay: 0, cls: 'big' }),
    plugT: tag('built on the transformer API', V(0, 0.2, 1.2), { color: '#ffd84a', ay: 0 }),
    rustT: tag('Rust', V(-0.95, 1.42, 1.05), { color: org, cls: 'big', ay: 1 }),
    oxcT: tag('Oxc', V(0.95, 1.42, 1.05), { color: org, cls: 'big', ay: 1 }),
    par: tag('scanning in parallel', V(0, 3.62, 0), { color: org }),
    comp: tag('components found', V(0, 3.62, 0), { color: pink }),
    meta: tag('metadata resolved ✓', V(0, 3.62, 0), { color: grn }),
    tc: tag('type checking', V(-1.25, 0.62, 2.3), { color: cyan }),
    bund: tag('bundling', V(0.65, 0.62, 2.3), { color: '#ffd84a' }),
    beta: tag('BETA', V(0, NGP_Y + 0.5, 1.05), { color: org, cls: 'big' }),
    prod: tag('production: stay on ngc', V(0, 3.05, 0), { color: crim, cls: 'big' }),
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
const _col = new THREE.Color(), _c2 = new THREE.Color();
const pulse = (t, a, d = 0.7) => P(t, a, 0.12) * (1 - P(t, a + 0.12, d));
const at = (g, x, y, z) => g.position.set(x, y, z);

function frame(t) {
  const c = C;
  const [cp, cl] = camAt(t); camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld(true);
  O.dust.rotation.y = t * 0.012;

  // ---------- TypeScript 6 (with the transformer API) slides out, TypeScript 7 slides in
  const sw = P(t, c.broke - 0.75, 0.75, eio);
  at(O.ts6, -sw * 7, 0.35, 0); fade(O.ts6, 1 - P(t, c.broke - 0.2, 0.4));
  at(O.plug, -sw * 7, 0.76, 0); fade(O.plug, 1 - P(t, c.broke - 0.2, 0.4));
  at(O.ts7, (1 - sw) * 7, 0.35, 0); fade(O.ts7, P(t, c.broke - 0.8, 0.3));
  O.ts7.userData.mat.emissiveIntensity = 0.5 + 1.6 * pulse(t, c.go, 1.2) + 0.8 * pulse(t, c.tsgo, 0.8);

  // speed streaks along TS7
  const st = win(t, c.native, c.without - 0.1, 0.4, 0.4); O.streaks.visible = st > 0.01;
  for (let i = 0; i < 16; i++) {
    const k = (t * 1.6 + rnd(i) * 3) % 1; _p.set(-1.9 + k * 3.8, 0.12 + rnd(i + 40) * 0.46, 1.13 + rnd(i + 80) * 0.03);
    _s.set(Math.max(0.0001, Math.sin(k * Math.PI) * st), 1, 1); O.streaks.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.streaks.instanceMatrix.needsUpdate = true;

  // ---------- ngc: sits on the API, breaks, is lifted away, returns as the production fallback
  const fall = P(t, c.broke - 0.05, 0.3, (k) => k * k), lift = P(t, c.built - 0.35, 0.8, eio), back2 = P(t, c.production - 0.3, 0.8, eio);
  const shake = pulse(t, c.broke, 0.9) * Math.sin(t * 60) * 0.04;
  let ny = lerp(1.17, 0.96, fall); ny = lerp(ny, 4.3, lift); ny = lerp(ny, 2.4, back2);
  at(O.ngc, shake, ny, 0); O.ngc.rotation.z = (0.09 * fall + shake) * (1 - lift);
  fade(O.ngc, (1 - lift) + back2);
  const hurt = fall * (1 - lift);
  O.ngc.userData.em.color.copy(_col.set(0xfb7185)).lerp(_c2.set(0xff2020), hurt * (0.5 + 0.5 * Math.sin(t * 8)));
  O.ngc.userData.mat.emissiveIntensity = 0.5 + 1.5 * pulse(t, c.broke, 1.0) + 1.2 * pulse(t, c.ngcw, 1.0);
  $('flash').style.opacity = pulse(t, c.broke, 0.4) * 0.25;

  // ---------- what ngc did: decorators + templates in, JavaScript out
  const inOut = 1 - P(t, c.ngp - 0.2, 0.4);
  for (const [g, a, x] of [[O.dec, c.decorators, -0.8], [O.tpl, c.templates, 0.8]]) {
    const k = P(t, a - 0.1, 0.55, (v) => v * v); at(g, x, lerp(3.4, 1.55, k), 0.1);
    fade(g, P(t, a - 0.1, 0.2) * (1 - P(t, a + 0.5, 0.35)) * inOut);
    g.scale.setScalar(1 - 0.5 * P(t, a + 0.4, 0.4));
  }
  const jk = P(t, c.js - 0.1, 0.6, eout); at(O.js, 0, 0.98, lerp(0.6, 2.25, jk)); fade(O.js, P(t, c.js - 0.1, 0.25) * inOut);

  // ---------- ngp drops in
  fade(O.ngp, drop(Object.assign(O.ngp, {}), t, c.ngpw - 0.15, { from: 3.0, d: 0.45 }));
  O.ngp.userData.mat.emissiveIntensity = 0.5 + 1.4 * pulse(t, c.rust, 1.0) + 1.0 * pulse(t, c.hands, 1.0);
  const betaK = P(t, c.betaw - 0.1, 0.5);
  O.ngp.userData.mat.opacity *= lerp(1, 0.55, betaK);

  // ---------- files scanned in parallel
  const gridOn = P(t, c.scans - 0.1, 0.2) * (1 - P(t, c.hand - 0.1, 0.6));
  const bx = lerp(-1.75, 1.75, P(t, c.parallel - 0.15, 1.25, eio));
  const found = P(t, c.component - 0.1, 0.4, back);
  O.files.visible = gridOn > 0.01;
  for (let i = 0; i < 20; i++) {
    filePos(i, _p); const a = P(t, c.scans - 0.1 + rnd(i) * 0.7, 0.3, back) * gridOn;
    const scanned = _p.x < bx, isC = COMP.includes(i);
    _col.set(0x33415e); if (scanned) _col.set(0xb45309); if (scanned && isC) _col.lerp(_c2.set(0xff5c93), found);
    O.files.setColorAt(i, _col);
    _s.setScalar(Math.max(0.0001, a * (1 + (isC ? 0.22 * found : 0)))); _p.z = isC ? 0.12 * found : 0;
    O.files.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.files.instanceMatrix.needsUpdate = true; O.files.instanceColor.needsUpdate = true;
  const beamOn = win(t, c.parallel - 0.2, c.parallel + 1.15, 0.15, 0.2) * gridOn;
  O.beams.forEach((b, r) => { b.visible = beamOn > 0.01; b.material.opacity = beamOn; b.position.set(bx, 1.95 + r * 0.4, 0.1); });
  const mk = P(t, c.metadata - 0.25, 0.3) * gridOn; O.dots.visible = mk > 0.01;
  for (let i = 0; i < 24; i++) {
    filePos(COMP[i % 6], _p); const k = (t * 0.9 + (i / 6 | 0) / 4 + (i % 6) * 0.07) % 1;
    _p.set(lerp(_p.x, _p.x * 0.3, k), lerp(_p.y, NGP_Y + 0.32, k), lerp(0.12, 0.3, Math.sin(k * Math.PI)));
    _s.setScalar(Math.max(0.0001, Math.sin(k * Math.PI) * mk)); O.dots.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.dots.instanceMatrix.needsUpdate = true;

  // ---------- hand-off to tsgo / esbuild / Rolldown
  const toolsOut = 1 - P(t, c.end - 0.1, 0.5) * 0;
  const cueT = [c.tsgo, c.esbuild, c.rolldown];
  O.tools.forEach((s, i) => {
    const a = P(t, c.hands + i * 0.14, 0.45, back); const p = s.userData.p;
    at(s, p[0], p[1], p[2]); s.scale.setScalar(Math.max(0.0001, a)); fade(s, clamp(a) * toolsOut);
    s.userData.mat.emissiveIntensity = 0.4 + 2.2 * pulse(t, cueT[i], 0.9) + (i === 0 ? 1.5 * pulse(t, c.type, 0.9) : 1.5 * pulse(t, c.bundling, 0.9));
  });
  const fl = P(t, c.hands + 0.5, 0.4) * (1 - P(t, c.beta - 0.2, 0.5)); O.flow.visible = fl > 0.01;
  for (let i = 0; i < 18; i++) {
    const j = i % 3, k = (t * 0.8 + (i / 3 | 0) / 6) % 1; const p = O.tools[j].userData.p;
    _p.set(lerp(p[0] * 0.4, p[0], k), lerp(NGP_Y, p[1] + 0.3, k) + Math.sin(k * Math.PI) * 0.25, lerp(1.02, p[2], k));
    _s.setScalar(Math.max(0.0001, Math.sin(k * Math.PI) * fl)); O.flow.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.flow.instanceMatrix.needsUpdate = true;

  // ---------- tags
  const g = O.t;
  pop(g.broken, t, c.broke + 0.2, c.why - 0.2);
  pop(g.fastT, t, c.go, c.without - 0.1); pop(g.noapi, t, c.without + 0.1, c.ngc - 0.1);
  pop(g.plugT, t, c.plugged + 0.2, c.decorators - 0.1);
  pop(g.rustT, t, c.rust, c.hand - 0.1); pop(g.oxcT, t, c.oxc, c.hand - 0.1);
  pop(g.par, t, c.parallel, c.component - 0.15); pop(g.comp, t, c.component, c.metadata - 0.3); pop(g.meta, t, c.metadata, c.hand - 0.1);
  pop(g.tc, t, c.type, c.bench - 0.1); pop(g.bund, t, c.bundling, c.bench - 0.1);
  pop(g.beta, t, c.betaw, c.end - 0.1); pop(g.prod, t, c.production, c.end - 0.1);
  for (const tg of tags) placeTag(tg);

  // ---------- headline (hook)
  $('head').style.opacity = win(t, 0.12, c.why - 0.3, 0.25, 0.3);
  const h1 = P(t, 0.2, 0.45, back); $('hl').style.transform = `scale(${0.7 + 0.3 * h1})`; $('hl').style.opacity = P(t, 0.2, 0.2);
  const hx = P(t, c.broke, 0.3, back); $('hx').style.display = 'inline-block'; $('hx').style.opacity = P(t, c.broke - 0.05, 0.1);
  $('hx').style.transform = `scale(${0.5 + 0.5 * hx})`;
  const h2 = P(t, c.rust0 - 0.6, 0.4, back); $('hl2').style.opacity = P(t, c.rust0 - 0.6, 0.2); $('hl2').style.transform = `translateY(${(1 - h2) * 30}px) scale(${0.8 + 0.2 * h2})`;

  // ---------- benchmark panel
  const cv = win(t, c.benchmarks - 0.5, c.beta - 0.2); const ce = $('cmp'); ce.style.opacity = cv; ce.style.transform = `translateY(${(1 - cv) * -30}px)`;
  if (cv > 0) {
    const a = P(t, c.benchmarks, 0.5, eio), b = P(t, c.benchmarks + 0.2, c.three - c.benchmarks + 0.3, eio);
    $('b1').style.width = a * 33 + '%'; $('b2').style.width = b * 100 + '%';
    $('v1').textContent = a >= 1 ? '1×' : ''; $('v2').textContent = b > 0.3 ? `up to ${(1 + 2 * b).toFixed(1).replace('.0', '')}×` : '';
  }

  // ---------- takeaway
  $('fin').style.opacity = P(t, c.end + 0.3, 0.3);
  const fa = P(t, c.end + 0.3, 0.4, back); $('fa').style.transform = `scale(${0.8 + 0.2 * fa})`;
  for (const [id, a2] of [['fp1', c.tools - 0.1], ['fp2', c.native2 - 0.35]]) { const k = P(t, a2, 0.35, back); $(id).style.opacity = P(t, a2, 0.12); $(id).style.transform = `scale(${0.6 + 0.4 * k})`; }
  $('fch').style.opacity = P(t, c.native2 + 0.3, 0.4);

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
  O.ngp.userData.p = [0, NGP_Y, 0];
  const c = C;
  KEYS = [
    { t0: 0, t1: 0, pos: V(4.4, 3.4, 8.6), look: V(0, 1.5, 0) },
    { t0: 0, t1: c.why, pos: V(-1.6, 3.0, 8.4), look: V(0, 1.5, 0), e: (k) => k * (2 - k) },
    { t0: c.why - 0.2, t1: c.why + 1.2, pos: V(2.4, 2.6, 8.4), look: V(0, 1.2, 0) },
    { t0: c.ngc - 0.2, t1: c.ngc + 1.2, pos: V(-2.2, 3.0, 7.8), look: V(0, 1.85, 0) },
    { t0: c.ngp - 0.2, t1: c.ngp + 1.3, pos: V(2.0, 3.0, 7.6), look: V(0, 1.6, 0) },
    { t0: c.scans - 0.3, t1: c.scans + 1.0, pos: V(1.2, 3.4, 8.8), look: V(0, 2.25, 0) },
    { t0: c.hand - 0.2, t1: c.hand + 1.2, pos: V(-1.6, 4.4, 11.6), look: V(0, 0.95, 0.8) },
    { t0: c.bench - 0.2, t1: c.bench + 1.2, pos: V(2.2, 3.0, 8.4), look: V(0, 1.9, 0.5) },
    { t0: c.beta - 0.2, t1: c.beta + 1.2, pos: V(-1.9, 3.2, 8.6), look: V(0, 2.1, 0.4) },
    { t0: c.end - 0.2, t1: c.end + 1.6, pos: V(3.4, 4.2, 10.2), look: V(0, 2.9, 0.4) },
  ];
  frame(0);
  return C.duration;
};
window.renderFrame = (t) => frame(t);
