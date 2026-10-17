# Privacy

**Short version: Bongbong collects nothing. There is no Bongbong server.**

## What Bongbong connects to

1. **The chat sites you add** (for example chat.zalo.me, web.whatsapp.com). They load in Bongbong exactly like in a browser, and those sites' own privacy policies apply.
2. **GitHub Releases** of this project, once a day, to check for a new version. You can turn this off in Settings → General. Nothing about you is sent except what any web request carries (IP address, user agent).

Nothing else. No telemetry, no analytics, no crash reporting, no ads.

## What is stored on your computer

All in your Windows user profile (`%APPDATA%\Bongbong`):

- `bongbong.json`: your accounts (name, colour, skin, schedule…), the dock position and settings. If you set a PIN, only a salted scrypt hash of it is stored.
- `Partitions\<account>\`: one separate browser profile per account (cookies, local storage). This is how you stay logged in, and how several accounts of the same app stay separate.

Message previews (the last 3 notifications per account) are kept **in memory only** and are gone when Bongbong quits.

## The PIN

The PIN stops someone using your PC from opening your chats through Bongbong. It does **not** encrypt the login data on disk. Anyone with access to your Windows account can still read the browser profiles, like with any browser. Use Windows' own sign-in and disk encryption (BitLocker) for that.

## Screen sharing

By default Bongbong's windows are excluded from screenshots, recordings and screen sharing (Windows 10 version 2004 or newer). You see them; the people watching your shared screen do not. On older Windows versions this protection is not available.

## Removing everything

Remove each account (right-click its bubble → Remove account), or uninstall Bongbong and delete `%APPDATA%\Bongbong`.
