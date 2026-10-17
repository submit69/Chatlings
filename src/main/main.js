'use strict';
const fs = require('fs');
const path = require('path');
const { app, ipcMain, Menu, dialog, shell, powerMonitor, screen, BrowserWindow } = require('electron');

if (process.env.CHATLINGS_USERDATA) app.setPath('userData', path.resolve(process.env.CHATLINGS_USERDATA));
else require('./migrate').migrateFromBongbong(path.join(app.getPath('appData'), 'Bongbong'), app.getPath('userData'));

// Must be decided before the app is ready, so read the setting straight from disk.
function earlySettings() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'chatlings.json'), 'utf8')).settings || {};
  } catch {
    return {};
  }
}
const gpuEnv = process.env.CHATLINGS_NO_GPU;
if (gpuEnv === '1' || (gpuEnv !== '0' && !earlySettings().hardwareAcceleration)) app.disableHardwareAcceleration();

const registry = require('../adapters');
const i18n = require('./i18n');
const layout = require('./layout');
const { createStore, newAccount, COLORS, SOUNDS, SKINS } = require('./store');
const { AccountManager, chromeUA } = require('./accounts');
const { createPopup } = require('./chat-popup');
const { createDock } = require('./dock-window');
const { createTray } = require('./tray');
const { createLock, validPin, hashPin, verifyPin } = require('./lock');
const { createPrivacy } = require('./privacy');
const { createMemoryWatch, kb } = require('./memory');
const { createSound } = require('./sound');
const { accountMode, tomorrowMorning } = require('./schedule');
const { MODES: SLEEP_MODES } = require('./sleep');
const picker = require('./picker');
const updater = require('./updater');

const { t } = i18n;

// Log main-process errors instead of Electron's default modal dialog, which
// can block quitting and is confusing for a tray app.
process.on('uncaughtException', (e) => console.error('[chatlings] uncaught', e));
process.on('unhandledRejection', (e) => console.error('[chatlings] unhandled rejection', e));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('io.github.submit69.chatlings');
  app.userAgentFallback = chromeUA();
  app.whenReady().then(start);
}

// Exposed for tests (CHATLINGS_FAKE=1 only) and the RAM report.
const ctx = { t };

