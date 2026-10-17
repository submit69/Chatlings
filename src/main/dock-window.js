'use strict';
// The bubble dock: one transparent, frameless, always-on-top window that
// draws every account's bubble. Transparent parts let clicks through
// (setIgnoreMouseEvents with forward), toggled by the renderer on hover.
const path = require('path');
const { BrowserWindow, screen } = require('electron');
const layout = require('./layout');

function createDock({ store, onReady }) {
  const win = new BrowserWindow({
    width: layout.COLUMN_W,
    height: layout.columnHeight(1),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    title: 'Bongbong',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'bubble-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'dock.html'));
  win.webContents.once('did-finish-load', () => onReady && onReady());

  let size = { count: 1, previewHeight: 0, previewIndex: 0 };
  let dragging = false;
  let wantVisible = true;

  // Some full-screen apps push themselves above "always on top" windows.
  const topTimer = setInterval(() => {
    if (!win.isDestroyed() && win.isVisible() && !dragging) win.moveTop();
  }, 10000);
  win.on('closed', () => clearInterval(topTimer));

  function display() {
    const pos = store.data.dock;
    const all = screen.getAllDisplays();
    return all.find((d) => d.id === pos.displayId) || screen.getPrimaryDisplay();
  }

  function relayout() {
    if (win.isDestroyed() || dragging) return;
    const s = layout.dockSize(size.count, size);
    const b = layout.dockBounds(store.data.dock, s, display().workArea);
    win.setBounds(b);
  }

  for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(ev, () => relayout());

  const api = {
    win,
    edge: () => store.data.dock.edge,
    bounds: () => win.getBounds(),
    relayout,
    setSize(next) {
      size = { ...size, ...next };
      relayout();
    },
    setHover(on) {
      if (!win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true });
    },
    dragStart() {
      dragging = true;
      return win.getBounds();
    },
    dragMove({ x, y }) {
      if (!dragging || win.isDestroyed()) return;
      const b = win.getBounds();
      win.setBounds({ x: Math.round(x), y: Math.round(y), width: b.width, height: b.height });
    },
    dragEnd() {
      if (!dragging) return;
      dragging = false;
      const b = win.getBounds();
      const d = screen.getDisplayMatching(b);
      const snap = layout.snapToEdge(b, d.workArea);
      store.data.dock = { edge: snap.edge, y: snap.y, displayId: d.id };
      store.save();
      relayout();
      api.send('bb:state', { edge: snap.edge });
    },
    /** Screen Y of a bubble given its offset inside the dock. */
    screenY: (top) => win.getBounds().y + top,
    setVisible(v) {
      wantVisible = v;
      if (win.isDestroyed()) return;
      if (v) win.showInactive();
      else win.hide();
    },
    isVisible: () => wantVisible,
    send(ch, data) {
      if (!win.isDestroyed()) win.webContents.send(ch, data);
    },
    windows: () => [win],
  };
  relayout();
  return api;
}

module.exports = { createDock };
