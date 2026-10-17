'use strict';
// Settings + accounts in one JSON file in userData. No Electron dependency
// (the path is passed in) so it can be tested with node:test.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_SCHEDULE } = require('./schedule');

const COLORS = ['#3B82F6', '#F97316', '#10B981', '#EC4899', '#8B5CF6', '#EAB308', '#14B8A6', '#EF4444'];
const SOUNDS = ['chime', 'bell', 'pop', 'meow', 'woof', 'file', 'none'];
const SKINS = ['avatar', 'cat', 'dog'];

const DEFAULTS = {
  version: 1,
  accounts: [],
  dock: { edge: 'right', y: null, displayId: null },
  groups: {
    work: { enabled: true },
    personal: { enabled: true },
  },
  dndUntil: 0,
  settings: {
    locale: null, // null = follow Windows
    merged: false,
    hideAll: false,
    contentProtection: true,
    hideOnPresentation: true,
    previews: true,
    autoPeek: true, // show the preview card by itself when a message arrives
    autoLaunch: false,
    checkUpdates: true,
    pin: null, // {salt, hash}
    autoLockMinutes: 10,
    lockOnScreenLock: true,
    memThresholdMB: 800,
    spellcheck: false,
    // Off by default: saves ~60 MB (GPU process). Turn on if video calls stutter.
    hardwareAcceleration: false,
    popupPinned: false,
  },
};

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Fills missing keys from defaults, recursively. Arrays are taken as-is. */
function withDefaults(data, defaults) {
  const out = { ...defaults };
  if (!isObj(data)) return structuredClone(defaults);
  for (const [k, v] of Object.entries(data)) {
    out[k] = isObj(v) && isObj(defaults[k]) ? withDefaults(v, defaults[k]) : v;
  }
  return out;
}

function newAccount(adapter, existing = [], opts = {}) {
  const used = new Set(existing.map((a) => a.color));
  const sameApp = existing.filter((a) => a.adapter === adapter.id).length;
  const name = opts.name || (sameApp ? `${adapter.name} ${sameApp + 1}` : adapter.name);
  return {
    id: `${adapter.id}-${crypto.randomBytes(4).toString('hex')}`,
    adapter: adapter.id,
    name,
    url: opts.url || undefined,
    color: opts.color || COLORS.find((c) => !used.has(c)) || COLORS[existing.length % COLORS.length],
    skin: 'avatar',
    hidden: false,
    group: 'personal',
    sleepMode: adapter.sleepMode || 'always',
    sleepEvery: 10,
    idleMinutes: 15,
    schedule: { ...DEFAULT_SCHEDULE },
    sound: 'chime',
    soundFile: null,
    preview: true,
    muteNative: true,
    createdAt: Date.now(),
  };
}

function createStore(file) {
  let data = withDefaults(null, DEFAULTS);
  try {
    data = withDefaults(JSON.parse(fs.readFileSync(file, 'utf8')), DEFAULTS);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // Keep the broken file for the user instead of silently overwriting it.
      try {
        fs.copyFileSync(file, file + '.broken-' + Date.now());
      } catch {}
    }
  }
  let timer = null;

  const writeNow = () => {
    clearTimeout(timer);
    timer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };

  const api = {
    file,
    get data() {
      return data;
    },
    get settings() {
      return data.settings;
    },
    accounts: () => data.accounts,
    account: (id) => data.accounts.find((a) => a.id === id),
    save() {
      clearTimeout(timer);
      timer = setTimeout(writeNow, 300);
    },
    flush() {
      if (timer) writeNow();
    },
    setSetting(key, value) {
      data.settings[key] = value;
      api.save();
    },
    addAccount(acc) {
      data.accounts.push(acc);
      api.save();
      return acc;
    },
    updateAccount(id, patch) {
      const a = api.account(id);
      if (!a) return null;
      for (const [k, v] of Object.entries(patch)) {
        a[k] = isObj(v) && isObj(a[k]) ? { ...a[k], ...v } : v;
      }
      api.save();
      return a;
    },
    removeAccount(id) {
      data.accounts = data.accounts.filter((a) => a.id !== id);
      api.save();
    },
    moveAccount(id, toIndex) {
      const i = data.accounts.findIndex((a) => a.id === id);
      if (i < 0) return;
      const [a] = data.accounts.splice(i, 1);
      data.accounts.splice(Math.max(0, Math.min(toIndex, data.accounts.length)), 0, a);
      api.save();
    },
  };
  return api;
}

module.exports = { DEFAULTS, COLORS, SOUNDS, SKINS, withDefaults, newAccount, createStore };
