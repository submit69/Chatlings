// Pure logic: schedule, sleep, mood, memory, unread, sound, privacy, PIN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isActive, accountMode, toMinutes, tomorrowMorning } = require('../src/main/schedule.js');
const sleep = require('../src/main/sleep.js');
const { mood, pick } = require('../src/renderer/mood.js');
const { shouldReload, summarize, RELOAD_COOLDOWN_MS } = require('../src/main/memory.js');
const { resolveUnread, total, badgeText } = require('../src/main/unread.js');
const { pickSound } = require('../src/main/sound.js');
const { shouldHideFor, QUNS } = require('../src/main/privacy.js');
const lock = require('../src/main/lock.js');

// 2026-10-12 is a Monday.
const at = (day, hh, mm = 0) => new Date(2026, 9, 11 + day, hh, mm);

test('toMinutes parses HH:MM', () => {
  assert.equal(toMinutes('08:30'), 510);
  assert.equal(toMinutes('24:00'), 1440);
  assert.equal(toMinutes('8:5'), null);
  assert.equal(toMinutes('nope'), null);
});

test('isActive: disabled schedule is always active', () => {
  assert.equal(isActive(null, at(0, 3)), true);
  assert.equal(isActive({ enabled: false, days: [], from: '09:00', to: '10:00' }, at(0, 3)), true);
});

test('isActive: day window', () => {
  const s = { enabled: true, days: [1, 2, 3, 4, 5], from: '08:00', to: '17:30' };
  assert.equal(isActive(s, at(1, 8, 0)), true, 'Mon 08:00');
  assert.equal(isActive(s, at(1, 17, 29)), true, 'Mon 17:29');
  assert.equal(isActive(s, at(1, 17, 30)), false, 'Mon 17:30 is outside');
  assert.equal(isActive(s, at(1, 7, 59)), false);
  assert.equal(isActive(s, at(6, 10)), false, 'Saturday');
  assert.equal(isActive(s, at(0, 10)), false, 'Sunday');
});

test('isActive: window across midnight belongs to the start day', () => {
  const s = { enabled: true, days: [5], from: '22:00', to: '06:00' }; // Friday night shift
  assert.equal(isActive(s, at(5, 23)), true, 'Fri 23:00');
  assert.equal(isActive(s, at(6, 2)), true, 'Sat 02:00 still Friday shift');
  assert.equal(isActive(s, at(6, 6)), false, 'Sat 06:00 over');
  assert.equal(isActive(s, at(6, 23)), false, 'Sat 23:00 not a shift day');
  assert.equal(isActive(s, at(5, 2)), false, 'Fri 02:00 belongs to Thursday');
});

test('isActive: from == to means the whole day', () => {
  const s = { enabled: true, days: [0], from: '00:00', to: '00:00' };
  assert.equal(isActive(s, at(0, 13)), true);
  assert.equal(isActive(s, at(1, 13)), false);
});

test('accountMode: group off, outside hours, dnd', () => {
  const sch = { enabled: true, days: [1], from: '09:00', to: '17:00', outside: 'hide' };
  const a = { group: 'work', schedule: sch };
  assert.deepEqual(accountMode(a, { groups: { work: { enabled: false } } }, at(1, 10)), { visible: false, muted: true, reason: 'group' });
  assert.deepEqual(accountMode(a, {}, at(1, 20)), { visible: false, muted: true, reason: 'schedule' });
  assert.deepEqual(accountMode({ ...a, schedule: { ...sch, outside: 'mute' } }, {}, at(1, 20)), { visible: true, muted: true, reason: 'schedule' });
  assert.deepEqual(accountMode({ ...a, schedule: { ...sch, outside: 'none' } }, {}, at(1, 20)), { visible: true, muted: false, reason: null });
  assert.deepEqual(accountMode(a, { dndUntil: at(1, 11).getTime() }, at(1, 10)), { visible: true, muted: true, reason: 'dnd' });
  assert.deepEqual(accountMode(a, { dndUntil: at(1, 9).getTime() }, at(1, 10)), { visible: true, muted: false, reason: null });
});

