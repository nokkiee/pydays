#!/usr/bin/env node
// Checks the course files in content/days/:
//   - they parse, and every text is there in all five languages;
//   - every runnable example runs under Python without an error (examples marked `error`
//     must fail), with empty stdin unless the example gives some;
//   - every exercise's solution passes all its checks, and its starter code does not;
//   - code spans and table rows agree between the languages (warnings).
// Usage: node tools/check-content.mjs [day ...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseDay, LANGS } from '../renderer/js/parse.js';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = require('../src/runner.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pydays-content-'));
runner.init({
  srcDir: path.join(ROOT, 'src'),
  contentDir: path.join(ROOT, 'content'),
  workDir: () => path.join(tmp, 'ws'),
  cacheDir: () => path.join(tmp, 'cache'),
  settings: () => ({}),
  send: () => {},
});

const only = process.argv.slice(2).map(Number).filter(Boolean);
const dir = path.join(ROOT, 'content', 'days');
const files = fs.readdirSync(dir).filter((f) => /^\d\d\.txt$/.test(f)).sort();
let errors = 0;
let warnings = 0;
const fail = (where, msg) => {
  errors++;
  console.log(`  ✗ ${where}: ${msg}`);
};
const warn = (where, msg) => {
  warnings++;
  console.log(`  ! ${where}: ${msg}`);
};

function runPython(cmd, code, stdin, files) {
  return new Promise((resolve) => {
    const cwd = fs.mkdtempSync(path.join(tmp, 'ex-'));
    for (const f of files) fs.writeFileSync(path.join(cwd, f.name), f.text);
    fs.writeFileSync(path.join(cwd, 'example.py'), code);
    const p = spawn(cmd[0], [...cmd.slice(1), '-u', 'example.py'], { cwd, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.stdin.on('error', () => {});
    p.stdin.end(stdin || '');
    const timer = setTimeout(() => p.kill('SIGKILL'), 10000);
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
  });
}

const codeSpans = (s) => [...String(s || '').matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort();
const tableRows = (s) => String(s || '').split('\n').filter((l) => /^\|/.test(l.trim())).length;

function checkLangs(where, obj, { spans = false } = {}) {
  if (!obj) return fail(where, 'missing');
  for (const l of LANGS) if (!obj[l] || !obj[l].trim()) fail(where, `no ${l} text`);
  const en = obj.en || '';
  for (const l of LANGS.slice(1)) {
    if (!obj[l]) continue;
    if (tableRows(obj[l]) !== tableRows(en)) fail(where, `${l}: table rows differ from en`);
    if (spans) {
      const a = codeSpans(en).join('\u0000');
      const b = codeSpans(obj[l]).join('\u0000');
      if (a !== b) warn(where, `${l}: code spans differ from en (${codeSpans(obj[l]).filter((x) => !codeSpans(en).includes(x)).slice(0, 4).join(', ')})`);
    }
  }
}

const py = await runner.detect();
if (!py.ok) {
  console.error('Python 3 not found');
  process.exit(2);
}
console.log(`Python ${py.version}`);

for (const f of files) {
  const n = Number(f.slice(0, 2));
  if (only.length && !only.includes(n)) continue;
  const { day, errors: perr } = parseDay(fs.readFileSync(path.join(dir, f), 'utf8'), f);
  console.log(`Day ${n}: ${day.title?.en || '?'}`);
  for (const e of perr) fail(f, e);
  if (day.day !== n) fail(f, `@day ${day.day} in file ${f}`);
  checkLangs(`${f} title`, day.title);
  checkLangs(`${f} summary`, day.summary);
  if (!day.source) fail(f, 'no @source');
  day.blocks.forEach((b, i) => b.type === 'md' && checkLangs(`${f} md#${i}`, b.text));

  // examples
  for (const [i, b] of day.blocks.entries()) {
    if (b.type !== 'code' || b.opts.norun) continue;
    const r = await runPython(py.cmd, b.code, b.opts.stdin, day.files);
    if (b.opts.error && r.code === 0) fail(`${f} code#${i}`, 'marked `error` but ran without one');
    if (!b.opts.error && r.code !== 0) fail(`${f} code#${i}`, `exit ${r.code}: ${r.err.trim().split('\n').pop()}\n${b.code.split('\n').slice(0, 3).join('\n')}`);
  }

  // exercises
  const ids = new Set();
  if (!day.exercises.length) warn(f, 'no exercises');
  for (const ex of day.exercises) {
    const where = `${f} ${ex.id}`;
    if (ids.has(ex.id)) fail(where, 'duplicate id');
    ids.add(ex.id);
    checkLangs(`${where} title`, ex.title);
    checkLangs(`${where} text`, ex.text, { spans: true });
    if (ex.hint) checkLangs(`${where} hint`, ex.hint, { spans: true });
    if (!ex.cases.length || ex.cases.some((c) => !c.checks.length)) fail(where, 'no checks');
    if (!ex.solution) {
      fail(where, 'no solution');
      continue;
    }
    const spec = (code) => ({ file: 'ex.py', code, files: day.files, cases: ex.cases });
    const sol = await runner.check(spec(ex.solution));
    sol.results.forEach((r, i) => {
      if (r.timedOut) return fail(where, `solution: case ${i + 1} timed out`);
      if (r.error && !r.checks) return fail(where, `solution: case ${i + 1}: ${r.error} ${r.detail || ''}`);
      if (r.error) fail(where, `solution: case ${i + 1} raised ${r.error.split('\n').pop()}`);
      for (const k of r.checks || []) if (!k.ok) fail(where, `solution fails: ${k.type}: ${k.value}${k.got ? ' (got ' + k.got + ')' : ''}${k.detail ? ' ' + k.detail : ''}\n    output: ${JSON.stringify(r.out.slice(0, 300))}`);
    });
    const st = await runner.check(spec(ex.starter || ''));
    const starterPasses = st.results.every((r) => !r.timedOut && !r.errorType && (r.checks || []).every((k) => k.ok));
    if (starterPasses) fail(where, 'the starter code already passes');
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(errors ? `\n${errors} error(s), ${warnings} warning(s)` : `\nAll good (${warnings} warning(s)).`);
process.exit(errors ? 1 : 0);
