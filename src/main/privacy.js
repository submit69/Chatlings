'use strict';
// 1. Content protection: every Chatlings window calls setContentProtection(true).
//    On Windows 10 2004+ this sets WDA_EXCLUDEFROMCAPTURE, so the windows are
//    left out of screenshots, recordings and screen sharing (Meet, Zoom, Teams,
//    OBS), while you still see them. No need to guess which app is sharing.
// 2. Optional: hide while presenting / running a full-screen game, using
//    SHQueryUserNotificationState through koffi. QUNS_BUSY (any full-screen
//    app, e.g. maximised Excel) is deliberately NOT hidden.

const QUNS = { NOT_PRESENT: 1, BUSY: 2, RUNNING_D3D_FULL_SCREEN: 3, PRESENTATION_MODE: 4, ACCEPTS_NOTIFICATIONS: 5, QUIET_TIME: 6, APP: 7 };

function shouldHideFor(state) {
  return state === QUNS.PRESENTATION_MODE || state === QUNS.RUNNING_D3D_FULL_SCREEN;
}

let queryFn = null;
function loadQuery() {
  if (queryFn !== null) return queryFn;
  queryFn = false;
  if (process.platform !== 'win32') return queryFn;
  try {
    const koffi = require('koffi');
    const shell32 = koffi.load('shell32.dll');
    const fn = shell32.func('int __stdcall SHQueryUserNotificationState(_Out_ int *state)');
    queryFn = () => {
      const out = [0];
      return fn(out) === 0 ? out[0] : 0;
    };
  } catch (e) {
    console.warn('[privacy] presentation detection unavailable:', e.message);
  }
  return queryFn;
}

function notificationState() {
  const q = loadQuery();
  return q ? q() : 0;
}

/**
 * @param opts.windows () => (BrowserWindow|BaseWindow)[]
 * @param opts.isProtectionOn () => boolean
 * @param opts.isHideOnPresentation () => boolean
 * @param opts.onPresentation (hidden:boolean) => void
 */
function createPrivacy({ windows, isProtectionOn, isHideOnPresentation, onPresentation }) {
  let timer = null;
  let hidden = false;
  const api = {
    protect(win) {
      if (win && !win.isDestroyed()) win.setContentProtection(isProtectionOn());
    },
    applyAll() {
      for (const w of windows()) api.protect(w);
    },
    isHiddenForPresentation: () => hidden,
    tick() {
      const want = isHideOnPresentation() && shouldHideFor(notificationState());
      if (want !== hidden) {
        hidden = want;
        onPresentation(hidden);
      }
    },
    start() {
      timer = setInterval(api.tick, 3000);
    },
    stop() {
      clearInterval(timer);
    },
  };
  return api;
}

module.exports = { QUNS, shouldHideFor, notificationState, createPrivacy };