test('tomorrowMorning is 08:00 next day', () => {
  const d = new Date(tomorrowMorning(at(1, 22)));
  assert.equal(d.getDate(), at(2, 0).getDate());
  assert.equal(d.getHours(), 8);
});

// ---------- sleep ----------
test('desiredAwake per mode', () => {
  const now = 10_000_000;
  const base = { popupOpen: false, peekUntil: 0, manualSleep: false, scheduleActive: false, lastUsedAt: 0 };
  assert.equal(sleep.desiredAwake({ sleepMode: 'always' }, base, now), true);
  assert.equal(sleep.desiredAwake({ sleepMode: 'idle', idleMinutes: 15 }, base, now), false);
  assert.equal(sleep.desiredAwake({ sleepMode: 'idle', idleMinutes: 15 }, { ...base, lastUsedAt: now - 60_000 }, now), true);
  assert.equal(sleep.desiredAwake({ sleepMode: 'idle', idleMinutes: 15 }, { ...base, lastUsedAt: now - 16 * 60_000 }, now), false);
  assert.equal(sleep.desiredAwake({ sleepMode: 'schedule' }, { ...base, scheduleActive: true }, now), true);
  assert.equal(sleep.desiredAwake({ sleepMode: 'schedule' }, base, now), false);
  assert.equal(sleep.desiredAwake({ sleepMode: 'always' }, { ...base, manualSleep: true }, now), false, 'manual sleep wins over always');
  assert.equal(sleep.desiredAwake({ sleepMode: 'idle' }, { ...base, popupOpen: true }, now), true, 'open popup keeps it awake');
  assert.equal(sleep.desiredAwake({ sleepMode: 'idle' }, { ...base, manualSleep: true, peekUntil: now + 1 }, now), true, 'peeking');
});

test('nextWake / shouldPeek', () => {
  const acc = { sleepEvery: 10 };
  const now = 50 * 60_000;
  assert.equal(sleep.nextWake(acc, { lastPeekAt: now - 3 * 60_000 }, now), now + 7 * 60_000);
  assert.equal(sleep.nextWake(acc, { sleptAt: now - 20 * 60_000 }, now), now, 'overdue → now');
  assert.equal(sleep.shouldPeek(acc, { awake: false, lastPeekAt: now - 11 * 60_000 }, now), true);
  assert.equal(sleep.shouldPeek(acc, { awake: false, lastPeekAt: now - 2 * 60_000 }, now), false);
  assert.equal(sleep.shouldPeek(acc, { awake: true, lastPeekAt: 0 }, now), false);
});

test('bootPlan staggers awake accounts and skips sleeping ones', () => {
  const accs = [{ id: 'a', sleepMode: 'always' }, { id: 'b', sleepMode: 'idle' }, { id: 'c', sleepMode: 'always' }];
  const plan = sleep.bootPlan(accs, () => ({}), 0);
  assert.deepEqual(plan, [{ id: 'a', at: 0 }, { id: 'c', at: sleep.STAGGER_MS }]);
});

// ---------- mood ----------
test('mood states', () => {
  const now = 100 * 60_000;
  assert.equal(mood({ asleep: true, unread: 3 }, now), 'sleepy');
  assert.equal(mood({ unread: 2, lastNewAt: now - 1000, oldestUnreadAt: now - 1000 }, now), 'excited');
  assert.equal(mood({ unread: 2, oldestUnreadAt: now - 31 * 60_000, lastNewAt: now - 31 * 60_000 }, now), 'sad');
  assert.equal(mood({ unread: 2, oldestUnreadAt: now - 5 * 60_000, lastNewAt: now - 2 * 60_000 }, now), 'idle', 'calms down after a minute');
  assert.equal(mood({ unread: 0, lastReadAt: now - 3000, lastReplyLatency: 60_000 }, now), 'happy');
  assert.equal(mood({ unread: 0, lastReadAt: now - 3000, lastReplyLatency: 5 * 60_000, lastActivityAt: now - 3000 }, now), 'idle', 'slow reply is not happy');
  assert.equal(mood({ unread: 0, lastActivityAt: now - 31 * 60_000 }, now), 'sleepy');
  assert.equal(mood({ unread: 0, lastActivityAt: now - 60_000 }, now), 'idle');
});

