// Draws the Bongbong icon (a chat bubble with cat ears) without any image
// library: shapes are tested per pixel with 4×4 supersampling, then written
// as PNG (zlib) and ICO (PNG-compressed entries).
//   node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
fs.mkdirSync(OUT, { recursive: true });

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function inTri(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = s(x, y, ax, ay, bx, by);
  const d2 = s(x, y, bx, by, cx, cy);
  const d3 = s(x, y, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const INDIGO = [99, 102, 241];
const PINK = [236, 72, 153];

/** Colour (rgba 0..255) at unit coords, or null for transparent. */
function shade(x, y, { unread, simple }) {
  if (unread) {
    if (inCircle(x, y, 0.8, 0.2, 0.19)) return inCircle(x, y, 0.8, 0.2, 0.14) ? [239, 68, 68, 255] : [255, 255, 255, 255];
  }
  const body = inCircle(x, y, 0.5, 0.57, 0.37);
  const ears = inTri(x, y, [0.17, 0.42], [0.2, 0.06], [0.45, 0.26]) || inTri(x, y, [0.83, 0.42], [0.8, 0.06], [0.55, 0.26]);
  const tail = inTri(x, y, [0.2, 0.74], [0.08, 0.98], [0.44, 0.88]);
  if (!(body || ears || tail)) return null;
  if (!simple) {
    if (inCircle(x, y, 0.37, 0.55, 0.055) || inCircle(x, y, 0.63, 0.55, 0.055)) return [255, 255, 255, 255];
    if (inTri(x, y, [0.46, 0.64], [0.54, 0.64], [0.5, 0.69])) return [255, 228, 230, 255];
    const innerEar = inTri(x, y, [0.23, 0.36], [0.24, 0.15], [0.39, 0.27]) || inTri(x, y, [0.77, 0.36], [0.76, 0.15], [0.61, 0.27]);
    if (innerEar) return [...mix([255, 200, 220], [255, 180, 200], y), 255];
  } else if (inCircle(x, y, 0.37, 0.56, 0.08) || inCircle(x, y, 0.63, 0.56, 0.08)) {
    return [255, 255, 255, 255];
  }
  return [...mix(INDIGO, PINK, Math.min(1, Math.max(0, (x + y) / 2))), 255];
}

function render(size, opts = {}) {
  const ss = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < ss; sj++) {
        for (let si = 0; si < ss; si++) {
          const c = shade((i + (si + 0.5) / ss) / size, (j + (sj + 0.5) / ss) / size, opts);
          if (c) {
            r += c[0] * c[3];
            g += c[1] * c[3];
            b += c[2] * c[3];
            a += c[3];
          }
        }
      }
      const o = (j * size + i) * 4;
      if (a) {
        px[o] = Math.round(r / a);
        px[o + 1] = Math.round(g / a);
        px[o + 2] = Math.round(b / a);
        px[o + 3] = Math.round(a / (ss * ss));
      }
    }
  }
  return png(size, size, px);
}

// ---- PNG ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- ICO (entries stored as PNG, supported since Vista) ----
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir[o] = size >= 256 ? 0 : size;
    dir[o + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, dir, ...images.map((i) => i.data)]);
}

const write = (name, buf) => {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('wrote build/' + name, buf.length, 'bytes');
};
write('icon.png', render(512));
write('icon.ico', ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: render(size, { simple: size <= 24 }) }))));
write('tray.png', render(16, { simple: true }));
write('tray@2x.png', render(32, { simple: true }));
write('tray-unread.png', render(16, { simple: true, unread: true }));
write('tray-unread@2x.png', render(32, { simple: true, unread: true }));
