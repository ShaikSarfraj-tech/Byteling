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
const url = `http://127.0.0.1:${server.address().port}/src/video/index.html`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.init);
  const dur = await page.evaluate(() => window.init());
  return { page, dur };
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
