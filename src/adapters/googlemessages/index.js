'use strict';
const { defineAdapter, SSO } = require('../common');
const selectors = require('./selectors');

// Title format: Pairs with an Android phone by QR. Title shows "(2) Messages" in some versions; unread conversations are bold in the list.
module.exports = defineAdapter({
  id: 'googlemessages',
  name: 'Google Messages',
  tier: 2,
  url: 'https://messages.google.com/web/',
  allowedHosts: ['messages.google.com', ...SSO.google],
  loginHint: 'qr',
  color: '#1A73E8',
  // Monochrome glyph from simple-icons (CC0), used only to identify the service.
  icon: { viewBox: '0 0 24 24', path: 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zM4.911 7.089h11.456a2.197 2.197 0 0 1 2.165 2.19v5.863a2.213 2.213 0 0 1-2.177 2.178H8.04c-1.174 0-2.04-.99-2.04-2.178v-4.639L4.503 7.905c-.31-.42-.05-.816.408-.816zm3.415 2.19c-.347 0-.68.21-.68.544 0 .334.333.544.68.544h7.905c.346 0 .68-.21.68-.544 0-.334-.334-.545-.68-.545zm0 2.177c-.347 0-.68.21-.68.544 0 .334.333.544.68.544h7.905c.346 0 .68-.21.68-.544 0-.334-.334-.544-.68-.544zm-.013 2.19c-.346 0-.68.21-.68.544 0 .334.334.544.68.544h5.728c.347 0 .68-.21.68-.544 0-.334-.333-.545-.68-.545z' },
  selectors,
});
