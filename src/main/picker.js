'use strict';
// Small framed windows for Chatlings' own pages: the "add account" picker and
// Settings. One instance each.
const path = require('path');
const { BrowserWindow } = require('electron');

const open = new Map();

function openPage(name, file, { width, height, title, query, protect }) {
  const existing = open.get(name);
  if (existing && !existing.isDestroyed()) {
    if (query) existing.webContents.send('settings:refresh', query);
    existing.show();
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 480,
    minHeight: 420,
    show: false,
    title,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'bubble-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.setMenu(null);
  if (protect) protect(win);
  win.loadFile(path.join(__dirname, '..', 'renderer', file), { query: query || {} });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => open.delete(name));
  open.set(name, win);
  return win;
}

function openPicker(opts) {
  return openPage('picker', 'picker.html', { width: 720, height: 640, ...opts });
}

function openSettings(opts) {
  return openPage('settings', 'settings.html', { width: 860, height: 680, ...opts });
}

function closePage(name) {
  const w = open.get(name);
  if (w && !w.isDestroyed()) w.close();
}

function sendTo(name, ch, data) {
  const w = open.get(name);
  if (w && !w.isDestroyed()) w.webContents.send(ch, data);
}

function windows() {
  return [...open.values()].filter((w) => !w.isDestroyed());
}

module.exports = { openPicker, openSettings, closePage, sendTo, windows };
