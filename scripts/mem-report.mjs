// RAM report for the README: starts Chatlings with 0, 1 and 5 fake accounts
// (and 5 sleeping ones), waits, then prints private memory per process.
//   npm run mem-report            fake chat pages (measures Chatlings itself)
//   npm run mem-report -- --gpu   with hardware acceleration on
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = createRequire(import.meta.url)('electron');
const gpu = process.argv.includes('--gpu');
const SECONDS = 30;

function run(label, n, extra = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CHATLINGS_FAKE: '1',
      CHATLINGS_FAKE_ACCOUNTS: String(n),
      CHATLINGS_USERDATA: fs.mkdtempSync(path.join(os.tmpdir(), 'bb-mem-')),
      CHATLINGS_MEMREPORT: String(SECONDS),
      CHATLINGS_NO_GPU: gpu ? '0' : '1',
      ...extra,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [root], { env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => process.env.DEBUG && process.stderr.write(d));
    process.stderr.write(label + '…\n');
    child.on('exit', () => {
      const line = out.split('\n').find((l) => l.startsWith('CHATLINGS_MEM '));
      if (!line) return reject(new Error(label + ': no report'));
      resolve({ label, n, ...JSON.parse(line.slice('CHATLINGS_MEM '.length)) });
    });
  });
}

const runs = [];
runs.push(await run('0 accounts', 0));
runs.push(await run('1 account', 1));
runs.push(await run('5 accounts awake', 5));
runs.push(await run('5 accounts asleep', 5, { CHATLINGS_FAKE_SLEEP: '1' }));

console.log(`\nPrivate memory after ${SECONDS} s, hardware acceleration ${gpu ? 'ON' : 'OFF'} (Windows ${os.release()}, Electron ${createRequire(import.meta.url)('electron/package.json').version}).`);
console.log('Fake chat pages are tiny, so "per account" here is the floor of one Chromium renderer, not the cost of a real web app.\n');
console.log('| Case | Chatlings itself | Accounts | Total |');
console.log('|---|---:|---:|---:|');
for (const r of runs) {
  const acc = r.accounts.reduce((s, a) => s + a.mb, 0);
  console.log(`| ${r.label} | ${r.frameMB} MB | ${acc} MB | ${r.totalMB} MB |`);
}
console.log('\nPer process (5 accounts awake):');
console.log('| Process | MB |');
console.log('|---|---:|');
for (const m of runs[2].metrics) console.log(`| ${m.type}${m.account ? ' ' + m.account : ''} | ${m.mb} |`);
