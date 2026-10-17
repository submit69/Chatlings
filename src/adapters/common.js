'use strict';
// Shared helpers for adapters. Everything here is plain JS with no Electron
// dependency so it can be unit-tested with node:test.

// Title patterns, tried in order. Most web chats prefix the tab title with
// "(N) ". Some use "[N]" or put the number at the end.
const COUNT_PATTERNS = [/^\s*\((\d+)\+?\)/, /^\s*\[(\d+)\+?\]/, /\((\d+)\+?\)\s*$/, /\[(\d+)\+?\]\s*$/];
// A leading bullet, star or bang usually means "something unread, no count".
const DOT_PATTERN = /^\s*[•●*!]\s*/;

/**
 * Generic title parser.
 * @returns {{count:number|null, dot:boolean}}
 */
function parseTitle(title, patterns = COUNT_PATTERNS) {
  const t = String(title || '');
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      return { count: n, dot: n > 0 };
    }
  }
  return { count: null, dot: DOT_PATTERN.test(t) };
}

/**
 * Runs inside the chat page (isolated world), so it must be self-contained:
 * no closures, only its argument. Sums the numbers in every element matching
 * `sel.unreadBadge`. Badges without a number count as 1.
 * Returns null when no badge selector matched anything (means "don't know").
 */
function countBadges(sel) {
  if (!sel || !sel.unreadBadge) return null;
  const nodes = document.querySelectorAll(sel.unreadBadge);
  if (!nodes.length) return sel.zeroWhen && document.querySelector(sel.zeroWhen) ? 0 : null;
  let total = 0;
  for (const n of nodes) {
    if (n.offsetParent === null && getComputedStyle(n).position !== 'fixed') continue;
    const m = (n.textContent || '').replace(/\s/g, '').match(/(\d+)/);
    total += m ? parseInt(m[1], 10) : 1;
  }
  return total;
}

/** Runs inside the page. Finds the logged-in user's display name and avatar. */
function readProfile(sel) {
  if (!sel) return null;
  const out = {};
  if (sel.profileName) {
    const el = document.querySelector(sel.profileName);
    const v = el && (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    if (v) out.name = v.slice(0, 60);
  }
  if (sel.profileAvatar) {
    const el = document.querySelector(sel.profileAvatar);
    const src = el && (el.currentSrc || el.src || el.getAttribute('href') || el.getAttribute('xlink:href'));
    if (src && /^(https?:|data:image\/)/.test(src)) out.avatar = src;
  }
  return out.name || out.avatar ? out : null;
}

function hostMatches(host, allowed) {
  host = String(host || '').toLowerCase();
  return allowed.some((h) => host === h || host.endsWith('.' + h));
}

function isAllowedUrl(url, allowedHosts) {
  try {
    const u = new URL(url);
    if (u.protocol === 'about:' || u.protocol === 'blob:' || u.protocol === 'data:') return true;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return hostMatches(u.hostname, allowedHosts);
  } catch {
    return false;
  }
}

// Hosts used by single-sign-on flows. Only adapters that need them list them.
const SSO = {
  google: ['accounts.google.com', 'accounts.youtube.com', 'gstatic.com', 'googleusercontent.com'],
  microsoft: ['login.microsoftonline.com', 'login.live.com', 'login.microsoft.com', 'account.live.com', 'msauth.net', 'msftauth.net', 'live.com'],
  apple: ['appleid.apple.com'],
  meta: ['facebook.com', 'fbcdn.net', 'fbsbx.com'],
};

/** Builds an adapter object with defaults filled in. */
function defineAdapter(def) {
  const selectors = def.selectors || {};
  const patterns = def.titlePatterns;
  return {
    tier: 1,
    size: { width: 420, height: 680 },
    sleepMode: def.tier === 2 ? 'idle' : 'always',
    loginHint: 'qr',
    ...def,
    selectors,
    parseUnread: def.parseUnread || ((title) => parseTitle(title, patterns)),
    unreadFromDom: def.unreadFromDom || countBadges,
    profileFromDom: def.profileFromDom || readProfile,
  };
}

module.exports = { parseTitle, countBadges, readProfile, hostMatches, isAllowedUrl, defineAdapter, SSO, COUNT_PATTERNS };
