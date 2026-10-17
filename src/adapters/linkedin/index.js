'use strict';
const { defineAdapter } = require('../common');
const selectors = require('./selectors');

// Title format: "(3) Messaging | LinkedIn".
module.exports = defineAdapter({
  id: 'linkedin',
  name: 'LinkedIn',
  tier: 2,
  url: 'https://www.linkedin.com/messaging/',
  allowedHosts: ['linkedin.com', 'licdn.com'],
  loginHint: 'password',
  color: '#0A66C2',
  size: { width: 900, height: 680 },
  // Monochrome glyph (letter mark, no logo).
  icon: { text: 'in' },
  selectors,
});
