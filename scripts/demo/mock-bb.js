// Stand-in for the preload bridge so the real dock renderer can run inside
// the demo stage (an iframe). Everything is forwarded to window.parent.demo.
(function () {
  'use strict';
  const listeners = {};
  const stage = () => window.parent.demo;
  window.bb = {
    send(ch, data) {
      stage().onSend(ch, data);
    },
    invoke(ch, data) {
      return Promise.resolve(stage().onInvoke(ch, data));
    },
    on(ch, fn) {
      (listeners[ch] = listeners[ch] || []).push(fn);
      return () => {};
    },
  };
  window.__emit = (ch, data) => (listeners[ch] || []).forEach((fn) => fn(data));
})();
