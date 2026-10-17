'use strict';
// Account sleep: an asleep account has no WebContentsView (≈0 MB). Its login
// stays in the partition. Every N minutes it wakes for PEEK_MS to refresh the
// unread count. Pure functions, no Electron.

const PEEK_MS = 60 * 1000;
const MODES = ['always', 'idle', 'schedule'];

/**
 * @param account {sleepMode, sleepEvery (min), idleMinutes}
 * @param st      runtime state {popupOpen, peekUntil, manualSleep, scheduleActive, lastUsedAt}
 */
function desiredAwake(account, st, now) {
  if (st.popupOpen) return true;
  if (st.peekUntil && now < st.peekUntil) return true;
  if (st.manualSleep) return false;
  const mode = account.sleepMode || 'always';
  if (mode === 'always') return true;
  if (mode === 'schedule' && st.scheduleActive) return true;
  const idleMs = (account.idleMinutes ?? 15) * 60 * 1000;
  return !!st.lastUsedAt && now - st.lastUsedAt < idleMs;
}

/** When should a sleeping account next wake up to peek at its unread count? */
function nextWake(account, st, now) {
  const every = Math.max(1, account.sleepEvery ?? 10) * 60 * 1000;
  const last = Math.max(st.lastPeekAt || 0, st.sleptAt || 0) || now;
  return Math.max(now, last + every);
}

/** Should we start a peek now? Only for asleep accounts. */
function shouldPeek(account, st, now) {
  if (st.awake) return false;
  return now >= nextWake(account, st, now);
}

/** Order in which accounts are loaded at startup, STAGGER_MS apart. Sleeping ones are skipped. */
const STAGGER_MS = 3000;
function bootPlan(accounts, stateOf, now) {
  const out = [];
  for (const a of accounts) {
    if (desiredAwake(a, stateOf(a), now)) out.push({ id: a.id, at: out.length * STAGGER_MS });
  }
  return out;
}

module.exports = { PEEK_MS, MODES, STAGGER_MS, desiredAwake, nextWake, shouldPeek, bootPlan };
