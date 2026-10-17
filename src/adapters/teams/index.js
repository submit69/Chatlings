'use strict';
const { defineAdapter, SSO } = require('../common');
const selectors = require('./selectors');

// Title format: "(3) Chat | Microsoft Teams".
module.exports = defineAdapter({
  id: 'teams',
  name: 'Microsoft Teams (work)',
  tier: 2,
  url: 'https://teams.microsoft.com/v2/',
  allowedHosts: ['teams.microsoft.com', 'teams.cloud.microsoft', 'cloud.microsoft', 'office.com', 'office.net', 'microsoft.com', 'skype.com', ...SSO.microsoft],
  loginHint: 'password',
  color: '#5059C9',
  size: { width: 900, height: 680 },
  // Monochrome glyph (letter mark, no logo).
  icon: { text: 'T' },
  selectors,
});
