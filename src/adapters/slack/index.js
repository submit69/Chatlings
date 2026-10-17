'use strict';
const { defineAdapter, SSO } = require('../common');
const selectors = require('./selectors');

// Title format: "! Slack | ..." for mentions and "* Slack | ..." for unread; both become a dot. No number in the title.
module.exports = defineAdapter({
  id: 'slack',
  name: 'Slack',
  tier: 2,
  url: 'https://app.slack.com/client',
  allowedHosts: ['slack.com', 'slack-edge.com', ...SSO.google, ...SSO.microsoft, ...SSO.apple],
  loginHint: 'password',
  color: '#4A154B',
  size: { width: 900, height: 680 },
  // Monochrome glyph (letter mark, no logo).
  icon: { text: 'S' },
  selectors,
});
