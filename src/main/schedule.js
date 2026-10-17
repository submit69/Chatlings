'use strict';
// Working hours / do-not-disturb. Pure functions, no Electron.

const DEFAULT_SCHEDULE = { enabled: false, days: [1, 2, 3, 4, 5], from: '08:00', to: '17:30', outside: 'mute' };

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 24 || min > 59) return null;
  return Math.min(h * 60 + min, 24 * 60);
}

/**
 * Is `now` inside the schedule window?
 * - days: 0 = Sunday ... 6 = Saturday, the day the window STARTS on.
 * - from > to means the window runs past midnight (22:00 → 06:00): the part
 *   after midnight belongs to the previous day's window.
 * - from == to means the whole day.
 * A disabled or missing schedule is always active.
 */
function isActive(schedule, now = new Date()) {
  if (!schedule || !schedule.enabled) return true;
  const days = Array.isArray(schedule.days) ? schedule.days : [];
  const from = toMinutes(schedule.from);
  const to = toMinutes(schedule.to);
  if (from === null || to === null) return true;
  const d = now.getDay();
  const t = now.getHours() * 60 + now.getMinutes();
  if (from === to) return days.includes(d);
  if (from < to) return days.includes(d) && t >= from && t < to;
  const prev = (d + 6) % 7;
  return (days.includes(d) && t >= from) || (days.includes(prev) && t < to);
}

/**
 * What an account should do right now.
 * @returns {{visible:boolean, muted:boolean, reason:string|null}}
 *   muted = no sound and no preview card.
 */
function accountMode(account, ctx = {}, now = new Date()) {
  const groups = ctx.groups || {};
  const group = groups[account.group];
  if (group && group.enabled === false) return { visible: false, muted: true, reason: 'group' };
  if (!isActive(account.schedule, now)) {
    const outside = (account.schedule && account.schedule.outside) || 'mute';
    if (outside === 'hide') return { visible: false, muted: true, reason: 'schedule' };
    if (outside === 'mute') return { visible: true, muted: true, reason: 'schedule' };
  }
  if (ctx.dndUntil && now.getTime() < ctx.dndUntil) return { visible: true, muted: true, reason: 'dnd' };
  return { visible: true, muted: false, reason: null };
}

/** Timestamp for "do not disturb until tomorrow morning" (default 08:00). */
function tomorrowMorning(now = new Date(), hour = 8) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

module.exports = { DEFAULT_SCHEDULE, toMinutes, isActive, accountMode, tomorrowMorning };
