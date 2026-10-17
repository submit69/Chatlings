// Electron entry: renders public/og.html to public/og.png (1200×630) for link previews.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const dir = process.argv[process.argv.length - 1];
  const win = new BrowserWindow({ width: 1200, height: 630, show: false, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(dir, 'og.html'));
  await new Promise((r) => setTimeout(r, 800));
  let img = await win.webContents.capturePage();
  if (img.getSize().width !== 1200) img = img.resize({ width: 1200, height: 630, quality: 'best' });
  fs.writeFileSync(path.join(dir, 'og.png'), img.toPNG());
  fs.unlinkSync(path.join(dir, 'og.html'));
  app.exit(0);
});
