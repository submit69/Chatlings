'use strict';
// PIN lock. It only stops people sharing this PC from opening the chats.
// It does NOT encrypt the login data stored in the partitions.
const crypto = require('crypto');

const MAX_TRIES = 5;
const COOLDOWN_MS = 30 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1 };

function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32, SCRYPT).toString('hex');
  return { salt, hash };
}

function verifyPin(pin, rec) {
  if (!rec || !rec.salt || !rec.hash) return false;
  const a = Buffer.from(hashPin(pin, rec.salt).hash, 'hex');
  const b = Buffer.from(rec.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- attempt limiting (pure) ---
function newAttempts() {
  return { fails: 0, until: 0 };
}

function canTry(st, now) {
  if (st.until && now < st.until) return { ok: false, waitMs: st.until - now };
  return { ok: true, waitMs: 0 };
}

function recordFailure(st, now) {
  const fails = st.until && now >= st.until ? 1 : st.fails + 1;
  if (fails >= MAX_TRIES) return { fails: 0, until: now + COOLDOWN_MS };
  return { fails, until: 0 };
}

function shouldAutoLock(idleSeconds, minutes) {
  return minutes > 0 && idleSeconds >= minutes * 60;
}

/**
 * Runtime lock controller.
 * @param opts.getRecord () => {salt, hash} | null
 * @param opts.onChange (locked) => void
 */
function createLock({ getRecord, getAutoLockMinutes, getLockOnScreenLock, powerMonitor, onChange }) {
  let locked = !!getRecord();
  let attempts = newAttempts();
  let timer = null;

  const set = (v) => {
    if (locked === v) return;
    locked = v;
    onChange(locked);
  };

  const api = {
    isEnabled: () => !!getRecord(),
    isLocked: () => locked && !!getRecord(),
    lock() {
      if (getRecord()) set(true);
    },
    /** @returns {{ok:boolean, waitMs?:number, left?:number}} */
    unlock(pin, now = Date.now()) {
      const c = canTry(attempts, now);
      if (!c.ok) return { ok: false, waitMs: c.waitMs };
      if (verifyPin(pin, getRecord())) {
        attempts = newAttempts();
        set(false);
        return { ok: true };
      }
      attempts = recordFailure(attempts, now);
      const w = canTry(attempts, now);
      return { ok: false, waitMs: w.waitMs, left: w.ok ? MAX_TRIES - attempts.fails : 0 };
    },
    start() {
      if (powerMonitor) {
        powerMonitor.on('lock-screen', () => getLockOnScreenLock() && api.lock());
        timer = setInterval(() => {
          if (!locked && shouldAutoLock(powerMonitor.getSystemIdleTime(), getAutoLockMinutes())) api.lock();
        }, 15000);
      }
    },
    stop() {
      clearInterval(timer);
    },
  };
  return api;
}

module.exports = { MAX_TRIES, COOLDOWN_MS, validPin, hashPin, verifyPin, newAttempts, canTry, recordFailure, shouldAutoLock, createLock };
