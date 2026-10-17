'use strict';
// The one shared chat popup (BaseWindow). Every awake account's
// WebContentsView is a hidden child; clicking a bubble makes that one visible.
// A small bar on top (our own page) holds name, pin, reload and close.
// The PIN lock screen is another view laid over the chat.
const path = require('path');
const { BaseWindow, WebContentsView } = require('electron');

const BAR_H = 36;
const RENDERER = path.join(__dirname, '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', 'preload', 'bubble-preload.js');

function ownView(file) {
  const v = new WebContentsView({
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  v.setBackgroundColor('#00000000');
  v.webContents.loadFile(path.join(RENDERER, file));
  return v;
}

function createPopup({ onShown, onHidden, isPinned, setPinned, onBarAction }) {
  const win = new BaseWindow({
    width: 420,
    height: 680,
    minWidth: 320,
    minHeight: 420,
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#ffffff',
    title: 'Bongbong',
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');

  // Created on first use: each of our own pages is a renderer process (~20 MB).
  let bar = null;
  let lockView = null;
  const views = new Set();
  let current = null; // {id, view}
  let showingLock = false;
  let lastHiddenAt = 0;
  let hideTimer = null;

  function chatBounds() {
    const [w, h] = win.getContentSize();
    return { x: 0, y: BAR_H, width: w, height: h - BAR_H };
  }

  // Every chat view gets the real size even while hidden: a page laid out at
  // 0×0 may switch to a mobile layout and hide the very badges we count.
  function layout() {
    const [w] = win.getContentSize();
    const b = chatBounds();
    if (bar) bar.setBounds({ x: 0, y: 0, width: w, height: BAR_H });
    for (const v of views) v.setBounds(b);
    if (lockView) lockView.setBounds(b);
  }
  win.on('resize', layout);

  win.on('blur', () => {
    if (isPinned()) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!win.isFocused() && !isPinned()) api.hide();
    }, 120);
  });
  win.on('focus', () => clearTimeout(hideTimer));

  function ensureBar() {
    if (!bar) {
      bar = ownView('popup-bar.html');
      win.contentView.addChildView(bar, 0);
    }
    return bar;
  }

  function sendBar(account, adapter) {
    ensureBar();
    if (bar.webContents.isLoading()) {
      bar.webContents.once('did-finish-load', () => sendBar(account, adapter));
      return;
    }
    bar.webContents.send('bar:state', {
      id: account.id,
      name: account.name,
      color: account.color,
      adapter: adapter ? { id: adapter.id, name: adapter.name, icon: adapter.icon, color: adapter.color } : null,
      pinned: isPinned(),
      locked: showingLock,
    });
  }

  const api = {
    win,
    BAR_H,
    adopt(view) {
      views.add(view);
      view.setVisible(false);
      view.setBounds(chatBounds());
      win.contentView.addChildView(view, bar ? 1 : 0);
    },
    release(view) {
      views.delete(view);
      if (current && current.view === view) current.view = null;
      try {
        win.contentView.removeChildView(view);
      } catch {}
    },
    isVisible: () => !win.isDestroyed() && win.isVisible(),
    currentId: () => (current ? current.id : null),
    /** True when the popup is on screen showing this account's chat (not the lock screen). */
    isShowing: (id) => !win.isDestroyed() && win.isVisible() && !showingLock && !!current && current.id === id,
    recentlyHidden: () => Date.now() - lastHiddenAt < 250,
    /**
     * @param opts {id, view, account, adapter, bounds, locked}
     */
    show({ id, view, account, adapter, bounds, locked }) {
      clearTimeout(hideTimer);
      for (const v of views) if (v !== view) v.setVisible(false);
      current = { id, view };
      showingLock = !!locked;
      if (view) view.setVisible(!locked);
      if (locked) {
        if (!lockView) {
          lockView = ownView('lock.html');
          win.contentView.addChildView(lockView);
        }
        lockView.setVisible(true);
        lockView.webContents.send('lock:state', { reset: true });
      } else if (lockView) {
        lockView.setVisible(false);
      }
      if (bounds) win.setBounds(bounds);
      layout();
      sendBar(account, adapter);
      const wasVisible = win.isVisible();
      win.show();
      win.focus();
      if (locked && lockView) lockView.webContents.focus();
      else if (view) view.webContents.focus();
      // Behind the lock screen nothing has been seen yet; unlocked() reports it.
      if (!locked) onShown(id, wasVisible);
    },
    hide() {
      if (win.isDestroyed() || !win.isVisible()) return;
      const id = current && current.id;
      win.hide();
      lastHiddenAt = Date.now();
      onHidden(id);
    },
    setPinned(v) {
      setPinned(v);
      if (bar) bar.webContents.send('bar:state', { pinned: v });
    },
    refreshBar(account, adapter) {
      if (current && account && current.id === account.id) sendBar(account, adapter);
    },
    unlocked() {
      if (!showingLock) return;
      showingLock = false;
      if (lockView) lockView.setVisible(false);
      if (current && current.view) {
        current.view.setVisible(true);
        current.view.webContents.focus();
      }
      if (current) onShown(current.id, true);
    },
    lockNow() {
      if (win.isVisible()) api.hide();
    },
    barAction(action) {
      onBarAction(action, current && current.id);
    },
    windows: () => [win],
  };
  return api;
}

module.exports = { createPopup, BAR_H };
