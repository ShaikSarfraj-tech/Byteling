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
const NS = 12, LBY = 3.05;
const SOLO = 5;                                   // the single server that dies first
const WAVE = [0, 2, 3, 6, 7, 9, 10];              // "many servers fail their checks at once"
const LAST = [1, 4, 8, 11];                       // the survivors that then overload
const spos = (i, out) => out.set((i % 4 - 1.5) * 0.88, 0.6 + Math.floor(i / 4) * 0.74, 0);
let FAIL, REC;                                    // per-server failure / recovery times (set at boot)

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

  // hook: the two apps
  add('outlook', slab(3.1, 0.85, 0.7, 0x1d4ed8, { label: 'Outlook', labelColor: '#ffffff', edge: 0x93c5fd, emissive: 0x1d4ed8, labelH: 0.36 }));
  add('teamsS', slab(3.1, 0.85, 0.7, 0x5b3fc4, { label: 'Teams', labelColor: '#ffffff', edge: 0xc4b5fd, emissive: 0x5b3fc4, labelH: 0.36 }));

  // load balancer + server wall
  add('lbS', slab(3.7, 0.46, 1.2, 0x0e7490, { label: 'LOAD BALANCER', labelColor: '#d5fbff', edge: 0x5ee6ff, emissive: 0x0e7490, labelH: 0.2 }));
  O.srv = new THREE.InstancedMesh(new THREE.BoxGeometry(0.66, 0.52, 0.8), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35 }), NS);
  O.led = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.07, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }), NS);
  O.slot = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x0b1220 }), NS * 2);
  O.srv.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(O.srv, O.led, O.slot);
  O.req = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd84a }), 60); scene.add(O.req);
  O.rain = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd84a }), 26); scene.add(O.rain);
  O.ping = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), NS); scene.add(O.ping);

  const cyan = '#5ee6ff', grn = '#4ade80', red = '#ff5a5a', org = '#ffb347';
  O.t = {
    na: tag('Microsoft: no sign of an attack', V(0, 1.0, 1.4), { color: cyan, ay: 1 }),
    ask: tag('health check: are you alive?', V(0, LBY + 0.42, 0.6), { color: cyan }),
    out: tag('removed from rotation', V(0, 0, 0), { color: red, ay: 0 }),
    good: tag('✓ traffic avoids the dead server', V(0, 0.24, 0.5), { color: grn, ay: 0 }),
    mass: tag('mass ejection', V(0, 0.24, 0.5), { color: red, ay: 0, cls: 'big' }),
    over: tag('overloaded', V(0, 0.24, 0.5), { color: org, ay: 0, cls: 'big' }),
    casc: tag('CASCADING FAILURE', V(0, 1.35, 0.6), { color: red, cls: 'big', ay: 0.5 }),
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

function frame(t) {
  const c = C;
  const [cp, cl] = camAt(t); camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld(true);
  O.dust.rotation.y = t * 0.012;

  // ---------- hook: Outlook + Teams go down
  const dn = P(t, c.down, 0.5, eout), flick = t > c.down && t < c.down + 0.5 ? (Math.sin(t * 90) > 0 ? 1 : 0.3) : 1;
  const appsOut = 1 - P(t, c.lb - 0.3, 0.6);
  for (const [g, y, a, base, s] of [[O.outlook, 2.75, 0.15, 0x1d4ed8, 1], [O.teamsS, 1.65, c.teams - 0.2, 0x5b3fc4, -1]]) {
    const inn = P(t, a, 0.45, back);
    g.position.set(s * 0.12 * dn, y - dn * 0.35 + (1 - inn) * 0.6 + P(t, c.lb - 0.3, 0.6) * 1.2, 1.0); g.rotation.z = s * 0.07 * dn;
    _col.set(base).lerp(_c2.set(0x7f1d1d), dn); g.userData.mat.color.copy(_col); g.userData.mat.emissive.copy(_col);
    g.userData.em.color.set(dn > 0.5 ? 0xff5a5a : 0x93c5fd); g.userData.mat.emissiveIntensity = 0.6 * flick;
    fade(g, P(t, a, 0.2) * appsOut * (0.55 + 0.45 * flick));
  }
  $('flash').style.opacity = pulse(t, c.down, 0.45) * 0.3 + pulse(t, c.cascading + 0.2, 0.6) * 0.3;

  // ---------- load balancer + servers
  const sys = P(t, c.lb - 0.2, 0.7, eout);
  const allDead = P(t, FAIL[LAST[3]] + 0.3, 0.4) * (1 - P(t, c.hc - 0.1, 0.5));
  O.lbS.position.set(0, LBY + (1 - sys) * 1.2, 0); fade(O.lbS, sys);
  O.lbS.userData.mat.emissiveIntensity = 0.5 + 1.2 * pulse(t, c.balancer, 1.0) + 0.8 * pulse(t, c.asking, 1.0);
  O.lbS.userData.em.color.copy(_col.set(0x5ee6ff)).lerp(_c2.set(0xff5a5a), allDead);

  const active = []; let nActive = 0;
  for (let i = 0; i < NS; i++) if (t < FAIL[i] + 0.35 || t >= REC[i]) { active.push(i); nActive++; }
  const strain = P(t, c.overload - 0.2, 0.8) * (1 - P(t, c.hc - 0.1, 0.3));                                  // survivors heating up
  O.srv.visible = O.led.visible = O.slot.visible = sys > 0.01;
  for (let i = 0; i < NS; i++) {
    spos(i, _p); const rec = 1 - P(t, REC[i], 0.35, eio); const dead = P(t, FAIL[i], 0.25) * rec, gone = P(t, FAIL[i] + 0.35, 0.45, eio) * rec;
    const inn = P(t, c.lb - 0.1 + (i % 4) * 0.06 + Math.floor(i / 4) * 0.1, 0.45, back);
    const hot = LAST.includes(i) ? strain * (1 - dead) : 0;
    const jit = hot * Math.sin(t * 55 + i) * 0.018;
    _p.x += jit; _p.z -= gone * 0.55; _p.y += (1 - inn) * -0.4;
    _s.setScalar(Math.max(0.0001, inn * (1 - 0.12 * gone) * (1 + 0.05 * hot)));
    O.srv.setMatrixAt(i, _m.compose(_p, _q, _s));
    _col.set(0x33466b).lerp(_c2.set(0xb45309), hot).lerp(_c2.set(0x1a2236), gone); O.srv.setColorAt(i, _col);
    const z0 = _p.z; _p.z = z0 + 0.41; _p.y += 0.15; O.led.setMatrixAt(i, _m.compose(_p, _q, _s));
    _col.set(0x4ade80).lerp(_c2.set(0xffb347), hot).lerp(_c2.set(0xff3b3b), dead); if (gone > 0.5) _col.multiplyScalar(0.55 + 0.25 * Math.sin(t * 6 + i)); O.led.setColorAt(i, _col);
    _p.y -= 0.15; for (let k = 0; k < 2; k++) { _p.y -= 0.1; O.slot.setMatrixAt(i * 2 + k, _m.compose(_p, _q, _s)); }
  }
  for (const m of [O.srv, O.led, O.slot]) m.instanceMatrix.needsUpdate = true;
  O.srv.instanceColor.needsUpdate = true; O.led.instanceColor.needsUpdate = true;

  // ---------- health-check pings (LB → server → back)
  const pingOn = Math.max(win(t, c.asking - 0.1, c.casc, 0.3, 0.3), P(t, c.hc + 0.6, 0.4)) * sys; O.ping.visible = pingOn > 0.01;
  for (let i = 0; i < NS; i++) {
    spos(i, _p); const ph = ((t * 0.9 + i * 0.13) % 1), k = ph < 0.5 ? ph * 2 : 2 - ph * 2;         // down then back up
    const up = t < FAIL[i] || t >= REC[i]; const answers = up || ph < 0.5;                                                   // dead servers never answer
    _p.set(lerp(_p.x * 0.35, _p.x, k), lerp(LBY - 0.25, _p.y + 0.3, k), 0.75);
    _s.setScalar(answers ? pingOn * (t < FAIL[i] + 0.35 || up ? 1 : 0.0001) : 0.0001); O.ping.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.ping.instanceMatrix.needsUpdate = true;

  // ---------- user traffic: same volume, spread over whoever is still in rotation
  const trf = P(t, c.lb + 0.6, 0.6) * sys; O.req.visible = O.rain.visible = trf > 0.01;
  for (let j = 0; j < 60; j++) {
    if (!nActive) { _s.setScalar(0.0001); _p.set(0, -5, 0); O.req.setMatrixAt(j, _m.compose(_p, _q, _s)); continue; }
    const tgt = active[j % nActive]; spos(tgt, _p); const k = (t * (1.1 - 0.35 * strain) + rnd(j) * 7) % 1;
    _p.set(lerp(_p.x * 0.3, _p.x + (rnd(j + 9) - 0.5) * 0.3, k), lerp(LBY - 0.25, _p.y, k), lerp(0.62, 0.48, k) + Math.sin(k * Math.PI) * 0.25);
    _s.setScalar(Math.max(0.0001, Math.sin(k * Math.PI) * trf)); O.req.setMatrixAt(j, _m.compose(_p, _q, _s));
  }
  for (let j = 0; j < 26; j++) {
    const k = (t * 0.8 + rnd(j + 50) * 5) % 1; const pile = allDead;
    _p.set((rnd(j + 70) - 0.5) * 3.0, lerp(4.9, LBY + 0.3 + pile * rnd(j) * 0.9, k), 0.2 + (rnd(j + 30) - 0.5) * 0.6);
    _s.setScalar(Math.max(0.0001, (pile > 0.5 ? 1 : Math.sin(k * Math.PI)) * trf)); O.rain.setMatrixAt(j, _m.compose(_p, _q, _s));
  }
  O.req.instanceMatrix.needsUpdate = true; O.rain.instanceMatrix.needsUpdate = true;
  O.req.material.color.set(allDead > 0.5 ? 0xff5a5a : 0xffd84a); O.rain.material.color.set(allDead > 0.5 ? 0xff5a5a : 0xffd84a);

  // ---------- tags
  const g = O.t;
  pop(g.na, t, c.notattack, c.news - 0.15);
  pop(g.ask, t, c.asking, c.stops - 0.2);
  spos(SOLO, g.out.pos); g.out.pos.y -= 0.42; g.out.pos.z = 0.4; pop(g.out, t, c.pulled, c.dies + 0.2);
  pop(g.good, t, c.dies - 0.3, c.many - 0.2); pop(g.mass, t, c.allp, c.now + 0.3);
  pop(g.over, t, c.overload, c.casc - 0.1); pop(g.casc, t, c.cascading, c.inv + 0.2);
  for (const tg of tags) placeTag(tg);

  // ---------- headline (hook)
  $('head').style.opacity = win(t, 0.12, c.news - 0.25, 0.25, 0.3);
  const h1 = P(t, 0.15, 0.45, back); $('hl').style.transform = `scale(${0.7 + 0.3 * h1})`; $('hl').style.opacity = P(t, 0.15, 0.2);
  const h2 = P(t, c.down - 0.05, 0.35, back); $('hl2').style.opacity = P(t, c.down - 0.05, 0.12); $('hl2').style.transform = `scale(${0.5 + 0.5 * h2})`;

  // ---------- status cards
  let tv = 0, ttl = '', body = '';
  const X = '<span class="rd">✖</span>';
  if (t >= c.news && t < c.expl) {
    tv = win(t, c.news + 0.15, c.expl - 0.3); ttl = 'Microsoft 365 · service health';
    const sv = ['Outlook / Exchange Online', 'Teams', 'SharePoint', 'Copilot', 'Defender XDR'];
    body = sv.map((n, i) => (t >= c.m365 + 0.25 + i * 0.3 ? `${X} ${n}` : `<span class="d">· ${n}</span>`)).join('\n');
    body += `\n<span class="${t >= c.seventy ? 'hl' : 'd'}">${t >= c.seventy ? '70+ countries affected' : ' '}</span>`;
  } else if (t >= c.expl && t < c.lb) {
    tv = win(t, c.expl + 0.15, c.lb - 0.3); ttl = 'incident EX1550543';
    body = `<span class="d">early explanation</span>\n`;
    body += t >= c.spike - 0.4 ? `<span class="d">traffic spike?</span>  <span class="rd">${t >= c.spike + 0.3 ? 'no' : ''}</span>\n` : '\n';
    body += t >= c.failed ? `<span class="hl">failed server health checks</span>` : '';
  } else if (t >= c.inv && t < c.end) {
    tv = win(t, c.inv + 0.15, c.end - 0.3); ttl = 'incident EX1550543';
    body = `<span class="d">malicious activity</span>  none known\n<span class="d">final root cause</span>   ${t >= c.root ? '<span class="hl">investigating</span>' : ''}\n<span class="d">post-incident report</span>  ${t >= c.investigated ? '<span class="or">pending</span>' : ''}`;
  }
  const te = $('term'); te.style.opacity = tv; te.style.transform = `translateY(${(1 - tv) * -30}px) scale(${0.96 + 0.04 * tv})`;
  if (tv > 0) { $('tt').textContent = ttl; $('tp').innerHTML = body; }

  // ---------- rotation / load panel (numbers follow the animation: 12 servers' worth of traffic ÷ servers left)
  const cv = win(t, c.stops - 0.3, c.inv - 0.2); const ce = $('cmp'); ce.style.opacity = cv; ce.style.transform = `translateY(${(1 - cv) * -30}px)`;
  if (cv > 0) {
    const load = nActive ? Math.round(1200 / nActive) : 0;
    $('b1').style.width = (nActive / NS * 100) + '%'; $('v1').textContent = `${nActive} / ${NS}`; $('v1').style.color = nActive > 6 ? '#4ade80' : (nActive ? '#ffb347' : '#ff5a5a');
    $('b2').style.width = Math.min(100, load / 3) + '%'; $('b2').style.background = load > 150 ? 'linear-gradient(90deg,#ffb347,#ff5a5a)' : 'linear-gradient(90deg,#2dd4bf,#5ee6ff)';
    $('v2').textContent = nActive ? load + '%' : 'down'; $('v2').style.color = load > 150 || !nActive ? '#ff5a5a' : '#5ee6ff';
  }

  // ---------- takeaway
  $('fin').style.opacity = P(t, c.hc - 0.2, 0.3);
  const fa = P(t, c.hc - 0.2, 0.4, back); $('fa').style.transform = `scale(${0.8 + 0.2 * fa})`;
  for (const [id, a2] of [['fp1', c.end + 3.0], ['fp2', c.fail - 0.05]]) { const k = P(t, a2, 0.35, back); $(id).style.opacity = P(t, a2, 0.12); $(id).style.transform = `scale(${0.6 + 0.4 * k})`; }
  $('fch').style.opacity = P(t, c.carefully + 0.4, 0.4);

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
  FAIL = new Array(NS).fill(1e9); REC = Array.from({ length: NS }, (_, i) => c.hc - 0.1 + i * 0.06);
  FAIL[SOLO] = c.stops; WAVE.forEach((i, k) => { FAIL[i] = c.many + 0.1 + k * 0.2; });
  LAST.forEach((i, k) => { FAIL[i] = c.failing2 + 0.1 + k * 0.22; });
  // in the takeaway the system is shown healthy again
  const L = V(0, 2.18, 0);
  KEYS = [
    { t0: 0, t1: 0, pos: V(3.6, 3.0, 8.4), look: V(0, 2.6, 0.6) },
    { t0: 0, t1: c.news, pos: V(-1.4, 2.8, 8.2), look: V(0, 2.6, 0.6), e: (k) => k * (2 - k) },
    { t0: c.news - 0.2, t1: c.news + 1.2, pos: V(1.6, 3.4, 9.6), look: V(0, 3.3, 0.6) },
    { t0: c.lb - 0.3, t1: c.lb + 1.3, pos: V(-2.2, 3.4, 9.4), look: L },
    { t0: c.stops - 0.2, t1: c.stops + 1.2, pos: V(1.6, 3.2, 9.2), look: L },
    { t0: c.one - 0.2, t1: c.one + 1.2, pos: V(2.4, 3.6, 9.4), look: L },
    { t0: c.now - 0.2, t1: c.now + 1.2, pos: V(-2.0, 3.0, 8.8), look: L },
    { t0: c.casc - 0.2, t1: c.casc + 1.0, pos: V(0.4, 2.8, 8.2), look: L },
    { t0: c.inv - 0.2, t1: c.inv + 1.2, pos: V(2.2, 3.4, 9.6), look: V(0, 2.4, 0) },
    { t0: c.end - 0.2, t1: c.end + 1.6, pos: V(-2.6, 4.0, 10.4), look: V(0, 3.0, 0) },
  ];
  frame(0);
  return C.duration;
};
window.renderFrame = (t) => frame(t);
