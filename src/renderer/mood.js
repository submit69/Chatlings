// Pet mood from the account's activity. Pure; runs in the dock renderer and in
// node:test (loaded with require()).
(function (root) {
  'use strict';
  const MIN = 60 * 1000;
  const EXCITED_MS = 60 * 1000; // a message arrived less than a minute ago
  const HAPPY_WINDOW = 2 * MIN; // read within 2 minutes of arrival...
  const HAPPY_SHOW_MS = 10 * 1000; // ...shows hearts for 10 seconds
  const SAD_MS = 30 * MIN; // unread older than 30 minutes
  const SLEEPY_MS = 30 * MIN; // nothing happened for 30 minutes

  const MOODS = ['idle', 'excited', 'happy', 'sad', 'sleepy'];

  /**
   * @param s.unread          number (dots count as 1)
   * @param s.lastNewAt       time of the latest incoming message
   * @param s.oldestUnreadAt  when the current unread streak started
   * @param s.lastReadAt      when the user last opened the chat
   * @param s.lastReplyLatency ms between message arrival and the user opening it
   * @param s.asleep          account is sleeping (RAM saver)
   * @param s.lastActivityAt  latest of: message, open, hover
   */
  function mood(s, now) {
    if (s.asleep) return 'sleepy';
    if (s.unread > 0) {
      if (s.oldestUnreadAt && now - s.oldestUnreadAt > SAD_MS) return 'sad';
      // Jump for the first minute after a message, then wait calmly (badge stays).
      if (s.lastNewAt && now - s.lastNewAt < EXCITED_MS) return 'excited';
      return 'idle';
    }
    if (s.lastReadAt && now - s.lastReadAt < HAPPY_SHOW_MS && s.lastReplyLatency != null && s.lastReplyLatency <= HAPPY_WINDOW) return 'happy';
    const last = Math.max(s.lastActivityAt || 0, s.lastNewAt || 0, s.lastReadAt || 0);
    if (last && now - last > SLEEPY_MS) return 'sleepy';
    return 'idle';
  }

  /** Skins may not implement every mood; fall back to idle. */
  function pick(skin, m) {
    const supported = (skin && skin.moods) || MOODS;
    return supported.includes(m) ? m : 'idle';
  }

  const api = { mood, pick, MOODS, EXCITED_MS, SAD_MS, SLEEPY_MS, HAPPY_WINDOW, HAPPY_SHOW_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BBMood = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
