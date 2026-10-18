// "Add account" picker: pick an app (tier 1, tier 2 beta) or a custom URL.
(async () => {
  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  BB.applyI18n();
  const { el, t, iconSvg } = BB;
  const $ = (id) => document.getElementById(id);

  async function add(payload) {
    $('err').textContent = '';
    document.body.style.cursor = 'progress';
    const r = await bb.invoke('picker:add', payload);
    document.body.style.cursor = '';
    if (!r.ok) $('err').textContent = r.error || t('picker.failed');
  }

  for (const a of init.adapters) {
    if (a.tier > 2) continue;
    const tile = el(
      'button',
      { class: 'tile', type: 'button', onclick: () => add({ adapter: a.id }), 'data-adapter': a.id },
      el('span', { class: 'glyph', style: { background: a.color } }, iconSvg(a.icon, '#fff')),
      el('span', {}, el('div', { class: 'n', text: a.name }), el('div', { class: 'h', text: t(a.loginHint === 'qr' ? 'picker.loginQr' : 'picker.loginPassword') })),
    );
    $(a.tier === 1 ? 'tier1' : 'tier2').append(tile);
  }

  // Not a chat account: a shortcut to noilamviec.com (company reviews), opened in the browser.
  $('tier1').append(
    el(
      'button',
      {
        class: 'tile link',
        type: 'button',
        'data-link': 'noilamviec',
        title: 'noilamviec.com',
        onclick: () => bb.invoke('app:openExternal', 'https://noilamviec.com/?utm_source=chatlings&utm_medium=app&utm_campaign=picker'),
      },
      el('span', { class: 'glyph img' }, el('img', { src: 'brand/noilamviec.png', alt: '' })),
      el('span', {}, el('div', { class: 'n', text: t('picker.nlv') }), el('div', { class: 'h', text: t('picker.nlvHint') })),
    ),
  );

  // "Fun" section: the author's free browser games, opened in the browser (3D, too heavy for a chat frame).
  for (const g of [
    { id: 'superdog', name: 'Super Dog', url: 'https://superdog.submit69.com/' },
    { id: 'chickenplus', name: 'Chicken Plus', url: 'https://chickenplus.submit69.com/' },
    { id: 'superbus', name: 'Super Bus', url: 'https://superbus.submit69.com/' },
  ]) {
    $('fun').append(
      el(
        'button',
        {
          class: 'tile link',
          type: 'button',
          'data-link': g.id,
          title: g.url.replace(/^https:\/\/|\/$/g, ''),
          onclick: () => bb.invoke('app:openExternal', g.url + '?utm_source=chatlings&utm_medium=app&utm_campaign=picker'),
        },
        el('span', { class: 'glyph img' }, el('img', { src: 'brand/game-' + g.id + '.png', alt: '' })),
        el('span', {}, el('div', { class: 'n', text: g.name }), el('div', { class: 'h', text: t('picker.game.' + g.id) })),
      ),
    );
  }

  if (init.donate) {
    $('tier1').append(
      el(
        'button',
        { class: 'tile link', type: 'button', 'data-link': 'donate', onclick: () => bb.send('donate:open') },
        el('span', { class: 'glyph', style: { background: '#F59E0B', fontSize: '22px' } }, '☕'),
        el('span', {}, el('div', { class: 'n', text: t('donate.tile') }), el('div', { class: 'h', text: t('donate.tileHint') })),
      ),
    );
  }

  $('custom').addEventListener('submit', (e) => {
    e.preventDefault();
    add({ adapter: 'custom', name: $('cname').value, url: $('curl').value });
  });
})();
