'use strict';
// Runs the learner's Python code with the Python 3 installed on this computer.
// Three kinds of runs:
//   start()  – an interactive run (or the Python shell) whose output streams to the terminal
//              panel and whose stdin is typed there;
//   check()  – runs an exercise through src/harness.py and returns the test results;
//   syntax() – compiles the code without running it, for the Problems panel.
// Errors come back as codes (no-python, …); the renderer translates them.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const IS_WIN = process.platform === 'win32';
const OUTPUT_LIMIT = 2 * 1024 * 1024; // a runaway print loop gets stopped after this much output
const MARK = '@@PYDAYS-RESULT@@';

let ctx = null;
let python = null;
let detecting = null;
let nextId = 1;
const running = new Map(); // id -> { child, killed }

function init(c) {
  ctx = c;
}

// ---- Python detection ------------------------------------------------------------------

function execOut(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: opts.timeout || 15000, windowsHide: true, ...opts }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || '') + String(stderr || '') });
    });
  });
}

function splitCmd(s) {
  // "py -3" -> ['py', '-3']; a quoted Windows path stays one piece, and so does an unquoted
  // path to an existing file ("C:\Program Files\...\python.exe").
  const whole = String(s).trim().replace(/^"|"$/g, '');
  if (whole && path.isAbsolute(whole) && fs.existsSync(whole)) return [whole];
  const parts = String(s).match(/"[^"]+"|\S+/g) || [];
  return parts.map((p) => p.replace(/^"|"$/g, ''));
}

// Where Windows installers put Python when it isn't on PATH. A '*' matches part of one
// folder name; newer versions (sorted last) come first.
function winCandidates(patterns) {
  if (!IS_WIN) return [];
  const env = process.env;
  const vars = { PF: env.ProgramFiles || 'C:\\Program Files', LOCAL: env.LOCALAPPDATA || '', SYS: env.SystemDrive || 'C:' };
  const found = [];
  for (const pattern of patterns) {
    const p = pattern.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
    const parts = p.split('\\');
    const i = parts.findIndex((x) => x.includes('*'));
    if (i < 0) {
      if (fs.existsSync(p)) found.push(p);
      continue;
    }
    const re = new RegExp('^' + parts[i].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
    let names = [];
    try {
      names = fs.readdirSync(parts.slice(0, i).join('\\')).filter((n) => re.test(n));
    } catch {}
    names.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const n of names) {
      const full = [...parts.slice(0, i), n, ...parts.slice(i + 1)].join('\\');
      if (fs.existsSync(full)) found.push(full);
    }
  }
  return found;
}

const WIN_PYTHON = ['{LOCAL}\\Programs\\Python\\Python3*\\python.exe', '{PF}\\Python3*\\python.exe', '{SYS}\\Python3*\\python.exe'];

async function findPython(custom) {
  const candidates = custom ? [custom] : IS_WIN ? ['py -3', 'python', 'python3', ...winCandidates(WIN_PYTHON)] : ['python3', 'python'];
  for (const c of candidates) {
    const [cmd, ...pre] = splitCmd(c);
    if (!cmd) continue;
    const r = await execOut(cmd, [...pre, '--version']);
    const m = r.out.match(/Python\s+(3\.\d+(?:\.\d+)?)/);
    if (r.ok && m) return { ok: true, cmd: [cmd, ...pre], version: m[1] };
  }
  return { ok: false, error: custom ? 'bad-python-path' : 'no-python' };
}

function detect(force) {
  if (python && !force) return Promise.resolve(python);
  if (detecting && !force) return detecting;
  const custom = (ctx.settings() || {}).pythonPath || '';
  detecting = findPython(custom.trim()).then((p) => {
    python = p;
    detecting = null;
    return p;
  });
  return detecting;
}

// ---- workspace ---------------------------------------------------------------------------

function safeKey(key) {
  const k = String(key || 'playground').replace(/[^\w.\-]+/g, '_').slice(0, 80);
  return k || 'playground';
}

function safeFileName(name, fallback = 'main.py') {
  const n = path.basename(String(name || fallback)).replace(/[^\w.\-]+/g, '_');
  return /\.py$/.test(n) ? n : fallback;
}

