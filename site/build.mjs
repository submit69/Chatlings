// Builds the landing page into site/public:
//   node site/build.mjs      (then: cd site && npx wrangler deploy)
// Copies the page, the demo videos (npm run video) and the icon, inserts the
// supported-apps list from the adapter registry, renders og.png.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const site = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(site, '..');
const out = path.join(site, 'public');
const require = createRequire(import.meta.url);
const registry = require(path.join(root, 'src', 'adapters'));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const glyph = (icon) =>
  icon.path
    ? `<svg viewBox="${icon.viewBox || '0 0 24 24'}" aria-hidden="true"><path fill="#fff" d="${icon.path}"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI, sans-serif" font-weight="800" font-size="${icon.text.length > 1 ? 11 : 14}" fill="#fff">${esc(icon.text)}</text></svg>`;
const apps = registry
  .list()
  .filter((a) => a.tier <= 2)
  .map((a) => `<li><i style="background:${a.color}">${glyph(a.icon)}</i>${esc(a.name)}</li>`)
  .join('\n          ');

const html = fs.readFileSync(path.join(site, 'src', 'index.html'), 'utf8').replace('<!--APPS-->', apps);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(site, 'src', 'site.js'), path.join(out, 'site.js'));
fs.copyFileSync(path.join(root, 'build', 'icon.png'), path.join(out, 'icon.png'));
for (const lang of ['vi', 'en']) {
  for (const ext of ['mp4', 'jpg']) {
    const f = path.join(root, 'docs', `chatlings-demo-${lang}.${ext}`);
    if (!fs.existsSync(f)) throw new Error(`missing ${f}: run npm run video first`);
    fs.copyFileSync(f, path.join(out, path.basename(f)));
  }
}
fs.writeFileSync(
  path.join(out, '_headers'),
  `/*.mp4
  Cache-Control: public, max-age=86400
/*.jpg
  Cache-Control: public, max-age=86400
/*.png
  Cache-Control: public, max-age=86400
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src https://api.github.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
`,
);

// og.png for Facebook / Zalo / X link previews
fs.copyFileSync(path.join(site, 'src', 'og.html'), path.join(out, 'og.html'));
const electron = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(electron, [path.join(site, 'og.cjs'), out], { env, stdio: 'inherit' });
if (r.status !== 0 || !fs.existsSync(path.join(out, 'og.png'))) throw new Error('og.png failed');

for (const f of fs.readdirSync(out)) console.log(`${f.padEnd(26)} ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)} KB`);
