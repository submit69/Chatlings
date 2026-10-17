<div align="center">

<img src="build/icon.png" width="96" alt="" />

# Chatlings

**Chat heads for your desktop.** Zalo, Messenger, WhatsApp, Telegram, Discord and more float as bubbles on the edge of your screen. Click one to chat, click away to get back to work.

Several accounts at once · cat & dog bubbles · hidden from screen sharing · no telemetry · MIT

[English](README.md) · [Tiếng Việt](README.vi.md)

<img src="docs/demo.gif" width="760" alt="Bubbles for Zalo, WhatsApp and Discord floating over a spreadsheet; a message arrives, the cat bubble jumps, hovering shows a preview, clicking opens the chat" />

### [⬇ Download for Windows, macOS, Linux](https://github.com/submit69/chatlings/releases/latest) · [Website & 30-second video](https://chatlings.submit69.com)

</div>

---

## Supported apps

| | App | Sign in | Unread count |
|---|---|---|---|
| ✅ | **Zalo** | QR | title + list badges |
| ✅ | **Messenger** | email / password | title |
| ✅ | **Telegram** | QR / phone | title + list badges |
| ✅ | **WhatsApp** | QR | title + list badges |
| ✅ | **Discord** | QR / password | title + server badges |
| 🧪 | Slack · Microsoft Teams (work & personal) · Google Chat · Google Messages · Instagram · X · LinkedIn · Element (Matrix) | web sign-in | title / badges (beta) |
| ➕ | **Any other web chat**: type a name and a URL | | title |

Chatlings runs each service's **official web app** inside its own isolated browser profile. No unofficial APIs, so it is as safe for your account as using the website. Add the same app several times for several accounts: two Zalo + one WhatsApp + one Discord is fine.

Every login page above was opened in Chatlings and loads normally (no "unsupported browser"): `npm run check-adapters`. The list-badge selectors were written from the sites' public markup and still need confirming with logged-in accounts; until then the tab title (and a dot on new notifications) does the counting. Reports and PRs welcome.

## Features

| | |
|---|---|
| 🫧 **Floating bubbles** | Always on top, even over a maximised Excel. Drag to move; they snap to the nearest edge. Transparent areas let clicks through. |
| 👥 **Multi-account** | Any mix of apps and accounts, each in its own partition. Merge them into one bubble that fans out. |
| 👀 **Hover preview** | Rest the mouse on a bubble to see the last 3 messages. Kept in RAM only. |
| 🐱 **Pets with feelings** | Avatar, cat or dog. They jump when a message arrives, show hearts when you reply quickly, droop when a message waits over 30 minutes, doze when nothing happens. |
| 🙈 **Hidden from screen sharing** | Bubbles and chats are left out of screenshots, recordings and Meet / Zoom / Teams / OBS sharing. You still see them. Optionally hide while presenting or gaming. |
| 🌙 **Working hours** | Per account, night shifts included: outside hours hide the bubble or keep it silent. *Work* / *Personal* profiles, "do not disturb for 1 hour / until tomorrow". |
| 🔒 **PIN lock** | Locks after idle time or when Windows locks; 5 wrong tries = 30 s wait. Badges show only a dot while locked. |
| 🔔 **Sound per account** | Chime, bell, pop, meow, woof, your own file, or silent. The site's own sounds are muted while its popup is hidden. |
| 💤 **Account sleep** | A sleeping account uses ~0 MB and wakes for a minute every N minutes to check messages. Click to wake now. |
| 🧹 **Leak guard** | An account that grows past 800 MB (adjustable) is quietly reloaded while its popup is hidden. |

## Memory, honestly

Most of the RAM goes to the chat websites themselves. Each **awake** account is its own Chromium process: separate logins need separate processes. Chatlings keeps its own part small and lets you put accounts to sleep.

