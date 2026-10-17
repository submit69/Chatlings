import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = require('../src/adapters/index.js');
const { parseTitle, countBadges, isAllowedUrl, hostMatches } = require('../src/adapters/common.js');

test('every registered adapter has the required fields', () => {
  assert.equal(registry.list().length, registry.IDS.length);
  for (const a of registry.list()) {
    for (const k of ['id', 'name', 'tier', 'icon', 'color', 'size', 'parseUnread', 'unreadFromDom', 'profileFromDom', 'selectors', 'allowedHosts']) {
      assert.ok(a[k] !== undefined, `${a.id}.${k}`);
    }
    assert.ok([1, 2, 3].includes(a.tier), a.id);
    assert.match(a.color, /^#[0-9A-Fa-f]{6}$/, a.id);
    assert.ok(a.icon.path || a.icon.text, a.id + ' icon');
    assert.equal(typeof a.selectors.unreadBadge, 'string', a.id);
    assert.ok(fs.existsSync(path.join(root, 'src/adapters', a.id, 'selectors.js')), a.id + ' selectors.js');
  }
});

test('allowedHosts contains the host of the adapter URL (and fallback)', () => {
  for (const a of registry.list()) {
    if (a.id === 'custom') continue;
    assert.ok(isAllowedUrl(a.url, a.allowedHosts), `${a.id}: ${a.url}`);
    assert.ok(a.url.startsWith('https://'), a.id);
    if (a.fallbackUrl) assert.ok(isAllowedUrl(a.fallbackUrl, a.allowedHosts), a.id + ' fallback');
  }
});

test('navigation guard', () => {
  const z = registry.get('zalo');
  assert.equal(isAllowedUrl('https://id.zalo.me/account', z.allowedHosts), true);
  assert.equal(isAllowedUrl('https://evilzalo.me/', z.allowedHosts), false, 'suffix must be on a dot boundary');
  assert.equal(isAllowedUrl('https://example.com/', z.allowedHosts), false);
  assert.equal(isAllowedUrl('file:///C:/x', z.allowedHosts), false);
  assert.equal(isAllowedUrl('about:blank', z.allowedHosts), true);
  assert.equal(hostMatches('LOGIN.microsoftonline.com', ['microsoftonline.com']), true);
  assert.ok(isAllowedUrl('https://accounts.google.com/signin', registry.get('slack').allowedHosts), 'SSO for Slack');
  assert.ok(!isAllowedUrl('https://accounts.google.com/signin', z.allowedHosts), 'no SSO hosts for Zalo');
});

test('generic title parsing', () => {
  assert.deepEqual(parseTitle('(3) WhatsApp'), { count: 3, dot: true });
  assert.deepEqual(parseTitle('(0) Zalo'), { count: 0, dot: false });
  assert.deepEqual(parseTitle('[12] Element'), { count: 12, dot: true });
  assert.deepEqual(parseTitle('Telegram Web (5)'), { count: 5, dot: true });
  assert.deepEqual(parseTitle('• Discord | #general'), { count: null, dot: true });
  assert.deepEqual(parseTitle('* Slack | general'), { count: null, dot: true });
  assert.deepEqual(parseTitle('Messenger'), { count: null, dot: false });
  assert.deepEqual(parseTitle(''), { count: null, dot: false });
});

test('adapter-specific title parsing', () => {
  assert.deepEqual(registry.get('element').parseUnread('Element [4]'), { count: 4, dot: true });
  assert.deepEqual(registry.get('element').parseUnread('Element *'), { count: null, dot: true });
  assert.deepEqual(registry.get('googlechat').parseUnread('Chat (2) - me@gmail.com - Gmail'), { count: 2, dot: true });
  assert.deepEqual(registry.get('discord').parseUnread('(7) Discord | #dev'), { count: 7, dot: true });
});

test('countBadges sums visible badges (runs in the page)', () => {
  const badge = (text) => ({ textContent: text, offsetParent: {} });
  global.document = { querySelectorAll: () => [badge('3'), badge(' 12 '), badge('')], querySelector: () => null };
  global.getComputedStyle = () => ({ position: 'static' });
  assert.equal(countBadges({ unreadBadge: '.b' }), 16, 'empty badge counts as 1');
  global.document = { querySelectorAll: () => [], querySelector: () => null };
  assert.equal(countBadges({ unreadBadge: '.b' }), null, 'nothing matched = unknown');
  assert.equal(countBadges({ unreadBadge: '' }), null);
  delete global.document;
  delete global.getComputedStyle;
});

test('page functions are self-contained (they are serialised into the page)', () => {
  for (const a of registry.list()) {
    for (const fn of [a.unreadFromDom, a.profileFromDom]) {
      // Must survive toString() → new Function without outer variables.
      const rebuilt = new Function('return (' + fn.toString() + ')')();
      assert.equal(typeof rebuilt, 'function', a.id);
    }
  }
});

test('custom adapter: hosts from URL, fake mode override', () => {
  const c = registry.get('custom');
  assert.deepEqual(c.hostsFor('https://chat.example.com/x'), ['example.com']);
  assert.deepEqual(c.hostsFor('https://team.example.com.vn/'), ['example.com.vn']);
  assert.deepEqual(c.hostsFor('nope'), []);
  const r = registry.resolve({ id: 'custom-1', adapter: 'custom', url: 'https://chat.example.com/' });
  assert.equal(r.url, 'https://chat.example.com/');
  process.env.BONGBONG_FAKE = '1';
  const f = registry.resolve({ id: 'zalo-1', adapter: 'zalo', fakeMode: 'dom' });
  delete process.env.BONGBONG_FAKE;
  assert.match(f.url, /^file:.*fake-chat\.html\?id=zalo-1&adapter=zalo&mode=dom$/);
  assert.equal(f.selectors.unreadBadge, '.fake-badge');
});

// ---------- i18n ----------
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf8'));
const vi = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/vi.json'), 'utf8'));

test('en and vi have the same keys and no empty strings', () => {
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const [k, v] of Object.entries({ ...en, ...vi })) assert.ok(String(v).trim(), k);
});

test('placeholders match between languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(en)) assert.equal(ph(vi[k]), ph(en[k]), k);
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

test('every i18n key used in the source exists', () => {
  const store = require('../src/main/store.js');
  const sleep = require('../src/main/sleep.js');
  const dynamic = {
    'group.': Object.keys(store.DEFAULTS.groups),
    'skin.': store.SKINS,
    'sound.': store.SOUNDS,
    'sleep.': sleep.MODES,
    'color.': ['blue', 'orange', 'green', 'pink', 'purple', 'yellow', 'teal', 'red'],
    'day.': ['0', '1', '2', '3', '4', '5', '6'],
  };
  const used = new Set();
  for (const f of walk(path.join(root, 'src')).filter((f) => /\.(js|html)$/.test(f))) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    for (const m of s.matchAll(/data-i18n(?:-title|-placeholder)?="([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
    for (const m of s.matchAll(/opt\(\s*'([a-zA-Z0-9_.]+)',\s*(?:'([a-zA-Z0-9_.]+)')?/g)) {
      used.add(m[1]);
      if (m[2]) used.add(m[2]);
    }
    for (const m of s.matchAll(/'((?:settings|tray|menu|dock|lock|picker|sound|outside|about|bar)\.[a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
  }
  for (const [prefix, list] of Object.entries(dynamic)) for (const k of list) used.add(prefix + k);
  const missing = [...used].filter((k) => !k.endsWith('.') && !/\.(html|png|js|css|json)$/.test(k) && !(k in en));
  assert.deepEqual(missing, []);
});