test('pick falls back to idle when a skin lacks a mood', () => {
  assert.equal(pick({ moods: ['idle', 'excited'] }, 'sad'), 'idle');
  assert.equal(pick({ moods: ['idle', 'excited'] }, 'excited'), 'excited');
  assert.equal(pick(null, 'sad'), 'sad');
});

// ---------- memory ----------
test('shouldReload only when hidden, over threshold, not recently', () => {
  const now = 10 * RELOAD_COOLDOWN_MS;
  const base = { mb: 900, thresholdMB: 800, popupVisible: false, lastReloadAt: 0, now };
  assert.equal(shouldReload(base), true);
  assert.equal(shouldReload({ ...base, popupVisible: true }), false, 'never while the popup is open');
  assert.equal(shouldReload({ ...base, mb: 700 }), false);
  assert.equal(shouldReload({ ...base, thresholdMB: 0 }), false, '0 disables');
  assert.equal(shouldReload({ ...base, lastReloadAt: now - 1000 }), false, 'cooldown');
});

test('summarize splits accounts and frame using private bytes', () => {
  const metrics = [
    { pid: 1, memory: { privateBytes: 50 * 1024, workingSetSize: 99 * 1024 } },
    { pid: 2, memory: { privateBytes: 200 * 1024 } },
    { pid: 3, memory: { workingSetSize: 30 * 1024 } },
  ];
  const s = summarize(metrics, new Map([[2, 'zalo-1']]));
  assert.deepEqual(s, { accounts: { 'zalo-1': 200 }, frameMB: 80, totalMB: 280 });
});

// ---------- unread ----------
test('resolveUnread: title > DOM > dot signals', () => {
  assert.deepEqual(resolveUnread({ titleCount: 3, domCount: 5 }), { count: 3, dot: true });
  assert.deepEqual(resolveUnread({ titleCount: null, domCount: 5 }), { count: 5, dot: true });
  assert.deepEqual(resolveUnread({ titleCount: 0, domCount: 5 }), { count: 0, dot: false });
  assert.deepEqual(resolveUnread({ titleDot: true }), { count: null, dot: true });
  assert.deepEqual(resolveUnread({ faviconChanged: true }), { count: null, dot: true });
  assert.deepEqual(resolveUnread({ notifiedSinceView: true }), { count: null, dot: true });
  assert.deepEqual(resolveUnread({}), { count: null, dot: false });
});

test('total and badgeText', () => {
  assert.deepEqual(total([{ count: 2, dot: true }, { count: null, dot: true }, { count: 0, dot: false }]), { count: 2, dot: true });
  assert.deepEqual(total([{ count: null, dot: true }]), { count: 0, dot: true });
  assert.equal(badgeText({ count: 150 }), '99+');
  assert.equal(badgeText({ count: 7 }), '7');
  assert.equal(badgeText({ count: null, dot: true }), '');
});

// ---------- sound ----------
test('pickSound respects mute, lock and the account choice', () => {
  assert.equal(pickSound({ sound: 'meow' }, { muted: true }), null);
  assert.equal(pickSound({ sound: 'none' }, {}), null);
  assert.deepEqual(pickSound({ sound: 'meow' }, { locked: true }), { sound: 'pop' });
  assert.deepEqual(pickSound({ sound: 'woof' }, {}), { sound: 'woof' });
  assert.deepEqual(pickSound({ sound: 'file', soundFile: 'C:/a.mp3' }, {}), { sound: 'file', file: 'C:/a.mp3' });
  assert.deepEqual(pickSound({ sound: 'file' }, {}), { sound: 'chime' });
});

// ---------- privacy ----------
test('hide only for presentation and D3D full screen, not for busy (maximised Excel)', () => {
  assert.equal(shouldHideFor(QUNS.PRESENTATION_MODE), true);
  assert.equal(shouldHideFor(QUNS.RUNNING_D3D_FULL_SCREEN), true);
  assert.equal(shouldHideFor(QUNS.BUSY), false);
  assert.equal(shouldHideFor(QUNS.ACCEPTS_NOTIFICATIONS), false);
});

