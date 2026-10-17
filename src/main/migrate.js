'use strict';
// The app used to be called Bongbong. Move its data (settings + the per-account
// browser profiles, i.e. the logins) into the new folder so nobody has to sign
// in again. Runs before the app is ready; no Electron dependency.
const fs = require('fs');
const path = require('path');

/**
 * @param oldDir  e.g. %APPDATA%\Bongbong
 * @param newDir  e.g. %APPDATA%\Chatlings
 * @returns {string[]} names of the entries that were moved
 */
function migrateFromBongbong(oldDir, newDir) {
  const moved = [];
  if (!fs.existsSync(oldDir) || path.resolve(oldDir) === path.resolve(newDir)) return moved;
  // Already migrated (or a fresh Chatlings profile with data): leave both alone.
  if (fs.existsSync(path.join(newDir, 'chatlings.json'))) return moved;
  fs.mkdirSync(newDir, { recursive: true });
  for (const name of fs.readdirSync(oldDir)) {
    const target = path.join(newDir, name === 'bongbong.json' ? 'chatlings.json' : name);
    if (fs.existsSync(target)) continue;
    try {
      fs.renameSync(path.join(oldDir, name), target);
      moved.push(name);
    } catch (e) {
      // Old app still running (files locked): keep going, the rest still helps.
      console.warn('[chatlings] could not move', name, e.code || e.message);
    }
  }
  try {
    if (!fs.readdirSync(oldDir).length) fs.rmdirSync(oldDir);
  } catch {}
  return moved;
}

module.exports = { migrateFromBongbong };
