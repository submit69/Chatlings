// End-to-end test in the real Electron app, with fake chat pages.
//   npm run e2e
// Opens real windows on your desktop for ~1 minute. Uses a throw-away profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(os.tmpdir(), 'chatlings-e2e');
fs.mkdirSync(SHOTS, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(extraEnv = {}) {
  const env = { ...process.env, CHATLINGS_FAKE: '1', CHATLINGS_FAKE_ACCOUNTS: '4', CHATLINGS_USERDATA: fs.mkdtempSync(path.join(os.tmpdir(), 'bb-e2e-')), ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE; // set by some editors; would start Electron as plain Node
  // CI Linux runners have no setuid sandbox helper for the npm-installed Electron.
  const args = [root, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])];
  const app = await _electron.launch({ args, env });
  const ev = (fn, arg) => app.evaluate(fn, arg);
  const until = async (fn, arg, ms = 20000, label = 'condition') => {
    const end = Date.now() + ms;
    let last;
    while (Date.now() < end) {
      try {
        last = await ev(fn, arg);
        if (last) return last;
      } catch (e) {
        last = String(e.message || e); // app still starting
      }
      await wait(250);
    }
    throw new Error(`timed out waiting for ${label} (last: ${JSON.stringify(last)})`);
  };
  return { app, ev, until };
}

// Runs in the main process: real mouse events into the dock renderer.
async function dockMouse(ev, steps) {
  await ev(async (_e, steps) => {
    const c = globalThis.__chatlings;
    const wc = c.dock.win.webContents;
    const b = c.dock.win.getBounds();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const s of steps) {
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      wc.sendInputEvent({ type: s.type, x, y, globalX: b.x + x + (s.dx || 0), globalY: b.y + y + (s.dy || 0), button: 'left', clickCount: 1 });
      await sleep(s.wait ?? 40);
    }
  }, steps);
}

/** Centre of bubble i inside the dock, in dock coordinates. */
async function bubbleXY(ev, i) {
  return ev((_e, i) => {
    const c = globalThis.__chatlings;
    const L = c.lib.layout;
    const b = c.dock.win.getBounds();
    const x = c.dock.edge() === 'right' ? b.width - L.COLUMN_W / 2 : L.COLUMN_W / 2;
    return { x, y: L.PAD + i * (L.BUBBLE + L.GAP) + L.BUBBLE / 2 };
  }, i);
}

async function click(ev, i) {
  const p = await bubbleXY(ev, i);
  await dockMouse(ev, [
    { type: 'mouseMove', ...p },
    { type: 'mouseDown', ...p },
    { type: 'mouseUp', ...p, wait: 300 },
  ]);
}

const dockDom = (ev) =>
  ev(async () => {
    const c = globalThis.__chatlings;
    return c.dock.win.webContents.executeJavaScript(`[...document.querySelectorAll('.bubble')].map(b => ({ key: b.dataset.key, mood: b.dataset.mood || null, badge: b.querySelector('.badge').textContent, count: b.classList.contains('has-count'), dot: b.classList.contains('has-dot'), asleep: b.classList.contains('asleep') }))`);
  });

const fakeAdd = (ev, i, n = 2) =>
  ev(async (_e, { i, n }) => {
    const c = globalThis.__chatlings;
    const a = c.store.accounts()[i];
    return c.accounts.state(a.id).view.webContents.executeJavaScript(`fake.add(${n})`);
  }, { i, n });

