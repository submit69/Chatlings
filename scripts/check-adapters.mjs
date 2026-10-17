// Opens every adapter's real URL in Bongbong (not logged in) and checks that a
// login page shows up and is not blocked as an "unsupported browser".
//   node scripts/check-adapters.mjs            all adapters
//   node scripts/check-adapters.mjs zalo slack only these
// Screenshots go to %TEMP%/bongbong-adapters.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(os.tmpdir(), 'bongbong-adapters');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const env = { ...process.env, BONGBONG_EXPOSE: '1', BONGBONG_USERDATA: fs.mkdtempSync(path.join(os.tmpdir(), 'bb-adapters-')) };
delete env.ELECTRON_RUN_AS_NODE;
delete env.BONGBONG_FAKE;
const app = await _electron.launch({ args: [root], env });
const ev = (fn, arg) => app.evaluate(fn, arg);
await (async () => {
  for (let i = 0; i < 60; i++) {
    if (await ev(() => !!globalThis.__bongbong).catch(() => false)) return;
    await wait(250);
  }
})();
// No picker window on first run for this check.
await ev(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => /picker/.test(w.webContents.getURL()) && w.close()));

const ids = await ev((_e, only) => {
  const c = globalThis.__bongbong;
  const out = [];
  for (const a of c.lib.registry.list()) {
    if (a.id === 'custom' || (only.length && !only.includes(a.id))) continue;
    const acc = c.store.addAccount(c.lib.newAccount(a, c.store.accounts()));
    out.push({ id: acc.id, adapter: a.id });
  }
  return out;
}, only);

const BLOCKED = /(unsupported browser|browser (is )?not supported|update (your )?(browser|chrome)|works with google chrome|this browser or app may not be secure|trình duyệt không được hỗ trợ|upgrade your browser)/i;
const results = [];
for (const { id, adapter } of ids) {
  await ev((_e, id) => globalThis.__bongbong.openAccount(id), id);
  let info = null;
  for (let i = 0; i < 40; i++) {
    await wait(1000);
    info = await ev(async (_e, id) => {
      const c = globalThis.__bongbong;
      const wc = c.accounts.state(id).view.webContents;
      if (wc.isLoading()) return null;
      const text = await wc.executeJavaScript('document.body ? document.body.innerText.slice(0, 3000) : ""').catch(() => '');
      return { url: wc.getURL(), title: wc.getTitle(), text, ua: wc.getUserAgent() };
    }, id);
    if (info && info.text.trim().length > 20 && i >= 6) break;
  }
  const png = await ev(async (_e, id) => {
    const c = globalThis.__bongbong;
    return (await c.accounts.state(id).view.webContents.capturePage()).toPNG().toString('base64');
  }, id).catch(() => null);
  if (png) fs.writeFileSync(path.join(OUT, adapter + '.png'), Buffer.from(png, 'base64'));
  const blocked = info ? BLOCKED.test(info.text) : null;
  console.log(adapter, info ? `${blocked ? 'BLOCKED' : 'ok'} ${info.url} | ${info.title}` : 'no page');
  results.push({ adapter, ok: !!info && !blocked && info.text.trim().length > 20, blocked, url: info && info.url, title: info && info.title, snippet: info && info.text.replace(/\s+/g, ' ').slice(0, 110) });
  await ev(() => globalThis.__bongbong.popup.hide());
}
await app.close();
console.table(results.map(({ adapter, ok, blocked, url, title }) => ({ adapter, ok, blocked, url: (url || '').slice(0, 60), title: (title || '').slice(0, 40) })));
for (const r of results) console.log(`${r.adapter}: ${r.snippet}`);
console.log('screenshots:', OUT);
