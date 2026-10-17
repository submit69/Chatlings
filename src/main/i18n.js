'use strict';
const path = require('path');
const fs = require('fs');

const LOCALES = ['en', 'vi'];
const dicts = {};
for (const l of LOCALES) dicts[l] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', l + '.json'), 'utf8'));

let current = 'en';

function pickLocale(setting, systemLocale) {
  if (LOCALES.includes(setting)) return setting;
  return String(systemLocale || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function setLocale(l) {
  current = LOCALES.includes(l) ? l : 'en';
}

function t(key, vars) {
  let s = dicts[current][key] ?? dicts.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return s;
}

module.exports = { LOCALES, dicts, pickLocale, setLocale, t, locale: () => current, dict: () => ({ ...dicts.en, ...dicts[current] }) };
