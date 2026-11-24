'use strict';
// Draws the repository's social preview (the card shown when a link to the repo is shared):
// docs/social-preview.png, 1280×640. Upload it in GitHub: Settings → General → Social preview.
//   npm run social
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const url = (p) => pathToFileURL(path.join(root, p)).href;
const font = (pkg, file, family, weight) =>
  `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url('${url(`node_modules/@fontsource-variable/${pkg}/files/${file}`)}'); }`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${font('inter', 'inter-latin-wght-normal.woff2', 'Inter', '100 900')}
  ${font('source-serif-4', 'source-serif-4-latin-wght-normal.woff2', 'Serif', '200 900')}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 640px; overflow: hidden; background: #1b1a19; color: #f0eee6; font-family: Inter, system-ui, sans-serif; }
  .card { position: absolute; inset: 0; padding: 72px 0 0 80px; }
  .logo { width: 104px; height: 104px; }
  h1 { font-family: Serif, Georgia, serif; font-size: 84px; font-weight: 600; letter-spacing: -0.02em; margin-top: 26px; }
  p { font-size: 27px; line-height: 1.35; color: #9e9b91; margin-top: 14px; width: 560px; }
  .pills { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 30px; width: 600px; }
  .pill { font-size: 18px; padding: 6px 13px; border-radius: 10px; background: #2f2e2b; color: #c9c6bb; }
  .pill b { color: #d97757; font-weight: 600; }
  .shot { position: absolute; left: 730px; top: 92px; width: 760px; border-radius: 16px; border: 1px solid #3a3935; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6); }
  .fade { position: absolute; left: 670px; top: 0; width: 120px; height: 640px; background: linear-gradient(90deg, #1b1a19, rgba(27, 26, 25, 0)); }
</style></head><body>
  <img class="shot" src="${url('docs/screenshots/exercise.png')}">
  <div class="fade"></div>
  <div class="card">
    <img class="logo" src="${url('build/icon.svg')}">
    <h1>PyDays</h1>
    <p>Learn Python in 30 days: one class a day, a real editor and terminal, and a progress calendar.</p>
    <div class="pills">
      <span class="pill"><b>30</b> classes</span>
      <span class="pill"><b>5</b> languages</span>
      <span class="pill">Editor</span>
      <span class="pill">Terminal</span>
      <span class="pill">Calendar</span>
    </div>
  </div>
</body></html>`;

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pydays-social-')), 'card.html');
  fs.writeFileSync(file, html);
  const win = new BrowserWindow({ width: 1280, height: 640, show: false, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadFile(file);
  await new Promise((r) => setTimeout(r, 800)); // images and fonts decoded and painted
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 640 });
  const out = path.join(root, 'docs', 'social-preview.png');
  fs.writeFileSync(out, image.toPNG());
  console.log('written', out, image.getSize());
  app.quit();
});
