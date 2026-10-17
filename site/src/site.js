// Language switch (Vietnamese is in the HTML, English below) and a download
// button that points straight at the latest installer on GitHub Releases.
(function () {
  'use strict';
  const EN = {
    'nav.features': 'Features',
    'nav.privacy': 'Privacy',
    'nav.faq': 'FAQ',
    'hero.pill': 'Free · Open source · Windows 10/11',
    'hero.h1a': 'Chat heads for your desktop,',
    'hero.h1b': 'reply without leaving your work',
    'hero.sub': 'Zalo, Messenger, WhatsApp, Telegram, Discord… become small bubbles on the edge of your screen, like chat heads on a phone. Several accounts at once; new messages pop up right next to the bubble.',
    'hero.download': 'Download for Windows',
    'hero.source': 'Source on GitHub',
    'hero.fine': 'No admin rights needed. No telemetry.',
    'apps.title': "Runs each app's official web version, every account in its own profile",
    'f.title': 'Everything you need to chat without leaving your work',
    'f.lead': 'Bubbles stay on top, even over a maximised Excel. Click to chat, click away to get back to work.',
    'f1.t': 'Floating bubbles',
    'f1.d': 'Drag them anywhere; they snap to the nearest edge. Hover for a × to hide one for now.',
    'f2.t': 'New messages pop up',
    'f2.d': "A preview card appears next to the bubble for a few seconds, without stealing the keyboard while you type.",
    'f3.t': 'Several accounts at once',
    'f3.d': '2 Zalo + 1 WhatsApp + 1 Discord? Sure. Each account is isolated, none logs the other out.',
    'f4.t': 'Full window when you need it',
    'f4.d': 'Open the app for a big chat window with your accounts on the left. Minimise it and it turns back into bubbles.',
    'f5.t': 'Hidden from screen sharing',
    'f5.d': 'Meet, Zoom, Teams and OBS do not see the bubbles or chats. You still see them.',
    'f6.t': 'Cats and dogs with feelings',
    'f6.d': 'They jump on new messages, show hearts when you reply quickly and droop when a message waits too long.',
    'f7.t': 'Working hours, do not disturb',
    'f7.d': 'Per-account hours (night shifts too), Work / Personal profiles, silence for an hour or until tomorrow.',
    'f8.t': 'PIN lock, sound per account',
    'f8.d': 'Locks when you step away. A different sound for each account: chime, meow, woof or your own file.',
    'f9.t': 'Saves RAM',
    'f9.d': 'Rarely used accounts can sleep at almost 0 MB and wake up now and then to check for messages.',
    'i.title': 'Installed in a minute',
    'i.lead': 'Installs for your Windows user only, no admin rights. Updates itself.',
    'i1.t': 'Download',
    'i1.d': 'Click "Download for Windows" above, or take the portable version from the Releases page.',
    'i2.t': 'Open it',
    'i2.d': 'The file is not code-signed yet, so Windows may warn: click "More info", then "Run anyway". The source is public on GitHub.',
    'i3.t': 'Add your accounts',
    'i3.d': "Pick an app and sign in on its own page (scan the QR code for Zalo, WhatsApp, Telegram). Done.",
    'p.title': 'Private by default',
    'p.lead': 'Chatlings has no servers of its own. MIT open source: read every line yourself.',
    'p1.t': 'No data collection',
    'p1.d': 'No telemetry, no analytics, no ads. The app only talks to the chat sites you add and to GitHub to check for updates.',
    'p2.t': 'No unofficial APIs',
    'p2.d': "It runs each app's official web version, as safe for your account as using a browser.",
    'p3.t': 'Your logins stay on your PC',
    'p3.d': 'Each account is a separate browser profile in your Windows user folder. Message previews live in RAM only.',
    'q.title': 'FAQ',
    'q1.q': 'Is it free?',
    'q1.a': 'Yes, completely free and open source under the MIT license.',
    'q2.q': 'Can my account get banned?',
    'q2.a': 'Chatlings runs the official web apps, just like opening chat.zalo.me or web.whatsapp.com in a browser. It uses no unofficial APIs.',
    'q3.q': 'Will it log me out of the app on my phone or PC?',
    'q3.a': 'Your phone is not affected. Zalo and WhatsApp limit how many web/desktop sessions an account can have; if you are at the limit, signing in here may end another web session of the same account. Different accounts never affect each other.',
    'q4.q': 'Why no LINE, Viber or Signal?',
    'q4.a': 'They have no web version, so there is nothing to put in a bubble. Any other web chat can be added by its address.',
    'q5.q': 'How much RAM does it use?',
    'q5.a': "Chatlings itself uses about 100 MB. Each open account uses about as much as that site in a Chrome tab. Accounts you rarely use can sleep at almost 0 MB.",
    'q6.q': 'macOS or Linux?',
    'q6.a': 'Windows 10/11 only for now. macOS and Linux are planned.',
    'end.title': 'Try it, it takes a minute',
    'end.lead': 'If you like it, a ⭐ on GitHub helps a lot.',
    'foot.privacy': 'Privacy policy',
    'foot.nlv': 'company reviews',
    'foot.dis': 'Chatlings is an independent project, not affiliated with Zalo, Meta, Telegram, Discord, Microsoft, Google or any supported service. All trademarks belong to their owners.',
  };

  const nodes = [...document.querySelectorAll('[data-i18n]')];
  const VI = Object.fromEntries(nodes.map((n) => [n.dataset.i18n, n.textContent]));
  const btn = document.getElementById('lang');
  const video = document.getElementById('video');
  let lang = 'vi';
  let version = '';

  function apply(l) {
    lang = l;
    const dict = l === 'en' ? EN : VI;
    for (const n of nodes) if (dict[n.dataset.i18n]) n.textContent = dict[n.dataset.i18n];
    document.documentElement.lang = l;
    btn.textContent = l === 'en' ? 'VI' : 'EN';
    const src = `/chatlings-demo-${l}.mp4`;
    if (!video.currentSrc.endsWith(src)) {
      video.poster = `/chatlings-demo-${l}.jpg`;
      video.src = src;
      video.play().catch(() => {});
    }
    showVersion();
    try {
      localStorage.setItem('lang', l);
    } catch {}
  }

  function showVersion() {
    if (!version) return;
    document.getElementById('ver').textContent = (lang === 'en' ? 'Version ' : 'Phiên bản ') + version + ' ·';
  }

  let saved = null;
  try {
    saved = localStorage.getItem('lang');
  } catch {}
  const first = saved || (/^vi\b/i.test(navigator.language || '') ? 'vi' : 'en');
  if (first === 'en') apply('en');
  btn.addEventListener('click', () => apply(lang === 'en' ? 'vi' : 'en'));

  // Point the download buttons at the latest installer.
  fetch('https://api.github.com/repos/submit69/Chatlings/releases/latest')
    .then((r) => (r.ok ? r.json() : null))
    .then((rel) => {
      if (!rel) return;
      const setup = (rel.assets || []).find((a) => /Setup-.*\.exe$/i.test(a.name));
      if (setup) document.querySelectorAll('a.dl').forEach((a) => (a.href = setup.browser_download_url));
      version = String(rel.tag_name || '').replace(/^v/, '');
      showVersion();
    })
    .catch(() => {});
})();
