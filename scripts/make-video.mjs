// Records the demo video in Vietnamese and English (fake data only):
//   node scripts/make-video.mjs          → docs/chatlings-demo-vi.mp4 and -en.mp4
//   node scripts/make-video.mjs en       → English only
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const electron = createRequire(import.meta.url)('electron');
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['vi', 'en'];

for (const lang of langs) {
  const env = { ...process.env, DEMO_LANG: lang };
  delete env.ELECTRON_RUN_AS_NODE;
  const code = await new Promise((r) => spawn(electron, [path.join(here, 'demo', 'video.cjs')], { env, stdio: 'inherit' }).on('exit', r));
  if (code) process.exit(code);
}
