'use strict';
const path = require('path');
const { Tray, Menu, nativeImage, app, shell } = require('electron');
const registry = require('../adapters');
const { badgeText, total } = require('./unread');
const { tomorrowMorning } = require('./schedule');
const { features } = require('./platform');

const BUILD = path.join(__dirname, '..', '..', 'build');

function img(name) {
  const i = nativeImage.createFromPath(path.join(BUILD, name));
  return i.isEmpty() ? nativeImage.createEmpty() : i;
}

/**
 * @param ctx main controller (see main.js)
 */
function createTray(ctx) {
  const { t } = ctx;
  const icons = { normal: img('tray.png'), unread: img('tray-unread.png') };
  const tray = new Tray(icons.normal);
  tray.setToolTip('Chatlings');
  let timer = null;

  function accountItems() {
    const accounts = ctx.store.accounts();
    if (!accounts.length) return [{ label: t('tray.noAccounts'), enabled: false }];
    const byApp = new Map();
    for (const a of accounts) {
      if (!byApp.has(a.adapter)) byApp.set(a.adapter, []);
      byApp.get(a.adapter).push(a);
    }
    const items = [];
    for (const [adapterId, list] of byApp) {
      const ad = registry.get(adapterId);
      items.push({ label: ad.id === 'custom' ? t('picker.custom') : ad.name, enabled: false });
      for (const a of list) {
        const st = ctx.accounts.state(a.id);
        const locked = ctx.lock.isLocked();
        const n = locked ? '' : badgeText(st);
        const flags = [st.awake ? '' : 'zzz', a.hidden ? t('tray.hiddenFlag') : ''].filter(Boolean).join(' ');
        items.push({
          label: `    ${a.name}${n ? `  (${n})` : st.dot ? '  •' : ''}${flags ? `  ${flags}` : ''}`,
          click: () => ctx.openAccount(a.id),
        });
      }
    }
    return items;
  }

  function build() {
    if (ctx.lock.isLocked()) {
      tray.setContextMenu(Menu.buildFromTemplate([{ label: t('tray.openApp'), click: () => ctx.openFull() }, { type: 'separator' }, { label: t('tray.quit'), click: () => app.quit() }]));
      tray.setImage(icons.normal);
      tray.setToolTip('Chatlings');
      return;
    }
    const s = ctx.store.settings;
    const groups = ctx.store.data.groups;
    const dndOn = ctx.store.data.dndUntil > Date.now();
    const mem = ctx.memory.last();
    const memItems = [
      { label: t('tray.memTotal', { mb: mem.totalMB || '…' }), enabled: false },
      { label: t('tray.memFrame', { mb: mem.frameMB || '…' }), enabled: false },
      { type: 'separator' },
      ...ctx.store.accounts().map((a) => {
        const st = ctx.accounts.state(a.id);
        const mb = mem.accounts[a.id];
        return {
          label: `${a.name}: ${st.awake ? (mb ? mb + ' MB' : '…') : t('tray.asleep')}`,
          submenu: [
            { label: t('tray.sleepNow'), enabled: st.awake, click: () => ctx.accounts.sleep(a.id, { manual: true }) },
            { label: t('tray.reload'), click: () => ctx.accounts.reload(a.id) },
          ],
        };
      }),
      { type: 'separator' },
      { label: t('tray.memRefresh'), click: () => (ctx.memory.sample(), rebuild()) },
    ];
    const menu = Menu.buildFromTemplate([
      { label: t('tray.openApp'), click: () => ctx.openFull() },
      { type: 'separator' },
      ...accountItems(),
      { type: 'separator' },
      { label: t('tray.addAccount'), click: () => ctx.addAccount() },
      { label: t('tray.showBubbles'), type: 'checkbox', checked: !s.hideAll, click: (i) => ctx.setSetting('hideAll', !i.checked) },
      ...(ctx.store.accounts().some((a) => ctx.accounts.state(a.id).dismissed) ? [{ label: t('tray.showClosed'), click: () => ctx.setSetting('hideAll', false) }] : []),
      { label: t('tray.merge'), type: 'checkbox', checked: !!s.merged, click: (i) => ctx.setSetting('merged', i.checked) },
      {
        label: t('tray.profiles'),
        submenu: Object.keys(groups).map((g) => ({
          label: t('group.' + g),
          type: 'checkbox',
          checked: groups[g].enabled !== false,
          click: (i) => ctx.setGroup(g, i.checked),
        })),
      },
      {
        label: dndOn ? t('tray.dndOnUntil', { time: new Date(ctx.store.data.dndUntil).toLocaleString() }) : t('tray.dnd'),
        submenu: [
          { label: t('tray.dnd1h'), click: () => ctx.setDnd(Date.now() + 3600 * 1000) },
          { label: t('tray.dndMorning'), click: () => ctx.setDnd(tomorrowMorning()) },
          { label: t('tray.dndOff'), enabled: dndOn, click: () => ctx.setDnd(0) },
        ],
      },
      {
        label: t('tray.privacy'),
        submenu: [
          ...(features.captureProtection ? [{ label: t('tray.hideFromCapture'), type: 'checkbox', checked: !!s.contentProtection, click: (i) => ctx.setSetting('contentProtection', i.checked) }] : []),
          ...(features.presentationDetection ? [{ label: t('tray.hideOnPresent'), type: 'checkbox', checked: !!s.hideOnPresentation, click: (i) => ctx.setSetting('hideOnPresentation', i.checked) }] : []),
          { label: t('tray.lockNow'), enabled: ctx.lock.isEnabled() && !ctx.lock.isLocked(), click: () => ctx.lockNow() },
        ],
      },
      { label: t('tray.memory'), submenu: memItems },
      { type: 'separator' },
      { label: t('tray.settings'), click: () => ctx.openSettings() },
      { label: t('tray.autoLaunch'), type: 'checkbox', checked: !!s.autoLaunch, click: (i) => ctx.setSetting('autoLaunch', i.checked) },
      { label: t('tray.checkUpdates'), click: () => ctx.checkUpdates(true) },
      { type: 'separator' },
      ...(ctx.donateInfo().any ? [{ label: t('tray.donate'), click: () => ctx.openDonate() }] : []),
      { label: t('tray.nlv'), click: () => shell.openExternal('https://noilamviec.com/?utm_source=chatlings&utm_medium=app&utm_campaign=tray') },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    const tot = total(ctx.store.accounts().map((a) => ctx.accounts.state(a.id)));
    tray.setImage(tot.dot ? icons.unread : icons.normal);
    tray.setToolTip(tot.count ? `Chatlings — ${tot.count}` : 'Chatlings');
  }

  function rebuild() {
    clearTimeout(timer);
    timer = setTimeout(build, 300);
  }

  // Left click opens the app, right click shows the menu.
  tray.on('click', () => ctx.openFull());
  build();
  return { tray, rebuild, build };
}

module.exports = { createTray };
