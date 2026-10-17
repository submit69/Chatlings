'use strict';
// Per-account notification sound. Bongbong blocks the site's own Notification
// and plays its own sound instead; the dock renderer synthesises it with
// WebAudio (or plays the user's file). Do-not-disturb, schedule and the PIN
// lock are checked first.
const fs = require('fs');

const THROTTLE_MS = 2500;

/**
 * @returns {null | {sound:string, file?:string}}
 */
function pickSound(account, { muted, locked }) {
  if (muted) return null;
  const s = account.sound || 'chime';
  if (s === 'none') return null;
  // While locked, play a neutral sound so it does not reveal which account it was.
  if (locked) return { sound: 'pop' };
  if (s === 'file') return account.soundFile ? { sound: 'file', file: account.soundFile } : { sound: 'chime' };
  return { sound: s };
}

function createSound({ send }) {
  const last = new Map();
  const cache = new Map();
  return {
    play(account, ctx, now = Date.now()) {
      const p = pickSound(account, ctx);
      if (!p) return false;
      if (now - (last.get(account.id) || 0) < THROTTLE_MS) return false;
      last.set(account.id, now);
      if (p.sound === 'file') {
        try {
          if (!cache.has(p.file)) cache.set(p.file, fs.readFileSync(p.file));
          send({ sound: 'file', data: cache.get(p.file) });
        } catch {
          send({ sound: 'chime' });
        }
      } else {
        send(p);
      }
      return true;
    },
    test(account) {
      last.delete(account.id);
      return this.play(account, { muted: false, locked: false });
    },
    forget(file) {
      cache.delete(file);
    },
  };
}

module.exports = { pickSound, createSound, THROTTLE_MS };
