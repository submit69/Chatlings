'use strict';
// Adapter registry. To add an app: create src/adapters/<id>/{index,selectors}.js
// and add the id below. See CONTRIBUTING.md.
const path = require('path');
const { pathToFileURL } = require('url');

const IDS = [
  // Tier 1: unread from title + DOM, profile name/avatar.
  'zalo', 'messenger', 'telegram', 'whatsapp', 'discord',
  // Tier 2 (beta): unread from title/badge only.
  'slack', 'teams', 'teams-live', 'googlechat', 'googlemessages', 'instagram', 'x', 'linkedin', 'element',
  // Anything else.
  'custom',
];

const adapters = new Map(IDS.map((id) => [id, require('./' + id)]));

// Selectors used by test/fake-chat.html, so the DOM tier can be tested.
const FAKE_SELECTORS = { unreadBadge: '.fake-badge', profileName: '#fake-name', profileAvatar: '#fake-avatar' };

function isFake() {
  return process.env.BONGBONG_FAKE === '1';
}

function get(id) {
  return adapters.get(id) || adapters.get('custom');
}

function list() {
  return [...adapters.values()];
}

/**
 * Everything the app needs to run one account: URL, allowed hosts, selectors.
 * Applies the custom URL and BONGBONG_FAKE overrides in one place.
 */
function resolve(account) {
  const a = get(account.adapter);
  let url = a.url;
  let allowedHosts = a.allowedHosts;
  if (a.id === 'custom') {
    url = account.url || '';
    allowedHosts = a.hostsFor(url);
  }
  let selectors = a.selectors;
  if (isFake()) {
    const file = path.join(__dirname, '..', '..', 'test', 'fake-chat.html');
    const u = pathToFileURL(file);
    u.searchParams.set('id', account.id);
    u.searchParams.set('adapter', a.id);
    if (account.fakeMode) u.searchParams.set('mode', account.fakeMode);
    url = u.href;
    selectors = FAKE_SELECTORS;
  }
  return { adapter: a, url, allowedHosts, selectors, fake: isFake() };
}

module.exports = { IDS, get, list, resolve, FAKE_SELECTORS, isFake };
