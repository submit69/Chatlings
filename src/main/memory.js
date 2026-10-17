'use strict';
// RAM watch. Web chats running for days tend to leak; when an account grows
// past the threshold while its popup is hidden, reload it quietly. The unread
// count lives on the server, so nothing is lost.

const CHECK_MS = 5 * 60 * 1000;
const RELOAD_COOLDOWN_MS = 30 * 60 * 1000;

function shouldReload({ mb, thresholdMB, popupVisible, lastReloadAt, now }) {
  if (!thresholdMB || thresholdMB <= 0) return false;
  if (popupVisible) return false;
  if (lastReloadAt && now - lastReloadAt < RELOAD_COOLDOWN_MS) return false;
  return mb > thresholdMB;
}

/**
 * Private memory of a process in KB. On Windows this is what Task Manager's
 * "Memory" column shows; the working set double-counts shared pages.
 */
function kb(m) {
  if (!m.memory) return 0;
  return m.memory.privateBytes || m.memory.workingSetSize || 0;
}

/**
 * Splits app.getAppMetrics() into per-account and "frame" (Bongbong itself).
 * @param metrics  Electron ProcessMetric[] (memory sizes in KB)
 * @param pidToAccount Map<pid, accountId>
 */
function summarize(metrics, pidToAccount) {
  const accounts = {};
  let frame = 0;
  let total = 0;
  for (const m of metrics) {
    const mb = kb(m) / 1024;
    total += mb;
    const id = pidToAccount.get(m.pid);
    if (id) accounts[id] = (accounts[id] || 0) + mb;
    else frame += mb;
  }
  const round = (v) => Math.round(v);
  for (const k of Object.keys(accounts)) accounts[k] = round(accounts[k]);
  return { accounts, frameMB: round(frame), totalMB: round(total) };
}

/**
 * @param opts.app Electron app
 * @param opts.accounts AccountManager (pidMap(), isShowing(id), reload(id), lastReloadAt(id))
 * @param opts.getThreshold () => MB
 */
function createMemoryWatch({ app, accounts, getThreshold }) {
  let last = { accounts: {}, frameMB: 0, totalMB: 0, at: 0 };
  let timer = null;
  const api = {
    sample() {
      last = { ...summarize(app.getAppMetrics(), accounts.pidMap()), at: Date.now() };
      return last;
    },
    last: () => last,
    check() {
      const s = api.sample();
      const now = Date.now();
      for (const [id, mb] of Object.entries(s.accounts)) {
        if (shouldReload({ mb, thresholdMB: getThreshold(), popupVisible: accounts.isShowing(id), lastReloadAt: accounts.lastReloadAt(id), now })) {
          accounts.reload(id, { quiet: true });
        }
      }
      return s;
    },
    start() {
      timer = setInterval(() => api.check(), CHECK_MS);
    },
    stop() {
      clearInterval(timer);
    },
  };
  return api;
}

module.exports = { CHECK_MS, RELOAD_COOLDOWN_MS, kb, shouldReload, summarize, createMemoryWatch };
