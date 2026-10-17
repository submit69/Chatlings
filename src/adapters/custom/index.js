'use strict';
const { defineAdapter } = require('../common');
const selectors = require('./selectors');

// Any web chat: the user types a name and a URL. Unread is read from the
// title with the generic "(N)" / "[N]" patterns, plus favicon/notification dots.
module.exports = defineAdapter({
  id: 'custom',
  name: 'Custom',
  tier: 3,
  url: '',
  allowedHosts: [],
  loginHint: 'password',
  color: '#64748B',
  sleepMode: 'always',
  icon: { text: '+' },
  selectors,
});

// Hosts a custom account may navigate to: the URL's own registrable-ish domain
// (last two labels, or three for things like example.com.vn).
module.exports.hostsFor = function hostsFor(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return [];
  }
  const parts = host.split('.');
  const twoLevelTld = /^(com|net|org|edu|gov|co|ac)$/.test(parts[parts.length - 2] || '') && parts.length > 2;
  const keep = twoLevelTld ? 3 : 2;
  return [parts.slice(-keep).join('.')];
};
