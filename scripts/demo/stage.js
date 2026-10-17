// Demo timeline. Runs the real dock renderer in an iframe with a mocked
// bridge, over a generic spreadsheet. scripts/demo/main.cjs records frames.
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const DOCK_URL = q.get('dock');
  const CHAT_URL = q.get('chat');
  const DICT = JSON.parse(decodeURIComponent(q.get('dict')));
  const TIMELINE = q.get('timeline') || 'gif';
  const LANG = q.get('lang') || 'en';
  const W = Number(q.get('w') || 960);
  const H = Number(q.get('h') || 560);
  document.documentElement.style.setProperty('--W', W + 'px');
  document.documentElement.style.setProperty('--H', H + 'px');
  if (q.get('pw')) document.documentElement.style.setProperty('--PW', q.get('pw') + 'px');
  if (q.get('ph')) document.documentElement.style.setProperty('--PH', q.get('ph') + 'px');
  if (TIMELINE === 'video') document.body.classList.add('video');
  const LAYOUT = { COLUMN_W: 84, PREVIEW_W: 300, BUBBLE: 56, GAP: 12, PAD: 14 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);

  // ---- spreadsheet ----
  const cols = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const widths = [34, 40, 150, 90, 90, 90, 90, 90, 90, 90, 90, 90];
  const items = ['Office rent', 'Salaries', 'Software', 'Marketing', 'Travel', 'Hardware', 'Training', 'Utilities', 'Insurance', 'Events', 'Legal', 'Misc'];
  let html = '<colgroup>' + widths.map((w) => `<col style="width:${w}px">`).join('') + '</colgroup>';
  html += '<tr>' + cols.map((c) => `<th>${c}</th>`).join('') + '</tr>';
  html += '<tr><th>1</th><td></td><td><b>Item</b></td><td><b>Q3</b></td><td><b>Q4</b></td><td><b>Δ</b></td>' + '<td></td>'.repeat(6) + '</tr>';
  const ROWS = Math.max(18, Math.ceil((H - 112) / 22));
  for (let r = 0; r < ROWS; r++) {
    const it = items[r];
    const a = it ? 1200 + ((r * 7919) % 8000) : '';
    const b = it ? a + ((r * 3571) % 1400) - 500 : '';
    html += `<tr><th>${r + 2}</th><td></td><td>${it || ''}</td><td class="n">${a ? a.toLocaleString('en') : ''}</td><td class="n${r === 3 ? ' sel' : ''}">${b ? b.toLocaleString('en') : ''}</td><td class="n">${it ? (((b - a) / a) * 100).toFixed(1) + '%' : ''}</td>${'<td></td>'.repeat(6)}</tr>`;
  }
  $('sheet').innerHTML = html;

  // ---- fake accounts ----
  const avatar = (bg) =>
    'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${bg}"/><circle cx="20" cy="16" r="7" fill="#fff"/><path d="M7 38c2-9 8-12 13-12s11 3 13 12z" fill="#fff"/></svg>`);
  const icons = window.parent === window ? JSON.parse(decodeURIComponent(q.get('icons'))) : {};
  const now = Date.now();
  const base = (o) => ({
    visible: true,
    muted: false,
    count: 0,
    dot: false,
    asleep: false,
    open: false,
    avatar: null,
    profileName: null,
    mood: { unread: 0, lastNewAt: 0, oldestUnreadAt: 0, lastReadAt: 0, lastReplyLatency: null, asleep: false, lastActivityAt: now },
    ...o,
  });
  const accounts = [
    base({ id: 'z', name: 'Zalo — Shop', color: '#3B82F6', skin: 'cat', adapter: 'zalo', adapterName: 'Zalo', icon: icons.zalo, iconColor: '#0068FF' }),
    base({ id: 'w', name: 'WhatsApp', color: '#F97316', skin: 'dog', adapter: 'whatsapp', adapterName: 'WhatsApp', icon: icons.whatsapp, iconColor: '#25D366' }),
    base({ id: 'd', name: 'Discord', color: '#10B981', skin: 'avatar', avatar: avatar('#8B5CF6'), adapter: 'discord', adapterName: 'Discord', icon: icons.discord, iconColor: '#5865F2' }),
  ];
  const previews = {
    z: [{ nid: 'z1', title: 'Lan', body: LANG === 'vi' ? 'Anh ơi, khách hỏi báo giá Q4 ạ' : 'Hi! The client is asking for the Q4 quote', time: Date.now() }],
    d: [
      { nid: '1', title: 'Huy · #release', body: 'Build is green, shipping v0.1 tonight 🚀', time: Date.now() - 60000 },
      { nid: '2', title: 'Lan · #design', body: 'New bubble skins look so cute', time: Date.now() - 4 * 60000 },
    ],
  };
  const state = () => ({ edge: 'right', merged: false, locked: false, paused: false, now: Date.now(), accounts: accounts.map((a) => ({ ...a, mood: { ...a.mood } })) });

  // ---- bridge for the dock iframe ----
  const dock = $('dock');
  window.demo = {
    onInvoke(ch, id) {
      if (ch === 'bb:init') return { locale: 'en', dict: DICT, adapters: [], state: state(), version: 'demo' };
      if (ch === 'dock:preview') {
        const a = accounts.find((x) => x.id === id);
        return { id, name: a.name, adapterName: a.adapterName, items: previews[id] || [], count: a.count, dot: a.dot, asleep: false };
      }
      if (ch === 'dock:dragStart') return { x: 0, y: 0, width: 0, height: 0 };
      return null;
    },
    onSend(ch, d) {
      if (ch === 'dock:size') {
        const w = LAYOUT.COLUMN_W + (d.previewHeight ? LAYOUT.PREVIEW_W : 0);
        const h = Math.max(d.count * LAYOUT.BUBBLE + (d.count - 1) * LAYOUT.GAP + 2 * LAYOUT.PAD, d.previewHeight ? LAYOUT.PAD + d.previewIndex * (LAYOUT.BUBBLE + LAYOUT.GAP) + d.previewHeight + LAYOUT.PAD * 2 : 0);
        dock.style.width = w + 'px';
        dock.style.height = h + 'px';
      }
    },
  };
  const push = () => dock.contentWindow.__emit('bb:state', state());
  const inDock = (fn) => fn(dock.contentWindow.document);
  const bubbleRect = (i) => {
    const r = dock.getBoundingClientRect();
    return { x: r.right - LAYOUT.COLUMN_W / 2, y: r.top + LAYOUT.PAD + i * (LAYOUT.BUBBLE + LAYOUT.GAP) + LAYOUT.BUBBLE / 2 };
  };
  const cursorTo = async (x, y, ms = 650) => {
    $('cursor').style.left = x - 3 + 'px';
    $('cursor').style.top = y - 2 + 'px';
    await sleep(ms);
  };
  const caption = async (text) => {
    $('caption').style.opacity = 0;
    await sleep(200);
    $('caption').textContent = text;
    $('caption').style.opacity = text ? 1 : 0;
  };
  const hover = (i, on) =>
    inDock((doc) => {
      const b = doc.querySelectorAll('.bubble')[i];
      b.dispatchEvent(new PointerEvent(on ? 'pointerenter' : 'pointerleave'));
    });

  const inDockEmit = (ch, data) => dock.contentWindow.__emit(ch, data);
  const newMessage = (a, n) => {
    a.count += n;
    a.dot = true;
    a.mood = { ...a.mood, unread: a.count, lastNewAt: Date.now(), oldestUnreadAt: a.mood.oldestUnreadAt || Date.now(), lastActivityAt: Date.now() };
    push();
  };

  const T = {
    vi: {
      float: 'Đang làm Excel vẫn thấy chat ở mép màn hình',
      newmsg: 'Có tin mới: mèo nhảy, tin hiện ngay cạnh bong bóng',
      hover: 'Rê chuột để xem nhanh',
      reply: 'Bấm để trả lời, xong quay lại làm việc',
      replyText: 'Ok em, 15 phút nữa anh gửi nhé',
      happy: 'Trả lời nhanh: mèo vui',
      multi: 'Nhiều nick của mọi app, cùng lúc',
      share: 'Chia sẻ màn hình? Người xem không thấy bong bóng',
      pip: 'Người xem thấy',
      sub: 'Bong bóng chat nổi cho máy tính',
      tags: ['Miễn phí', 'Mã nguồn mở', 'Windows', 'Không thu thập dữ liệu'],
    },
    en: {
      float: 'Your chats stay on the edge of the screen while you work',
      newmsg: 'New message: the cat jumps and the message pops up',
      hover: 'Hover to peek',
      reply: 'Click to reply, then back to work',
      replyText: 'Sure, sending it in 15 minutes',
      happy: 'Replied fast: happy cat',
      multi: 'Several accounts of every app, at once',
      share: 'Sharing your screen? Viewers do not see the bubbles',
      pip: 'What viewers see',
      sub: 'Floating chat heads for your desktop',
      tags: ['Free', 'Open source', 'Windows', 'No telemetry'],
    },
  }[LANG];

  async function card(on, withUrl) {
    const c = $('card');
    if (on) {
      $('card-sub').textContent = T.sub;
      $('card-tags').innerHTML = T.tags.map((t) => '<span>' + t + '</span>').join('');
      $('card-url').textContent = withUrl ? 'chatlings.submit69.com' : '';
      c.style.opacity = 0;
      c.classList.add('on');
      await sleep(30);
      c.style.opacity = 1;
    } else {
      c.style.opacity = 0;
      await sleep(500);
      c.classList.remove('on');
    }
  }

  async function runVideo() {
    dock.src = DOCK_URL;
    await new Promise((r) => (dock.onload = r));
    await card(true, false);
    await sleep(2200);
    await card(false);
    await caption(T.float);
    await sleep(2600);

    // Zalo message: cat jumps, the preview pops up by itself
    await caption(T.newmsg);
    const z = accounts[0];
    newMessage(z, 1);
    await sleep(300);
    inDockEmit('dock:peek', { id: 'z', ms: 3500 });
    await sleep(3600);
    newMessage(accounts[1], 1);
    await sleep(1000);

    // hover Discord
    await caption(T.hover);
    const d = bubbleRect(2);
    await cursorTo(d.x, d.y);
    hover(2, true);
    await sleep(2600);
    hover(2, false);

    // click Zalo, type a reply
    await caption(T.reply);
    const zr = bubbleRect(0);
    await cursorTo(zr.x, zr.y);
    $('ptitle').textContent = z.name;
    $('popup').style.setProperty('--c', z.color);
    $('chat').src = CHAT_URL;
    await new Promise((r) => ($('chat').onload = r));
    $('chat').contentWindow.fake.add(1);
    $('popup').classList.add('open');
    z.open = true;
    push();
    await sleep(700);
    await $('chat').contentWindow.fake.send(T.replyText, 50);
    await sleep(700);
    await cursorTo(Math.round(W * 0.3), Math.round(H * 0.55), 700);
    $('popup').classList.remove('open');
    z.open = false;
    z.count = 0;
    z.dot = false;
    z.mood = { ...z.mood, unread: 0, oldestUnreadAt: 0, lastReadAt: Date.now(), lastReplyLatency: 20000, lastActivityAt: Date.now() };
    push();
    await caption(T.happy);
    await sleep(2400);

    // more accounts
    await caption(T.multi);
    accounts.push(base({ id: 'z2', name: 'Zalo 2', color: '#EC4899', skin: 'dog', adapter: 'zalo', adapterName: 'Zalo', icon: icons.zalo, iconColor: '#0068FF' }));
    push();
    await sleep(800);
    accounts.push(base({ id: 't', name: 'Telegram', color: '#8B5CF6', skin: 'cat', adapter: 'telegram', adapterName: 'Telegram', icon: icons.telegram, iconColor: '#26A5E4' }));
    push();
    await sleep(800);
    newMessage(accounts[4], 3);
    await sleep(1600);

    // screen sharing: viewers do not see the bubbles
    await caption(T.share);
    const shot = $('pip-shot');
    shot.innerHTML = '';
    const clone = document.querySelector('.app').cloneNode(true);
    clone.style.position = 'relative';
    clone.style.width = W + 'px';
    clone.style.height = H + 'px';
    shot.append(clone);
    shot.style.transform = 'scale(' + 300 / W + ')';
    $('pip-label').textContent = '● ' + T.pip;
    $('pip').classList.add('on');
    await sleep(3400);
    $('pip').classList.remove('on');
    await caption('');

    await card(true, true);
    await sleep(3200);
    document.title = 'DONE';
  }

  async function run() {
    if (TIMELINE === 'video') return runVideo();
    dock.src = DOCK_URL;
    await new Promise((r) => (dock.onload = r));
    await sleep(900);
    await caption('Your chats float above your work');
    await sleep(1600);

    // a Zalo message arrives
    await caption('New message → the cat jumps');
    const z = accounts[0];
    z.count = 2;
    z.dot = true;
    z.mood = { ...z.mood, unread: 2, lastNewAt: Date.now(), oldestUnreadAt: Date.now(), lastActivityAt: Date.now() };
    push();
    await sleep(900);
    const w = accounts[1];
    w.count = 1;
    w.dot = true;
    w.mood = { ...w.mood, unread: 1, lastNewAt: Date.now(), oldestUnreadAt: Date.now(), lastActivityAt: Date.now() };
    push();
    await sleep(1500);

    // hover Discord → preview
    await caption('Hover to peek');
    const d = bubbleRect(2);
    await cursorTo(d.x, d.y);
    hover(2, true);
    await sleep(2300);
    hover(2, false);

    // click Zalo → popup
    await caption('Click to chat, then back to Excel');
    const zr = bubbleRect(0);
    await cursorTo(zr.x, zr.y);
    $('ptitle').textContent = 'Zalo — Shop';
    $('popup').style.setProperty('--c', z.color);
    $('chat').src = CHAT_URL;
    await new Promise((r) => ($('chat').onload = r));
    $('chat').contentWindow.fake.add(2);
    $('popup').classList.add('open');
    z.open = true;
    push();
    await sleep(1800);
    await cursorTo(250, 330, 700);
    $('popup').classList.remove('open');
    z.open = false;
    z.count = 0;
    z.dot = false;
    z.mood = { ...z.mood, unread: 0, oldestUnreadAt: 0, lastReadAt: Date.now(), lastReplyLatency: 20000, lastActivityAt: Date.now() };
    push();
    await caption('Replied fast → happy cat');
    await sleep(2300);
    await caption('Chatlings · free & open source');
    await sleep(1800);
    document.title = 'DONE';
  }
  run();
})();
