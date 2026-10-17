'use strict';
// The one shared chat window (BaseWindow). Every awake account's
// WebContentsView is a hidden child; the chosen one is made visible.
//
// Two modes on the same window (so chat views never change parent):
//  - compact: small popup next to the bubbles, always on top, hides on blur.
//  - full:    the "real app" window: account sidebar on the left, taskbar
//             button, minimise / maximise, stays open when you switch apps.
//
// Our own pages: a bar on top (name + buttons), the sidebar (full mode only)
// and the PIN lock screen laid over the chat.
const path = require('path');
const { BaseWindow, WebContentsView } = require('electron');

const BAR_H = 36;
const SIDEBAR_W = 72;
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

/**
 * @param opts.onShown(id)        the user can now see this account's chat
 * @param opts.onHidden(id)
 * @param opts.onWindowState()    focus / minimise / show / hide changed (dock visibility)
 * @param opts.isPinned / setPinned  compact mode "keep open"
 * @param opts.getFullBounds / setFullBounds  remembered size of the full window
 */
function createPopup({ onShown, onHidden, onWindowState, isPinned, setPinned, getFullBounds, setFullBounds }) {
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
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    backgroundColor: '#ffffff',
    title: 'Chatlings',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');

  // Created on first use: each of our own pages is a renderer process (~20 MB).
  let bar = null;
  let sidebar = null;
  let lockView = null;
  const views = new Set();
  let current = null; // {id, view}
  let mode = 'compact';
  let showingLock = false;
  let lastHiddenAt = 0;
  let hideTimer = null;
  let allowClose = false;
  let lastBar = null;

  const left = () => (mode === 'full' ? SIDEBAR_W : 0);

  function chatBounds() {
    const [w, h] = win.getContentSize();
    return { x: left(), y: BAR_H, width: Math.max(0, w - left()), height: Math.max(0, h - BAR_H) };
  }

  // Every chat view gets the real size even while hidden: a page laid out at
  // 0×0 may switch to a mobile layout and hide the very badges we count.
  function layout() {
    const [w, h] = win.getContentSize();
    const b = chatBounds();
    if (bar) bar.setBounds({ x: left(), y: 0, width: Math.max(0, w - left()), height: BAR_H });
    if (sidebar) {
      sidebar.setVisible(mode === 'full');
      sidebar.setBounds({ x: 0, y: 0, width: SIDEBAR_W, height: h });
    }
    for (const v of views) v.setBounds(b);
    if (lockView) lockView.setBounds(b);
  }
  win.on('resize', layout);

  win.on('blur', () => {
    onWindowState();
    if (mode === 'full' || isPinned()) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!win.isFocused() && !isPinned() && mode === 'compact') api.hide();
    }, 120);
  });
  win.on('focus', () => {
    clearTimeout(hideTimer);
    onWindowState();
    // Back in the full window: whatever it shows has now been seen.
    if (mode === 'full' && current && !showingLock) onShown(current.id);
  });
  for (const ev of ['minimize', 'restore', 'show', 'hide']) win.on(ev, () => onWindowState());
  for (const ev of ['maximize', 'unmaximize']) win.on(ev, () => sendBarMode());

  const saveFull = () => {
    if (mode !== 'full' || win.isMinimized()) return;
    if (win.isMaximized()) setFullBounds({ ...(getFullBounds() || {}), maximized: true });
    else setFullBounds({ ...win.getBounds(), maximized: false });
  };
  win.on('resized', saveFull);
  win.on('moved', saveFull);

  // Alt+F4 / ✕ on the full window: go back to bubbles, keep running.
  win.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    api.hide();
  });

  function ensureBar() {
    if (!bar) {
      bar = ownView('popup-bar.html');
      win.contentView.addChildView(bar);
    }
    return bar;
  }

  function ensureSidebar() {
    if (!sidebar) {
      sidebar = ownView('sidebar.html');
      win.contentView.addChildView(sidebar);
    }
    return sidebar;
  }

  function send(view, ch, data) {
    if (!view || view.webContents.isDestroyed()) return;
    if (view.webContents.isLoading()) view.webContents.once('did-finish-load', () => view.webContents.send(ch, data));
    else view.webContents.send(ch, data);
  }

  function sendBarMode() {
    if (bar) send(bar, 'bar:state', { mode, maximized: win.isMaximized(), pinned: isPinned() });
  }

  function sendBar(account, adapter) {
    ensureBar();
    lastBar = { account, adapter };
    send(bar, 'bar:state', {
      id: account.id,
      name: account.name,
      color: account.color,
      adapter: adapter ? { id: adapter.id, name: adapter.name, icon: adapter.icon, color: adapter.color } : null,
      pinned: isPinned(),
      locked: showingLock,
      mode,
      maximized: win.isMaximized(),
    });
  }

  function applyMode(next, bounds) {
    const changed = next !== mode;
    mode = next;
    if (mode === 'full') {
      ensureSidebar();
      win.setAlwaysOnTop(false);
      win.setSkipTaskbar(false);
      win.setMinimumSize(640, 480);
      if (changed || !win.isVisible()) {
        const fb = getFullBounds();
        if (win.isMaximized() && fb && !fb.maximized) win.unmaximize();
        if (bounds) win.setBounds(bounds);
        if (fb && fb.maximized) win.maximize();
      }
    } else {
      if (win.isMaximized()) win.unmaximize();
      if (win.isMinimized()) win.restore();
      win.setMinimumSize(320, 420);
      win.setAlwaysOnTop(true, 'pop-up-menu');
      win.setSkipTaskbar(true);
      if (bounds) win.setBounds(bounds);
    }
    layout();
  }

  const api = {
    win,
    BAR_H,
    SIDEBAR_W,
    mode: () => mode,
    adopt(view) {
      views.add(view);
      view.setVisible(false);
      view.setBounds(chatBounds());
      win.contentView.addChildView(view, 0);
    },
    release(view) {
      views.delete(view);
      if (current && current.view === view) current.view = null;
      try {
        win.contentView.removeChildView(view);
      } catch {}
    },
    isVisible: () => !win.isDestroyed() && win.isVisible(),
    /** On screen and in use: compact popup visible, or full window focused and not minimised. */
    isActive: () => !win.isDestroyed() && win.isVisible() && !win.isMinimized() && (mode === 'compact' || win.isFocused()),
    /** The full window is open (possibly minimised or behind another app). */
    isFullOpen: () => !win.isDestroyed() && mode === 'full' && (win.isVisible() || win.isMinimized()),
    currentId: () => (current ? current.id : null),
    /** True when this account's chat is actually in front of the user (not the lock screen). */
    isShowing: (id) => api.isActive() && !showingLock && !!current && current.id === id,
    recentlyHidden: () => Date.now() - lastHiddenAt < 250,
    /**
     * @param opts {id, view, account, adapter, bounds, locked, mode}
     */
    show({ id, view, account, adapter, bounds, locked, mode: m = 'compact' }) {
      clearTimeout(hideTimer);
      applyMode(m, bounds);
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
        send(lockView, 'lock:state', { reset: true });
      } else if (lockView) {
        lockView.setVisible(false);
      }
      layout();
      sendBar(account, adapter);
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (locked && lockView) lockView.webContents.focus();
      else if (view) view.webContents.focus();
      // Behind the lock screen nothing has been seen yet; unlocked() reports it.
      if (!locked) onShown(id);
      onWindowState();
    },
    hide() {
      if (win.isDestroyed() || !win.isVisible()) return;
      const id = current && current.id;
      win.hide();
      lastHiddenAt = Date.now();
      onHidden(id);
      onWindowState();
    },
    minimize() {
      if (mode === 'full') win.minimize();
      else api.hide();
    },
    toggleMaximize() {
      if (mode !== 'full') return;
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    },
    setPinned(v) {
      setPinned(v);
      sendBarMode();
    },
    refreshBar(account, adapter) {
      if (current && account && current.id === account.id) sendBar(account, adapter);
    },
    /** Sidebar contents (full mode). */
    sendSidebar(state) {
      if (sidebar) send(sidebar, 'side:state', state);
    },
    unlocked() {
      if (!showingLock) return;
      showingLock = false;
      if (lockView) lockView.setVisible(false);
      if (current && current.view) {
        current.view.setVisible(true);
        current.view.webContents.focus();
      }
      if (current && api.isActive()) onShown(current.id);
    },
    lockNow() {
      if (!win.isVisible()) return;
      if (mode === 'compact') return api.hide();
      // Full window stays, the lock screen covers the chat.
      showingLock = true;
      if (current && current.view) current.view.setVisible(false);
      if (!lockView) {
        lockView = ownView('lock.html');
        win.contentView.addChildView(lockView);
      }
      lockView.setVisible(true);
      layout();
      send(lockView, 'lock:state', { reset: true });
      if (lastBar) sendBar(lastBar.account, lastBar.adapter);
    },
    allowClose() {
      allowClose = true;
    },
    windows: () => [win],
  };
  return api;
}

module.exports = { createPopup, BAR_H, SIDEBAR_W };