test('Chatlings end-to-end (fake chats)', { timeout: 240000 }, async (t) => {
  const { app, ev, until } = await launch();
  try {
    // all 4 accounts load one by one (3 s apart) and settle
    await until(() => {
      const c = globalThis.__chatlings;
      return c.store.accounts().every((a) => c.accounts.state(a.id).settled);
    }, null, 40000, 'accounts settled');

    await t.test('unread badges through all 3 tiers', async () => {
      for (let i = 0; i < 4; i++) await fakeAdd(ev, i, 2);
      const st = await until(() => {
        const c = globalThis.__chatlings;
        const s = c.store.accounts().map((a) => {
          const r = c.accounts.state(a.id);
          return { mode: a.fakeMode, count: r.count, dot: r.dot, previews: r.notifications.length };
        });
        return s.every((x) => x.dot) && s;
      }, null, 15000, 'all badges');
      const by = Object.fromEntries(st.map((s) => [s.mode, s]));
      assert.equal(by.title.count, 2, 'tier 1: title');
      assert.equal(by.dom.count, 2, 'tier 2: DOM badges');
      assert.equal(by.favicon.count, null, 'tier 3: favicon → dot only');
      assert.equal(by.notify.count, null);
      assert.equal(by.notify.previews, 2, 'notifications kept for preview');
      const dom = await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`[...document.querySelectorAll('.bubble')].every(b => b.dataset.mood === 'excited') && [...document.querySelectorAll('.bubble .badge')].map(b => b.textContent)`);
      }, null, 8000, 'excited moods');
      assert.deepEqual(dom, ['2', '2', '', '']);
    });

    await t.test('click a bubble opens the popup with that account', async () => {
      await click(ev, 1);
      const r = await until(() => {
        const c = globalThis.__chatlings;
        const id = c.store.accounts()[1].id;
        return c.popup.isShowing(id) && { id, visible: c.accounts.state(id).view.getVisible() };
      }, null, 5000, 'popup open');
      assert.equal(r.visible, true);
      // opening marks it viewed: the notification dot of account 3 is untouched
      await click(ev, 1);
      await until(() => !globalThis.__chatlings.popup.isVisible(), null, 4000, 'second click closes');
    });

    await t.test('hover shows the preview card with the latest notifications', async () => {
      // let the cards that popped up for the new messages go away first
      await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`document.getElementById('preview').hidden`);
      }, null, 12000, 'auto previews gone');
      const p = await bubbleXY(ev, 3);
      await dockMouse(ev, [{ type: 'mouseMove', ...p, wait: 900 }]);
      const card = await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`(() => { const c = document.getElementById('preview'); return c.classList.contains('shown') && c.querySelectorAll('.item').length; })()`);
      }, null, 5000, 'preview card');
      assert.equal(card, 2);
      const img = await ev(async () => (await globalThis.__chatlings.dock.win.webContents.capturePage()).toPNG().toString('base64'));
      fs.writeFileSync(path.join(SHOTS, 'preview.png'), Buffer.from(img, 'base64'));
      await dockMouse(ev, [{ type: 'mouseMove', x: 2, y: 2, wait: 600 }]);
    });

    await t.test('a new message pops up its preview by itself, then hides', async () => {
      await ev(() => globalThis.__chatlings.popup.hide());
      await wait(300);
      await fakeAdd(ev, 3, 1); // notify-mode account
      const shown = await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`document.getElementById('preview').classList.contains('shown') && document.querySelectorAll('#preview .item').length`);
      }, null, 5000, 'auto preview');
      assert.equal(shown, 3);
      await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`!document.getElementById('preview').classList.contains('shown')`);
      }, null, 9000, 'auto preview hides');
    });

    await t.test('× on hover hides a bubble until its next message', async () => {
      await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`document.getElementById('preview').hidden`);
      }, null, 12000, 'previews gone');
      const id = await ev(() => globalThis.__chatlings.store.accounts()[1].id);
      const shown = await ev(async () =>
        globalThis.__chatlings.dock.win.webContents.executeJavaScript(`(() => {
          const b = document.querySelectorAll('.bubble')[1];
          b.dispatchEvent(new PointerEvent('pointerenter'));
          const d = getComputedStyle(b.querySelector('.close')).display;
          b.querySelector('.close').click();
          return d;
        })()`),
      );
      assert.equal(shown, 'block', 'x shows on hover');
      await wait(400);
      let keys = (await dockDom(ev)).map((d) => d.key);
      assert.ok(!keys.includes(id), 'bubble gone');
      assert.equal(await ev(() => globalThis.__chatlings.popup.isVisible()), false, 'did not open the chat');
      await fakeAdd(ev, 1, 1);
      await until(async (_e, id) => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`[...document.querySelectorAll('.bubble')].some(b => b.dataset.key === ${JSON.stringify(id)})`);
      }, id, 6000, 'bubble back after a new message');
    });

    await t.test('drag the dock across the screen snaps it to the other edge', async () => {
      // a preview that popped up for the last message widens the dock; wait it out
      await until(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`document.getElementById('preview').hidden`);
      }, null, 12000, 'previews gone');
      const before = await ev(() => globalThis.__chatlings.store.data.dock.edge);
      const p = await bubbleXY(ev, 0);
      const dir = before === 'right' ? -1 : 1;
      const steps = [{ type: 'mouseMove', ...p }, { type: 'mouseDown', ...p, wait: 150 }];
      for (let k = 1; k <= 12; k++) steps.push({ type: 'mouseMove', ...p, dx: dir * k * 90 });
      steps.push({ type: 'mouseUp', ...p, dx: dir * 12 * 90, wait: 500 });
      await dockMouse(ev, steps);
      const after = await until(() => globalThis.__chatlings.store.data.dock.edge, null, 3000);
      assert.notEqual(after, before);
      const ok = await ev(({ screen }) => {
        const c = globalThis.__chatlings;
        const b = c.dock.win.getBounds();
        const wa = screen.getDisplayMatching(b).workArea;
        return c.dock.edge() === 'left' ? b.x === wa.x : b.x + b.width === wa.x + wa.width;
      });
      assert.ok(ok, 'hugs the edge');
      assert.equal(await ev(() => globalThis.__chatlings.popup.isVisible()), false, 'drag did not open the popup');
    });

    await t.test('merged mode: one hub bubble, click fans out', async () => {
      await ev(() => globalThis.__chatlings.setSetting('merged', true));
      try {
        await wait(400);
        let dom = await dockDom(ev);
        assert.deepEqual(dom.map((d) => d.key), ['__hub']);
        const total = await ev(() => {
          const c = globalThis.__chatlings;
          return c.store.accounts().reduce((n, a) => n + Math.max(0, c.accounts.state(a.id).count || 0), 0);
        });
        assert.equal(dom[0].badge, String(total), 'hub shows the total');
        await click(ev, 0);
        await wait(300);
        dom = await dockDom(ev);
        assert.equal(dom.length, 5);
      } finally {
        await ev(() => globalThis.__chatlings.setSetting('merged', false));
        await wait(300);
      }
    });

    await t.test('full app window: sidebar, bubbles come back when minimised, bubble click restores it', async () => {
      const r = await ev(async () => {
        const c = globalThis.__chatlings;
        const id = c.store.accounts()[2].id;
        c.openFull(id);
        await new Promise((r) => setTimeout(r, 1500));
        const side = c.popup.win.contentView.children.find((v) => /sidebar.html/.test(v.webContents.getURL()));
        const items = side ? await side.webContents.executeJavaScript("document.querySelectorAll('.acc').length") : 0;
        const active = side ? await side.webContents.executeJavaScript("document.querySelectorAll('.acc.on').length") : 0;
        const focused = c.popup.win.isFocused();
        const dockWhileFocused = c.dock.win.isVisible();
        c.popup.minimize();
        await new Promise((r) => setTimeout(r, 600));
        return { id, mode: c.popup.mode(), items, active, focused, dockWhileFocused, dockAfterMin: c.dock.win.isVisible(), fullOpen: c.popup.isFullOpen() };
      });
      assert.equal(r.mode, 'full');
      assert.equal(r.items, 4, 'all accounts in the sidebar');
      assert.equal(r.active, 1);
      if (r.focused) assert.equal(r.dockWhileFocused, false, 'bubbles hidden while using the full app');
      assert.equal(r.dockAfterMin, true, 'bubbles back after minimising');
      assert.equal(r.fullOpen, true);
      await click(ev, 0);
      const back = await until(() => {
        const c = globalThis.__chatlings;
        return !c.popup.win.isMinimized() && c.popup.mode() === 'full' && c.popup.currentId();
      }, null, 5000, 'full window restored');
      assert.equal(back, await ev(() => globalThis.__chatlings.store.accounts()[0].id), 'switched to the clicked account');
      await ev(() => globalThis.__chatlings.popup.hide());
      await wait(300);
      assert.equal(await ev(() => globalThis.__chatlings.popup.isFullOpen()), false, 'closing goes back to bubbles only');
    });

    // Windows only: Linux cannot hide windows from capture, and macOS CI runners
    // have no screen-recording permission for desktopCapturer.
    await t.test('content protection hides the bubbles from screen capture', { skip: process.platform !== 'win32' }, async () => {
      // magenta ring on the first bubble, easy to find in a screenshot
      await ev(() => {
        const c = globalThis.__chatlings;
        const a = c.store.accounts()[0];
        c.store.updateAccount(a.id, { color: '#FF00FF', skin: 'avatar' });
        c.pushState();
      });
      await wait(600);
      const count = (protect) =>
        ev(async ({ desktopCapturer, screen }, protect) => {
          const c = globalThis.__chatlings;
          c.setSetting('contentProtection', protect);
          await new Promise((r) => setTimeout(r, 700));
          const b = c.dock.win.getBounds();
          const d = screen.getDisplayMatching(b);
          const sf = d.scaleFactor;
          let sources = [];
          for (let i = 0; i < 4 && !sources.length; i++) {
            sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) } });
            if (!sources.length) await new Promise((r) => setTimeout(r, 1000));
          }
          if (!sources.length) throw new Error('desktopCapturer returned no screens (is the screen locked?)');
          const src = sources.find((s) => String(s.display_id) === String(d.id)) || sources[0];
          const img = src.thumbnail;
          const sz = img.getSize();
          const kx = sz.width / d.size.width;
          const ky = sz.height / d.size.height;
          const bmp = img.toBitmap(); // BGRA
          let n = 0;
          const x0 = Math.max(0, Math.floor((b.x - d.bounds.x) * kx));
          const y0 = Math.max(0, Math.floor((b.y - d.bounds.y) * ky));
          const x1 = Math.min(sz.width, Math.ceil((b.x - d.bounds.x + b.width) * kx));
          const y1 = Math.min(sz.height, Math.ceil((b.y - d.bounds.y + b.height) * ky));
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const o = (y * sz.width + x) * 4;
              if (bmp[o + 2] > 220 && bmp[o + 1] < 50 && bmp[o] > 220) n++;
            }
          }
          return n;
        }, protect);
      const visible = await count(false);
      const hidden = await count(true);
      assert.ok(visible > 50, `bubble visible in capture when protection is off (${visible} px)`);
      assert.equal(hidden, 0, 'no bubble pixels in capture when protection is on');
    });

    await t.test('PIN lock blocks the popup and previews', async () => {
      const r = await ev(() => {
        const c = globalThis.__chatlings;
        c.store.setSetting('pin', c.lib.hashPin('2580'));
        c.lock.lock();
        const id = c.store.accounts()[3].id;
        c.openAccount(id);
        return { locked: c.lock.isLocked(), showingChat: c.popup.isShowing(id), popup: c.popup.isVisible(), chatVisible: c.accounts.state(id).view.getVisible() };
      });
      assert.deepEqual(r, { locked: true, showingChat: false, popup: true, chatVisible: false });
      const dom = await (async () => {
        await wait(300);
        return dockDom(ev);
      })();
      assert.ok(dom.every((d) => d.badge === ''), 'numbers hidden while locked');
      const prev = await ev(async () => {
        const c = globalThis.__chatlings;
        return c.dock.win.webContents.executeJavaScript(`bb.invoke('dock:preview', ${JSON.stringify('x')}).then(() => 1)`).then(() => null);
      });
      assert.equal(prev, null);
      const u = await ev(() => {
        const c = globalThis.__chatlings;
        const bad = c.lock.unlock('1111');
        const good = c.lock.unlock('2580');
        const id = c.store.accounts()[3].id;
        return { bad: bad.ok, good: good.ok, showingChat: c.popup.isShowing(id) };
      });
      assert.deepEqual(u, { bad: false, good: true, showingChat: true });
      await ev(() => {
        const c = globalThis.__chatlings;
        c.store.setSetting('pin', null);
        c.popup.hide();
      });
    });

    await t.test('working hours: outside → hide or mute', async () => {
      const r = await ev(() => {
        const c = globalThis.__chatlings;
        const a = c.store.accounts()[2];
        const now = new Date();
        const day = (now.getDay() + 3) % 7; // a day that is not today
        c.store.updateAccount(a.id, { schedule: { enabled: true, days: [day], from: '09:00', to: '10:00', outside: 'mute' } });
        const muted = c.sound.play(c.store.account(a.id), { muted: true, locked: false });
        c.store.updateAccount(a.id, { schedule: { outside: 'hide' } });
        c.pushState();
        return { id: a.id, muted };
      });
      assert.equal(r.muted, false, 'no sound while muted');
      await wait(400);
      const keys = (await dockDom(ev)).map((d) => d.key);
      assert.ok(!keys.includes(r.id), 'bubble hidden outside hours');
      await ev((_e, id) => {
        const c = globalThis.__chatlings;
        c.store.updateAccount(id, { schedule: { enabled: false } });
        c.pushState();
      }, r.id);
    });

    await t.test('sleeping destroys the view, clicking wakes it', async () => {
      const id = await ev(() => {
        const c = globalThis.__chatlings;
        const a = c.store.accounts()[0];
        c.accounts.sleep(a.id, { manual: true });
        c.pushState();
        return a.id;
      });
      const st = await ev((_e, id) => {
        const s = globalThis.__chatlings.accounts.state(id);
        return { view: !!s.view, awake: s.awake, count: s.count };
      }, id);
      assert.deepEqual({ view: st.view, awake: st.awake }, { view: false, awake: false });
      await wait(300);
      const dom = await dockDom(ev);
      assert.equal(dom[0].asleep, true);
      assert.equal(dom[0].mood, 'sleepy');
      await click(ev, 0);
      await until((_e, id) => globalThis.__chatlings.accounts.state(id).awake, id, 5000, 'woke on click');
      await ev(() => globalThis.__chatlings.popup.hide());
    });

    await t.test('RAM watch reloads only while the popup is hidden', async () => {
      const r = await ev(async () => {
        const c = globalThis.__chatlings;
        const id = c.store.accounts()[1].id;
        c.store.setSetting('memThresholdMB', 1);
        c.openAccount(id);
        await new Promise((r) => setTimeout(r, 300));
        c.memory.check();
        const whileOpen = c.accounts.lastReloadAt(id);
        c.popup.hide();
        c.memory.check();
        const whileHidden = c.accounts.lastReloadAt(id);
        c.store.setSetting('memThresholdMB', 800);
        return { whileOpen, whileHidden };
      });
      assert.equal(r.whileOpen, 0);
      assert.ok(r.whileHidden > 0);
    });

    const img = await ev(async () => (await globalThis.__chatlings.dock.win.webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(SHOTS, 'dock.png'), Buffer.from(img, 'base64'));
    console.log('screenshots in', SHOTS);
  } finally {
    await app.close();
  }
});