function start() {
  Menu.setApplicationMenu(null);
  const store = createStore(path.join(app.getPath('userData'), 'chatlings.json'));
  ctx.store = store;
  seedFakeAccounts(store);
  i18n.setLocale(i18n.pickLocale(store.settings.locale, app.getLocale()));

  let screenLocked = false;

  // ---------- windows ----------
  const popup = createPopup({
    isPinned: () => !!store.settings.popupPinned,
    setPinned: (v) => store.setSetting('popupPinned', v),
    onShown: (id) => {
      accounts.markViewed(id);
      accounts.syncAudio();
      pushState();
    },
    onHidden: (id) => {
      if (id) accounts.state(id).lastUsedAt = Date.now();
      accounts.syncAudio();
      pushState();
    },
    // Focus / minimise of the full window decides whether bubbles are shown.
    onWindowState: () => {
      updateDockVisibility();
      accounts.syncAudio();
      pushState();
    },
    getFullBounds: () => store.data.fullWindow || null,
    setFullBounds: (b) => {
      store.data.fullWindow = b;
      store.save();
    },
  });
  popup.win.on('resized', () => {
    const id = popup.currentId();
    if (!id || popup.mode() !== 'compact') return;
    const [width, height] = popup.win.getSize();
    store.updateAccount(id, { popupSize: { width, height } });
  });

  const accounts = new AccountManager({ store, popup });
  ctx.accounts = accounts;
  ctx.popup = popup;

  const dock = createDock({ store, onReady: () => pushState() });
  ctx.dock = dock;

  const lock = createLock({
    getRecord: () => store.settings.pin,
    getAutoLockMinutes: () => store.settings.autoLockMinutes,
    getLockOnScreenLock: () => store.settings.lockOnScreenLock,
    powerMonitor,
    onChange: (locked) => {
      if (locked) popup.lockNow();
      else popup.unlocked();
      pushState();
    },
  });
  ctx.lock = lock;

  const privacy = createPrivacy({
    windows: () => [...dock.windows(), ...popup.windows(), ...picker.windows()],
    isProtectionOn: () => !!store.settings.contentProtection,
    isHideOnPresentation: () => !!store.settings.hideOnPresentation,
    onPresentation: (hidden) => {
      if (hidden && popup.mode() === 'compact' && !store.settings.popupPinned) popup.hide();
      updateDockVisibility();
    },
  });
  ctx.privacy = privacy;

  const memory = createMemoryWatch({ app, accounts, getThreshold: () => store.settings.memThresholdMB });
  ctx.memory = memory;

  const sound = createSound({ send: (p) => dock.send('dock:play', p) });
  ctx.sound = sound;

  // ---------- state push ----------
  let pushTimer = null;
  let quitting = false;
  function pushState() {
    if (pushTimer || quitting) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      dock.send('bb:state', dockState());
      popup.sendSidebar(sidebarState());
      if (ctx.tray) ctx.tray.rebuild();
      updateDockVisibility();
    }, 60);
  }
  ctx.pushState = pushState;

  function modeOf(a) {
    return accountMode(a, { groups: store.data.groups, dndUntil: store.data.dndUntil }, new Date());
  }

  function dockState() {
    const locked = lock.isLocked();
    return {
      edge: store.data.dock.edge,
      merged: !!store.settings.merged,
      locked,
      paused: screenLocked,
      now: Date.now(),
      accounts: store.accounts().map((a) => {
        const st = accounts.state(a.id);
        const ad = registry.get(a.adapter);
        const mode = modeOf(a);
        return {
          id: a.id,
          name: a.name,
          color: a.color,
          skin: a.skin || 'avatar',
          adapter: ad.id,
          adapterName: ad.name,
          icon: ad.icon,
          iconColor: ad.color,
          avatar: st.profile && st.profile.avatarData ? st.profile.avatarData : null,
          profileName: st.profile ? st.profile.name : null,
          visible: !a.hidden && mode.visible,
          muted: mode.muted,
          count: locked ? null : st.count,
          dot: st.dot,
          asleep: !st.awake,
          open: popup.isShowing(a.id),
          mood: {
            unread: (st.count || 0) || (st.dot ? 1 : 0),
            lastNewAt: st.lastNewAt,
            oldestUnreadAt: st.oldestUnreadAt,
            lastReadAt: st.lastReadAt,
            lastReplyLatency: st.lastReplyLatency,
            asleep: !st.awake,
            lastActivityAt: st.lastActivityAt,
          },
        };
      }),
    };
  }

  // Bubbles hide while you are using the full window; minimise it or switch to
  // another app and they come back.
  function updateDockVisibility() {
    const usingFullApp = popup.isFullOpen() && popup.isActive();
    dock.setVisible(!store.settings.hideAll && !privacy.isHiddenForPresentation() && !usingFullApp);
  }

  function sidebarState() {
    const locked = lock.isLocked();
    return {
      current: popup.currentId(),
      locked,
      accounts: store.accounts().map((a) => {
        const st = accounts.state(a.id);
        const ad = registry.get(a.adapter);
        return {
          id: a.id,
          name: a.name,
          color: a.color,
          adapterName: ad.name,
          icon: ad.icon,
          iconColor: ad.color,
          avatar: st.profile && st.profile.avatarData ? st.profile.avatarData : null,
          count: locked ? null : st.count,
          dot: st.dot,
          asleep: !st.awake,
        };
      }),
    };
  }

  accounts.on('changed', () => pushState());
  accounts.on('message', (id) => {
    const a = store.account(id);
    if (!a) return;
    sound.play(a, { muted: modeOf(a).muted, locked: lock.isLocked() });
    pushState();
    // Show the preview card by itself for a few seconds. Not while chatting in
    // the popup, and never the chat popup itself: that would steal the keyboard.
    if (store.settings.autoPeek && !store.settings.hideAll && !popup.isActive() && previewFor(id)) {
      setTimeout(() => dock.send('dock:peek', { id, ms: 6000 }), 150);
    }
  });

  // ---------- actions ----------
  function openAccount(id, anchorTop) {
    const account = store.account(id);
    if (!account) return;
    // The full window is open (maybe minimised or behind Excel): bring it back.
    if (popup.isFullOpen()) return openFull(id);
    if (popup.isVisible() && popup.currentId() === id) {
      popup.hide();
      return;
    }
    if (popup.recentlyHidden() && popup.currentId() === id) return; // the click that blurred it
    const ad = registry.get(account.adapter);
    const view = accounts.wake(id, 'open');
    const size = account.popupSize || ad.size;
    const db = dock.bounds();
    const wa = screen.getDisplayMatching(db).workArea;
    const anchorY = anchorTop != null ? dock.screenY(anchorTop) : db.y;
    const bounds = layout.popupBounds(db, dock.edge(), anchorY, size, wa);
    popup.show({ id, view, account, adapter: ad, bounds, locked: lock.isLocked() });
  }
  ctx.openAccount = (id) => openAccount(id);

  /** The full app window: account sidebar + big chat area. */
  function openFull(id) {
    const list = store.accounts();
    if (!list.length) return addAccount();
    const pick = store.account(id) || store.account(popup.currentId()) || list.find((a) => !a.hidden) || list[0];
    const ad = registry.get(pick.adapter);
    const view = accounts.wake(pick.id, 'open');
    let bounds = null;
    const fb = store.data.fullWindow;
    const wa = screen.getDisplayMatching(fb && fb.width ? fb : dock.bounds()).workArea;
    if (fb && fb.width && fb.height) {
      bounds = { x: fb.x, y: fb.y, width: Math.min(fb.width, wa.width), height: Math.min(fb.height, wa.height) };
    } else {
      const width = Math.min(1240, Math.round(wa.width * 0.85));
      const height = Math.min(820, Math.round(wa.height * 0.9));
      bounds = { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height };
    }
    popup.show({ id: pick.id, view, account: pick, adapter: ad, bounds, locked: lock.isLocked(), mode: 'full' });
  }
  ctx.openFull = (id) => openFull(id);

  function addAccount() {
    picker.openPicker({ title: t('picker.title'), protect: (w) => privacy.protect(w) });
  }
  ctx.addAccount = addAccount;

  function openSettings(query) {
    picker.openSettings({ title: t('settings.title'), query, protect: (w) => privacy.protect(w) });
  }
  ctx.openSettings = openSettings;

  function setSetting(key, value) {
    store.setSetting(key, value);
    switch (key) {
      case 'contentProtection':
        privacy.applyAll();
        break;
      case 'hideOnPresentation':
        privacy.tick();
        break;
      case 'autoLaunch':
        if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!value, args: ['--hidden'] });
        break;
      case 'locale':
        i18n.setLocale(i18n.pickLocale(value, app.getLocale()));
        dock.win.webContents.reload();
        break;
      case 'spellcheck':
        accounts.setSpellcheck(!!value);
        break;
      case 'popupPinned':
        popup.setPinned(!!value);
        break;
    }
    pushState();
  }
  ctx.setSetting = setSetting;
  ctx.setGroup = (g, on) => {
    store.data.groups[g] = { ...(store.data.groups[g] || {}), enabled: on };
    store.save();
    pushState();
  };
  ctx.setDnd = (until) => {
    store.data.dndUntil = until;
    store.save();
    pushState();
  };
  ctx.lockNow = () => lock.lock();
  ctx.checkUpdates = (interactive) => updater.check({ interactive });

  async function confirm(message, detail, okLabel) {
    const { response } = await dialog.showMessageBox({ type: 'warning', buttons: [okLabel, t('common.cancel')], defaultId: 1, cancelId: 1, message, detail });
    return response === 0;
  }

  async function accountAction(id, action) {
    const a = store.account(id);
    if (!a) return false;
    switch (action) {
      case 'open':
        openAccount(id);
        break;
      case 'sleep':
        if (popup.currentId() === id && popup.mode() === 'compact') popup.hide();
        accounts.sleep(id, { manual: true });
        break;
      case 'wake':
        accounts.state(id).manualSleep = false;
        accounts.wake(id, 'manual');
        break;
      case 'reload':
        accounts.reload(id);
        break;
      case 'signout':
        if (!(await confirm(t('confirm.signout', { name: a.name }), t('confirm.signoutDetail'), t('menu.signOut')))) return false;
        await accounts.signOut(id);
        break;
      case 'remove':
        if (!(await confirm(t('confirm.remove', { name: a.name }), t('confirm.removeDetail'), t('menu.remove')))) return false;
        if (popup.currentId() === id) popup.hide();
        await accounts.remove(id);
        if (popup.mode() === 'full' && store.accounts().length) openFull();
        break;
      default:
        return false;
    }
    pushState();
    return true;
  }

  const ACCOUNT_FIELDS = {
    name: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 40,
    color: (v) => /^#[0-9a-fA-F]{6}$/.test(v),
    skin: (v) => SKINS.includes(v),
    hidden: (v) => typeof v === 'boolean',
    group: (v) => typeof v === 'string' && v in store.data.groups,
    sleepMode: (v) => SLEEP_MODES.includes(v),
    sleepEvery: (v) => Number.isFinite(v) && v >= 1 && v <= 240,
    idleMinutes: (v) => Number.isFinite(v) && v >= 1 && v <= 480,
    schedule: (v) => v && typeof v === 'object',
    sound: (v) => SOUNDS.includes(v),
    preview: (v) => typeof v === 'boolean',
    muteNative: (v) => typeof v === 'boolean',
  };
  function updateAccount(id, patch) {
    const clean = {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (ACCOUNT_FIELDS[k] && ACCOUNT_FIELDS[k](v)) clean[k] = k === 'name' ? v.trim() : v;
    }
    const a = store.updateAccount(id, clean);
    if (!a) return null;
    if ('muteNative' in clean) accounts.syncAudio();
    popup.refreshBar(a, registry.get(a.adapter));
    pushState();
    return a;
  }

  function accountMenu(id) {
    const a = store.account(id);
    if (!a) return null;
    const st = accounts.state(id);
    const idx = store.accounts().indexOf(a);
    const colorNames = ['blue', 'orange', 'green', 'pink', 'purple', 'yellow', 'teal', 'red'];
    return Menu.buildFromTemplate([
      { label: a.name, enabled: false },
      { label: t('menu.open'), click: () => openAccount(id) },
      { type: 'separator' },
      {
        label: t('menu.skin'),
        submenu: SKINS.map((s) => ({ label: t('skin.' + s), type: 'radio', checked: a.skin === s, click: () => updateAccount(id, { skin: s }) })),
      },
      {
        label: t('menu.color'),
        submenu: COLORS.map((c, i) => ({ label: t('color.' + colorNames[i]), type: 'radio', checked: a.color.toLowerCase() === c.toLowerCase(), click: () => updateAccount(id, { color: c }) })),
      },
      { label: t('menu.rename'), click: () => openSettings({ tab: 'accounts', id }) },
      {
        label: t('menu.sound'),
        submenu: [
          ...SOUNDS.filter((s) => s !== 'file').map((s) => ({ label: t('sound.' + s), type: 'radio', checked: a.sound === s, click: () => (updateAccount(id, { sound: s }), sound.test(store.account(id))) })),
          { label: t('sound.file'), type: 'radio', checked: a.sound === 'file', click: () => pickSoundFile(id) },
        ],
      },
      { label: t('menu.preview'), type: 'checkbox', checked: a.preview !== false, click: (i) => updateAccount(id, { preview: i.checked }) },
      {
        label: t('menu.sleepMode'),
        submenu: SLEEP_MODES.map((m) => ({ label: t('sleep.' + m), type: 'radio', checked: a.sleepMode === m, click: () => updateAccount(id, { sleepMode: m }) })),
      },
      st.awake ? { label: t('menu.sleepNow'), click: () => accountAction(id, 'sleep') } : { label: t('menu.wake'), click: () => accountAction(id, 'wake') },
      { label: t('menu.reload'), click: () => accountAction(id, 'reload') },
      { type: 'separator' },
      { label: t('menu.moveUp'), enabled: idx > 0, click: () => (store.moveAccount(id, idx - 1), pushState()) },
      { label: t('menu.moveDown'), enabled: idx < store.accounts().length - 1, click: () => (store.moveAccount(id, idx + 1), pushState()) },
      { label: t('menu.hide'), click: () => updateAccount(id, { hidden: true }) },
      { label: t('menu.settings'), click: () => openSettings({ tab: 'accounts', id }) },
      { type: 'separator' },
      { label: t('tray.addAccount'), click: addAccount },
      { type: 'separator' },
      { label: t('menu.signOut'), click: () => accountAction(id, 'signout') },
      { label: t('menu.remove'), click: () => accountAction(id, 'remove') },
    ]);
  }

  function hubMenu() {
    const s = store.settings;
    return Menu.buildFromTemplate([
      { label: t('tray.addAccount'), click: addAccount },
      { label: t('tray.merge'), type: 'checkbox', checked: !!s.merged, click: (i) => setSetting('merged', i.checked) },
      { label: t('tray.hideBubbles'), click: () => setSetting('hideAll', true) },
      { label: t('tray.settings'), click: () => openSettings() },
    ]);
  }

  async function pickSoundFile(id) {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: t('sound.fileFilter'), extensions: ['mp3', 'wav', 'ogg', 'm4a'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const a = store.updateAccount(id, { sound: 'file', soundFile: r.filePaths[0] });
    sound.forget(r.filePaths[0]);
    sound.test(a);
    pushState();
    return r.filePaths[0];
  }

  function previewFor(id) {
    const a = store.account(id);
    if (!a || lock.isLocked() || !store.settings.previews || a.preview === false || modeOf(a).muted) return null;
    const st = accounts.state(id);
    return { id, name: a.name, adapterName: registry.get(a.adapter).name, items: accounts.previews(id), count: st.count, dot: st.dot, asleep: !st.awake };
  }

  // ---------- IPC ----------
  const fromDock = (e) => e.sender === dock.win.webContents;

  ipcMain.handle('bb:init', () => ({
    locale: i18n.locale(),
    dict: i18n.dict(),
    version: app.getVersion(),
    adapters: registry.list().map((a) => ({ id: a.id, name: a.name, tier: a.tier, icon: a.icon, color: a.color, loginHint: a.loginHint })),
    state: dockState(),
    fake: registry.isFake(),
  }));

  ipcMain.on('dock:hover', (e, on) => fromDock(e) && dock.setHover(!!on));
  ipcMain.on('dock:click', (e, d) => {
    if (!fromDock(e) || !d) return;
    if (d.id === '__add') addAccount();
    else openAccount(String(d.id), Number(d.top) || 0);
  });
  ipcMain.on('dock:context', (e, d) => {
    if (!fromDock(e) || !d) return;
    const m = d.id === '__hub' || d.id === '__add' ? hubMenu() : accountMenu(String(d.id));
    if (m) m.popup({ window: dock.win });
  });
  ipcMain.on('dock:hubContext', (e) => fromDock(e) && hubMenu().popup({ window: dock.win }));
  ipcMain.handle('dock:dragStart', (e) => (fromDock(e) ? dock.dragStart() : null));
  ipcMain.on('dock:dragMove', (e, p) => {
    if (!fromDock(e) || !p) return;
    if (popup.isVisible() && popup.mode() === 'compact' && !store.settings.popupPinned) popup.hide();
    dock.dragMove(p);
  });
  ipcMain.on('dock:dragEnd', (e) => fromDock(e) && dock.dragEnd());
  ipcMain.on('dock:size', (e, s) => {
    if (!fromDock(e) || !s) return;
    dock.setSize({ count: Math.max(1, s.count | 0), previewHeight: Math.max(0, s.previewHeight | 0), previewIndex: Math.max(0, s.previewIndex | 0) });
  });
  ipcMain.handle('dock:preview', (e, id) => (fromDock(e) ? previewFor(String(id)) : null));
  ipcMain.on('dock:previewClick', (e, d) => {
    if (!fromDock(e) || !d) return;
    openAccount(String(d.id));
    if (d.nid) accounts.clickNotification(String(d.id), String(d.nid));
  });

  ipcMain.on('bar:pin', () => setSetting('popupPinned', !store.settings.popupPinned));
  ipcMain.on('bar:close', () => popup.hide());
  ipcMain.on('bar:min', () => popup.minimize());
  ipcMain.on('bar:max', () => popup.toggleMaximize());
  ipcMain.on('bar:full', () => openFull(popup.currentId()));
  ipcMain.on('side:select', (_e, id) => openFull(String(id)));
  ipcMain.on('side:add', () => addAccount());
  ipcMain.on('side:settings', () => openSettings());
  ipcMain.on('side:context', (_e, id) => {
    const m = accountMenu(String(id));
    if (m) m.popup();
  });
  ipcMain.on('bar:reload', () => popup.currentId() && accounts.reload(popup.currentId()));
  ipcMain.on('bar:menu', () => {
    const m = popup.currentId() && accountMenu(popup.currentId());
    if (m) m.popup();
  });
  ipcMain.on('win:close', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.close();
  });

  ipcMain.handle('picker:add', (_e, d) => {
    if (!d || !d.adapter) return { ok: false };
    const ad = registry.get(d.adapter);
    const opts = {};
    if (ad.id === 'custom') {
      let u;
      try {
        u = new URL(String(d.url || '').trim());
      } catch {
        return { ok: false, error: t('picker.badUrl') };
      }
      if (u.protocol !== 'https:') return { ok: false, error: t('picker.badUrl') };
      opts.url = u.href;
      opts.name = String(d.name || '').trim().slice(0, 40) || u.hostname;
    }
    const acc = store.addAccount(newAccount(ad, store.accounts(), opts));
    picker.closePage('picker');
    pushState();
    setTimeout(() => openAccount(acc.id), 300);
    return { ok: true, id: acc.id };
  });

  ipcMain.handle('lock:unlock', (_e, pin) => lock.unlock(String(pin || '')));

  function settingsPayload() {
    const { pin, ...settings } = store.settings;
    return {
      settings: { ...settings, pinSet: !!pin },
      accounts: store.accounts().map((a) => {
        const st = accounts.state(a.id);
        return { ...a, runtime: { awake: st.awake, count: st.count, dot: st.dot, profileName: st.profile ? st.profile.name : null } };
      }),
      groups: store.data.groups,
      dndUntil: store.data.dndUntil,
      adapters: registry.list().map((a) => ({ id: a.id, name: a.name, tier: a.tier, icon: a.icon, color: a.color })),
      memory: memory.last(),
      version: app.getVersion(),
      locale: i18n.locale(),
      dict: i18n.dict(),
      colors: COLORS,
      sounds: SOUNDS,
      skins: SKINS,
      sleepModes: SLEEP_MODES,
    };
  }
  const SETTING_KEYS = ['locale', 'merged', 'hideAll', 'contentProtection', 'hideOnPresentation', 'previews', 'autoLaunch', 'checkUpdates', 'autoLockMinutes', 'lockOnScreenLock', 'memThresholdMB', 'spellcheck', 'popupPinned', 'hardwareAcceleration', 'autoPeek'];
  ipcMain.handle('settings:get', () => settingsPayload());
  ipcMain.handle('settings:set', (_e, d) => {
    if (!d) return false;
    const g = /^group:(w+)$/.exec(d.key);
    if (g && g[1] in store.data.groups) return ctx.setGroup(g[1], !!d.value), true;
    if (d.key === 'dnd') {
      ctx.setDnd(d.value === '1h' ? Date.now() + 3600 * 1000 : d.value === 'morning' ? tomorrowMorning() : 0);
      return true;
    }
    if (!SETTING_KEYS.includes(d.key)) return false;
    setSetting(d.key, d.value);
    return true;
  });
  ipcMain.handle('account:update', (_e, d) => !!(d && updateAccount(String(d.id), d.patch)));
  ipcMain.handle('account:action', (_e, d) => d && accountAction(String(d.id), String(d.action)));
  ipcMain.handle('account:move', (_e, d) => {
    if (!d) return false;
    store.moveAccount(String(d.id), d.to | 0);
    pushState();
    return true;
  });
  ipcMain.handle('pin:set', (_e, d) => {
    if (!d || !validPin(d.pin)) return { ok: false, error: t('lock.invalid') };
    if (store.settings.pin && !verifyPin(String(d.oldPin || ''), store.settings.pin)) return { ok: false, error: t('lock.wrongOld') };
    store.setSetting('pin', hashPin(String(d.pin)));
    pushState();
    return { ok: true };
  });
  ipcMain.handle('pin:clear', (_e, d) => {
    if (store.settings.pin && !verifyPin(String((d && d.oldPin) || ''), store.settings.pin)) return { ok: false, error: t('lock.wrongOld') };
    store.setSetting('pin', null);
    popup.unlocked();
    pushState();
    return { ok: true };
  });
  ipcMain.handle('mem:sample', () => memory.sample());
  ipcMain.handle('sound:pickFile', (_e, id) => pickSoundFile(String(id)));
  ipcMain.handle('sound:test', (_e, id) => {
    const a = store.account(String(id));
    return a ? sound.test(a) : false;
  });
  ipcMain.handle('updates:check', () => updater.check({ interactive: true }));
  ipcMain.handle('app:openExternal', (_e, url) => {
    const ok = /^https:\/\/(github\.com\/submit69\/chatlings|github\.com\/simple-icons)/.test(String(url));
    if (ok) shell.openExternal(String(url));
    return ok;
  });

  ipcMain.on('chat:title', (e, d) => {
    const id = accounts.accountForWebContents(e.sender);
    if (!id || !d) return;
    accounts.onTitle(id, String(d.title || ''));
    if (d.favicon) accounts.onFavicon(id, String(d.favicon));
  });
  ipcMain.on('chat:notify', (e, d) => {
    const id = accounts.accountForWebContents(e.sender);
    if (id && d) accounts.onNotify(id, d);
  });

  // ---------- system ----------
  powerMonitor.on('lock-screen', () => {
    screenLocked = true;
    pushState();
  });
  powerMonitor.on('unlock-screen', () => {
    screenLocked = false;
    pushState();
  });

  // Starting Chatlings again (Start menu, desktop icon) opens the full app.
  app.on('second-instance', () => {
    setSetting('hideAll', false);
    openFull();
  });
  app.on('window-all-closed', () => {
    // Tray app: keep running.
  });
  app.on('before-quit', () => {
    popup.allowClose();
    // Stop every timer first: a tick running while windows are being destroyed
    // would throw, and Electron's error dialog would then block the exit.
    quitting = true;
    clearTimeout(pushTimer);
    accounts.stop();
    store.flush();
    privacy.stop();
    memory.stop();
    lock.stop();
  });

  ctx.tray = createTray(ctx);
  privacy.applyAll();
  privacy.start();
  lock.start();
  memory.start();
  accounts.boot();
  updateDockVisibility();
  setTimeout(() => (memory.sample(), ctx.tray.rebuild()), 20000);

  if (!store.accounts().length && !registry.isFake()) addAccount();
  // Opening the app shows the full window; starting with Windows (--hidden)
  // only shows the bubbles.
  else if (!registry.isFake() && !process.argv.includes('--hidden')) openFull();
  if (store.settings.checkUpdates && app.isPackaged) {
    setTimeout(() => updater.check({ interactive: false }), 60 * 1000);
    setInterval(() => updater.check({ interactive: false }), 24 * 3600 * 1000);
  }

  // Test hooks: only with fake chats, or for scripts/check-adapters.mjs.
  if (registry.isFake() || process.env.CHATLINGS_EXPOSE === '1') {
    ctx.lib = { layout, hashPin, newAccount, registry };
    globalThis.__chatlings = ctx;
  }
  if (process.env.CHATLINGS_MEMREPORT) memReport(Number(process.env.CHATLINGS_MEMREPORT) || 25);
}

