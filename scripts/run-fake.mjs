// Start Bongbong with fake chat pages instead of real services, in a
// throw-away profile. Handy for development and for recording the demo.
//   npm run fake            3 fake accounts
//   npm run fake -- 5       5 fake accounts
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = createRequire(import.meta.url)('electron');
const n = process.argv[2] || '3';
const userData = path.join(os.tmpdir(), 'bongbong-fake-' + n);
if (process.argv.includes('--fresh')) fs.rmSync(userData, { recursive: true, force: true });

const child = spawn(electron, [root], {
  stdio: 'inherit',
  env: { ...process.env, BONGBONG_FAKE: '1', BONGBONG_FAKE_ACCOUNTS: n, BONGBONG_USERDATA: userData },
});
child.on('exit', (code) => process.exit(code ?? 0));
