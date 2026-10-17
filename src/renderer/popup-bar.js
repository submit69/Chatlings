// Title bar of the chat popup.
(async () => {
  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  BB.applyI18n();
  const $ = (id) => document.getElementById(id);
  $('menu').onclick = () => bb.send('bar:menu');
  $('reload').onclick = () => bb.send('bar:reload');
  $('pin').onclick = () => bb.send('bar:pin');
  $('close').onclick = () => bb.send('bar:close');
  bb.on('bar:state', (s) => {
    if (s.color) document.body.style.setProperty('--c', s.color);
    if (s.name) $('name').textContent = s.name;
    if (s.adapter) {
      $('app').textContent = s.adapter.name;
      $('glyph').textContent = '';
      $('glyph').append(BB.iconSvg(s.adapter.icon, '#fff'));
    }
    if ('pinned' in s) {
      $('pin').classList.toggle('on', !!s.pinned);
      $('pin').title = BB.t(s.pinned ? 'bar.unpin' : 'bar.pin');
    }
  });
})();
