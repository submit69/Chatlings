// Starts the real app with 3 fake chat accounts, waits for them to load,
// prints the RAM report and checks that everything came up, then quits.
// Used by CI on Windows, macOS and Linux (under xvfb-run).
//   node scripts/smoke.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = createRequire(import.meta.url)('electron');
const env = {
  ...process.env,
  CHATLINGS_FAKE: '1',
  CHATLINGS_FAKE_ACCOUNTS: '3',
  CHATLINGS_USERDATA: fs.mkdtempSync(path.join(os.tmpdir(), 'chatlings-smoke-')),
  CHATLINGS_MEMREPORT: '25',
};
delete env.ELECTRON_RUN_AS_NODE;
// CI runners have no setuid sandbox helper for the npm-installed Electron.
const args = [root, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];

const child = spawn(electron, args, { env });
let out = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => process.stderr.write(d));
const killer = setTimeout(() => child.kill(), 120000);
const code = await new Promise((r) => child.on('exit', r));
clearTimeout(killer);

const line = out.split('\n').find((l) => l.startsWith('CHATLINGS_MEM '));
if (!line) {
  console.error(`no report (exit ${code})\n${out}`);
  process.exit(1);
}
const r = JSON.parse(line.slice('CHATLINGS_MEM '.length));
console.log(`${process.platform}: Chatlings itself ${r.frameMB} MB, total ${r.totalMB} MB`);
console.table(r.metrics.map((m) => ({ type: m.type, account: m.account || '', mb: m.mb })));
const problems = [];
if (r.accounts.length !== 3) problems.push(`expected 3 accounts, got ${r.accounts.length}`);
for (const a of r.accounts) if (!a.awake) problems.push(`${a.id} did not load`);
if (!r.metrics.some((m) => m.account === '(dock)')) problems.push('no dock renderer');
if (problems.length) {
  console.error('FAILED: ' + problems.join('; '));
  process.exit(1);
}
console.log('smoke OK');
