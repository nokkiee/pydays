'use strict';
// Runs inside the app when PYDAYS_SMOKE=1: drives the real window through the main features,
// prints SMOKE OK / SMOKE FAILED with the details, and quits with a matching exit code.
// PYDAYS_SHOTS=<dir> also saves screenshots of the main screens there.
const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(win, app) {
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const until = async (code, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try {
        if (await js(code)) return true;
      } catch {}
      await wait(150);
    }
    return false;
  };
  const shotDir = process.env.PYDAYS_SHOTS;
  // an offscreen window paints into images instead of the screen; keep the latest frame
  let frame = null;
  if (win.webContents.isOffscreen()) {
    win.webContents.setFrameRate(30);
    win.webContents.on('paint', (_e, _dirty, image) => (frame = image));
  }
  const shot = async (name) => {
    if (!shotDir) return;
    await wait(900);
    if (win.webContents.isOffscreen()) win.webContents.invalidate();
    await wait(300);
    const img = win.webContents.isOffscreen() ? frame : await win.webContents.capturePage();
    if (!img) return;
    fs.mkdirSync(shotDir, { recursive: true });
    fs.writeFileSync(path.join(shotDir, name + '.png'), img.toPNG());
  };
  const setEditor = (code) => js(`(() => { const ed = monaco.editor.getEditors()[0]; ed.setValue(${JSON.stringify(code)}); return true; })()`);
  const termText = `document.querySelector('.term')?.textContent || ''`;
  const result = {};
  const step = async (name, fn) => {
    try {
      result[name] = (await fn()) === true;
    } catch (e) {
      result[name] = String(e && e.message);
    }
  };

  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()));
  await step('boot', () => until(`window.pydaysReady === true && !!document.querySelector('.sidebar .day-link')`));
  await step('days', () => js(`document.querySelectorAll('.sidebar .day-link').length`).then((n) => n === Number(process.env.PYDAYS_EXPECT_DAYS || 30) || `found ${n}`));
  // a first start asks for the language; the smoke test always runs with one chosen
  await js(`document.querySelector('.lang-opt.sel')?.click(); document.querySelector('.modal-actions .btn.primary')?.click()`);
  await step('home', () => until(`!!document.querySelector('.continue') && !!document.querySelector('.track')`));
  await shot('01-home');

  await js(`location.hash = '#/day/1'`);
  await step('lesson', () => until(`document.querySelectorAll('.lesson-scroll .snippet').length > 2 && !!document.querySelector('.lesson-scroll .snippet .mtk1, .lesson-scroll .snippet span[class^=mtk]')`));
  await step('editor', () => until(`window.monaco && monaco.editor.getEditors().length === 1 && document.querySelectorAll('.view-line').length > 0`));
  await shot('02-lesson');

  // a lesson example runs in the terminal
  await step('runExample', async () => {
    await js(`[...document.querySelectorAll('.snippet-bar .btn')].find((b) => b.querySelector('.ico') && b.textContent.trim() && b.closest('.snippet') && b === b.parentNode.lastElementChild).click()`);
    return until(`(${termText}).includes('Welcome to 30 Days Of Python') && /\d+\.\d\d s/.test(${termText})`, 20000);
  });

  // a program that reads input(): the terminal's input line sends the answer
  await step('stdin', async () => {
    await setEditor('name = input("Your name: ")\nprint("Hi, " + name + "!")\n');
    await js(`document.querySelector('.ide-actions .run-btn:not([hidden])').click()`);
    if (!(await until(`!!document.querySelector('.term-input') && (${termText}).includes('Your name:')`, 15000))) return 'no prompt';
    await js(`(() => { const i = document.querySelector('.term-input'); i.value = 'Ada'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    return until(`(${termText}).includes('Hi, Ada!')`, 10000);
  });

  // an error is reported and marked in the editor
  await step('traceback', async () => {
    await setEditor('x = 1\nprint(x / 0)\n');
    await js(`document.querySelector('.ide-actions .run-btn:not([hidden])').click()`);
    return until(`(${termText}).includes('ZeroDivisionError') && monaco.editor.getModelMarkers({ owner: 'runtime' }).length === 1`, 15000);
  });

  // the Problems panel finds a syntax error without running
  await step('problems', async () => {
    await setEditor('print("open"\n');
    return until(`monaco.editor.getModelMarkers({ owner: 'syntax' }).length === 1 && !!document.querySelector('.ptab .badge.err')`, 10000);
  });

  // the Python shell
  await step('repl', async () => {
    await js(`[...document.querySelectorAll('.panel-tabs .ptab')][0].click()`);
    await js(`[...document.querySelectorAll('.panel-tabs .btn')].find((b) => b.querySelector('.ico'))?.click()`);
    if (!(await until(`!!document.querySelector('.term-input') && (${termText}).includes('>>> ')`, 15000))) return 'no prompt';
    await js(`(() => { const i = document.querySelector('.term-input'); i.value = '6 * 7'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    const ok = await until(`(${termText}).includes('42')`, 10000);
    await shot('02b-terminal');
    await js(`document.querySelector('.ide-actions .btn.danger:not([hidden])')?.click()`);
    return ok;
  });

  // exercises: a wrong answer fails, the right one passes and is recorded
  await js(`location.hash = '#/day/1/exercises'`);
  await step('exerciseFail', async () => {
    await until(`document.querySelectorAll('.ex').length > 0`);
    await js(`document.querySelector('.ex .ex-actions .btn').click()`);
    await until(`monaco.editor.getEditors()[0].getModel().uri.path.endsWith('ex1_hello_world.py')`);
    await setEditor(`print('Hello World')\n`);
    await js(`document.querySelector('.ex .ex-actions .ex-check').click()`);
    return until(`!!document.querySelector('.tests-sum.bad')`, 15000);
  });
  await step('exercisePass', async () => {
    await setEditor(`print('Hello, World!')\n`);
    await js(`document.querySelector('.ex .ex-actions .ex-check').click()`);
    return until(`!!document.querySelector('.tests-sum.ok') && !!document.querySelector('.ex.solved')`, 15000);
  });
  await shot('03-exercise');
  await step('saved', async () => {
    await wait(600);
    const p = await js(`window.api.storeGet('progress')`);
    return !!p?.days?.[1]?.exercises?.['hello-world'] || JSON.stringify(p);
  });

  // completing a day by hand reaches the calendar
  await step('markDone', async () => {
    await js(`document.querySelector('.modal .icon-btn')?.click()`);
    if (await js(`!!document.querySelector('.lesson-head .pill.ok')`)) return true; // done already (seeded)
    await js(`[...document.querySelectorAll('.lesson-head .actions .btn')][0]?.click()`);
    return until(`!!document.querySelector('.celebrate') && !!document.querySelector('.lesson-head .pill.ok')`, 5000);
  });
  await js(`document.querySelectorAll('.overlay').forEach((o) => o.remove())`);

  await js(`location.hash = '#/calendar'`);
  await step('calendar', () => until(`document.querySelectorAll('.cal-day').length >= 28 && !!document.querySelector('.cal-day.today .cal-chip')`));
  await shot('04-calendar');

  await js(`location.hash = '#/course'`);
  await step('course', () => until(`document.querySelectorAll('.day-card').length === document.querySelectorAll('.sidebar .day-link').length && document.querySelectorAll('.ms-card').length > 0`));
  await shot('05-course');

  await js(`location.hash = '#/settings'`);
  await step('settings', () => until(`document.querySelectorAll('.set-row').length > 5`));

  const ok = Object.values(result).every((v) => v === true);
  console.log('SMOKE ' + (ok ? 'OK ' : 'FAILED ') + JSON.stringify(result));
  app.exit(ok ? 0 : 1);
}

module.exports = { run };
