// Dog skin. Floppy ears flap when excited, droop when sad; tongue out when
// happy/excited; eyes closed when sleepy. The account colour (--c) is the collar.
(function () {
  'use strict';
  const skins = (window.BBSkins = window.BBSkins || {});

  const SVG = `
<svg class="pet dog" viewBox="0 0 64 64" aria-hidden="true">
  <circle class="head" cx="32" cy="35" r="23" fill="#C98B5B" stroke="var(--c)" stroke-width="3"/>
  <ellipse cx="25" cy="27" rx="7" ry="6" fill="#E9C29B" opacity=".85"/>
  <g class="ear ear-l"><path d="M14 14 C4 16 3 36 9 42 C13 45 17 40 18 33 C19 25 20 17 14 14 Z" fill="#7A4B2A" stroke="var(--c)" stroke-width="2"/></g>
  <g class="ear ear-r"><path d="M50 14 C60 16 61 36 55 42 C51 45 47 40 46 33 C45 25 44 17 50 14 Z" fill="#7A4B2A" stroke="var(--c)" stroke-width="2"/></g>
  <ellipse cx="32" cy="45" rx="11.5" ry="8.5" fill="#F3DCC2"/>
  <g class="eyes-open"><g class="eye"><circle cx="24" cy="33" r="3.6" fill="#2D2A32"/><circle cx="25.2" cy="31.6" r="1.2" fill="#fff"/></g><g class="eye"><circle cx="40" cy="33" r="3.6" fill="#2D2A32"/><circle cx="41.2" cy="31.6" r="1.2" fill="#fff"/></g></g>
  <g class="eyes-closed" stroke="#2D2A32" stroke-width="2" fill="none" stroke-linecap="round"><path d="M20 34 q4 3 8 0"/><path d="M36 34 q4 3 8 0"/></g>
  <g class="eyes-happy" stroke="#2D2A32" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M20 35 q4 -5.5 8 0"/><path d="M36 35 q4 -5.5 8 0"/></g>
  <g class="brows" stroke="#5C3A21" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M20.5 27.5 q3.5 -2.6 7 -0.4"/><path d="M43.5 27.5 q-3.5 -2.6 -7 -0.4"/></g>
  <ellipse cx="32" cy="40.5" rx="4.2" ry="3" fill="#2D2A32"/>
  <g class="mouth-smile" stroke="#2D2A32" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M32 43.5 v2 M27 45 q5 4 10 0"/></g>
  <g class="mouth-sad" stroke="#2D2A32" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M32 43.5 v2 M27.5 49 q4.5 -3.5 9 0"/></g>
  <g class="tongue"><path d="M29 47 h6 v3.5 a3 3 0 0 1 -6 0 z" fill="#F07C8A"/><path d="M32 47.5 v3" stroke="#D9576A" stroke-width="1"/></g>
  <path class="collar" d="M15 53 q17 9 34 0" stroke="var(--c)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="32" cy="58" r="2.4" fill="#FACC15" stroke="#B45309" stroke-width=".8"/>
</svg>`;

  const CSS = `
.dog .ear { transition: transform .3s; }
.dog .ear-l { transform-origin: 15px 15px; } .dog .ear-r { transform-origin: 49px 15px; }
.fidget .dog .ear-l { animation: dog-ear-idle 1.6s ease-in-out 1; }
@keyframes dog-ear-idle { 0%,60%,100% { transform: rotate(0) } 75% { transform: rotate(10deg) } }
[data-mood="excited"] .dog .ear-l { animation: dog-flap-l .35s ease-in-out infinite; }
[data-mood="excited"] .dog .ear-r { animation: dog-flap-r .35s ease-in-out infinite; }
@keyframes dog-flap-l { 50% { transform: rotate(18deg) } }
@keyframes dog-flap-r { 50% { transform: rotate(-18deg) } }
.hover .dog .ear-l { transform: rotate(12deg); } .hover .dog .ear-r { transform: rotate(-12deg); }
[data-mood="sad"] .dog .ear-l { animation: none; transform: rotate(-10deg) translateY(4px); }
[data-mood="sad"] .dog .ear-r { transform: rotate(10deg) translateY(4px); }
[data-mood="sad"] .dog .brows path:first-child { transform: rotate(-16deg); transform-origin: 27px 27px; }
[data-mood="sad"] .dog .brows path:last-child { transform: rotate(16deg); transform-origin: 37px 27px; }
.dog .eye { transform-box: fill-box; transform-origin: center; }
.fidget .dog .eye { animation: pet-blink 1.6s 1; }
.dog .eyes-closed, .dog .eyes-happy, .dog .mouth-sad, .dog .tongue { display: none; }
[data-mood="sleepy"] .dog .eyes-open, [data-mood="happy"] .dog .eyes-open { display: none; }
[data-mood="sleepy"] .dog .eyes-closed { display: inline; }
[data-mood="happy"] .dog .eyes-happy { display: inline; }
[data-mood="happy"] .dog .tongue, [data-mood="excited"] .dog .tongue { display: inline; }
.dog .tongue { transform-origin: 32px 47px; }
[data-mood="excited"] .dog .tongue, [data-mood="happy"] .dog .tongue { animation: dog-pant .5s ease-in-out infinite; }
@keyframes dog-pant { 50% { transform: scaleY(1.18) } }
[data-mood="sad"] .dog .mouth-smile { display: none; }
[data-mood="sad"] .dog .mouth-sad { display: inline; }
`;

  let styled = false;
  skins.dog = {
    id: 'dog',
    name: { en: 'Dog', vi: 'Cún' },
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
