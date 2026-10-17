// Preload for every chat view (sandboxed, context-isolated). Shared by all
// adapters; the adapter id arrives via additionalArguments.
//  - watches the tab title and favicon (MutationObserver + 2 s poll fallback)
//  - replaces window.Notification so messages go to Chatlings (preview card,
//    per-account sound) instead of the Windows notification centre
// Nothing is exposed to the page except the Notification replacement.
const { contextBridge, ipcRenderer } = require('electron');

const arg = (k) => {
  const p = `--bb-${k}=`;
  const a = (process.argv || []).find((x) => x.startsWith(p));
  return a ? a.slice(p.length) : '';
};
const adapterId = arg('adapter');

// ---- 1. Notification hook, runs in the page's main world ----
function hook(notify, marker) {
  const live = new Map();
  let seq = 0;
  const fire = (n, type) => {
    const ev = new Event(type);
    n.dispatchEvent(ev);
    const h = n['on' + type];
    if (typeof h === 'function') {
      try {
        h.call(n, ev);
      } catch (e) {
        setTimeout(() => {
          throw e;
        });
      }
    }
  };
  class Notification extends EventTarget {
    constructor(title, options) {
      super();
      const o = options || {};
      this.title = String(title ?? '');
      this.body = String(o.body ?? '');
      this.tag = String(o.tag ?? '');
      this.icon = String(o.icon ?? '');
      this.data = o.data ?? null;
      this.silent = !!o.silent;
      this.onclick = this.onshow = this.onclose = this.onerror = null;
      const nid = 'n' + ++seq;
      live.set(nid, this);
      if (live.size > 30) live.delete(live.keys().next().value);
      notify({ nid, title: this.title, body: this.body, tag: this.tag });
      setTimeout(() => fire(this, 'show'), 0);
    }
    close() {
      fire(this, 'close');
    }
    static get permission() {
      return 'granted';
    }
    static requestPermission(cb) {
      if (typeof cb === 'function') cb('granted');
      return Promise.resolve('granted');
    }
    static get maxActions() {
      return 2;
    }
  }
  Object.defineProperty(window, 'Notification', { value: Notification, writable: true, configurable: true });
  if (window.ServiceWorkerRegistration) {
    ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
      new Notification(title, options);
      return Promise.resolve();
    };
    ServiceWorkerRegistration.prototype.getNotifications = function () {
      return Promise.resolve([]);
    };
  }
  // Chatlings' preview card was clicked: behave as if the toast was clicked.
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d[marker] !== 'click') return;
    const n = live.get(d.nid);
    if (n) fire(n, 'click');
  });
}

const MARKER = '__chatlings_' + Math.random().toString(36).slice(2);
const send = (p) => ipcRenderer.send('chat:notify', p);
try {
  contextBridge.executeInMainWorld({ func: hook, args: [send, MARKER] });
} catch (e) {
  // Older Electron: fall back to a bridged callback.
  contextBridge.exposeInMainWorld('__chatlingsNotify', send);
  console.warn('[chatlings] executeInMainWorld unavailable', e && e.message);
}

ipcRenderer.on('chat:clickNotification', (_e, nid) => {
  window.postMessage({ [MARKER]: 'click', nid }, '*');
});

// ---- 2. Title + favicon watcher ----
let lastTitle = null;
let lastIcon = null;
function report() {
  const title = document.title || '';
  const link = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]');
  const favicon = link ? link.href : '';
  if (title === lastTitle && favicon === lastIcon) return;
  lastTitle = title;
  lastIcon = favicon;
  ipcRenderer.send('chat:title', { title, favicon: favicon.length > 200000 ? favicon.slice(0, 200000) : favicon, adapter: adapterId });
}

let scheduled = false;
function soon() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    report();
  }, 150);
}

window.addEventListener('DOMContentLoaded', () => {
  const target = document.head || document.documentElement;
  new MutationObserver(soon).observe(target, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href'] });
  report();
  setInterval(report, 2000);
});
