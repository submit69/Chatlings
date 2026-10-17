// Records docs/demo.gif from fake data (no real accounts, nothing from your
// screen): node scripts/make-demo.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const electron = createRequire(import.meta.url)('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(here, 'demo', 'main.cjs')], { env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
