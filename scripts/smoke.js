#!/usr/bin/env node
'use strict';
// Starts the app with a fresh data folder and runs scripts/smoke-inner.js inside it.
//   node scripts/smoke.js            the smoke test
//   node scripts/smoke.js --shots    also saves screenshots to ./tmp-shots
//   --lang=pl                        interface language (default en)
//   --seed                           start with some progress, for screenshots
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : args.includes(`--${name}`) ? true : def;
};
const lang = opt('lang', 'en');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pydays-smoke-'));
const store = path.join(dataDir, 'store');
fs.mkdirSync(store, { recursive: true });
fs.writeFileSync(path.join(store, 'settings.json'), JSON.stringify({ lang }));

if (opt('seed')) {
  // three weeks of plausible history ending yesterday, days 1–5 done
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return fmt(d);
  };
  const activity = {};
  const days = {};
  const plan = [[-9, 1], [-8, 2], [-6, 3], [-3, 4], [-1, 5]];
  for (const o of [-12, -9, -8, -7, -6, -4, -3, -2, -1]) activity[day(o)] = { runs: 6 + (o % 4), solved: 1, minutes: 18 + ((o * 7) % 25), done: [] };
  for (const [o, n] of plan) {
    activity[day(o)].done.push(n);
    activity[day(o)].minutes = 48;
    days[n] = { done: day(o), exercises: {} };
  }
  const milestones = { 3: day(-6) };
  fs.writeFileSync(path.join(store, 'progress.json'), JSON.stringify({ days, activity, milestones }));
}

const shots = opt('shots') ? path.resolve(typeof opt('shots') === 'string' ? opt('shots') : 'tmp-shots') : '';
const electron = require('electron');
const child = spawn(electron, ['.', ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [])], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    PYDAYS_SMOKE: '1',
    PYDAYS_DATA_DIR: dataDir,
    PYDAYS_LANG: lang,
    PYDAYS_SIZE: '1440x900',
    PYDAYS_HIDDEN: opt('show') ? '' : '1',
    ...(shots ? { PYDAYS_SHOTS: shots } : {}),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
child.stdout.on('data', (d) => {
  out += d;
  process.stdout.write(d);
});
child.stderr.on('data', (d) => {
  const s = String(d);
  if (!/Fontconfig|libva|GPU process|dbus|viz_main|gles2|ANGLE|Gtk-WARNING|ozone/i.test(s)) process.stderr.write(s);
});
const timer = setTimeout(() => {
  console.error('SMOKE TIMEOUT');
  child.kill('SIGKILL');
}, 180000);
child.on('close', (code) => {
  clearTimeout(timer);
  fs.rmSync(dataDir, { recursive: true, force: true });
  if (shots) console.log('Screenshots: ' + shots);
  process.exit(/SMOKE OK/.test(out) ? 0 : code || 1);
});
