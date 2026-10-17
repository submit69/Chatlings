// Account list on the left of the full window.
(async () => {
  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  BB.applyI18n();
  const { el, iconSvg } = BB;
  const list = document.getElementById('list');
  document.getElementById('add').onclick = () => bb.send('side:add');
  document.getElementById('settings').onclick = () => bb.send('side:settings');

  function initials(name) {
    const p = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] || '?').slice(0, 2)).toUpperCase();
  }

  function render(s) {
    list.textContent = '';
    for (const a of s.accounts) {
      const pic = el('div', { class: 'pic' });
      if (a.avatar) pic.append(el('img', { src: a.avatar, alt: '', draggable: 'false' }));
      else pic.textContent = initials(a.name);
      const n = !s.locked && a.count > 0 ? (a.count > 99 ? '99+' : String(a.count)) : '';
      const badge = n ? el('span', { class: 'badge', text: n }) : a.dot ? el('span', { class: 'badge dot' }) : null;
      const app = el('span', { class: 'app', style: { background: a.iconColor } }, iconSvg(a.icon, '#fff'));
      const btn = el(
        'button',
        {
          class: `acc${a.id === s.current ? ' on' : ''}${a.asleep ? ' asleep' : ''}`,
          title: `${a.name} — ${a.adapterName}`,
          style: { '--c': a.color },
          onclick: () => bb.send('side:select', a.id),
          oncontextmenu: (e) => (e.preventDefault(), bb.send('side:context', a.id)),
        },
        pic,
        app,
        badge,
      );
      btn.style.setProperty('--c', a.color);
      list.append(btn);
    }
  }

  bb.on('side:state', render);
})();
