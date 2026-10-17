// Dock renderer: draws the bubbles, handles hover/click/drag/context menu,
// the preview card, moods and sounds. Talks to main only through window.bb.
(async function () {
  'use strict';
  const { t, el, iconSvg, ago } = window.BB;
  const L = { BUBBLE: 56, GAP: 12, PAD: 14 }; // = src/main/layout.js
  const HOVER_DELAY = 300;

  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  let state = init.state;
  let expanded = false; // merged mode: list open
  const nodes = new Map(); // key -> {root, face, key, skinKey}
  let order = []; // keys currently shown, top to bottom
  const column = document.getElementById('column');
  const card = document.getElementById('preview');

  // ---------- click-through ----------
  let over = false;
  function setOver(v) {
    if (v === over) return;
    over = v;
    bb.send('dock:hover', v);
  }
  document.addEventListener('mousemove', (e) => setOver(!!e.target.closest('.hit') || dragging));
  document.addEventListener('mouseleave', () => !dragging && setOver(false));

  // ---------- render ----------
  function visibleAccounts() {
    return state.accounts.filter((a) => a.visible);
  }

  function items() {
    const list = visibleAccounts();
    if (!state.accounts.length) return [{ key: '__add' }];
    if (state.merged && list.length > 1) return expanded ? [{ key: '__hub' }, ...list.map((a) => ({ key: a.id, a }))] : [{ key: '__hub' }];
    return list.map((a) => ({ key: a.id, a }));
  }

  function makeNode(key) {
    const root = el(
      'div',
      { class: 'bubble hit', 'data-key': key },
      el('div', { class: 'face' }),
      el('div', { class: 'app' }),
      el('div', { class: 'badge' }),
      el('div', { class: 'zzz' }, el('span', { text: 'z' }), el('span', { text: 'z' }), el('span', { text: 'Z' })),
      el('div', { class: 'hearts' }, el('span', { text: '♥' }), el('span', { text: '♥' }), el('span', { text: '♥' })),
    );
    const n = { root, face: root.querySelector('.face'), key, skinKey: null };
    if (key !== '__add') {
      // × on hover: hide this bubble until its next message (hub: hide all).
      const close = el('button', { class: 'close', type: 'button', title: t(key === '__hub' ? 'dock.dismissAll' : 'dock.dismiss'), text: '×' });
      close.addEventListener('pointerdown', (e) => e.stopPropagation());
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePreview(true);
        bb.send('dock:dismiss', { id: key });
      });
      root.append(close);
    }
    wire(n);
    return n;
  }

  function hubTotal() {
    let count = 0;
    let dot = false;
    for (const a of visibleAccounts()) {
      if (a.count > 0) count += a.count;
      else if (a.dot) dot = true;
    }
    return { count, dot: dot || count > 0 };
  }

  function paint(n, a) {
    const r = n.root;
    if (n.key === '__add') {
      r.classList.add('add');
      if (n.skinKey !== 'add') {
        n.face.textContent = '+';
        n.skinKey = 'add';
      }
      r.title = t('dock.add');
      return;
    }
    if (n.key === '__hub') {
      r.classList.add('hub');
      if (n.skinKey !== 'hub') {
        n.face.textContent = '';
        n.face.append(hubIcon());
        n.skinKey = 'hub';
      }
      setBadge(r, hubTotal());
      r.title = t(expanded ? 'dock.collapse' : 'dock.expand');
      return;
    }
    r.style.setProperty('--c', a.color);
    const skin = (window.BBSkins || {})[a.skin] || window.BBSkins.avatar;
    const skinKey = [a.skin, a.avatar ? a.avatar.length + a.avatar.slice(-16) : '', a.name, a.color].join('|');
    if (n.skinKey !== skinKey) {
      skin.render(n.face, { name: a.profileName || a.name, avatar: a.avatar, color: a.color });
      n.skinKey = skinKey;
      n.skin = skin;
    }
    const app = r.querySelector('.app');
    if (app.dataset.adapter !== a.adapter) {
      app.textContent = '';
      app.style.background = a.iconColor;
      app.append(iconSvg(a.icon, '#fff'));
      app.dataset.adapter = a.adapter;
    }
    setBadge(r, a);
    r.classList.toggle('asleep', a.asleep);
    r.classList.toggle('muted', a.muted);
    r.classList.toggle('open', a.open);
    applyMood(n, a);
    const status = a.asleep ? ` · ${t('dock.asleep')}` : '';
    r.title = `${a.name} — ${a.adapterName}${status}`;
  }

  function setBadge(r, s) {
    const badge = r.querySelector('.badge');
    const hasCount = !state.locked && s.count > 0;
    r.classList.toggle('has-count', hasCount);
    r.classList.toggle('has-dot', !hasCount && !!s.dot);
    badge.textContent = hasCount ? (s.count > 99 ? '99+' : String(s.count)) : '';
  }

  function applyMood(n, a) {
    const m = BBMood.pick(n.skin, BBMood.mood(a.mood, Date.now()));
    if (n.root.dataset.mood !== m) {
      n.root.dataset.mood = m;
      n.skin && n.skin.setState(n.face, m);
    }
  }

  function hubIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'hub-icon');
    svg.innerHTML = '<path fill="#fff" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" opacity=".95"/><circle cx="8" cy="10.5" r="1.4" fill="#6366f1"/><circle cx="12" cy="10.5" r="1.4" fill="#6366f1"/><circle cx="16" cy="10.5" r="1.4" fill="#6366f1"/>';
    return svg;
  }

  function render() {
    document.body.className = `edge-${state.edge}${state.paused ? ' paused' : ''}${state.locked ? ' locked' : ''}`;
    const list = items();
    const keys = list.map((i) => i.key);
    for (const [k, n] of nodes) {
      if (!keys.includes(k)) {
        n.root.remove();
        nodes.delete(k);
      }
    }
    list.forEach((it, i) => {
      let n = nodes.get(it.key);
      if (!n) {
        n = makeNode(it.key);
        nodes.set(it.key, n);
      }
      if (column.children[i] !== n.root) column.insertBefore(n.root, column.children[i] || null);
      paint(n, it.a);
    });
    order = keys;
    if (previewFor && !keys.includes(previewFor)) hidePreview(true);
    sendSize();
  }

  let sizeKey = '';
  function sendSize() {
    const s = { count: Math.max(1, order.length), previewHeight: previewShownHeight, previewIndex: previewIndex };
    const k = JSON.stringify(s);
    if (k === sizeKey) return;
    sizeKey = k;
    bb.send('dock:size', s);
  }

  // Idle life without continuous animation: every few seconds one bubble
  // fidgets once (see the memory note in dock.css).
  let fidgetTurn = 0;
  setInterval(() => {
    if (document.hidden || state.paused) return;
    const list = order.map((k) => nodes.get(k)).filter((n) => n && !n.key.startsWith('__'));
    if (!list.length) return;
    const n = list[fidgetTurn++ % list.length];
    n.root.classList.remove('fidget');
    void n.root.offsetWidth;
    n.root.classList.add('fidget');
    setTimeout(() => n.root.classList.remove('fidget'), 1700);
  }, 3500);

  // Moods depend on time (sad after 30 min, sleepy after 30 min idle).
  setInterval(() => {
    for (const a of state.accounts) {
      const n = nodes.get(a.id);
      if (n) applyMood(n, a);
    }
  }, 5000);

  // ---------- pointer: click / drag / context ----------
  let dragging = false;

  function wire(n) {
    const r = n.root;
    let start = null;
    r.addEventListener('pointerenter', () => {
      r.classList.add('hover');
      if (!n.key.startsWith('__')) schedulePreview(n.key);
    });
    r.addEventListener('pointerleave', () => {
      r.classList.remove('hover');
      leaveSoon();
    });
    r.addEventListener('pointerdown', async (e) => {
      if (e.button !== 0 || e.target.closest('.close')) return;
      try {
        r.setPointerCapture(e.pointerId);
      } catch {}
      const s0 = (start = { sx: e.screenX, sy: e.screenY, bounds: null, moved: false, dx: 0, dy: 0 });
      // The window position arrives asynchronously; moves made before it are
      // not lost: the latest one is applied as soon as it is known.
      s0.boundsP = bb.invoke('dock:dragStart').then((b) => {
        s0.bounds = b;
        if (s0.moved && b) bb.send('dock:dragMove', { x: b.x + s0.dx, y: b.y + s0.dy });
      });
    });
    r.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.screenX - start.sx;
      const dy = e.screenY - start.sy;
      if (!start.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        start.moved = true;
        dragging = true;
        r.classList.add('dragging');
        hidePreview(true);
      }
      start.dx = dx;
      start.dy = dy;
      if (start.moved && start.bounds) bb.send('dock:dragMove', { x: start.bounds.x + dx, y: start.bounds.y + dy });
    });
    const end = async (e) => {
      if (!start) return;
      const s = start;
      start = null;
      await s.boundsP;
      // a quick flick may end before any move was applied
      if (s.moved && s.bounds) bb.send('dock:dragMove', { x: s.bounds.x + s.dx, y: s.bounds.y + s.dy });
      try {
        if (e && e.pointerId !== undefined && r.hasPointerCapture(e.pointerId)) r.releasePointerCapture(e.pointerId);
      } catch {}
      bb.send('dock:dragEnd');
      if (s.moved) {
        dragging = false;
        r.classList.remove('dragging');
        return;
      }
      click(n);
    };
    r.addEventListener('pointerup', end);
    r.addEventListener('pointercancel', () => {
      if (start) bb.send('dock:dragEnd');
      start = null;
      dragging = false;
      r.classList.remove('dragging');
    });
    r.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      hidePreview(true);
      bb.send('dock:context', { id: n.key });
    });
  }

  function click(n) {
    hidePreview(true);
    if (n.key === '__hub') {
      expanded = !expanded;
      render();
      return;
    }
    const top = L.PAD + order.indexOf(n.key) * (L.BUBBLE + L.GAP);
    bb.send('dock:click', { id: n.key, top });
    if (state.merged && expanded && n.key !== '__add') {
      expanded = false;
      setTimeout(render, 200);
    }
  }

  // ---------- preview card ----------
  let previewTimer = null;
  let leaveTimer = null;
  let peekTimer = null;
  let peekId = null; // card shown by itself for a new message
  let previewFor = null;
  let previewShownHeight = 0;
  let previewIndex = 0;

  function schedulePreview(id) {
    clearTimeout(leaveTimer);
    clearTimeout(previewTimer);
    if (previewFor === id) return;
    previewTimer = setTimeout(() => showPreview(id), HOVER_DELAY);
  }

  function leaveSoon() {
    clearTimeout(previewTimer);
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      // An auto-popped card (new message) is hidden by its own timer.
      if (!card.matches(':hover') && previewFor !== peekId) hidePreview();
    }, 220);
  }

  card.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
  card.addEventListener('pointerleave', leaveSoon);

  async function showPreview(id) {
    if (dragging) return;
    const p = await bb.invoke('dock:preview', id);
    if (!p || dragging) return;
    const a = state.accounts.find((x) => x.id === id);
    if (!a) return;
    previewFor = id;
    card.style.setProperty('--c', a.color);
    card.textContent = '';
    card.append(el('div', { class: 'head' }, el('b', { text: a.name }), a.name === p.adapterName ? null : el('span', { class: 'sub', text: p.adapterName })));
    if (p.items.length) {
      for (const it of p.items) {
        card.append(
          el(
            'div',
            { class: 'item', 'data-nid': it.nid },
            el('div', { class: 't' }, el('span', { text: it.title || a.name }), el('span', { class: 'time', text: ago(it.time) })),
            it.body ? el('div', { class: 'b', text: it.body }) : null,
          ),
        );
      }
    } else {
      const status = p.asleep ? t('dock.asleep') : p.count > 0 ? t('dock.unreadN', { n: p.count }) : p.dot ? t('dock.unreadDot') : t('dock.noMessages');
      card.append(el('div', { class: 'empty', text: status }));
    }
    card.append(el('div', { class: 'foot', text: t('dock.clickToOpen') }));
    previewIndex = Math.max(0, order.indexOf(id));
    card.style.top = L.PAD + previewIndex * (L.BUBBLE + L.GAP) + 'px';
    card.hidden = false;
    card.classList.remove('shown');
    previewShownHeight = Math.ceil(card.getBoundingClientRect().height);
    sendSize();
    // Wait for the window to grow before showing the card.
    setTimeout(() => previewFor === id && card.classList.add('shown'), 60);
  }

  function hidePreview(now) {
    clearTimeout(previewTimer);
    clearTimeout(peekTimer);
    peekId = null;
    if (!previewFor) return;
    previewFor = null;
    card.classList.remove('shown');
    const done = () => {
      if (previewFor) return;
      card.hidden = true;
      previewShownHeight = 0;
      sendSize();
    };
    if (now) done();
    else setTimeout(done, 150);
  }

  card.addEventListener('click', (e) => {
    const id = previewFor;
    if (!id) return;
    const item = e.target.closest('.item');
    hidePreview(true);
    bb.send('dock:previewClick', { id, nid: item ? item.dataset.nid : null });
  });

  // ---------- main → dock ----------
  bb.on('bb:state', (s) => {
    state = { ...state, ...s };
    render();
  });
  bb.on('dock:play', (p) => window.BBSound.play(p));

  // New message: main asks to show the card by itself for a few seconds.
  // It stays while the mouse is on the card or a bubble.
  bb.on('dock:peek', async ({ id, ms }) => {
    if (dragging) return;
    if (previewFor && previewFor !== id && card.matches(':hover')) return; // user is reading another card
    clearTimeout(peekTimer);
    await showPreview(id);
    peekId = id;
    const check = () => {
      if (previewFor !== id) return;
      if (card.matches(':hover') || document.querySelector('.bubble.hover')) {
        peekTimer = setTimeout(check, 1500);
        return;
      }
      peekId = null;
      hidePreview();
    };
    peekTimer = setTimeout(check, ms || 6000);
  });
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden || state.paused));

  window.__dock = { get state() { return state; }, render };
  render();
})();
