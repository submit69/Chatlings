// Builds the donation assets from src/donate.json:
//   - src/renderer/brand/donate-qr.png  (VietQR bank transfer, used by the app and the site)
//   - .github/FUNDING.yml               (the "Sponsor" button on GitHub)
//   node scripts/make-donate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const QRCode = require('qrcode');
const { vietqrPayload } = require(path.join(root, 'src', 'main', 'vietqr.js'));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'src', 'donate.json'), 'utf8'));

const png = path.join(root, 'src', 'renderer', 'brand', 'donate-qr.png');
const image = /^[\w.-]+\.(png|jpe?g|webp)$/i.test(cfg.image || '') && fs.existsSync(path.join(root, 'src', 'renderer', 'brand', cfg.image)) ? cfg.image : '';
if (image) console.log('IMG →', 'src/renderer/brand/' + image);
const payload = image ? null : vietqrPayload(cfg.bank);
if (payload) {
  await QRCode.toFile(png, payload, { width: 480, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });
  console.log('QR  →', path.relative(root, png), `(${payload.length} chars)`);
} else {
  fs.rmSync(png, { force: true });
  console.log(image ? 'QR  → not needed (using the image)' : 'QR  → skipped (bank not filled in)');
}

const user = (url, host) => {
  const m = new RegExp(`${host.replace('.', '\\.')}/([A-Za-z0-9_-]+)`).exec(String(url || ''));
  return m ? m[1] : '';
};
const lines = [];
if (cfg.githubSponsors) lines.push(`github: [${cfg.githubSponsors}]`);
if (user(cfg.buyMeACoffee, 'buymeacoffee.com')) lines.push(`buy_me_a_coffee: ${user(cfg.buyMeACoffee, 'buymeacoffee.com')}`);
if (user(cfg.kofi, 'ko-fi.com')) lines.push(`ko_fi: ${user(cfg.kofi, 'ko-fi.com')}`);
if (payload || image) lines.push(`custom: ['https://chatlings.submit69.com/#donate']`);
const funding = path.join(root, '.github', 'FUNDING.yml');
if (lines.length) {
  fs.writeFileSync(funding, lines.join('\n') + '\n');
  console.log('FUNDING.yml →', lines.join(' | '));
} else {
  fs.rmSync(funding, { force: true });
  console.log('FUNDING.yml → skipped (nothing filled in)');
}
