// Avatar skin: the account's profile picture, or its initials on the account
// colour. Moods use the shared bubble effects in dock.css (hop, hearts, zzz).
(function () {
  'use strict';
  const skins = (window.BBSkins = window.BBSkins || {});

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    const s = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
    return s.toUpperCase();
  }

  skins.avatar = {
    id: 'avatar',
    name: { en: 'Avatar', vi: 'Ảnh đại diện' },
    moods: ['idle', 'excited', 'happy', 'sad', 'sleepy'],
    render(el, ctx) {
      el.textContent = '';
      const wrap = document.createElement('div');
      wrap.className = 'skin-avatar';
      if (ctx.avatar) {
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = ctx.avatar;
        img.onerror = () => {
          img.remove();
          wrap.textContent = initials(ctx.name);
        };
        wrap.appendChild(img);
      } else {
        wrap.textContent = initials(ctx.name);
      }
      el.appendChild(wrap);
    },
    setState(el, mood) {
      el.dataset.mood = mood;
    },
  };
})();
