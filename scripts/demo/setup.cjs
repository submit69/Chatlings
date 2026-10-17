// Shared by the GIF (main.cjs) and video (video.cjs) recorders: builds the
// URL of the demo stage, with a copy of the real dock page that loads the
// mocked bridge first.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..', '..');

function stageUrl({ lang = 'en', timeline = 'gif', w, h, pw, ph } = {}) {
  const renderer = path.join(root, 'src', 'renderer');
  let dock = fs.readFileSync(path.join(renderer, 'dock.html'), 'utf8');
  dock = dock
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    .replace('<head>', `<head><base href="${pathToFileURL(renderer + path.sep).href}">`)
    .replace('<script src="common.js"></script>', `<script src="${pathToFileURL(path.join(__dirname, 'mock-bb.js')).href}"></script><script src="common.js"></script>`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-demo-'));
  fs.writeFileSync(path.join(tmp, 'dock.html'), dock);

  const registry = require(path.join(root, 'src', 'adapters'));
  const icons = Object.fromEntries(['zalo', 'whatsapp', 'discord', 'telegram'].map((id) => [id, registry.get(id).icon]));
  const dict = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', `${lang}.json`), 'utf8'));
  const chat = pathToFileURL(path.join(root, 'test', 'fake-chat.html'));
  chat.search = `?adapter=zalo&mode=title&id=demo&lang=${lang}`;
  const stage = pathToFileURL(path.join(__dirname, 'stage.html'));
  const p = stage.searchParams;
  p.set('dock', pathToFileURL(path.join(tmp, 'dock.html')).href);
  p.set('chat', chat.href);
  p.set('dict', encodeURIComponent(JSON.stringify(dict)));
  p.set('icons', encodeURIComponent(JSON.stringify(icons)));
  p.set('timeline', timeline);
  p.set('lang', lang);
  if (w) p.set('w', w);
  if (h) p.set('h', h);
  if (pw) p.set('pw', pw);
  if (ph) p.set('ph', ph);
  return stage.href;
}

module.exports = { root, stageUrl };
