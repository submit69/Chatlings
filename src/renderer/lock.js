// PIN lock screen shown over the chat in the popup.
(async () => {
  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  BB.applyI18n();
  const $ = (id) => document.getElementById(id);
  const input = $('pin');
  const dots = $('dots');
  const msg = $('msg');
  let busy = false;
  let waitTimer = null;

  function draw() {
    const n = Math.max(4, input.value.length);
    dots.textContent = '';
    for (let i = 0; i < n; i++) dots.append(BB.el('i', { class: i < input.value.length ? 'on' : '' }));
  }

  async function submit() {
    if (busy || input.value.length < 4) return;
    busy = true;
    const r = await bb.invoke('lock:unlock', input.value);
    busy = false;
    input.value = '';
    draw();
    if (r.ok) {
      msg.textContent = '';
      return;
    }
    dots.classList.remove('shake');
    void dots.offsetWidth;
    dots.classList.add('shake');
    if (r.waitMs > 0) countdown(r.waitMs);
    else msg.textContent = BB.t('lock.wrong', { n: r.left });
  }

  function countdown(ms) {
    clearInterval(waitTimer);
    const until = Date.now() + ms;
    const tick = () => {
      const s = Math.ceil((until - Date.now()) / 1000);
      if (s <= 0) {
        clearInterval(waitTimer);
        msg.textContent = '';
        return;
      }
      msg.textContent = BB.t('lock.wait', { s });
    };
    tick();
    waitTimer = setInterval(tick, 500);
  }

  function press(k) {
    if (k === 'del') input.value = input.value.slice(0, -1);
    else if (k === 'ok') return submit();
    else if (input.value.length < 8) input.value += k;
    draw();
  }

  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']) {
    const label = k === 'del' ? '⌫' : k === 'ok' ? '→' : k;
    $('pad').append(BB.el('button', { class: k === 'ok' ? 'primary' : '', text: label, onclick: () => press(k), title: k === 'ok' ? BB.t('lock.unlock') : null }));
  }
  document.addEventListener('keydown', (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('ok');
  });
  bb.on('lock:state', () => {
    input.value = '';
    draw();
    window.focus();
  });
  draw();
})();
