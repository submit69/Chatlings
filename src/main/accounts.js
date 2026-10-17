'use strict';
// Runtime side of accounts: one WebContentsView per AWAKE account, unread
// tracking, notifications (RAM only), sleep/wake. Persistent settings live in
// the store; everything here is lost on quit on purpose.
const { EventEmitter } = require('events');
const path = require('path');
const { WebContentsView, session, shell } = require('electron');
const registry = require('../adapters');
const { isAllowedUrl } = require('../adapters/common');
const { resolveUnread } = require('./unread');
const { isActive } = require('./schedule');
const sleep = require('./sleep');

const PRELOAD = path.join(__dirname, '..', 'preload', 'chat-preload.js');
const DOM_POLL_MS = 4000;
const SETTLE_MS = 8000; // ignore unread jumps right after load (initial sync)
const MAX_PREVIEWS = 3;

function chromeUA() {
  const major = String(process.versions.chrome || '140').split('.')[0];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

function newRuntime() {
  return {
    view: null,
    awake: false,
    settled: false,
    title: '',
    titleCount: null,
    titleDot: false,
    domCount: null,
    favicon: null,
    faviconBase: null,
    notifiedSinceView: false,
    count: null,
    dot: false,
    notifications: [],
    profile: null,
    lastNewAt: 0,
    oldestUnreadAt: 0,
    lastReadAt: 0,
    lastReplyLatency: null,
    lastActivityAt: Date.now(),
    lastUsedAt: 0,
    lastPeekAt: 0,
    sleptAt: 0,
    peekUntil: 0,
    manualSleep: false,
    lastReloadAt: 0,
    crashed: false,
    triedFallback: false,
    scheduleActive: true,
  };
}

class AccountManager extends EventEmitter {
  /**
   * @param opts.store
   * @param opts.popup  {adopt(view), release(view), isShowing(id), isVisible()}
   * @param opts.isLocked () => boolean
   */
  constructor({ store, popup }) {
    super();
    this.store = store;
    this.popup = popup;
    this.rt = new Map();
    this.byWebContents = new Map();
    this.sessionsReady = new Set();
    this.ua = chromeUA();
    this.booting = new Set();
    this.timers = [];
  }

  state(id) {
    if (!this.rt.has(id)) this.rt.set(id, newRuntime());
    return this.rt.get(id);
  }

  accountForWebContents(wc) {
    return this.byWebContents.get(wc.id);
  }

  partition(account) {
    return `persist:${account.id}`;
  }

  setupSession(account) {
    const name = this.partition(account);
    const ses = session.fromPartition(name);
    if (this.sessionsReady.has(name)) return ses;
    this.sessionsReady.add(name);
    ses.setUserAgent(this.ua);
    const allowed = new Set(['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'speaker-selection', 'display-capture']);
    ses.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
    ses.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));
    ses.setSpellCheckerEnabled(!!this.store.settings.spellcheck);
    return ses;
  }

  // ---------- wake / sleep ----------

  wake(id, reason = 'use') {
    if (this.stopped) return null;
    const account = this.store.account(id);
    if (!account) return null;
    const st = this.state(id);
    if (st.view && !st.view.webContents.isDestroyed()) return st.view;
    const r = registry.resolve(account);
    if (!r.url) return null;
    const ses = this.setupSession(account);
    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        preload: PRELOAD,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: !!this.store.settings.spellcheck,
        autoplayPolicy: 'document-user-activation-required',
        enableWebSQL: false,
        devTools: !!process.env.BONGBONG_DEVTOOLS,
        additionalArguments: [`--bb-account=${id}`, `--bb-adapter=${r.adapter.id}`],
      },
    });
    view.setBackgroundColor('#ffffff');
    const wc = view.webContents;
    st.view = view;
    st.awake = true;
    st.settled = false;
    st.crashed = false;
    this.byWebContents.set(wc.id, id);
    this.wire(account, r, view);
    this.popup.adopt(view);
    wc.setAudioMuted(this.shouldMuteAudio(account));
    wc.loadURL(r.url).catch(() => {});
    this.emit('changed', id, { reason: 'wake:' + reason });
    return view;
  }

  sleep(id, { manual = false } = {}) {
    const st = this.state(id);
    if (manual) st.manualSleep = true;
    if (!st.view) return;
    const view = st.view;
    st.view = null;
    st.awake = false;
    st.sleptAt = Date.now();
    st.peekUntil = 0;
    this.popup.release(view);
    const wc = view.webContents;
    this.byWebContents.delete(wc.id);
    if (!wc.isDestroyed()) wc.close();
    this.emit('changed', id, { reason: 'sleep' });
  }

  wire(account, r, view) {
    const id = account.id;
    const wc = view.webContents;
    const st = this.state(id);

    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedUrl(url, r.allowedHosts) && !/^(about|blob|data):/.test(url)) {
        return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true, alwaysOnTop: true } };
      }
      if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    wc.on('did-create-window', (child) => {
      child.setContentProtection(!!this.store.settings.contentProtection);
      child.webContents.setUserAgent(this.ua);
    });
    const guard = (e, url) => {
      if (r.fake && url.startsWith('file:')) return;
      if (!isAllowedUrl(url, r.allowedHosts)) {
        e.preventDefault();
        if (/^https?:/.test(url)) shell.openExternal(url);
      }
    };
    wc.on('will-navigate', guard);
    wc.on('will-redirect', guard);

    wc.on('page-title-updated', (_e, title) => this.onTitle(id, title));
    wc.on('page-favicon-updated', (_e, favs) => this.onFavicon(id, favs && favs[0]));
    wc.on('did-finish-load', () => {
      setTimeout(() => {
        if (st.view === view) {
          st.settled = true;
          if (st.count === 0 || st.count === null) st.faviconBase = st.favicon;
          this.pollDom(id);
        }
      }, SETTLE_MS);
    });
    wc.on('did-fail-load', (_e, code, _desc, url, isMain) => {
      if (!isMain || code === -3) return;
      // Messenger may be folded into facebook.com; try the fallback once.
      if (r.adapter.fallbackUrl && !st.triedFallback) {
        st.triedFallback = true;
        wc.loadURL(r.adapter.fallbackUrl).catch(() => {});
      } else {
        setTimeout(() => st.view === view && !wc.isDestroyed() && wc.reload(), 30000);
      }
    });
    wc.on('render-process-gone', (_e, details) => {
      st.crashed = true;
      console.warn(`[accounts] ${id} renderer gone: ${details.reason}`);
      if (details.reason !== 'clean-exit') setTimeout(() => st.view === view && !wc.isDestroyed() && wc.reload(), 5000);
    });
    wc.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F5') wc.reload();
      if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i' && process.env.BONGBONG_DEVTOOLS) wc.openDevTools({ mode: 'detach' });
    });
  }

  // ---------- unread ----------

  isViewing(id) {
    return this.popup.isShowing(id);
  }

  recompute(id) {
    const st = this.state(id);
    const prev = { count: st.count, dot: st.dot };
    const faviconChanged = !!(st.settled && st.faviconBase && st.favicon && st.favicon !== st.faviconBase && !this.isViewing(id));
    const r = resolveUnread({ titleCount: st.titleCount, titleDot: st.titleDot, domCount: st.domCount, faviconChanged, notifiedSinceView: st.notifiedSinceView });
    st.count = r.count;
    st.dot = r.dot;
    if (!st.dot) st.oldestUnreadAt = 0;
    else if (!st.oldestUnreadAt) st.oldestUnreadAt = Date.now();
    const changed = prev.count !== st.count || prev.dot !== st.dot;
    if (changed) {
      const grew = (st.count || 0) > (prev.count || 0) || (st.dot && !prev.dot);
      if (grew && st.settled && !this.isViewing(id)) this.newMessage(id, null);
      this.emit('changed', id, { reason: 'unread' });
    }
    return changed;
  }

  onTitle(id, title) {
    const st = this.state(id);
    if (title === st.title) return;
    st.title = title;
    const account = this.store.account(id);
    if (!account) return;
    const p = registry.get(account.adapter).parseUnread(title);
    st.titleCount = p.count;
    st.titleDot = p.dot;
    this.recompute(id);
  }

  onFavicon(id, href) {
    const st = this.state(id);
    if (!href || href === st.favicon) return;
    st.favicon = href;
    if (!st.faviconBase && st.settled && !st.dot) st.faviconBase = href;
    this.recompute(id);
  }

  onNotify(id, n) {
    const st = this.state(id);
    const item = {
      nid: String(n.nid || ''),
      title: String(n.title || '').slice(0, 120),
      body: String(n.body || '').slice(0, 400),
      time: Date.now(),
    };
    st.notifications.unshift(item);
    st.notifications.length = Math.min(st.notifications.length, MAX_PREVIEWS);
    if (!this.isViewing(id)) st.notifiedSinceView = true;
    this.newMessage(id, item);
    this.recompute(id);
    this.emit('changed', id, { reason: 'notify' });
  }

  newMessage(id, item) {
    const st = this.state(id);
    const now = Date.now();
    if (now - st.lastNewAt < 1500 && !item) return; // title change right after a notification
    st.lastNewAt = now;
    st.lastActivityAt = now;
    if (!st.oldestUnreadAt) st.oldestUnreadAt = now;
    if (!this.isViewing(id)) this.emit('message', id, item);
  }

  /** The popup now shows this account. */
  markViewed(id) {
    const st = this.state(id);
    const now = Date.now();
    if (st.dot && st.oldestUnreadAt) st.lastReplyLatency = now - st.oldestUnreadAt;
    else st.lastReplyLatency = null;
    st.lastReadAt = now;
    st.lastUsedAt = now;
    st.lastActivityAt = now;
    st.manualSleep = false;
    st.notifiedSinceView = false;
    st.faviconBase = st.favicon;
    this.recompute(id);
    this.emit('changed', id, { reason: 'viewed' });
  }

  async pollDom(id) {
    const st = this.state(id);
    const account = this.store.account(id);
    if (!account || !st.view || st.view.webContents.isDestroyed() || st.view.webContents.isLoading()) return;
    const r = registry.resolve(account);
    const wc = st.view.webContents;
    try {
      if (r.selectors.unreadBadge) {
        const code = `(${r.adapter.unreadFromDom.toString()})(${JSON.stringify(r.selectors)})`;
        const n = await wc.executeJavaScriptInIsolatedWorld(1001, [{ code }]);
        const v = typeof n === 'number' && n >= 0 ? n : null;
        if (v !== st.domCount) {
          st.domCount = v;
          this.recompute(id);
        }
      }
      const needProfile = !st.profile || Date.now() - (st.profile.at || 0) > 10 * 60 * 1000;
      if (needProfile && (r.selectors.profileName || r.selectors.profileAvatar)) {
        const code = `(${r.adapter.profileFromDom.toString()})(${JSON.stringify(r.selectors)})`;
        const p = await wc.executeJavaScriptInIsolatedWorld(1002, [{ code }]);
        if (p && (p.name || p.avatar)) {
          const changed = !st.profile || st.profile.name !== p.name || st.profile.avatar !== p.avatar;
          const avatarData = changed ? await this.avatarData(wc.session, p.avatar) : st.profile.avatarData;
          st.profile = { name: p.name, avatar: p.avatar, avatarData, at: Date.now() };
          if (changed) this.emit('changed', id, { reason: 'profile' });
        }
      }
    } catch {
      // Page navigating or blocked; try again next tick.
    }
  }

  /**
   * The dock never touches the network: the avatar is downloaded here with the
   * account's own session (cookies included) and handed over as a data: URL.
   */
  async avatarData(ses, url) {
    if (!url) return null;
    if (url.startsWith('data:image/')) return url.length < 400000 ? url : null;
    try {
      const res = await ses.fetch(url);
      if (!res.ok) return null;
      const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
      if (!type.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 300000) return null;
      return `data:${type};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  // ---------- actions ----------

  reload(id, { quiet = false } = {}) {
    const st = this.state(id);
    if (!st.view || st.view.webContents.isDestroyed()) return this.wake(id, 'reload');
    st.lastReloadAt = Date.now();
    st.settled = false;
    st.view.webContents.reload();
    if (!quiet) this.emit('changed', id, { reason: 'reload' });
  }

  async signOut(id) {
    const account = this.store.account(id);
    if (!account) return;
    const ses = this.setupSession(account);
    await ses.clearStorageData();
    await ses.clearCache();
    const st = this.state(id);
    st.profile = null;
    st.notifications = [];
    this.reload(id);
  }

  async remove(id) {
    const account = this.store.account(id);
    this.sleep(id);
    if (account) {
      const ses = this.setupSession(account);
      await ses.clearStorageData().catch(() => {});
      await ses.clearCache().catch(() => {});
    }
    this.rt.delete(id);
    this.store.removeAccount(id);
    this.emit('changed', id, { reason: 'removed' });
  }

  shouldMuteAudio(account) {
    return !!account.muteNative && !this.isViewing(account.id);
  }

  syncAudio() {
    for (const a of this.store.accounts()) {
      const st = this.state(a.id);
      if (st.view && !st.view.webContents.isDestroyed()) st.view.webContents.setAudioMuted(this.shouldMuteAudio(a));
    }
  }

  setSpellcheck(on) {
    for (const name of this.sessionsReady) session.fromPartition(name).setSpellCheckerEnabled(on);
  }

  // ---------- scheduler ----------

  /** Load awake accounts one by one, STAGGER_MS apart. */
  boot() {
    const now = Date.now();
    const plan = sleep.bootPlan(this.store.accounts(), (a) => this.stateForSleep(a), now);
    for (const a of this.store.accounts()) {
      const st = this.state(a.id);
      st.sleptAt = now;
      this.booting.add(a.id);
    }
    for (const step of plan) {
      this.timers.push(
        setTimeout(() => {
          this.booting.delete(step.id);
          this.wake(step.id, 'boot');
        }, step.at),
      );
    }
    const lastAt = plan.length ? plan[plan.length - 1].at : 0;
    this.timers.push(setTimeout(() => this.booting.clear(), lastAt + 100));
    this.timers.push(setInterval(() => this.tick(), 15000));
    this.timers.push(setInterval(() => this.pollAll(), DOM_POLL_MS));
  }

  stateForSleep(account) {
    const st = this.state(account.id);
    st.scheduleActive = isActive(account.schedule);
    return { ...st, popupOpen: this.isViewing(account.id) };
  }

  tick(now = Date.now()) {
    if (this.stopped) return;
    for (const a of this.store.accounts()) {
      if (this.booting.has(a.id)) continue;
      const st = this.state(a.id);
      const s = this.stateForSleep(a);
      const want = sleep.desiredAwake(a, s, now);
      if (want && !st.awake) this.wake(a.id, 'schedule');
      else if (!want && st.awake) {
        if (st.peekUntil) st.lastPeekAt = now;
        this.sleep(a.id);
      } else if (!st.awake && sleep.shouldPeek(a, s, now)) {
        st.peekUntil = now + sleep.PEEK_MS;
        st.lastPeekAt = now;
        this.wake(a.id, 'peek');
      }
    }
  }

  pollAll() {
    for (const a of this.store.accounts()) {
      const st = this.state(a.id);
      if (st.awake && st.settled) this.pollDom(a.id);
    }
  }

  stop() {
    this.stopped = true;
    this.timers.forEach((t) => clearTimeout(t) || clearInterval(t));
    this.timers = [];
    for (const id of this.rt.keys()) {
      try {
        this.sleep(id);
      } catch {}
    }
  }

  // ---------- views for others ----------

  pidMap() {
    const m = new Map();
    for (const [id, st] of this.rt) {
      if (st.view && !st.view.webContents.isDestroyed()) {
        const pid = st.view.webContents.getOSProcessId();
        if (pid) m.set(pid, id);
      }
    }
    return m;
  }

  isShowing(id) {
    return this.isViewing(id);
  }

  lastReloadAt(id) {
    return this.state(id).lastReloadAt;
  }

  previews(id) {
    return this.state(id).notifications.slice();
  }

  clickNotification(id, nid) {
    const st = this.state(id);
    if (st.view && !st.view.webContents.isDestroyed()) st.view.webContents.send('chat:clickNotification', nid);
  }
}

module.exports = { AccountManager, chromeUA };
