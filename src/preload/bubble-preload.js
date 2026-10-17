// Preload for Bongbong's own pages (dock, popup bar, lock, picker, settings).
// Only the fixed channel names below can be used.
const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set([
  'dock:hover', 'dock:click', 'dock:context', 'dock:dragMove', 'dock:dragEnd', 'dock:size', 'dock:previewClick', 'dock:hubContext',
  'bar:pin', 'bar:close', 'bar:reload', 'bar:menu',
  'win:close',
]);
const INVOKE = new Set([
  'bb:init', 'dock:dragStart', 'dock:preview',
  'picker:add', 'lock:unlock',
  'settings:get', 'settings:set', 'account:update', 'account:action', 'account:move',
  'pin:set', 'pin:clear', 'mem:sample', 'sound:pickFile', 'sound:test', 'updates:check', 'app:openExternal',
]);
const ON = new Set(['bb:state', 'dock:play', 'dock:peek', 'bar:state', 'lock:state', 'settings:refresh']);

contextBridge.exposeInMainWorld('bb', {
  send(ch, data) {
    if (SEND.has(ch)) ipcRenderer.send(ch, data);
  },
  invoke(ch, data) {
    if (!INVOKE.has(ch)) return Promise.reject(new Error('channel not allowed: ' + ch));
    return ipcRenderer.invoke(ch, data);
  },
  on(ch, fn) {
    if (!ON.has(ch)) return () => {};
    const h = (_e, d) => fn(d);
    ipcRenderer.on(ch, h);
    return () => ipcRenderer.removeListener(ch, h);
  },
});
