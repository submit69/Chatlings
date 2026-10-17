'use strict';
// What differs between Windows, macOS and Linux, in one place.
const fs = require('fs');
const os = require('os');
const path = require('path');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

const features = {
  // setIgnoreMouseEvents(…, {forward}) only exists on Windows and macOS; on
  // Linux the dock keeps catching clicks in its (small) transparent margin.
  clickThrough: isWin || isMac,
  // setContentProtection: Windows 10 2004+ and macOS. Not available on Linux.
  captureProtection: isWin || isMac,
  // SHQueryUserNotificationState (presentation mode / full-screen game).
  presentationDetection: isWin,
};

/** A user agent that matches the OS, so sign-in pages see a consistent browser. */
function chromeUA(chromeVersion = process.versions.chrome || '140') {
  const major = String(chromeVersion).split('.')[0];
  const osPart = isMac ? 'Macintosh; Intel Mac OS X 10_15_7' : isLinux ? 'X11; Linux x86_64' : 'Windows NT 10.0; Win64; x64';
  return `Mozilla/5.0 (${osPart}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

/** Linux has no setLoginItemSettings: use an XDG autostart entry instead. */
function linuxAutostartFile() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'autostart', 'chatlings.desktop');
}

function setAutoLaunch(app, enabled) {
  if (!app.isPackaged) return;
  if (!isLinux) {
    app.setLoginItemSettings({ openAtLogin: !!enabled, args: ['--hidden'] });
    return;
  }
  const file = linuxAutostartFile();
  if (!enabled) {
    fs.rmSync(file, { force: true });
    return;
  }
  // AppImage: the stable path is $APPIMAGE (process.execPath is a temp mount).
  const exe = process.env.APPIMAGE || process.execPath;
  const extra = process.env.APPIMAGE ? ' --no-sandbox' : '';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ['[Desktop Entry]', 'Type=Application', 'Name=Chatlings', `Exec="${exe}"${extra} --hidden`, 'X-GNOME-Autostart-enabled=true', ''].join('\n'));
}

module.exports = { isWin, isMac, isLinux, features, chromeUA, setAutoLaunch, linuxAutostartFile };
