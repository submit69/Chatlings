'use strict';
const { defineAdapter, SSO } = require('../common');
const selectors = require('./selectors');

// Title format: "(3) Chat | Microsoft Teams". Personal accounts sign in through login.live.com.
module.exports = defineAdapter({
  id: 'teams-live',
  name: 'Microsoft Teams (personal)',
  tier: 2,
  url: 'https://teams.live.com/v2/',
  allowedHosts: ['teams.live.com', 'teams.microsoft.com', 'skype.com', 'microsoft.com', ...SSO.microsoft],
  loginHint: 'password',
  color: '#7B83EB',
  size: { width: 900, height: 680 },
  // Monochrome glyph (letter mark, no logo).
  icon: { text: 'T' },
  selectors,
});
