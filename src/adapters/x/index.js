'use strict';
const { defineAdapter, SSO } = require('../common');
const selectors = require('./selectors');

// Title format: "(1) Messages / X". The number includes notifications, not only DMs.
module.exports = defineAdapter({
  id: 'x',
  name: 'X (Twitter) DMs',
  tier: 2,
  url: 'https://x.com/messages',
  allowedHosts: ['x.com', 'twitter.com', 'twimg.com', ...SSO.google, ...SSO.apple],
  loginHint: 'password',
  color: '#000000',
  // Monochrome glyph from simple-icons (CC0), used only to identify the service.
  icon: { viewBox: '0 0 24 24', path: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z' },
  selectors,
});
