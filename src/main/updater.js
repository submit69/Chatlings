'use strict';
// Updates come only from this project's GitHub Releases. The Windows installer
// and the Linux AppImage update themselves (electron-updater); the portable exe,
// the .deb, macOS (not signed by Apple) and dev builds only check the latest
// release tag and offer to open the download page.
const { app, dialog, shell, net } = require('electron');
const { t } = require('./i18n');

const OWNER = 'submit69';
const REPO = 'chatlings';
const RELEASES = `https://github.com/${OWNER}/${REPO}/releases/latest`;

function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

async function latestTag() {
  const res = await net.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  return j.tag_name;
}

function canSelfUpdate() {
  if (!app.isPackaged) return false;
  if (process.platform === 'win32') return !process.env.PORTABLE_EXECUTABLE_DIR;
  if (process.platform === 'linux') return !!process.env.APPIMAGE;
  return false; // macOS builds are not signed by Apple, so Squirrel.Mac refuses them
}

async function check({ interactive }) {
  try {
    if (canSelfUpdate()) {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      const r = await autoUpdater.checkForUpdates();
      const v = r && r.updateInfo && r.updateInfo.version;
      if (v && newer(v, app.getVersion())) {
        autoUpdater.once('update-downloaded', async () => {
          const { response } = await dialog.showMessageBox({ type: 'info', buttons: [t('update.restart'), t('common.later')], message: t('update.ready', { version: v }) });
          if (response === 0) autoUpdater.quitAndInstall();
        });
        if (interactive) dialog.showMessageBox({ type: 'info', message: t('update.downloading', { version: v }) });
        return { update: v };
      }
    } else {
      const tag = await latestTag();
      if (tag && newer(tag, app.getVersion())) {
        const { response } = await dialog.showMessageBox({ type: 'info', buttons: [t('update.open'), t('common.later')], message: t('update.available', { version: tag }) });
        if (response === 0) shell.openExternal(RELEASES);
        return { update: tag };
      }
    }
    if (interactive) dialog.showMessageBox({ type: 'info', message: t('update.none', { version: app.getVersion() }) });
    return { update: null };
  } catch (e) {
    if (interactive) dialog.showMessageBox({ type: 'warning', message: t('update.failed'), detail: String(e.message || e) });
    return { error: String(e.message || e) };
  }
}

module.exports = { check, newer, RELEASES };
