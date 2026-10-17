# Skins

A skin draws what is inside one bubble. Built-in: `avatar` (profile picture or initials), `cat`, `dog`.

## Contract

A skin is a plain script that registers itself on `window.BBSkins`:

```js
(function () {
  'use strict';
  const skins = (window.BBSkins = window.BBSkins || {});
  skins.frog = {
    id: 'frog',
    name: { en: 'Frog', vi: 'Ếch' },
    // Moods this skin draws. Any mood not listed falls back to 'idle'.
    moods: ['idle', 'excited', 'happy', 'sad', 'sleepy'],
    // Called when the bubble is created or its skin/avatar/name/colour changes.
    // ctx = { name, avatar (data: URL or null), color }
    render(el, ctx) {
      el.innerHTML = '<svg class="pet frog" viewBox="0 0 64 64">…</svg>';
    },
    // Called when the mood changes. Usually just set an attribute and let CSS do the rest.
    setState(el, mood) {
      el.dataset.mood = mood;
    },
  };
})();
```

Then:

1. add `<script src="skins/frog.js"></script>` to `src/renderer/dock.html`,
2. add `'frog'` to `SKINS` in `src/main/store.js`,
3. add `"skin.frog"` to `src/i18n/en.json` and `vi.json`.

## Moods

The bubble element gets `data-mood="…"` and, while the mouse is over it, the class `hover`. Moods are computed by `src/renderer/mood.js` (`mood()` is pure and unit-tested):

| Mood | When | Typical drawing |
|---|---|---|
| `idle` | nothing special | breathe, blink, sway the tail |
| `excited` | there are unread messages | jump (the bubble does it for you), wiggle ears, open mouth |
| `happy` | you opened the chat within 2 minutes of the message | `^ ^` eyes, blush; floating hearts are drawn by the bubble |
| `sad` | a message has been waiting more than 30 minutes | ears down, frown |
| `sleepy` | the account is asleep (RAM saver), or nothing happened for 30 minutes | eyes closed; "zzz" is drawn by the bubble |

Plus `hover` (class, not a mood): perk up.

## Rules

- SVG + CSS keyframes only. Animate `transform` and `opacity`; **no CSS `filter`** (it costs a lot of memory in the always-on dock).
- Use `var(--c)` for the account colour somewhere visible (outline, collar…), so accounts stay distinguishable.
- Respect reduced motion: the dock already turns all animations off under `prefers-reduced-motion`; make sure each mood still reads without movement (closed eyes, ears down…).
- Keep the drawing inside a 64×64 box; the bubble is 56×56 and the pet SVG sits at `left:-4px; top:-6px` so ears can stick out.
- Inject your CSS once (see `cat.js`).
