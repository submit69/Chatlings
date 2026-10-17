'use strict';
// Combines the three unread signals into one badge. Pure.
//   1. title count            "(3) WhatsApp"
//   2. DOM badges             adapter.unreadFromDom()
//   3. favicon change / new Notification since the user last looked → dot only

/**
 * @returns {{count:number|null, dot:boolean}} count null = unknown, show a dot if `dot`.
 */
function resolveUnread({ titleCount = null, titleDot = false, domCount = null, faviconChanged = false, notifiedSinceView = false }) {
  let count = null;
  if (titleCount !== null && titleCount !== undefined) count = titleCount;
  else if (domCount !== null && domCount !== undefined) count = domCount;
  const dot = (count !== null && count > 0) || titleDot || ((count === null || count === 0) && (faviconChanged || notifiedSinceView));
  return { count, dot: !!dot };
}

/** Total for the tray / merged bubble. Dots without a number count as 1. */
function total(states) {
  let n = 0;
  let any = false;
  for (const s of states) {
    if (s.count > 0) n += s.count;
    else if (s.dot) any = true;
  }
  return { count: n, dot: n > 0 || any };
}

function badgeText(state) {
  if (state.count > 0) return state.count > 99 ? '99+' : String(state.count);
  return '';
}

module.exports = { resolveUnread, total, badgeText };
