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
const CW = 2.2, CH = 1.6, CD = 1.4, CY = 1.85;        // hero container
const KTOP = 0.95;

function build() {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b16); scene.fog = new THREE.FogExp2(0x070b16, 0.03);
  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 300); camera.setViewOffset(W, H, 0, VOFF, W, H);

  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x0a0f20, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(5, 9, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5ee6ff, 1.1); rim.position.set(-7, 4, -6); scene.add(rim);

  const grid = new THREE.GridHelper(400, 200, 0x24407a, 0x16223f); grid.position.y = -0.01;
  grid.material.transparent = true; grid.material.opacity = 0.75; scene.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x060a14 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);

  // dust
  const N = 500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (rnd(i) - 0.5) * 44; pos[i * 3 + 1] = rnd(i + 900) * 12 + 0.2; pos[i * 3 + 2] = (rnd(i + 1800) - 0.6) * 60; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  O.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x7fb4ff, size: 0.05, transparent: true, opacity: 0.55, sizeAttenuation: true }));
  scene.add(O.dust);
  const gt = glowTex();

  // host stack under the container
  O.hw = slab(3.6, 0.3, 7.0, 0x2a344d, { label: 'HARDWARE', labelColor: '#9fb0d0', edge: 0x6b7da6, labelH: 0.15 });
  O.hw.position.set(0, 0.15, -2.1); scene.add(O.hw);
  O.kern = slab(3.6, 0.55, 7.0, 0x0f3b38, { label: 'HOST LINUX KERNEL', labelColor: '#7ff5e0', edge: 0x2dd4bf, emissive: 0x0d9488, labelH: 0.24 });
  O.kern.position.set(0, 0.675, -2.1); scene.add(O.kern);

  // hero container: solid shell + ribs + wire
  const c = new THREE.Group(); c.position.set(0, CY, 0); scene.add(c); O.cont = c;
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x1677d8, roughness: 0.42, metalness: 0.45, transparent: true });
  O.shellMat = shellMat;
  c.add(new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CD), shellMat));
  const ribG = new THREE.BoxGeometry(0.07, CH * 0.86, 0.05);
  for (let i = 0; i < 13; i++) for (const s of [1, -1]) {
    const r = new THREE.Mesh(ribG, shellMat); r.position.set(-CW / 2 + 0.16 + i * (CW - 0.32) / 12, 0, s * (CD / 2 + 0.02)); c.add(r);
  }
  const ribS = new THREE.BoxGeometry(0.05, CH * 0.86, 0.07);
  for (let i = 0; i < 8; i++) for (const s of [1, -1]) {
    const r = new THREE.Mesh(ribS, shellMat); r.position.set(s * (CW / 2 + 0.02), 0, -CD / 2 + 0.14 + i * (CD - 0.28) / 7); c.add(r);
  }
  O.wireMat = new THREE.LineBasicMaterial({ color: 0x5ee6ff, transparent: true });
  c.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CW + 0.02, CH + 0.02, CD + 0.02)), O.wireMat));
  O.plate = textPlane('CONTAINER', { h: 0.2, color: '#d9ecff' }); O.plate.position.set(0, CH / 2 - 0.2, CD / 2 + 0.06); c.add(O.plate);
  // faint glass so the wireframe still reads as a box
  O.glassMat = new THREE.MeshBasicMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  c.add(new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CD), O.glassMat));

  // the process
  O.core = new THREE.Group(); scene.add(O.core);
  O.coreMat = new THREE.MeshStandardMaterial({ color: 0x5ee6ff, emissive: 0x22c8f0, emissiveIntensity: 0.9, roughness: 0.3, flatShading: true, transparent: true });
  O.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), O.coreMat); O.core.add(O.coreMesh);
  O.coreWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.4, 1)), new THREE.LineBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.5 }));
  O.core.add(O.coreWire);
  O.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0x5ee6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  O.glow.scale.setScalar(2.2); O.core.add(O.glow);
  O.coreLight = new THREE.PointLight(0x5ee6ff, 6, 6); O.core.add(O.coreLight);

  // neighbours sharing the kernel
  O.nb = [];
  for (const z of [-2.2, -4.4]) {
    const n = slab(CW, CH, CD, 0x1677d8, { edge: 0x5ee6ff }); n.position.set(0, CY, z); scene.add(n);
    const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: 0x5ee6ff, transparent: true })); n.add(k); n.userData.k = k;
    O.nb.push(n);
  }
  // kernel-feature chips
  O.chips = [0xb79cff, 0xff9d4d, 0x4ade80].map((col, i) => {
    const s = slab(0.34, 0.34, 0.34, col, { edge: 0xffffff, emissive: col }); scene.add(s); s.userData.x = (i - 1) * 1.15; return s;
  });

  // namespace shell
  O.ns = slab(CW + 0.55, CH + 0.5, CD + 0.55, 0x8b5cf6, { edge: 0xc4b5fd, emissive: 0x7c3aed }); O.ns.position.set(0, CY, 0); scene.add(O.ns);
  O.ns.userData.mat.side = THREE.DoubleSide; O.ns.userData.mat.depthWrite = false;
  // other host processes
  O.procs = [[-2.3, 2.9, -0.4], [2.25, 3.05, -0.9], [-1.9, 3.35, -1.8], [2.0, 2.2, 0.9], [-2.45, 1.9, 0.7]].map((p, i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshStandardMaterial({ color: 0x9fb0d0, emissive: 0x4b5f8a, flatShading: true, transparent: true }));
    m.position.set(...p); m.userData.p = p; scene.add(m); return m;
  });
  // cgroup rings
  O.rings = [0, 1, 2].map((i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.62 + i * 0.1, 0.022, 10, 80), new THREE.MeshBasicMaterial({ color: 0xff9d4d, transparent: true }));
    scene.add(r); return r;
  });
  // image layers
  const L = [['FROM ubuntu:24.04', 0x1d4ed8], ['RUN apt install nginx', 0x2563eb], ['COPY site/ /var/www', 0x3b82f6]];
  O.layers = L.map(([txt, col], i) => { const s = slab(1.86, 0.23, 1.12, col, { label: txt, mono: true, labelH: 0.13, edge: 0x93c5fd }); s.userData.y = 1.07 + 0.115 + i * 0.275; scene.add(s); return s; });
  O.wl = slab(1.86, 0.09, 1.12, 0x22c55e, { edge: 0xbbf7d0, emissive: 0x22c55e }); O.wl.userData.y = 1.07 + 3 * 0.275 + 0.045; scene.add(O.wl);

  // VM stack
  const vx = -5.6; O.vmx = vx;
  O.vhw = slab(3.0, 0.3, 2.4, 0x2a344d, { label: 'HARDWARE', labelColor: '#9fb0d0', edge: 0x6b7da6, labelH: 0.15 }); O.vhw.userData.p = [vx, 0.15, 0];
  O.vhyp = slab(3.0, 0.45, 2.4, 0x4c3a78, { label: 'HYPERVISOR', labelColor: '#d6c8ff', edge: 0xb79cff, labelH: 0.2 }); O.vhyp.userData.p = [vx, 0.625, 0];
  O.vbox = slab(3.0, 2.25, 2.4, 0xf4728f, { edge: 0xf9a8b8 }); O.vbox.userData.p = [vx, 2.03, 0]; O.vbox.userData.mat.depthWrite = false; O.vbox.userData.mat.side = THREE.DoubleSide;
  O.vkern = slab(2.6, 0.5, 2.0, 0x9f1239, { label: 'GUEST KERNEL', labelColor: '#ffd0da', edge: 0xfb7185, emissive: 0xbe123c, labelH: 0.2 }); O.vkern.userData.p = [vx, 1.2, 0];
  O.vos = slab(2.6, 0.85, 2.0, 0x7c2d4a, { label: 'FULL GUEST OS', labelColor: '#ffd0da', edge: 0xf9a8b8, labelH: 0.24 }); O.vos.userData.p = [vx, 1.93, 0];
  O.vapp = slab(1.5, 0.42, 1.3, 0x1677d8, { label: 'APP', labelColor: '#e2f1ff', edge: 0x5ee6ff, labelH: 0.2 }); O.vapp.userData.p = [vx, 2.62, 0];
  for (const k of ['vhw', 'vhyp', 'vbox', 'vkern', 'vos', 'vapp']) scene.add(O[k]);

  // the fleet (finale)
  const cols = 7, rows = 34, sx = 2.75, sz = 2.2; const list = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { const x = (q - 3) * sx, z = -r * sz; if (!(q === 3 && r === 0)) list.push([x, z]); }
  list.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  O.fleetPos = list;
  O.fleet = new THREE.InstancedMesh(new THREE.BoxGeometry(CW, CH, CD), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.4 }), list.length);
  const pal = [0x1677d8, 0x1d8fe8, 0x1565c0, 0x0ea5b7, 0x2563eb]; const col = new THREE.Color();
  list.forEach((p, i) => O.fleet.setColorAt(i, col.setHex(pal[Math.floor(rnd(i + 5) * pal.length)])));
  O.fleet.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(O.fleet);
  O.fleetEdges = new THREE.InstancedMesh(new THREE.BoxGeometry(CW + 0.04, 0.03, CD + 0.04), new THREE.MeshBasicMaterial({ color: 0x5ee6ff }), list.length);
  O.plat = slab(1, 0.55, 1, 0x0f3b38, { edge: 0x2dd4bf, emissive: 0x0d9488 }); O.plat.userData.mat.emissiveIntensity = 0.22; scene.add(O.plat);

  // ---- tags
  const cyan = '#5ee6ff', pur = '#b79cff', org = '#ff9d4d', grn = '#4ade80', pink = '#f9a8b8', red = '#ff5a5a', yel = '#ffd84a';
  O.t = {
    proc: tag('nginx<small>a Linux process</small>', V(0, CY - 0.5, 0.2), { ay: 0 }),
    vm: tag('VIRTUAL MACHINE', V(O.vmx, 3.35, 0), { color: pink }),
    heavy: tag('GBs of RAM + disk', V(O.vmx, 4.05, 0), { color: pink, cls: 'big' }),
    slow: tag('boots in ~tens of seconds', V(O.vmx, 4.75, 0), { color: pink }),
    noguest: tag('no guest OS', V(0, 2.95, 0), { color: cyan, cls: 'big' }),
    shared: tag('one shared kernel', V(1.0, 0.68, 1.5), { color: '#7ff5e0', ay: 0.5, ax: 0 }),
    chip: ['namespaces', 'cgroups', 'layered FS'].map((s, i) => tag(s, V((i - 1) * 1.15, 1.0, 1.95), { color: [pur, org, grn][i] })),
    ns: tag('namespace<small>limits what it can SEE</small>', V(0, CY + CH / 2 + 0.42, 0), { color: pur, cls: 'big' }),
    hp: [['systemd', 'PID 1'], ['sshd', 'PID 812'], ['postgres', 'PID 2231']].map(([n, p], i) => tag(`${n} <small>${p}</small>`, V(0, 0, 0), { color: '#9fb0d0' })),
    pid: tag('PID 1', V(0, CY - 0.4, 0.2), { color: yel, cls: 'big', ay: 0 }),
    net: tag('eth0 172.17.0.2<small>own network</small>', V(-0.6, CY - 0.72, 0.6), { color: pur, ay: 0, ax: 0.8 }),
    host: tag('web-1<small>own hostname</small>', V(0.6, CY - 0.72, 0.6), { color: pur, ay: 0, ax: 0.2 }),
    cg: tag('cgroup<small>limits what it can USE</small>', V(0, CY + CH / 2 + 0.42, 0), { color: org, cls: 'big' }),
    oom: tag('OOMKilled<small>exit code 137</small>', V(0, CY + 0.1, 0.3), { color: red, cls: 'big', ay: 0.5 }),
    fs: tag('layered filesystem', V(0, CY + CH / 2 + 0.42, 0), { color: grn, cls: 'big' }),
    ro: tag('read-only<small>image layers</small>', V(0, 1.0, 0.75), { color: '#93c5fd', ax: 0.5, ay: 0 }),
    rw: tag('writable<small>container layer</small>', V(1.05, 1.95, 0.6), { color: grn, ax: 0, ay: 0.5 }),
    hostpid: tag('PID 4721<small>as seen from the host</small>', V(0.42, CY, 0.2), { color: yel, ay: 0.5, ax: 0, cls: 'big' }),
    you: tag('just a process', V(0, CY + CH / 2 + 0.4, 0), { color: cyan, cls: 'big' }),
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
      if (w.kw) s.className = 'kw'; el.appendChild(s); capEls.push([s, w]);
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
function frame(t) {
  const c = C;
  // ---------- camera
  const [cp, cl] = camAt(t); camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld(true);
  O.dust.rotation.y = t * 0.012;

  // ---------- container shell: solid → x-ray → solid again in the finale
  const xray = P(t, c.reveal + 0.1, 0.9, eio) * (1 - P(t, c.scale + 0.1, 0.9, eio));
  const solid = 1 - xray;
  O.shellMat.opacity = solid; O.shellMat.depthWrite = solid > 0.95;
  O.shellMat.visible = solid > 0.01;
  O.plate.material.opacity = solid;
  O.wireMat.opacity = 0.35 + 0.65 * xray;
  O.glassMat.opacity = xray * 0.07;
  O.cont.rotation.y = 0;

  // ---------- process core
  const kill = P(t, c.kill, 0.4), respawn = P(t, c.fs + 0.1, 0.5, back);
  const dead = t >= c.kill && t < c.fs + 0.1;
  const danger = clamp(P(t, c.exceed, 1.2) - P(t, c.fs, 0.1));
  const up = P(t, c.fs + 0.2, 0.8, eio) * (1 - P(t, c.scale, 0.8, eio));
  const cy = lerp(CY, CY + 0.47, up);
  O.core.position.set(0, cy + Math.sin(t * 1.7) * 0.025, 0);
  let cs = lerp(1, 0.7, up) * (1 + Math.sin(t * 3.1) * 0.035);
  if (dead) cs *= (1 + kill * 1.3) * (kill < 1 ? 1 : 0); else if (t >= c.fs + 0.1) cs *= respawn;
  const pulse = P(t, c.linux, 0.3) * (1 - P(t, c.linux + 0.3, 0.5)) + P(t, c.there, 0.3) * (1 - P(t, c.there + 0.4, 0.6));
  cs *= 1 + pulse * 0.35;
  O.core.scale.setScalar(Math.max(cs, 0.0001)); O.core.visible = cs > 0.001 && xray > 0.02 || (cs > 0.001 && solid < 0.98);
  O.coreMesh.rotation.set(t * 0.5, t * 0.8, 0); O.coreWire.rotation.set(-t * 0.3, t * 0.4, t * 0.2);
  const cc = new THREE.Color(0x5ee6ff).lerp(new THREE.Color(0xff4040), danger * (0.6 + 0.4 * Math.sin(t * 22)));
  O.coreMat.color.copy(cc); O.coreMat.emissive.copy(cc).multiplyScalar(0.7); O.glow.material.color.copy(cc); O.coreLight.color.copy(cc);
  O.coreMat.opacity = dead ? 1 - kill : 1;
  O.glow.material.opacity = xray * (dead ? 1 - kill : 0.85) * (0.8 + pulse);
  O.coreLight.intensity = xray * 7;
  $('flash').style.opacity = (P(t, c.kill, 0.06) * (1 - P(t, c.kill + 0.06, 0.4))) * 0.35;

  // ---------- host stack
  const fin = P(t, c.scale + 0.2, 1.4, eio);                       // platform grows into "one server"
  const stackLbl = P(t, c.ct + 0.5, 0.6) * (1 - P(t, c.ns - 0.1, 0.6));
  fade(O.hw, 1 - fin, { label: stackLbl }); fade(O.kern, 1 - fin, { label: stackLbl });
  const kp = P(t, c.shares, 0.3) * (1 - P(t, c.shares + 0.4, 1.0)) + 0.5 * P(t, c.three, 0.3) * (1 - P(t, c.three + 0.3, 0.8));
  O.kern.userData.mat.emissiveIntensity = 0.22 + kp * 1.6;
  fade(O.plat, fin, { edge: 0.7 });
  const pw = lerp(3.6, 21, fin), pd = lerp(7.0, 78, fin);
  O.plat.scale.set(pw, 1, pd); O.plat.position.set(0, 0.675, 1.4 - pd / 2);

  // ---------- VM stack
  const vmOut = 1 - P(t, c.ns - 0.2, 0.8); const dim = lerp(1, 0.28, P(t, c.skips, 0.6));
  fade(O.vhw, drop(O.vhw, t, c.vm_hw - 0.12) * vmOut * dim);
  fade(O.vhyp, drop(O.vhyp, t, c.vm_hyp - 0.12) * vmOut * dim);
  const vb = P(t, c.vm_box, 0.5); O.vbox.position.set(...O.vbox.userData.p); O.vbox.scale.setScalar(0.9 + 0.1 * vb);
  fade(O.vbox, vb * vmOut * dim, { fill: 0.1 });
  fade(O.vos, drop(O.vos, t, c.vm_guest - 0.12) * vmOut * dim);
  fade(O.vapp, drop(O.vapp, t, c.vm_app - 0.12) * vmOut * dim);
  const vk = P(t, c.vm_kernel - 0.12, 0.45); const kpz = O.vkern.userData.p;
  O.vkern.position.set(kpz[0] - (1 - vk) * 3.2, kpz[1], kpz[2]); fade(O.vkern, P(t, c.vm_kernel - 0.12, 0.2) * vmOut * dim);
  O.vkern.userData.mat.emissiveIntensity = 0.5 + 2.5 * P(t, c.vm_kernel + 0.3, 0.2) * (1 - P(t, c.vm_kernel + 0.5, 0.9));
  const sag = P(t, c.vm_heavy, 0.5, back) * 0.06;                    // "heavy": the stack squashes
  for (const k of ['vos', 'vapp', 'vkern']) O[k].position.y -= sag * (k === 'vapp' ? 2 : 1);

  // ---------- neighbours sharing the kernel
  O.nb.forEach((n, i) => {
    const a = P(t, c.shares + i * 0.22, 0.5, back) * (1 - P(t, c.ns, 0.6));
    n.scale.setScalar(Math.max(0.001, a)); n.position.y = CY - (1 - a) * 0.4; fade(n, clamp(a), { fill: 0.22 });
    n.userData.k.material.opacity = clamp(a); n.userData.k.rotation.y = t;
  });

  // ---------- kernel feature chips
  const chipGo = [c.ns_word - 0.25, c.cg_word - 0.25, c.fs_word - 0.25];
  O.chips.forEach((s, i) => {
    const a = Math.max(P(t, c.three + i * 0.16, 0.5, back) * (1 - P(t, c.ns - 0.3, 0.4)), P(t, chipGo[i] - 0.45, 0.35, back)), g = P(t, chipGo[i], 0.55, eio);
    const x0 = s.userData.x, y0 = 0.675, z0 = lerp(1.2, 1.95, a);
    s.position.set(lerp(x0, 0, g), lerp(y0, CY, g) + Math.sin(g * Math.PI) * 0.5 + Math.sin(t * 2 + i) * 0.03 * (1 - g), lerp(z0, 0, g));
    s.rotation.set(t * 0.6 + i, t * 0.9 + i, 0); s.scale.setScalar(Math.max(0.001, a * (1 - g * 0.8)));
    fade(s, clamp(a * 2) * (1 - P(t, chipGo[i] + 0.45, 0.15)));
    const tg = O.t.chip[i]; pop(tg, t, c.three + i * 0.16 + 0.1, Math.min(chipGo[i] - 0.1, c.ns - 0.35)); tg.pos.set(x0, 1.0, z0);
  });

  // ---------- namespaces
  const nsA = P(t, c.ns_word + 0.25, 0.6, back);
  const nsO = nsA * lerp(1, 0.45, P(t, c.cg, 0.6)) * (1 - P(t, c.scale, 0.6));
  O.ns.scale.setScalar(0.6 + 0.4 * nsA); fade(O.ns, clamp(nsO), { fill: 0.1 + 0.08 * Math.sin(t * 2.2) ** 2, edge: 0.9 });
  O.procs.forEach((m, i) => {
    const a = P(t, c.ns + 0.1 + i * 0.08, 0.5, back), hid = P(t, c.see - 0.5, 0.9);
    const p = m.userData.p; m.position.set(p[0] + Math.sin(t * 0.7 + i) * 0.1, p[1] + Math.cos(t * 0.9 + i * 2) * 0.1, p[2]);
    m.scale.setScalar(Math.max(0.001, a)); m.rotation.y = t + i;
    m.material.opacity = lerp(1, 0.1, hid) * (1 - P(t, c.cg - 0.2, 0.5)); m.visible = m.material.opacity > 0.01 && a > 0.01;
    if (i < 3) { const tg = O.t.hp[i]; tg.pos.set(m.position.x, m.position.y + 0.26, m.position.z); pop(tg, t, c.ns + 0.3 + i * 0.1, c.see - 0.5); tg.o *= 0.92; }
  });

  // ---------- cgroups
  const cgA = P(t, c.cg_word + 0.25, 0.6, back) * (1 - P(t, c.fs - 0.1, 0.5));
  O.rings.forEach((r, i) => {
    r.position.copy(O.core.position); r.visible = cgA > 0.01; r.material.opacity = clamp(cgA);
    const squeeze = 1 - 0.18 * danger; r.scale.setScalar(Math.max(0.001, cgA * squeeze));
    r.rotation.set(Math.PI / 2 + Math.sin(t * 0.9 + i * 2.1) * 0.5, t * (0.5 + i * 0.2), i * 1.1);
    r.material.color.set(danger > 0.3 ? 0xff5a5a : 0xff9d4d);
  });

  // ---------- image layers
  const layOut = 1 - P(t, c.scale, 0.5);
  O.layers.forEach((s, i) => { s.position.set(0, 0, 0); fade(s, drop(s, t, c.image + i * 0.42 - 0.1, { from: 1.5 }) * layOut, { fill: 0.96 }); });
  O.wl.position.set(0, 0, 0); fade(O.wl, drop(O.wl, t, c.writable - 0.1, { from: 1.2 }) * layOut);
  O.wl.userData.mat.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.5;

  // ---------- fleet
  const span = Math.max(0.5, c.hundreds + 0.9 - c.start); let count = 1;
  const n = O.fleetPos.length;
  for (let i = 0; i < n; i++) {
    const [x, z] = O.fleetPos[i]; const d = Math.pow(i / n, 0.6) * span + rnd(i) * 0.25;
    const a = P(t, c.start + d, 0.3, back); if (a > 0.5) count++;
    _s.setScalar(Math.max(0.0001, a)); _p.set(x, CY + (1 - P(t, c.start + d, 0.3)) * 0.9, z);
    O.fleet.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  O.fleet.instanceMatrix.needsUpdate = true;
  O.fleet.visible = t > c.start - 0.1;
  scene.fog.density = lerp(0.03, 0.017, fin);

  // ---------- tags
  const g = O.t;
  pop(g.proc, t, c.linux, c.vm - 0.2);
  pop(g.vm, t, c.vm_box + 0.1, c.skips); pop(g.heavy, t, c.vm_heavy, c.ct + 0.2); pop(g.slow, t, c.vm_slow, c.ct + 0.2);
  pop(g.noguest, t, c.skips, c.shares - 0.1); pop(g.shared, t, c.shares + 0.1, c.three - 0.2);
  pop(g.ns, t, c.ns_word + 0.3, c.inside - 0.2);
  pop(g.pid, t, c.pid1 + 0.5, c.cg - 0.3); pop(g.net, t, c.net, c.cg - 0.3); pop(g.host, t, c.hostname, c.cg - 0.3);
  pop(g.cg, t, c.cg_word + 0.3, c.limit + 0.1);
  pop(g.oom, t, c.kill + 0.12, c.fs - 0.05);
  pop(g.fs, t, c.fs_word + 0.3, c.image - 0.1);
  pop(g.ro, t, c.ro, c.ps - 0.2); pop(g.rw, t, c.writable + 0.25, c.ps - 0.2);
  g.rw.pos.y = O.wl.userData.y + 0.1;
  pop(g.hostpid, t, c.there, c.scale - 0.2); g.hostpid.pos.y = cy;
  for (const tg of tags) placeTag(tg);

  // ---------- headline
  const hd = $('head'); const ho = win(t, 0.15, c.vm - 0.35, 0.3, 0.3); hd.style.opacity = ho;
  $('hk').style.opacity = P(t, 0.15, 0.3);
  const h1 = P(t, 0.3, 0.45, back); $('hl').style.transform = `scale(${0.7 + 0.3 * h1})`; $('hl').style.opacity = P(t, 0.3, 0.2);
  const hx = P(t, c.hook_not, 0.3, back); $('hx').style.display = 'inline-block'; $('hx').style.transform = `scale(${0.3 + 0.7 * hx + 0.5 * Math.sin(clamp((t - c.hook_not) / 0.4) * Math.PI)})`; $('hx').style.opacity = P(t, c.hook_not, 0.1);
  const h2 = P(t, c.linux - 0.25, 0.4, back); $('hl2').style.opacity = P(t, c.linux - 0.25, 0.2); $('hl2').style.transform = `translateY(${(1 - h2) * 30}px) scale(${0.8 + 0.2 * h2})`;

  // ---------- terminal
  let tv = 0, ttl = '', body = '';
  if (t >= c.see + 0.2 && t < c.cg) {
    tv = win(t, c.see + 0.25, c.cg - 0.35); ttl = 'inside the container';
    const cmd = 'ps'; const ty = typed(cmd, t, c.inside, 0.45);
    body = `<span class="p">/ #</span> ${ty}${t < c.pid1 ? blink(t) : ''}\n`;
    if (t >= c.pid1) body += `<span class="d">PID   USER   COMMAND</span>\n<span class="hl">  1   root   nginx  </span>\n<span class="p">/ #</span> ${blink(t)}`;
    else body += '\n\n';
  } else if (t >= c.limit - 0.3 && t < c.fs) {
    tv = win(t, c.limit - 0.25, c.fs - 0.35); ttl = 'host';
    const l1 = 'docker run --cpus=0.5 \\', l2 = '  --memory=500m nginx'; const all = l1 + '\n' + l2;
    let ty = esc(typed(all, t, c.limit, 1.9));
    ty = ty.replace('--cpus=0.5', '<span class="or">--cpus=0.5</span>').replace('--memory=500m', '<span class="or">--memory=500m</span>');
    body = `<span class="p">$</span> ${ty}${t < c.limit + 1.9 ? CUR : ''}`;
    if (t < c.limit + 1.9 && !ty.includes('\n')) body += '\n';
    body += t >= c.kill + 0.1 ? `\n<span class="rd">✖ killed: out of memory (137)</span>` : '\n';
  } else if (t >= c.ps && t < c.scale + 0.3) {
    tv = win(t, c.ps + 0.3, c.scale - 0.15); ttl = 'host';
    const cmd = 'ps aux | grep nginx';
    body = `<span class="p">host $</span> ${esc(typed(cmd, t, c.run, 1.0))}${t < c.there - 0.25 ? blink(t) : ''}\n`;
    body += t >= c.there - 0.25 ? `<span class="d">USER   PID  COMMAND</span>\n<span class="hl">root  4721  nginx: master process</span>` : '\n';
  }
  const te = $('term'); te.style.opacity = tv; te.style.transform = `translateY(${(1 - tv) * -30}px) scale(${0.96 + 0.04 * tv})`;
  if (tv > 0) { $('tt').textContent = ttl; $('tp').innerHTML = body; }

  // ---------- gauges
  const gv = win(t, c.cpu - 0.35, c.fs - 0.3); const ge = $('gauges'); ge.style.opacity = gv; ge.style.transform = `translateY(${(1 - gv) * 40}px)`;
  if (gv > 0) {
    const cu = P(t, c.cpu, 0.9, eio); const cpuv = Math.min(0.5, cu * 0.56 + Math.sin(t * 9) * 0.012 * cu);
    $('gcf').style.width = (cpuv * 100) + '%'; $('gcf').style.background = cpuv >= 0.495 ? 'linear-gradient(90deg,#fbbf24,#ff9d4d)' : '';
    $('gcv').innerHTML = cpuv >= 0.495 ? '<span style="color:#ff9d4d">throttled</span>' : cpuv.toFixed(2) + ' CPU';
    let mem = P(t, c.ram, 1.9, eio) * 430 + Math.sin(t * 6) * 4; mem += P(t, c.exceed, c.kill - c.exceed, (x) => x * x) * 92;
    if (t >= c.kill) mem = 500 * (1 - P(t, c.kill, 0.25)) * 1.04;
    const over = mem >= 499 && t < c.kill + 0.25;
    $('gmf').style.width = clamp(mem / 500 * 78, 0, 100) + '%';
    $('gmf').style.background = mem > 440 ? 'linear-gradient(90deg,#ff9d4d,#ff5a5a)' : '';
    $('gmv').innerHTML = t >= c.kill ? '<span style="color:#ff5a5a">OOM-killed</span>' : `<span style="color:${mem > 440 ? '#ff5a5a' : '#dbe6ff'}">${Math.max(0, Math.round(mem))} MB</span>`;
    ge.style.borderColor = danger > 0.2 ? '#ff5a5a' : '#4a3320';
    if (danger > 0.2 && t < c.kill + 0.3) ge.style.transform += ` translateX(${Math.sin(t * 70) * 5 * danger}px)`;
  }

  // ---------- finale compare
  const cv = win(t, c.start - 0.3, c.end - 0.25); const ce = $('cmp'); ce.style.opacity = cv; ce.style.transform = `translateY(${(1 - cv) * -30}px)`;
  if (cv > 0) {
    const cf = P(t, c.fraction, 0.25); $('ccf').style.width = cf * 3 + '%'; $('ccv').textContent = cf >= 1 ? '< 1 second' : '';
    const vf = clamp((t - c.fraction) / 9); $('cvf').style.width = vf * 100 + '%'; $('cvv').textContent = t > c.fraction ? 'still booting…' : '';
    $('cn').textContent = count;
  }

  // ---------- takeaway
  const fv = P(t, c.end + 0.25, 0.3); $('fin').style.opacity = fv;
  $('fa').style.opacity = P(t, c.end + 0.25, 0.3); 
  for (const [id, a] of [['fp1', c.process], ['fp2', c.boundaries]]) { const k = P(t, a - 0.05, 0.35, back); $(id).style.opacity = P(t, a - 0.05, 0.12); $(id).style.transform = `scale(${0.6 + 0.4 * k})`; }
  $('fch').style.opacity = P(t, c.boundaries + 0.5, 0.4); $('fch').style.transform = `translateY(${(1 - P(t, c.boundaries + 0.5, 0.4)) * 20}px)`;

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
  const c = C, L = V(0, CY - 0.05, 0);
  KEYS = [
    { t0: 0, t1: 0, pos: V(5.2, 3.9, 8.4), look: V(0, CY - 0.5, 0) },
    { t0: 0, t1: c.reveal + 0.2, pos: V(-3.6, 3.3, 8.6), look: V(0, CY - 0.5, 0), e: (k) => k * (2 - k) * 0.6 + k * 0.4 },
    { t0: c.reveal, t1: c.reveal + 1.3, pos: V(1.2, 2.5, 6.4), look: L },
    { t0: c.vm - 0.25, t1: c.vm + 1.1, pos: V(O.vmx + 2.2, 3.6, 10.4), look: V(O.vmx, 2.45, 0) },
    { t0: c.ct - 0.25, t1: c.ct + 1.2, pos: V(4.0, 4.3, 9.6), look: V(0, 1.45, -1.5) },
    { t0: c.three - 0.2, t1: c.three + 0.9, pos: V(2.6, 3.0, 8.6), look: V(0, 1.25, -0.4) },
    { t0: c.ns - 0.2, t1: c.ns + 1.1, pos: V(2.3, 3.0, 7.4), look: V(0, CY + 0.2, 0) },
    { t0: c.see + 0.1, t1: c.inside + 0.7, pos: V(1.0, 2.3, 5.6), look: V(0, CY - 0.1, 0) },
    { t0: c.cg - 0.2, t1: c.cg + 1.1, pos: V(-1.9, 2.6, 5.9), look: V(0, CY - 0.1, 0) },
    { t0: c.fs - 0.2, t1: c.fs + 1.1, pos: V(1.6, 2.3, 5.7), look: V(0, CY - 0.05, 0) },
    { t0: c.ps - 0.2, t1: c.ps + 1.1, pos: V(-1.3, 2.9, 6.6), look: V(0, CY + 0.45, 0) },
    { t0: c.scale - 0.2, t1: c.scale + 2.6, pos: V(7.5, 10.5, 15.5), look: V(0, 1.2, -9.5) },
    { t0: c.server, t1: c.end - 0.2, pos: V(5.2, 9.0, 13.5), look: V(0, 1.2, -10.5) },
    { t0: c.end - 0.2, t1: c.end + 1.8, pos: V(3.4, 4.6, 10.2), look: V(0, 2.75, -1.2) },
  ];
  frame(0);
  return C.duration;
};
window.renderFrame = (t) => frame(t);
