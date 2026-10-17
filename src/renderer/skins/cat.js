// Cat skin. Pure SVG + CSS keyframes; the account colour (--c) is the outline.
// Moods: idle (blink, tail sway, breathe), hover (ears perk), excited (ears
// wiggle, mouth open), happy (^ ^ eyes, blush), sad (ears down, frown),
// sleepy (eyes closed).
(function () {
  'use strict';
  const skins = (window.BBSkins = window.BBSkins || {});

  const SVG = `
<svg class="pet cat" viewBox="0 0 64 64" aria-hidden="true">
  <g class="tail"><path d="M49 54 q13 -1 10 -17" stroke="#E8964A" stroke-width="5.5" fill="none" stroke-linecap="round"/></g>
  <g class="ear ear-l"><path d="M11 25 L13 5 L29 15 Z" fill="#F4A259" stroke="var(--c)" stroke-width="2.5" stroke-linejoin="round"/><path d="M15.5 19 L16.5 10 L24 15 Z" fill="#FFB4A2"/></g>
  <g class="ear ear-r"><path d="M53 25 L51 5 L35 15 Z" fill="#F4A259" stroke="var(--c)" stroke-width="2.5" stroke-linejoin="round"/><path d="M48.5 19 L47.5 10 L40 15 Z" fill="#FFB4A2"/></g>
  <circle class="head" cx="32" cy="37" r="24" fill="#F4A259" stroke="var(--c)" stroke-width="3"/>
  <path d="M32 14.5 v6 M25.5 15.5 l1.2 5 M38.5 15.5 l-1.2 5" stroke="#D9822B" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="32" cy="46" rx="11" ry="8" fill="#FFE8D1"/>
  <g class="eyes-open"><g class="eye"><ellipse cx="23.5" cy="35" rx="3.3" ry="4.3" fill="#2D2A32"/><circle cx="24.6" cy="33.4" r="1.2" fill="#fff"/></g><g class="eye"><ellipse cx="40.5" cy="35" rx="3.3" ry="4.3" fill="#2D2A32"/><circle cx="41.6" cy="33.4" r="1.2" fill="#fff"/></g></g>
  <g class="eyes-closed" stroke="#2D2A32" stroke-width="2" fill="none" stroke-linecap="round"><path d="M19.5 35.5 q4 3 8 0"/><path d="M36.5 35.5 q4 3 8 0"/></g>
  <g class="eyes-happy" stroke="#2D2A32" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M19.5 37 q4 -5.5 8 0"/><path d="M36.5 37 q4 -5.5 8 0"/></g>
  <g class="cheeks"><circle cx="18.5" cy="43" r="2.8" fill="#FF8FA3"/><circle cx="45.5" cy="43" r="2.8" fill="#FF8FA3"/></g>
  <path d="M30 41.5 h4 l-2 2.5 z" fill="#E5737F"/>
  <g class="mouth-smile" stroke="#2D2A32" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M28 46 q2 2.2 4 0 q2 2.2 4 0"/></g>
  <g class="mouth-sad" stroke="#2D2A32" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M28.5 48.5 q3.5 -3 7 0"/></g>
  <g class="mouth-open"><ellipse cx="32" cy="47.5" rx="2.8" ry="2.4" fill="#7A2E3A"/></g>
  <g class="whiskers" stroke="#2D2A32" stroke-width="1" opacity=".5" stroke-linecap="round"><path d="M7 41 h10"/><path d="M8 46 l9 -2"/><path d="M47 41 h10"/><path d="M47 44 l9 2"/></g>
</svg>`;

  const CSS = `
.cat .tail { transform-origin: 49px 54px; }
.fidget .cat .tail, [data-mood="excited"] .cat .tail { animation: cat-tail 1.6s ease-in-out 1; }
[data-mood="excited"] .cat .tail { animation-iteration-count: infinite; }
@keyframes cat-tail { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-14deg) } }
.cat .ear { transition: transform .25s; }
.cat .ear-l { transform-origin: 20px 20px; } .cat .ear-r { transform-origin: 44px 20px; }
[data-mood="excited"] .cat .ear-l { animation: cat-ear-l .45s ease-in-out infinite; }
[data-mood="excited"] .cat .ear-r { animation: cat-ear-r .45s ease-in-out infinite .1s; }
@keyframes cat-ear-l { 50% { transform: rotate(-12deg) } }
@keyframes cat-ear-r { 50% { transform: rotate(12deg) } }
.hover .cat .ear-l { transform: rotate(-8deg) translateY(-1.5px); }
.hover .cat .ear-r { transform: rotate(8deg) translateY(-1.5px); }
[data-mood="sad"] .cat .ear-l { transform: rotate(-32deg) translate(-2px, 4px); }
[data-mood="sad"] .cat .ear-r { transform: rotate(32deg) translate(2px, 4px); }
[data-mood="sleepy"] .cat .ear-l { transform: rotate(-14deg) translateY(2px); }
[data-mood="sleepy"] .cat .ear-r { transform: rotate(14deg) translateY(2px); }
.cat .eye { transform-box: fill-box; transform-origin: center; }
.fidget .cat .eye { animation: pet-blink 1.6s 1; }
.cat .eyes-closed, .cat .eyes-happy, .cat .mouth-sad, .cat .mouth-open { display: none; }
.cat .cheeks { opacity: .35; transition: opacity .3s; }
[data-mood="sleepy"] .cat .eyes-open, [data-mood="happy"] .cat .eyes-open { display: none; }
[data-mood="sleepy"] .cat .eyes-closed { display: inline; }
[data-mood="happy"] .cat .eyes-happy { display: inline; }
[data-mood="happy"] .cat .cheeks { opacity: .9; }
[data-mood="excited"] .cat .mouth-smile { display: none; }
[data-mood="excited"] .cat .mouth-open { display: inline; }
[data-mood="sad"] .cat .mouth-smile { display: none; }
[data-mood="sad"] .cat .mouth-sad { display: inline; }
[data-mood="sad"] .cat .eye { transform: scaleY(.75); animation: none; }
[data-mood="sad"] .cat .tail, [data-mood="sleepy"] .cat .tail { animation-duration: 3s; }
`;

  let styled = false;
  skins.cat = {
    id: 'cat',
    name: { en: 'Cat', vi: 'Mèo' },
    moods: ['idle', 'excited', 'happy', 'sad', 'sleepy'],
    render(el) {
      if (!styled) {
        const s = document.createElement('style');
        s.textContent = CSS;
        document.head.appendChild(s);
        styled = true;
      }
      el.innerHTML = '<div class="pet-shadow"></div>' + SVG;
    },
    setState(el, mood) {
      el.dataset.mood = mood;
    },
  };
})();