function workspaceDir(key) {
  const dir = path.join(ctx.workDir(), safeKey(key));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// files: [{ name, text }] – a lesson's data files, written fresh before every run so a
// program that changed them can't spoil the next run.
// A name may include one folder (mypackage/__init__.py) for lessons about packages.
function writeFiles(dir, files) {
  for (const f of files || []) {
    const parts = String(f.name).split(/[\\/]/).filter(Boolean);
    if (!parts.length || parts.length > 2 || parts.some((p) => p === '.' || p === '..' || !/^[\w.\-]+$/.test(p))) continue;
    const target = path.join(dir, ...parts);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(f.text ?? ''));
  }
}

function childEnv() {
  return { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' };
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (IS_WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {}
  }
}

// Windows programs end lines with \r\n; the terminal panel wants plain \n.
const crlf = (chunk) => String(chunk).replace(/\r(?=\n|$)/g, '');

// ---- interactive run -----------------------------------------------------------------------

// spec: { key, file, code, files?, repl?, timeoutMs? }
// repl: starts the Python shell (python -i) instead of running the file.
function start(spec) {
  const id = nextId++;
  const send = (ev) => ctx.send('run:event', { id, ...ev });
  const entry = { child: null, killed: false };
  running.set(id, entry);

  (async () => {
    const py = await detect();
    if (!py.ok) {
      send({ type: 'exit', code: -1, error: py.error });
      running.delete(id);
      return;
    }
    let dir;
    const file = safeFileName(spec.file);
    try {
      dir = workspaceDir(spec.key);
      writeFiles(dir, spec.files);
      if (!spec.repl) fs.writeFileSync(path.join(dir, file), String(spec.code ?? ''));
    } catch (err) {
      send({ type: 'exit', code: -1, error: 'workspace', detail: err.message });
      running.delete(id);
      return;
    }
    if (entry.killed) {
      send({ type: 'exit', code: null, killed: true });
      running.delete(id);
      return;
    }
    const args = spec.repl ? [...py.cmd.slice(1), '-i', '-q', '-u'] : [...py.cmd.slice(1), '-u', file];
    const t0 = Date.now();
    let child;
    try {
      child = spawn(py.cmd[0], args, { cwd: dir, env: childEnv(), detached: !IS_WIN, windowsHide: true });
    } catch (err) {
      send({ type: 'exit', code: -1, error: 'spawn', detail: err.message });
      running.delete(id);
      return;
    }
    entry.child = child;
    send({ type: 'status', text: 'run', cwd: dir });
    let total = 0;
    let truncated = false;
    let buf = { out: '', err: '' };
    let flushTimer = null;
    const flush = () => {
      flushTimer = null;
      if (buf.out) send({ type: 'out', data: buf.out });
      if (buf.err) send({ type: 'err', data: buf.err });
      buf = { out: '', err: '' };
    };
    const onData = (stream) => (d) => {
      if (truncated) return;
      const s = crlf(d);
      total += s.length;
      if (total > OUTPUT_LIMIT) {
        truncated = true;
        killTree(child);
        return;
      }
      buf[stream] += s;
      if (!flushTimer) flushTimer = setTimeout(flush, 30);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', onData('out'));
    child.stderr.on('data', onData('err'));
    child.stdin.on('error', () => {});
    // A program waiting for input() waits for the learner; the shell can stay open longer.
    const timeoutMs = spec.repl ? 4 * 3600 * 1000 : Math.max(1000, Math.min(spec.timeoutMs || 10 * 60 * 1000, 30 * 60 * 1000));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      flush();
      send({ type: 'exit', code: -1, error: 'spawn', detail: err.message });
      running.delete(id);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      send({ type: 'exit', code, signal, timeMs: Date.now() - t0, timedOut, truncated, killed: entry.killed });
      running.delete(id);
    });
  })();

  return { id };
}

function stdin(id, text) {
  const e = running.get(id);
  if (!e || !e.child || e.child.exitCode !== null) return false;
  try {
    if (text === null) e.child.stdin.end();
    else e.child.stdin.write(text);
    return true;
  } catch {
    return false;
  }
}

