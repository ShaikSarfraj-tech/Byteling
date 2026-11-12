// Renders the scene frame-by-frame with headless Chromium (deterministic, 60 fps).
//   node src/render.mjs                 -> all frames into frames/
//   node src/render.mjs --stills 1,5.2  -> PNG stills into frames/stills/ (for review)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FPS = 60, WORKERS = Number(process.env.WORKERS || 4);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const EP = process.env.EP; if (!EP) throw new Error('set EP=<episode folder name>');
const url = `http://127.0.0.1:${server.address().port}/src/episodes/${EP}/index.html?ep=${EP}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.init);
  const dur = await page.evaluate(() => window.init());
  return { page, dur };
}
if (process.argv.includes('--thumb')) {
  // episodes/$EP/thumbnail.png: a clean 3D frame (no captions/HUD) with a big headline from thumb.json
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/episodes', EP, 'thumb.json'), 'utf8'));
  const { page } = await open();
  await page.evaluate((t) => window.renderFrame(t), cfg.t);
  await page.evaluate((cfg) => {
    const st = document.getElementById('stage');
    for (const el of [...st.children]) if (el.id !== 'gl') el.style.display = 'none';
    const o = document.createElement('div');
    o.style.cssText = 'position:absolute;inset:0;background:linear-gradient(to bottom,rgba(4,6,14,.92) 0,rgba(4,6,14,.75) 30%,rgba(4,6,14,0) 52%,rgba(4,6,14,0) 80%,rgba(4,6,14,.9) 100%);font-family:Inter,sans-serif;text-align:center;';
    const sz = cfg.size || 176;
    o.innerHTML = `<div style="margin-top:150px;display:inline-block;font:800 40px Inter;letter-spacing:8px;color:#070b16;background:${cfg.accent || '#ffd84a'};padding:14px 30px;border-radius:14px;text-transform:uppercase">${cfg.kicker}</div>`
      + `<div style="margin-top:36px">` + cfg.lines.map(([txt, col]) => `<div style="font:900 ${sz}px/1.02 Inter;letter-spacing:-6px;color:${col};-webkit-text-stroke:22px #060913;paint-order:stroke fill;text-shadow:0 14px 50px rgba(0,0,0,.9)">${txt}</div>`).join('') + `</div>`
      + `<div style="position:absolute;left:0;right:0;bottom:120px;font:800 44px Inter;letter-spacing:10px;color:#8fa3c8">BYTELINK</div>`;
    st.appendChild(o);
  }, cfg);
  const out = path.join(ROOT, 'episodes', EP, 'thumbnail.png');
  await page.screenshot({ path: out }); console.log('thumbnail ->', out);
  await browser.close(); server.close(); process.exit(0);
}
const si = process.argv.indexOf('--stills');
if (si > 0) {
  const { page } = await open(); const dir = path.join(ROOT, 'frames/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of process.argv[si + 1].split(',')) {
    await page.evaluate((t) => window.renderFrame(t), Number(s));
    await page.screenshot({ path: path.join(dir, `t${Number(s).toFixed(2).padStart(5, '0')}.png`) });
  }
} else {
  const dir = path.join(ROOT, 'frames'); fs.mkdirSync(dir, { recursive: true });
  const first = await open(); const total = Math.ceil(first.dur * FPS); let done = 0; const t0 = Date.now();
  const work = async (w, ctx) => {
    const { page } = ctx || await open();
    for (let f = w; f < total; f += WORKERS) {
      await page.evaluate((t) => window.renderFrame(t), f / FPS);
      await page.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 96 });
      if (++done % 300 === 0) console.log(`${done}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w, w === 0 ? first : null)));
  console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close(); server.close();
