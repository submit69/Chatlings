// Title bar of the chat window. Compact popup: open full app, pin, close.
// Full window: minimise, maximise, close (back to bubbles).
(async () => {
  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  BB.applyI18n();
  const $ = (id) => document.getElementById(id);
  $('menu').onclick = () => bb.send('bar:menu');
  $('reload').onclick = () => bb.send('bar:reload');
  $('full').onclick = () => bb.send('bar:full');
  $('pin').onclick = () => bb.send('bar:pin');
  $('min').onclick = () => bb.send('bar:min');
  $('max').onclick = () => bb.send('bar:max');
  $('close').onclick = () => bb.send('bar:close');
  document.body.classList.add('compact');
  // Double-click the bar to maximise, like a normal window.
  document.body.addEventListener('dblclick', (e) => !e.target.closest('button') && bb.send('bar:max'));
  bb.on('bar:state', (s) => {
    if (s.color) document.body.style.setProperty('--c', s.color);
    if (s.name) $('name').textContent = s.name;
    if (s.adapter) {
      $('app').textContent = s.adapter.name;
      $('glyph').textContent = '';
      $('glyph').append(BB.iconSvg(s.adapter.icon, '#fff'));
    }
    if (s.mode) {
      document.body.classList.toggle('full', s.mode === 'full');
      document.body.classList.toggle('compact', s.mode !== 'full');
    }
    if ('maximized' in s) $('max').title = BB.t(s.maximized ? 'bar.restore' : 'bar.max');
    if ('pinned' in s) {
      $('pin').classList.toggle('on', !!s.pinned);
      $('pin').title = BB.t(s.pinned ? 'bar.unpin' : 'bar.pin');
    }
  });
})();