function kill(id) {
  const e = running.get(id);
  if (!e) return false;
  e.killed = true;
  killTree(e.child);
  return true;
}

function killAll() {
  for (const id of running.keys()) kill(id);
}

// ---- exercise checks -------------------------------------------------------------------------

function harnessPath() {
  // copied out of the app (it may sit inside app.asar, which Python can't read)
  const dir = ctx.cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'pydays_harness.py');
  const src = fs.readFileSync(path.join(ctx.srcDir, 'harness.py'), 'utf8');
  let current = null;
  try {
    current = fs.readFileSync(target, 'utf8');
  } catch {}
  if (current !== src) fs.writeFileSync(target, src);
  return target;
}

function runHarness(py, harness, dir, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(py.cmd[0], [...py.cmd.slice(1), '-u', harness, 'spec.json'], { cwd: dir, env: childEnv(), detached: !IS_WIN, windowsHide: true });
    } catch (err) {
      resolve({ error: 'spawn', detail: err.message });
      return;
    }
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (out.length < OUTPUT_LIMIT ? (out += d) : killTree(child)));
    child.stderr.on('data', (d) => (err.length < 64 * 1024 ? (err += d) : null));
    child.stdin.on('error', () => {});
    child.stdin.end();
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ error: 'spawn', detail: e.message });
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (timedOut) return resolve({ timedOut: true });
      const i = out.lastIndexOf(MARK);
      if (i < 0) return resolve({ error: 'harness', detail: crlf(err || out).slice(-4000) });
      try {
        resolve(JSON.parse(out.slice(i + MARK.length)));
      } catch (e) {
        resolve({ error: 'harness', detail: e.message });
      }
    });
  });
}

// spec: { file, code, files?, cases: [{ stdin, checks: [{ type, value }] }], timeoutMs? }
async function check(spec) {
  const py = await detect();
  if (!py.ok) return { error: py.error };
  const harness = harnessPath();
  const results = [];
  for (const c of spec.cases || []) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pydays-check-'));
    try {
      writeFiles(dir, spec.files);
      const file = safeFileName(spec.file);
      fs.writeFileSync(path.join(dir, file), String(spec.code ?? ''));
      fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify({ file, stdin: c.stdin || '', checks: c.checks || [] }));
      results.push(await runHarness(py, harness, dir, spec.timeoutMs || 10000));
    } finally {
      fs.rm(dir, { recursive: true, force: true }, () => {});
    }
  }
  return { results, version: py.version };
}

// ---- syntax check ------------------------------------------------------------------------------

const SYNTAX_SCRIPT = [
  'import sys, json',
  'src = sys.stdin.read()',
  'try:',
  '    compile(src, "main.py", "exec")',
  '    print(json.dumps({"ok": True}))',
  'except SyntaxError as e:',
  '    print(json.dumps({"ok": False, "type": type(e).__name__, "msg": e.msg, "line": e.lineno, "col": e.offset, "endLine": getattr(e, "end_lineno", None), "endCol": getattr(e, "end_offset", None)}))',
  'except Exception as e:',
  '    print(json.dumps({"ok": False, "type": type(e).__name__, "msg": str(e), "line": 1, "col": 1}))',
].join('\n');

async function syntax(code) {
  const py = await detect();
  if (!py.ok) return { ok: true, skipped: true };
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(py.cmd[0], [...py.cmd.slice(1), '-c', SYNTAX_SCRIPT], { env: childEnv(), windowsHide: true });
    } catch {
      resolve({ ok: true, skipped: true });
      return;
    }
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => (out += d));
    child.stdin.on('error', () => {});
    child.stdin.end(String(code ?? ''));
    const timer = setTimeout(() => killTree(child), 4000);
    child.on('error', () => resolve({ ok: true, skipped: true }));
    child.on('close', () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(out.trim().split('\n').pop()));
      } catch {
        resolve({ ok: true, skipped: true });
      }
    });
  });
}

module.exports = { init, detect, start, stdin, kill, killAll, check, syntax, workspaceDir, splitCmd };
