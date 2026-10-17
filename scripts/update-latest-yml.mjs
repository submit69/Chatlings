// After the installer is code-signed its bytes change, so the sha512/size in
// latest.yml (read by the installed app's auto-updater) and the .blockmap
// (differential download) must be rebuilt from the signed file.
//   node scripts/update-latest-yml.mjs [distDir]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');

const dist = path.resolve(process.argv[2] || 'dist');
const ymlPath = path.join(dist, 'latest.yml');
let yml = fs.readFileSync(ymlPath, 'utf8');
const file = /^path: (.+)$/m.exec(yml)[1].trim();
const exe = path.join(dist, file);

const info = await buildBlockMap(exe, 'gzip', `${exe}.blockmap`);
const size = fs.statSync(exe).size;
yml = yml.replace(/sha512: .+/g, `sha512: ${info.sha512}`).replace(/size: \d+/g, `size: ${size}`);
fs.writeFileSync(ymlPath, yml);
console.log(`latest.yml → ${file} size ${size} sha512 ${info.sha512.slice(0, 16)}…`);