// ---------- PIN ----------
test('PIN hashing with scrypt + salt', () => {
  assert.equal(lock.validPin('1234'), true);
  assert.equal(lock.validPin('12345678'), true);
  assert.equal(lock.validPin('123'), false);
  assert.equal(lock.validPin('12a4'), false);
  const rec = lock.hashPin('2468');
  assert.match(rec.salt, /^[0-9a-f]{32}$/);
  assert.notEqual(rec.hash, '2468');
  assert.equal(lock.verifyPin('2468', rec), true);
  assert.equal(lock.verifyPin('2469', rec), false);
  assert.notEqual(lock.hashPin('2468').hash, rec.hash, 'different salt → different hash');
});

test('5 wrong PINs → 30 s wait, then tries reset', () => {
  let st = lock.newAttempts();
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) {
    st = lock.recordFailure(st, t0);
    assert.equal(lock.canTry(st, t0).ok, true);
  }
  st = lock.recordFailure(st, t0);
  const c = lock.canTry(st, t0 + 1000);
  assert.equal(c.ok, false);
  assert.equal(c.waitMs, lock.COOLDOWN_MS - 1000);
  assert.equal(lock.canTry(st, t0 + lock.COOLDOWN_MS).ok, true);
  st = lock.recordFailure(st, t0 + lock.COOLDOWN_MS);
  assert.equal(st.fails, 1, 'counter restarts after the wait');
});

test('each lockout doubles the wait, up to 15 minutes', () => {
  assert.equal(lock.cooldownFor(1), 30_000);
  assert.equal(lock.cooldownFor(2), 60_000);
  assert.equal(lock.cooldownFor(3), 120_000);
  assert.equal(lock.cooldownFor(20), lock.MAX_COOLDOWN_MS);
  let st = lock.newAttempts();
  let t = 0;
  const lockOut = () => {
    for (let i = 0; i < lock.MAX_TRIES; i++) st = lock.recordFailure(st, t);
    return st.until - t;
  };
  assert.equal(lockOut(), 30_000);
  t = st.until;
  assert.equal(lockOut(), 60_000, 'second lockout waits longer');
});

test('createLock: unlock flow and lockout', () => {
  const rec = lock.hashPin('1357');
  const changes = [];
  const l = lock.createLock({ getRecord: () => rec, getAutoLockMinutes: () => 0, getLockOnScreenLock: () => true, onChange: (v) => changes.push(v) });
  assert.equal(l.isLocked(), true, 'starts locked when a PIN is set');
  const t0 = 5_000_000;
  for (let i = 0; i < 4; i++) assert.equal(l.unlock('0000', t0).ok, false);
  const r = l.unlock('0000', t0);
  assert.equal(r.ok, false);
  assert.ok(r.waitMs > 0);
  assert.equal(l.unlock('1357', t0 + 1000).ok, false, 'even the right PIN waits');
  assert.equal(l.unlock('1357', t0 + lock.COOLDOWN_MS).ok, true);
  assert.equal(l.isLocked(), false);
  assert.deepEqual(changes, [false]);
});

test('shouldAutoLock', () => {
  assert.equal(lock.shouldAutoLock(600, 10), true);
  assert.equal(lock.shouldAutoLock(599, 10), false);
  assert.equal(lock.shouldAutoLock(99999, 0), false);
});

// ---------- platform ----------
test('user agent matches the OS and the real Chrome version', async () => {
  const { chromeUA, features, isWin, isMac, isLinux } = require('../src/main/platform.js');
  const ua = chromeUA('140.0.7339.80');
  assert.match(ua, /Chrome\/140\.0\.0\.0 Safari\/537\.36$/);
  assert.doesNotMatch(ua, /Electron/);
  if (isWin) assert.match(ua, /Windows NT 10\.0/);
  if (isMac) assert.match(ua, /Macintosh/);
  if (isLinux) assert.match(ua, /X11; Linux x86_64/);
  assert.equal(features.clickThrough, !isLinux);
  assert.equal(features.presentationDetection, isWin);
});
