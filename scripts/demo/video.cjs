// Electron entry for recording the demo video (run via `npm run video`).
// Renders the stage offscreen at 1280×720 and pipes 30 fps raw frames into
// ffmpeg (H.264 MP4). Fake data only; nothing from your screen.
//   DEMO_LANG=vi|en  DEMO_OUT=path.mp4
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app, BrowserWindow } = require('electron');
const ffmpeg = require('ffmpeg-static');
const { root, stageUrl } = require('./setup.cjs');

const LANG = process.env.DEMO_LANG || 'vi';
const OUT = process.env.DEMO_OUT || path.join(root, 'docs', `chatlings-demo-${LANG}.mp4`);
const POSTER = OUT.replace(/\.mp4$/, '.jpg');
const W = 1280;
const H = 720;
const FPS = 30;
const ZOOM = 1.25;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true, webSecurity: false, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(FPS);

  let latest = null;
  let poster = null;
  win.webContents.on('paint', (_e, _dirty, image) => {
    const s = image.getSize();
    latest = s.width === W && s.height === H ? image : image.resize({ width: W, height: H, quality: 'best' });
  });
  let done = false;
  win.webContents.on('page-title-updated', (_e, t) => (done = t === 'DONE'));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = spawn(ffmpeg, ['-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => (ffErr = (ffErr + d).slice(-2000)));
  const write = (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)));

  // Lay the stage out at 1024×576 and zoom 125%: bubbles stay readable on a phone.
  win.webContents.on('dom-ready', () => win.webContents.setZoomFactor(ZOOM));
  await win.loadURL(stageUrl({ lang: LANG, timeline: 'video', w: W / ZOOM, h: H / ZOOM, pw: 380, ph: 430 }));
  const started = Date.now();
  let written = 0;
  // Wall-clock driven: if a frame takes long, the last image is repeated so
  // the video keeps real timing.
  while (!done && Date.now() - started < 90000) {
    if (latest) {
      const due = Math.floor(((Date.now() - started) / 1000) * FPS);
      const bmp = latest.toBitmap();
      while (written < due) {
        await write(bmp);
        written++;
      }
      // A frame from the preview moment makes a good poster image.
      if (!poster && Date.now() - started > 8800) poster = latest.toJPEG(88);
    }
    await new Promise((r) => setTimeout(r, 1000 / FPS / 2));
  }
  ff.stdin.end();
  const code = await new Promise((r) => ff.on('close', r));
  if (poster) fs.writeFileSync(POSTER, poster);
  process.stdout.write(code === 0 ? `video: ${written} frames (${(written / FPS).toFixed(1)} s) → ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)\n` : `ffmpeg failed (${code}):\n${ffErr}\n`);
  app.exit(code === 0 ? 0 : 1);
});
