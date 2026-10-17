# Security

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
[Security → Report a vulnerability](https://github.com/submit69/Chatlings/security/advisories/new).
You will get an answer within a few days; fixes ship as a new release, which installed apps pick up through auto-update.

Only the latest release is supported.

## How Chatlings protects you

**Chat sites are untrusted content.** Each account runs the service's own web app in a separate, sandboxed browser profile:

- `contextIsolation`, `sandbox` and no Node.js in every chat view; the chat preload exposes nothing to the page except a replacement for `Notification`.
- A chat site can only navigate within its own domains (plus the sign-in pages it needs); any other link opens in your normal browser. The same applies to pop-up windows.
- Microphone, camera and screen sharing are never granted in the background. You are asked the first time a chat you are looking at needs them (calls), and you can remember the answer per account or change it in Settings.
- Message previews are shown as plain text (no HTML) and kept in memory only.

**Chatlings' own windows** (bubbles, settings, picker) are local pages with a strict Content-Security-Policy. The main process accepts their requests only from those local pages, and validates every setting it receives.

**The PIN lock** blocks opening chats, previews, Settings, adding, signing out or removing accounts until you unlock. Wrong PINs lock you out for 30 s, then 1 min, 2 min… up to 15 min. The PIN protects against people using your computer; it does **not** encrypt your login data (see [PRIVACY.md](PRIVACY.md)).

**The packaged app** has Electron's fuses set so it cannot be started as plain Node.js (`ELECTRON_RUN_AS_NODE`), with `NODE_OPTIONS`, or with a debugger attached (`--inspect`).

**Updates** come only from this repository's GitHub Releases over HTTPS, and the installer checks the SHA-512 of the download against `latest.yml`. Releases are built by GitHub Actions from the tagged source; build steps run with a read-only token, only the final publish step can write, and third-party actions are pinned to commits. Dependabot keeps Electron (Chromium) and actions up to date. Code signing is planned (see [docs/code-signing.md](docs/code-signing.md)).

**Linux AppImage:** Ubuntu 23.10+ blocks Chromium's sandbox inside AppImages, so the AppImage runs with `--no-sandbox`. Prefer the `.deb`, which keeps the sandbox.

**No telemetry, no server:** Chatlings talks only to the chat sites you add and to GitHub Releases.
