'use strict';
const { defineAdapter, SSO } = require('../common');
const selectors = require('./selectors');

// Title format: "Chat (3) - name@gmail.com - Gmail" style; the count is not at the start, so a custom pattern is used.
module.exports = defineAdapter({
  id: 'googlechat',
  name: 'Google Chat',
  tier: 2,
  url: 'https://mail.google.com/chat/',
  // Google sometimes refuses sign-in inside embedded browsers ("This browser or app
  // may not be secure"). If that happens, see FAQ in README.
  allowedHosts: ['mail.google.com', 'chat.google.com', 'google.com', ...SSO.google],
  loginHint: 'password',
  color: '#00AC47',
  titlePatterns: [/^\s*\((\d+)\)/, /Chat \((\d+)\)/i, /\((\d+)\)/],
  // Monochrome glyph from simple-icons (CC0), used only to identify the service.
  icon: { viewBox: '0 0 24 24', path: 'M1.637 0C.733 0 0 .733 0 1.637v16.5c0 .904.733 1.636 1.637 1.636h3.955v3.323c0 .804.97 1.207 1.539.638l3.963-3.96h11.27c.903 0 1.636-.733 1.636-1.637V5.592L18.408 0Zm3.955 5.592h12.816v8.59H8.455l-2.863 2.863Z' },
  selectors,
});
