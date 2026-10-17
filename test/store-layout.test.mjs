import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStore, newAccount, withDefaults, DEFAULTS, COLORS } = require('../src/main/store.js');
const L = require('../src/main/layout.js');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bb-store-')), 'bongbong.json');
const zalo = { id: 'zalo', name: 'Zalo', sleepMode: 'always' };

test('withDefaults fills missing keys and keeps user values', () => {
  const d = withDefaults({ settings: { merged: true }, accounts: [{ id: 'x' }] }, DEFAULTS);
  assert.equal(d.settings.merged, true);
  assert.equal(d.settings.contentProtection, true);
  assert.equal(d.accounts.length, 1);
  assert.equal(d.dock.edge, 'right');
});

test('newAccount: partition-safe id, numbered names, unused colours', () => {
  const a = newAccount(zalo, []);
  assert.match(a.id, /^zalo-[0-9a-f]{8}$/);
  assert.equal(a.name, 'Zalo');
  const b = newAccount(zalo, [a]);
  assert.equal(b.name, 'Zalo 2');
  assert.notEqual(a.color, b.color);
  assert.ok(COLORS.includes(b.color));
  assert.equal(newAccount({ id: 'slack', name: 'Slack', sleepMode: 'idle' }, []).sleepMode, 'idle');
  assert.equal(newAccount(zalo, [], { name: 'Shop', url: 'https://x.y' }).name, 'Shop');
});

test('store round-trip, update, move, remove', () => {
  const file = tmp();
  const s = createStore(file);
  const a = s.addAccount(newAccount(zalo, s.accounts()));
  const b = s.addAccount(newAccount(zalo, s.accounts()));
  s.updateAccount(a.id, { name: 'Work', schedule: { enabled: true } });
  assert.equal(s.account(a.id).schedule.from, '08:00', 'nested patch merges');
  s.moveAccount(b.id, 0);
  s.setSetting('merged', true);
  s.flush();
  const s2 = createStore(file);
  assert.deepEqual(s2.accounts().map((x) => x.id), [b.id, a.id]);
  assert.equal(s2.account(a.id).name, 'Work');
  assert.equal(s2.settings.merged, true);
  s2.removeAccount(b.id);
  s2.flush();
  assert.equal(createStore(file).accounts().length, 1);
});

test('a corrupt file is kept aside, not overwritten', () => {
  const file = tmp();
  fs.writeFileSync(file, '{ broken');
  const s = createStore(file);
  assert.equal(s.accounts().length, 0);
  const kept = fs.readdirSync(path.dirname(file)).filter((f) => f.includes('.broken-'));
  assert.equal(kept.length, 1);
});

// ---------- layout ----------
const wa = { x: 0, y: 0, width: 1920, height: 1040 };

test('dock size grows with bubbles and preview', () => {
  assert.deepEqual(L.dockSize(1), { width: L.COLUMN_W, height: L.BUBBLE + 2 * L.PAD });
  assert.equal(L.dockSize(3).height, 3 * L.BUBBLE + 2 * L.GAP + 2 * L.PAD);
  const p = L.dockSize(1, { previewHeight: 200, previewIndex: 0 });
  assert.equal(p.width, L.COLUMN_W + L.PREVIEW_W);
  assert.equal(p.height, L.PAD + 200 + L.PAD * 2);
});

test('dock hugs the chosen edge and stays on screen', () => {
  const size = { width: 84, height: 300 };
  assert.deepEqual(L.dockBounds({ edge: 'right', y: 100 }, size, wa), { x: 1836, y: 100, width: 84, height: 300 });
  assert.equal(L.dockBounds({ edge: 'left', y: 100 }, size, wa).x, 0);
  assert.equal(L.dockBounds({ edge: 'right', y: 5000 }, size, wa).y, 740, 'clamped to bottom');
  assert.equal(L.dockBounds({ edge: 'right', y: -50 }, size, wa).y, 0, 'clamped to top');
  // second monitor on the left with negative coordinates
  const left = { x: -1280, y: 0, width: 1280, height: 1024 };
  assert.equal(L.dockBounds({ edge: 'left', y: 10 }, size, left).x, -1280);
});

test('snapToEdge picks the nearest side', () => {
  assert.deepEqual(L.snapToEdge({ x: 300, y: 200, width: 84, height: 100 }, wa), { edge: 'left', y: 200 });
  assert.deepEqual(L.snapToEdge({ x: 1500, y: 2000, width: 84, height: 100 }, wa), { edge: 'right', y: 940 });
});

test('popup sits on the inner side and inside the work area', () => {
  const dock = { x: 1836, y: 100, width: 84, height: 300 };
  const p = L.popupBounds(dock, 'right', 900, { width: 420, height: 680 }, wa);
  assert.equal(p.x + p.width, 1836, 'touches the dock column');
  assert.ok(p.y + p.height <= wa.height);
  const q = L.popupBounds({ x: 0, y: 100, width: 84, height: 300 }, 'left', 120, { width: 900, height: 680 }, wa);
  assert.equal(q.x, L.COLUMN_W);
  const small = { x: 0, y: 0, width: 800, height: 600 };
  const r = L.popupBounds({ x: 716, y: 0, width: 84, height: 100 }, 'right', 0, { width: 900, height: 680 }, small);
  assert.ok(r.width <= small.width - L.COLUMN_W && r.height <= 600 && r.x >= 0);
});

test('isDrag needs more than 4 px', () => {
  assert.equal(L.isDrag(4, 0), false);
  assert.equal(L.isDrag(0, -5), true);
});