/** CHATLINGS_FAKE=1 CHATLINGS_FAKE_ACCOUNTS=N: create N fake accounts on an empty profile. */
function seedFakeAccounts(store) {
  if (!registry.isFake() || store.accounts().length) return;
  const n = Number(process.env.CHATLINGS_FAKE_ACCOUNTS || 3);
  const apps = ['zalo', 'whatsapp', 'discord', 'telegram', 'messenger'];
  const modes = ['title', 'dom', 'favicon', 'notify'];
  const skins = ['cat', 'dog', 'avatar'];
  for (let i = 0; i < n; i++) {
    const ad = registry.get(apps[i % apps.length]);
    const acc = newAccount(ad, store.accounts());
    acc.fakeMode = modes[i % modes.length];
    acc.skin = skins[i % skins.length];
    if (process.env.CHATLINGS_FAKE_SLEEP === '1') acc.sleepMode = 'idle';
    store.addAccount(acc);
  }
  store.flush();
}

function ownPids() {
  const m = new Map();
  const add = (wc, name) => wc && !wc.isDestroyed() && m.set(wc.getOSProcessId(), name);
  add(ctx.dock.win.webContents, '(dock)');
  for (const v of ctx.popup.win.contentView.children) if (!ctx.accounts.byWebContents.has(v.webContents.id)) add(v.webContents, '(popup ' + v.webContents.getURL().split('/').pop() + ')');
  return m;
}

function memReport(seconds) {
  setTimeout(() => {
    const s = ctx.memory.sample();
    const accounts = ctx.store.accounts().map((a) => ({ id: a.id, adapter: a.adapter, awake: ctx.accounts.state(a.id).awake, mb: s.accounts[a.id] || 0 }));
    const metrics = app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, account: ctx.accounts.pidMap().get(m.pid) || ownPids().get(m.pid) || null, mb: Math.round(kb(m) / 1024), workingSetMB: Math.round(m.memory.workingSetSize / 1024) }));
    process.stdout.write('CHATLINGS_MEM ' + JSON.stringify({ ...s, accounts, metrics }) + '\n');
    app.quit();
  }, seconds * 1000);
}

module.exports = { ctx };