Measured with `npm run mem-report` (private memory, like Task Manager's *Memory* column), Windows 11, Electron 44, after 30 s:

| | Chatlings itself | Accounts | Total |
|---|---:|---:|---:|
| No accounts | 95 MB | — | 95 MB |
| 1 account | 106 MB | 23 MB | 129 MB |
| 5 accounts awake | 117 MB | 121 MB | 237 MB |
| 5 accounts **asleep** | 112 MB | **0 MB** | 112 MB |

These runs use tiny fake chat pages, so the *Accounts* column is the floor of one browser process, not the cost of a real app. A real logged-in Zalo is typically a few hundred MB, WhatsApp and Discord more, about the same as the same site in a Chrome tab. The **Memory** tab in Settings shows the live numbers per account, with *Sleep now* and *Reload* buttons.

Hardware acceleration is **off** by default because it saves ~50 MB (GPU process). Turn it on in Settings if video calls stutter (with it on: 141 MB with no accounts).

## Install

From [Releases](https://github.com/submit69/chatlings/releases/latest). The files are not code-signed yet, so your system asks once; you can read every line of the source first.

| | File | First start |
|---|---|---|
| **Windows 10/11** | `Chatlings-Setup-x.y.z.exe` (updates itself) or `…-portable.exe` | SmartScreen: **More info → Run anyway** |
| **macOS 11+** | `Chatlings-x.y.z-mac-arm64.dmg` (Apple M chips) or `…-mac-x64.dmg` (Intel) | Drag to Applications, **right-click → Open**. If blocked: System Settings → Privacy & Security → **Open Anyway** |
| **Linux** (Ubuntu, Debian…) | `chatlings_x.y.z_amd64.deb`, or `Chatlings-x.y.z-x86_64.AppImage` (updates itself) | `sudo apt install ./chatlings_*.deb`, or `chmod +x` the AppImage and run it |

Then pick an app and sign in on its own page (scan the QR for Zalo / WhatsApp / Telegram). Done.

**Differences by OS.** Hiding from screen sharing works on Windows and macOS only (Linux has no such API); hiding while presenting is Windows only. On Linux the transparent margin around the bubbles catches clicks (no click-through forwarding there), and under Wayland the system decides where windows go, so the bubbles may not sit exactly on the edge (X11 is fine). The AppImage runs with `--no-sandbox` because Ubuntu 23.10+ blocks Chromium's sandbox inside AppImages; the .deb keeps the sandbox, so prefer it. macOS builds update by downloading the new .dmg (apps not signed by Apple cannot update themselves). There is no iOS version: iPhones do not let apps float over other apps.

Right-click a bubble for skin, colour, sound, sleep mode, sign out. The tray icon has everything else.

## Privacy

**No telemetry, no analytics, no Chatlings server.** Chatlings only connects to the chat sites you add and, once a day, to this project's GitHub Releases to look for updates (can be turned off). Logins stay in your Windows profile. Details: [PRIVACY.md](PRIVACY.md). How the app is hardened and how to report a vulnerability: [SECURITY.md](SECURITY.md).

The PIN only stops people using your PC from opening your chats. It does **not** encrypt your login data.

## FAQ

**Why not LINE, Viber, Signal, KakaoTalk?** They have no web version, so there is nothing to put in a bubble. WeChat has one, but it refuses most new accounts.

**Will it log me out of the Zalo / WhatsApp app on my PC or phone?** Chatlings is just another *web* session. Zalo and WhatsApp limit how many devices can be linked to one account; if you are already at the limit, signing in here may sign out another web/desktop session of **the same account**. Different accounts never affect each other.

**Google Chat says "This browser or app may not be secure".** Google sometimes blocks sign-in inside embedded browsers. That is why Google Chat is beta. Signing in through a Google Workspace SSO page usually works; if not, there is no workaround yet.

**The unread number is wrong / missing for app X.** Sites change their markup. Selectors live in one file per app (`src/adapters/<app>/selectors.js`); a fix is usually a one-line PR. Chatlings always falls back to the tab title, then to a dot when the favicon changes or a notification arrives.

**I want to screenshot my bubbles.** Turn off *Privacy → Hide from screen sharing* in the tray first.

**Messenger keeps asking for a security check.** Meta sometimes shows a checkpoint on the first sign-in from a new browser. Complete it once; the login is then remembered.

## Roadmap

- One bubble per person or group, not just per account
- Ring only when you are @mentioned
- Shortcut: snip the screen or an Excel range as an image, paste into the open chat
- Global shortcut + quick search across accounts
- Code signing (SignPath)

## Contributing

New apps and new skins are small, self-contained PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) and [the skin guide](src/renderer/skins/README.md).

```bash
npm install
npm run fake     # try it with fake chats
npm test         # unit tests
npm run e2e      # end-to-end in real windows
```

## Disclaimer

Chatlings is an independent open-source project. It is **not affiliated with, endorsed by or connected to** Zalo, Meta (Messenger, WhatsApp, Instagram), Telegram, Discord, Slack, Microsoft, Google, X, LinkedIn, Element or any other supported service. All names and trademarks belong to their owners; service glyphs come from [simple-icons](https://simpleicons.org) (CC0) and are used only to tell services apart.

MIT © Chatlings contributors · Also see [noilamviec.com](https://noilamviec.com/?utm_source=chatlings&utm_medium=readme): anonymous, honest company reviews in Vietnam.
