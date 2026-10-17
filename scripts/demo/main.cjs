// Electron entry for recording docs/demo.gif (run via `npm run demo`).
// Renders scripts/demo/stage.html offscreen, grabs frames, encodes a GIF.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { root, stageUrl } = require('./setup.cjs');
const OUT = process.env.DEMO_OUT || path.join(root, 'docs', 'demo.gif');
const W = 960;
const H = 560;
const OUT_W = 760;
const FPS = 10;
const FRAMES_DIR = process.env.DEMO_FRAMES; // optional: dump some PNG frames to check

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const stage = stageUrl({ lang: 'en', timeline: 'gif' });

  const win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true, webSecurity: false, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(30);
  await win.loadURL(stage);

  const frames = [];
  let done = false;
  win.webContents.on('page-title-updated', (_e, t) => (done = t === 'DONE'));
  const started = Date.now();
  while (!done && Date.now() - started < 60000) {
    const t0 = Date.now();
    const img = (await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H })).resize({ width: OUT_W, quality: 'best' });
    const { width, height } = img.getSize();
    if (FRAMES_DIR && frames.length % 15 === 0) fs.writeFileSync(path.join(FRAMES_DIR, `f${String(frames.length).padStart(3, '0')}.png`), img.toPNG());
    const bgra = img.toBitmap();
    const rgba = new Uint8Array(bgra.length);
    for (let i = 0; i < bgra.length; i += 4) {
      rgba[i] = bgra[i + 2];
      rgba[i + 1] = bgra[i + 1];
      rgba[i + 2] = bgra[i];
      rgba[i + 3] = 255;
    }
    const prev = frames[frames.length - 1];
    if (prev && Buffer.compare(Buffer.from(prev.rgba), Buffer.from(rgba)) === 0) prev.delay += 1000 / FPS;
    else frames.push({ rgba, width, height, delay: 1000 / FPS });
    await new Promise((r) => setTimeout(r, Math.max(0, 1000 / FPS - (Date.now() - t0))));
  }

  // One shared palette from a sample of frames keeps colours stable.
  const sample = frames.filter((_, i) => i % Math.ceil(frames.length / 12) === 0);
  const joined = new Uint8Array(sample.reduce((n, f) => n + f.rgba.length, 0));
  let o = 0;
  for (const f of sample) {
    joined.set(f.rgba, o);
    o += f.rgba.length;
  }
  // 255 colours + index 255 = transparent. After the first frame, pixels that
  // did not change are written as transparent, so each frame only carries the
  // moving parts (the bubbles) and the GIF stays small.
  const palette = quantize(joined, 255);
  while (palette.length < 255) palette.push([0, 0, 0]);
  palette.push([255, 0, 255]);
  const TRANSPARENT = 255;
  const gif = GIFEncoder();
  let shown = null;
  for (const f of frames) {
    const idx = applyPalette(f.rgba, palette.slice(0, 255));
    if (!shown) {
      gif.writeFrame(idx, f.width, f.height, { palette, delay: Math.round(f.delay) });
      shown = idx;
      continue;
    }
    const out = new Uint8Array(idx.length);
    for (let i = 0; i < idx.length; i++) {
      if (idx[i] === shown[i]) out[i] = TRANSPARENT;
      else out[i] = shown[i] = idx[i];
    }
    gif.writeFrame(out, f.width, f.height, { delay: Math.round(f.delay), transparent: true, transparentIndex: TRANSPARENT, dispose: 1 });
  }
  gif.finish();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, gif.bytes());
  process.stdout.write(`demo: ${frames.length} frames → ${OUT} (${(gif.bytes().length / 1e6).toFixed(2)} MB)\n`);
  app.quit();
});
