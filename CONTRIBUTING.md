# Contributing

Thanks for helping! The two easiest and most useful contributions are **a new app (adapter)** and **a new skin**. Both are a couple of small files, no build step.

## Setup

```bash
git clone https://github.com/submit69/chatlings.git
cd chatlings
npm install          # Node 22 or newer
npm start            # run Chatlings
npm run fake         # run it with fake chat pages, in a throw-away profile
npm test             # unit tests (node:test)
npm run e2e          # end-to-end test in real windows (~1 min)
```

If `npm start` behaves like plain Node (`app` is undefined), your editor set `ELECTRON_RUN_AS_NODE=1`. Unset it in that terminal.

No bundler, no framework: main process is CommonJS in `src/main`, pages are plain HTML/CSS/JS in `src/renderer`.

## Adding an app (adapter)

Each app is one folder in `src/adapters/<id>/` with two files.

**`src/adapters/myapp/selectors.js`**: the only file to touch when the site changes its markup.

```js
'use strict';
module.exports = {
  // Badges in the conversation list; their numbers are summed (a badge with no number counts as 1).
  unreadBadge: '.chat-list .unread-badge',
  // The logged-in user's name and avatar (optional).
  profileName: '.me .display-name',
  profileAvatar: '.me img.avatar',
};
```

**`src/adapters/myapp/index.js`**

```js
'use strict';
const { defineAdapter } = require('../common');
const selectors = require('./selectors');

// Title format: "(3) MyApp" when there are unread messages.   ← write what you saw
module.exports = defineAdapter({
  id: 'myapp',
  name: 'MyApp',
  tier: 2,                             // 1 = title + DOM + profile verified, 2 = beta
  url: 'https://web.myapp.com/',
  allowedHosts: ['myapp.com'],         // navigation outside these opens in your browser
  loginHint: 'qr',                     // 'qr' or 'password' (text in the picker)
  color: '#123456',                    // tile / corner glyph background
  size: { width: 420, height: 680 },   // default popup size (optional)
  icon: { viewBox: '0 0 24 24', path: 'M…' }, // monochrome glyph, or { text: 'M' }
  selectors,
  // Optional:
  // titlePatterns: [/^\((\d+)\)/],    // regexes whose group 1 is the count
  // parseUnread(title) { return { count: 3, dot: true } },
  // fallbackUrl: 'https://…',         // tried once if the main URL fails to load
});
```

Then add `'myapp'` to `IDS` in `src/adapters/index.js`.

Rules and tips:

- **Use the official web app only.** No unofficial APIs, no scraping of other people's data.
- **Unread counting has three tiers.** (1) the tab title, (2) `unreadFromDom` with your `selectors.unreadBadge`, (3) a dot when the favicon changes or a notification arrives. The title is the most reliable; selectors break when the site redesigns.
- `unreadFromDom` and `profileFromDom` are **serialised into the page** (`fn.toString()`), so if you write your own they must not use anything outside their argument.
- If sign-in goes through Google / Microsoft / Apple, spread `SSO.google` etc. into `allowedHosts` (see `slack/index.js`).
- Icons: monochrome glyphs from [simple-icons](https://simpleicons.org) (CC0) are fine. If a brand is not there, use `{ text: 'X' }`. Never use a logo as Chatlings' own branding.
- Run `npm test`. It checks that every adapter has the required fields and that `allowedHosts` covers the URL.
- Run `node scripts/check-adapters.mjs myapp` to open the real login page and make sure it is not blocked as an unsupported browser.
- In the PR, say what you verified with a real account (title format, selectors, profile) and what you could not.

## Adding a skin

A skin is one file in `src/renderer/skins/<id>.js` plus a `<script>` tag in `src/renderer/dock.html` and the id in `SKINS` in `src/main/store.js` (and a `skin.<id>` label in `src/i18n/*.json`). See [`src/renderer/skins/README.md`](src/renderer/skins/README.md) for the contract and the five moods.

## Translations

UI strings are in `src/i18n/en.json` and `vi.json`. A new language = a new JSON file with the same keys, plus its code in `LOCALES` in `src/main/i18n.js`. `npm test` fails if a key is missing or placeholders differ.

## Ground rules

- No telemetry, analytics or calls to servers other than the chat sites and GitHub Releases. PRs that add any will not be merged.
- Keep the dock light: CSS `transform`/`opacity` animations only, **no CSS filters** (they cost ~25 MB of tile memory in the dock).
- Pure logic (schedules, moods, sleep, limits…) goes in functions that can be tested with `node:test` without Electron.
