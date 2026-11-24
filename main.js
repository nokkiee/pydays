'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, protocol, Menu, shell, net, ipcMain } = require('electron');
const { pathToFileURL } = require('url');
const runner = require('./src/runner');
const store = require('./src/store');

app.setName('PyDays');
app.setDesktopName('pydays.desktop'); // lets GNOME/KDE match the window to its launcher and icon on Wayland
if (process.env.PYDAYS_DATA_DIR) app.setPath('userData', process.env.PYDAYS_DATA_DIR);
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
if (process.platform === 'win32') app.setAppUserModelId('app.pydays');
if (process.env.PYDAYS_LANG) app.commandLine.appendSwitch('lang', process.env.PYDAYS_LANG);
const DEV = !!process.env.PYDAYS_DEV || process.argv.includes('--dev');

// The renderer is served from pydays://app/ so ES modules, fetch() and web workers behave
// as on a normal (secure) web origin.
protocol.registerSchemesAsPrivileged([
  { scheme: 'pydays', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const ROOT = __dirname;
const MODULES = path.join(ROOT, 'node_modules');
// URL prefix -> folder. Third-party libraries are served straight from node_modules.
const MOUNTS = [
  ['/content/', path.join(ROOT, 'content')],
  ['/vendor/monaco/', path.join(MODULES, 'monaco-editor', 'min')],
  ['/vendor/marked/', path.join(MODULES, 'marked', 'lib')],
  ['/vendor/fonts/inter/', path.join(MODULES, '@fontsource-variable', 'inter')],
  ['/vendor/fonts/serif/', path.join(MODULES, '@fontsource-variable', 'source-serif-4')],
  ['/vendor/fonts/mono/', path.join(MODULES, '@fontsource-variable', 'jetbrains-mono')],
  ['/', path.join(ROOT, 'renderer')],
];
const BG = '#1f1e1d';
let win = null;

function inside(base, target) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveUrlPath(pathname) {
  const p = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  for (const [prefix, dir] of MOUNTS) {
    if (p.startsWith(prefix)) {
      const file = path.join(dir, p.slice(prefix.length));
      return inside(dir, file) ? file : null;
    }
  }
  return null;
}

function serve(request) {
  const file = resolveUrlPath(new URL(request.url).pathname);
  if (!file || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

// ---- window size memory ---------------------------------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadBounds() {
  if (process.env.PYDAYS_SIZE) {
    const [width, height] = process.env.PYDAYS_SIZE.split('x').map(Number);
    return { width, height };
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return { width: 1440, height: 900 };
  }
}

function saveBounds() {
  if (!win || win.isDestroyed() || process.env.PYDAYS_SIZE) return;
  const state = { ...win.getNormalBounds(), maximized: win.isMaximized() };
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch {
    // Not worth bothering the user about.
  }
}

// ---- window ------------------------------------------------------------------------------

function createWindow() {
  const bounds = loadBounds();
  const hidden = !!process.env.PYDAYS_HIDDEN;
  win = new BrowserWindow({
    ...bounds,
    minWidth: 1080,
    minHeight: 660,
    backgroundColor: BG,
    title: 'PyDays',
    icon: path.join(ROOT, 'build', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: !hidden,
      offscreen: hidden,
    },
  });
  if (bounds.maximized) win.maximize();
  win.once('ready-to-show', () => !hidden && win.show());
  win.on('close', saveBounds);
  win.on('closed', () => {
    win = null;
    runner.killAll();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('pydays://')) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (DEV && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      win.webContents.toggleDevTools();
    }
    if (input.control && !input.shift && !input.alt && ['=', '+', '-', '0'].includes(input.key)) {
      const z = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(input.key === '0' ? 0 : Math.max(-3, Math.min(4, z + (input.key === '-' ? -0.5 : 0.5))));
      e.preventDefault();
    }
  });

  win.loadURL('pydays://app/index.html');
  if (process.env.PYDAYS_SMOKE) require('./scripts/smoke-inner').run(win, app, runner);
  if (process.env.PYDAYS_SELFTEST) selfTest(win);
}

// PYDAYS_SELFTEST=1: quick check of a (packaged) build. It opens the course and a lesson, looks for
// Python, prints the result and quits with a matching exit code.
async function selfTest(w) {
  const js = (code) => w.webContents.executeJavaScript(code, true);
  const until = async (code, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try {
        if (await js(code)) return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  };
  const result = {};
  result.days = await until(`window.pydaysReady === true && document.querySelectorAll('.sidebar .day-link').length === 30`);
  await js(`location.hash = '#/day/1'`);
  result.editor = await until(`!!window.monaco && window.monaco.editor.getEditors().length > 0 && document.querySelectorAll('.lesson-scroll .snippet').length > 0`);
  result.python = (await runner.detect()).ok === true;
  const ok = Object.values(result).every((v) => v === true);
  console.log('SELFTEST ' + (ok ? 'OK ' : 'FAILED ') + JSON.stringify(result));
  app.exit(ok ? 0 : 1);
}

// ---- IPC -------------------------------------------------------------------------------

function registerIpc() {
  const userData = () => app.getPath('userData');
  runner.init({
    srcDir: path.join(ROOT, 'src'),
    contentDir: path.join(ROOT, 'content'),
    workDir: () => path.join(userData(), 'workspace'),
    cacheDir: () => path.join(userData(), 'run-cache'),
    settings: () => store.readSync(userData(), 'settings') || {},
    send: (channel, payload) => win && !win.isDestroyed() && win.webContents.send(channel, payload),
  });

  ipcMain.handle('python:detect', (_e, force) => runner.detect(force));
  ipcMain.handle('run:start', (_e, spec) => runner.start(spec));
  ipcMain.handle('run:stdin', (_e, id, text) => runner.stdin(id, text));
  ipcMain.handle('run:kill', (_e, id) => runner.kill(id));
  ipcMain.handle('run:check', (_e, spec) => runner.check(spec));
  ipcMain.handle('run:syntax', (_e, code) => runner.syntax(code));
  ipcMain.handle('ws:open', (_e, key) => shell.openPath(runner.workspaceDir(key)));
  ipcMain.handle('store:get', (_e, key) => store.read(userData(), key));
  ipcMain.handle('store:set', (_e, key, value) => store.write(userData(), key, value));
  ipcMain.handle('store:del', (_e, key) => store.remove(userData(), key));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dev: DEV, locale: app.getLocale() }));
  ipcMain.handle('app:open-external', (_e, url) => /^https:\/\//.test(url) && shell.openExternal(url));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('pydays', serve);
    registerIpc();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
