// The code workspace, laid out like VS Code: file tabs, the Monaco editor, a bottom panel
// (Terminal, Tests, Problems) and a status bar. Used by the lessons and the playground.
import { h, btn, icon, clear, toast, splitter, debounce, esc, confirmDialog } from './ui.js';
import { t, tNodes } from './i18n.js';
import { loadMonaco, editorOptions, createEditor } from './monaco.js';
import { getSettings, setSettings, onSettings, loadCode, saveCode } from './store.js';
import { createTerminal } from './terminal.js';

// pip package names that differ from the module name
const PIP_NAMES = { bs4: 'beautifulsoup4', sklearn: 'scikit-learn', yaml: 'pyyaml', PIL: 'pillow', cv2: 'opencv-python', dotenv: 'python-dotenv' };

let pythonInfo = null;
export function python(force) {
  if (!pythonInfo || force) pythonInfo = window.api.detectPython(force);
  return pythonInfo;
}

/**
 * opts:
 *   key        workspace & saved-code key ('day03', 'playground')
 *   base       { file, starter } – the always-open tab
 *   exercises  [{ file, starter, cases, title }] – tabs that can be opened and checked
 *   files      data files written next to the program
 *   onRun()    called for every run (activity)
 *   onChecked(exercise, passed)
 *   onActive(file)
 */
export async function createIde(container, opts) {
  const saved = await loadCode(opts.key);
  saved.files = saved.files || {};
  const exByFile = new Map((opts.exercises || []).map((e) => [e.file, e]));
  const starterOf = (file) => (file === opts.base.file ? opts.base.starter : exByFile.get(file)?.starter) ?? '';
  const codeOf = (file) => saved.files[file] ?? starterOf(file);
  let open = [opts.base.file, ...(saved.open || []).filter((f) => f !== opts.base.file && exByFile.has(f))];
  let active = open.includes(saved.active) ? saved.active : opts.base.file;

  let monaco = null;
  let editor = null;
  const models = new Map();
  let disposed = false;
  let runId = null;
  let runMode = null; // 'run' | 'repl'
  let unsub = null;
  let checking = false;
  const lastResults = new Map(); // file -> rendered tests node
  let problems = [];
  let panelTab = 'terminal';

  const persist = () => {
    saved.open = open.slice(1);
    saved.active = active;
    saveCode(opts.key, saved);
  };

  // ---- layout ---------------------------------------------------------------------------
  const fileTabs = h('div', { class: 'file-tabs' });
  const runBtn = btn(t('ide.run'), { icon: 'play', kind: 'primary', small: true, cls: 'run-btn', title: t('ide.runTitle'), onClick: () => run() });
  const checkBtn = btn(t('ide.check'), { icon: 'flask', small: true, cls: 'run-btn', title: t('ide.checkTitle'), onClick: () => check() });
  const stopBtn = btn(t('ide.stop'), { icon: 'stop', kind: 'danger', small: true, cls: 'run-btn', onClick: () => stop() });
  stopBtn.hidden = true;
  const resetBtn = h('button', { class: 'icon-btn', title: t('ide.reset'), onclick: () => resetFile() }, icon('refresh'));
  const folderBtn = h('button', { class: 'icon-btn', title: t('ide.openFolder'), onclick: () => window.api.openWorkspace(opts.key) }, icon('folder'));
  const tabsBar = h('div', { class: 'ide-tabs' }, fileTabs, h('div', { class: 'ide-actions' }, resetBtn, folderBtn, checkBtn, stopBtn, runBtn));
  const editorBox = h('div', { class: 'editor-box' }, h('div', { class: 'loading-line' }, t('ide.loading')));

  const term = createTerminal({
    onSubmit: (line) => runId && window.api.sendStdin(runId, line + '\n'),
    onEof: () => runId && window.api.sendStdin(runId, null),
    onInterrupt: () => stop(),
  });
  const testsBody = h('div', { class: 'tests' }, h('div', { class: 'empty-note' }, t('tests.none')));
  const problemsBody = h('div');
  const ptabs = {
    terminal: { label: t('ide.terminal'), body: term.el },
    tests: { label: t('ide.tests'), body: testsBody },
    problems: { label: t('ide.problems'), body: problemsBody },
  };
  const panelTabs = h('div', { class: 'panel-tabs' });
  const panelBody = h('div', { class: 'panel-body' });
  const shellBtn = btn(t('ide.shell'), { icon: 'shell', small: true, kind: 'ghost', title: t('ide.shellTitle'), onClick: () => startShell() });
  const clearBtn = h('button', { class: 'icon-btn small', title: t('ide.clear'), onclick: () => term.clear() }, icon('trash', 14));
  const panel = h('div', { class: 'panel' }, panelTabs, panelBody);
  const hsplit = h('div', { class: 'hsplit' });

  const sbPython = h('span', { class: 'sb py' });
  const sbRun = h('span', { class: 'sb run' });
  const sbPos = h('span', { class: 'sb' });
  const statusbar = h('div', { class: 'statusbar' }, sbPython, sbRun, h('div', { class: 'grow' }), sbPos, h('span', { class: 'sb' }, t('status.spaces')), h('span', { class: 'sb' }, 'UTF-8'), h('span', { class: 'sb' }, 'Python'));

  const root = h('div', { class: 'ide' }, tabsBar, editorBox, hsplit, panel, statusbar);
  clear(container).appendChild(root);
  panel.style.height = (getSettings().panelHeight || 230) + 'px';
  splitter(hsplit, {
    vertical: true,
    min: 90,
    max: () => root.getBoundingClientRect().height - 130,
    onResize: (editorH) => {
      const total = root.getBoundingClientRect().height - tabsBar.offsetHeight - hsplit.offsetHeight - statusbar.offsetHeight;
      panel.style.height = Math.max(70, total - editorH) + 'px';
    },
    onDone: () => setSettings({ panelHeight: parseInt(panel.style.height, 10) }),
  });

  function renderPanelTabs() {
    clear(panelTabs);
    for (const [id, p] of Object.entries(ptabs)) {
      const b = h('button', { class: `ptab ${id === panelTab ? 'active' : ''}`, onclick: () => showPanel(id) }, p.label);
      if (id === 'problems' && problems.length) b.appendChild(h('span', { class: 'badge err' }, String(problems.length)));
      if (id === 'tests' && lastResults.get(active)) {
        const r = lastResults.get(active);
        b.appendChild(h('span', { class: `badge ${r.ok ? 'ok' : 'err'}` }, r.ok ? '✓' : `${r.passed}/${r.total}`));
      }
      panelTabs.appendChild(b);
    }
    panelTabs.appendChild(h('div', { class: 'grow' }));
    if (panelTab === 'terminal') panelTabs.append(shellBtn, clearBtn);
  }

  function showPanel(id) {
    panelTab = id;
    renderPanelTabs();
    clear(panelBody).appendChild(ptabs[id].body);
    if (id === 'terminal') term.el.scrollTop = term.el.scrollHeight;
  }

  function renderTabs() {
    clear(fileTabs);
    for (const f of open) {
      const ex = exByFile.get(f);
      const tab = h(
        'button',
        { class: `ftab ${f === active ? 'active' : ''}`, title: ex ? ex.title : f, onclick: () => activate(f) },
        h('span', { class: 'py' }, 'py'),
        h('span', null, f),
        ex && ex.solved ? h('span', { class: 'solved-dot' }, icon('check', 12)) : null,
        f === opts.base.file
          ? h('span', { class: 'x none' })
          : h(
              'span',
              {
                class: 'x',
                title: t('common.close'),
                onclick: (e) => {
                  e.stopPropagation();
                  closeTab(f);
                },
              },
              icon('x', 13),
            ),
      );
      tab.addEventListener('auxclick', (e) => e.button === 1 && f !== opts.base.file && closeTab(f));
      fileTabs.appendChild(tab);
    }
    const isEx = exByFile.has(active);
    checkBtn.hidden = !isEx || !!runId;
    checkBtn.classList.toggle('primary', isEx);
    runBtn.classList.toggle('primary', !isEx);
    fileTabs.querySelector('.ftab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateStatus() {
    python().then((p) => {
      clear(sbPython);
      if (p.ok) sbPython.append(icon('terminal', 12), t('status.python', { v: p.version }));
      else {
        sbPython.className = 'sb warn';
        sbPython.append(icon('alert', 12), t('status.noPython'));
        sbPython.onclick = () => (location.hash = '#/settings');
      }
    });
  }

  // ---- editor ------------------------------------------------------------------------------
  function modelFor(file) {
    if (models.has(file)) return models.get(file);
    const m = monaco.editor.createModel(codeOf(file), 'python', monaco.Uri.parse(`file:///${opts.key}/${file}`));
    m.onDidChangeContent(() => {
      saved.files[file] = m.getValue();
      persist();
      monaco.editor.setModelMarkers(m, 'runtime', []);
      if (file === active) syntaxCheck();
    });
    models.set(file, m);
    return m;
  }

  function activate(file) {
    if (!open.includes(file)) open.push(file);
    active = file;
    persist();
    renderTabs();
    if (editor) {
      editor.setModel(modelFor(file));
      editor.focus();
      syntaxCheck();
    }
    // the Tests panel shows this file's last check
    const r = lastResults.get(file);
    clear(testsBody).appendChild(r ? r.node : h('div', { class: 'empty-note' }, exByFile.has(file) ? t('tests.none') : t('tests.notExercise')));
    renderPanelTabs();
    opts.onActive?.(file);
  }

  function closeTab(file) {
    const i = open.indexOf(file);
    if (i < 1) return;
    open.splice(i, 1);
    if (active === file) activate(open[Math.min(i, open.length - 1)]);
    else {
      persist();
      renderTabs();
    }
  }

  async function resetFile() {
    const ok = await confirmDialog(t('ide.reset'), t('ide.resetText', { file: active }), t('ide.resetOk'), 'danger');
    if (!ok || !editor) return;
    setCode(active, starterOf(active));
  }

  function setCode(file, code) {
    activate(file);
    if (!editor) {
      saved.files[file] = code;
      persist();
      return;
    }
    const m = editor.getModel();
    editor.pushUndoStop();
    editor.executeEdits('pydays', [{ range: m.getFullModelRange(), text: code }]);
    editor.pushUndoStop();
    editor.setPosition({ lineNumber: 1, column: 1 });
  }

  const currentCode = () => (editor ? editor.getModel().getValue() : codeOf(active));

  // ---- problems (live syntax check) -------------------------------------------------------
  let syntaxSeq = 0;
  const syntaxCheck = debounce(async () => {
    if (!editor || disposed) return;
    const m = editor.getModel();
    const file = active;
    const seq = ++syntaxSeq;
    const r = await window.api.syntax(m.getValue());
    if (disposed || seq !== syntaxSeq || m.isDisposed()) return;
    problems = [];
    const markers = [];
    if (r && !r.ok && r.line) {
      const line = Math.min(r.line, m.getLineCount());
      const col = Math.max(1, r.col || 1);
      problems.push({ file, line, col, msg: `${r.type}: ${r.msg}` });
      markers.push({
        startLineNumber: line,
        startColumn: col,
        endLineNumber: r.endLine && r.endLine >= line ? Math.min(r.endLine, m.getLineCount()) : line,
        endColumn: r.endCol && r.endCol > col ? r.endCol : m.getLineMaxColumn(line),
        message: `${r.type}: ${r.msg}`,
        severity: monaco.MarkerSeverity.Error,
      });
    }
    monaco.editor.setModelMarkers(m, 'syntax', markers);
    renderProblems();
  }, 450);

  function renderProblems() {
    clear(problemsBody);
    if (!problems.length) problemsBody.appendChild(h('div', { class: 'empty-note' }, t('problems.none')));
    for (const p of problems) {
      problemsBody.appendChild(
        h(
          'div',
          {
            class: 'prob',
            onclick: () => {
              activate(p.file);
              editor?.revealLineInCenter(p.line);
              editor?.setPosition({ lineNumber: p.line, column: p.col });
              editor?.focus();
            },
          },
          icon('circleX', 14),
          h('span', null, p.msg),
          h('span', { class: 'loc' }, `${p.file}:${p.line}`),
        ),
      );
    }
    renderPanelTabs();
  }

  // ---- running ---------------------------------------------------------------------------------
  function setRunning(on, mode) {
    runMode = on ? mode : null;
    runBtn.hidden = on;
    stopBtn.hidden = !on;
    checkBtn.hidden = on || !exByFile.has(active);
    shellBtn.disabled = on && mode === 'repl';
    clear(sbRun);
    if (on) sbRun.append(h('span', { class: 'spin' }), ' ', mode === 'repl' ? t('status.shell') : t('status.running'));
  }

  function killCurrent() {
    if (!runId) return Promise.resolve();
    const id = runId;
    return new Promise((resolve) => {
      const off = window.api.onRunEvent((ev) => {
        if (ev.id === id && ev.type === 'exit') {
          off();
          resolve();
        }
      });
      window.api.kill(id);
      setTimeout(() => {
        off();
        resolve();
      }, 1500);
    });
  }

  function cmdLine(file, repl) {
    if (!term.endsWithNewline()) term.write('\n');
    term.block([h('span', { class: 'path' }, `~/pydays/${opts.key}`), ' ', h('span', { class: 'dollar' }, '$'), ' ', repl ? 'python' : `python ${file}`], 't-cmd');
  }

  async function startProcess({ file, code, repl }) {
    await killCurrent();
    showPanel('terminal');
    cmdLine(file, repl);
    setRunning(true, repl ? 'repl' : 'run');
    if (repl) term.block(t('term.shellStarted'), 't-info');
    let errText = '';
    unsub?.();
    unsub = null;
    const r = await window.api.run({ key: opts.key, file, code, files: opts.files || [], repl });
    runId = r.id;
    term.setActive(true, repl ? 'repl' : 'run');
    term.focus();
    unsub = window.api.onRunEvent((ev) => {
      if (ev.id !== r.id) return;
      if (ev.type === 'out') term.write(ev.data);
      else if (ev.type === 'err') {
        errText += ev.data;
        term.writeErr(ev.data);
      } else if (ev.type === 'exit') {
        unsub?.();
        unsub = null;
        if (runId === r.id) runId = null;
        term.setActive(false);
        setRunning(false);
        renderTabs();
        reportExit(ev, errText, file, repl);
      }
    });
  }

  function reportExit(ev, errText, file, repl) {
    if (ev.error) {
      if (!term.endsWithNewline()) term.write('\n');
      if (ev.error === 'no-python' || ev.error === 'bad-python-path') {
        const box = h('span', { class: 't-hint' });
        box.append(h('b', null, t(ev.error === 'no-python' ? 'term.noPython' : 'term.badPath')), h('br'), tNodes('term.installPython', { link: h('a', { href: '#/settings' }, t('nav.settings')) }));
        term.block(box, 't-hint');
      } else term.block(t('term.startFailed', { detail: ev.detail || ev.error }), 't-done bad');
      return;
    }
    if (!term.endsWithNewline()) term.write('\n');
    const secs = ((ev.timeMs || 0) / 1000).toFixed(2);
    if (ev.timedOut) term.block(t('term.timeout'), 't-done bad');
    else if (ev.truncated) term.block(t('term.truncated'), 't-done bad');
    else if (ev.killed) term.block(t('term.stopped'), 't-done');
    else if (repl) term.block(t('term.shellClosed'), 't-done');
    else term.block(ev.code === 0 ? t('term.done', { time: secs }) : t('term.exitCode', { code: ev.code, time: secs }), ev.code === 0 ? 't-done' : 't-done bad');
    if (!repl && errText) {
      markTraceback(errText, file);
      moduleHint(errText);
    }
  }

  function markTraceback(text, file) {
    if (!monaco) return;
    const lines = [...text.matchAll(/File "([^"]+)", line (\d+)/g)].filter((m) => m[1].endsWith(file));
    if (!lines.length) return;
    const line = Number(lines[lines.length - 1][2]);
    const msg = text.trim().split('\n').pop();
    const m = models.get(file);
    if (!m || line > m.getLineCount()) return;
    monaco.editor.setModelMarkers(m, 'runtime', [{ startLineNumber: line, startColumn: m.getLineFirstNonWhitespaceColumn(line) || 1, endLineNumber: line, endColumn: m.getLineMaxColumn(line), message: msg, severity: monaco.MarkerSeverity.Error }]);
  }

  function moduleHint(text) {
    const m = text.match(/ModuleNotFoundError: No module named '([\w.]+)'/);
    if (!m) return;
    const mod = m[1].split('.')[0];
    const pip = PIP_NAMES[mod] || mod;
    const cmd = window.navigator.platform.startsWith('Win') ? `py -m pip install ${pip}` : `python3 -m pip install ${pip}`;
    const box = h('span', { class: 't-hint' });
    box.append(tNodes('term.module', { mod: h('code', null, mod), cmd: h('code', null, cmd) }));
    term.block(box, 't-hint');
  }

  async function run() {
    if (checking) return;
    opts.onRun?.();
    await startProcess({ file: active, code: currentCode() });
  }

  async function runSnippet(code) {
    opts.onRun?.();
    await startProcess({ file: 'example.py', code });
  }

  async function startShell() {
    opts.onRun?.();
    await startProcess({ file: '', code: '', repl: true });
  }

  function stop() {
    if (runId) window.api.kill(runId);
  }

  // ---- exercise checks ----------------------------------------------------------------------------
  async function check(file = active) {
    const ex = exByFile.get(file);
    if (!ex || checking) return;
    if (file !== active) activate(file);
    checking = true;
    checkBtn.disabled = true;
    opts.onRun?.();
    showPanel('tests');
    clear(testsBody).appendChild(h('div', { class: 'empty-note' }, h('span', { class: 'spin' }), ' ', t('tests.running')));
    let res;
    try {
      res = await window.api.check({ file, code: currentCode(), files: opts.files || [], cases: ex.cases });
    } finally {
      checking = false;
      checkBtn.disabled = false;
    }
    if (disposed) return;
    const view = renderResults(res, ex);
    lastResults.set(file, view);
    if (active === file) clear(testsBody).appendChild(view.node);
    renderPanelTabs();
    if (view.ok) {
      ex.solved = true;
      renderTabs();
    }
    opts.onChecked?.(ex, view.ok);
    return view.ok;
  }

  function renderResults(res, ex) {
    const node = h('div');
    if (res.error) {
      const box = h('div', { class: 'tests-sum bad' }, icon('alert'), ' ', t(res.error === 'no-python' ? 'term.noPython' : res.error === 'bad-python-path' ? 'term.badPath' : 'term.startFailed', { detail: res.error }));
      node.appendChild(box);
      if (res.error === 'no-python' || res.error === 'bad-python-path') node.appendChild(h('p', { class: 'muted' }, tNodes('term.installPython', { link: h('a', { href: '#/settings' }, t('nav.settings')) })));
      return { node, ok: false, passed: 0, total: 1 };
    }
    let passed = 0;
    let total = 0;
    const cases = res.results.map((r, i) => {
      const c = ex.cases[i];
      const box = h('div', { class: 'case' });
      const head = h('div', { class: 'case-head' }, t('tests.case', { n: i + 1 }));
      if (c.stdin) head.append(' · ', t('tests.input'), ' ', h('code', null, c.stdin.replace(/\n$/, '').replace(/\n/g, ' ⏎ ')));
      box.appendChild(head);
      if (r.timedOut || r.error) {
        total += c.checks.length;
        box.appendChild(h('div', { class: 'chk bad' }, icon('x', 14), h('span', null, r.timedOut ? t('tests.timeout') : t('tests.harness', { detail: r.detail || r.error }))));
        return box;
      }
      for (const k of r.checks) {
        total++;
        if (k.ok) passed++;
        const label =
          k.type === 'out'
            ? h('span', null, t('tests.outContains'), ' ', h('code', null, k.value))
            : k.type === 're'
              ? h('span', null, t('tests.outMatches'), ' ', h('code', null, k.value))
              : h('code', null, k.value);
        const row = h('div', { class: `chk ${k.ok ? 'ok' : 'bad'}` }, icon(k.ok ? 'check' : 'x', 14), h('span', null, label, !k.ok && (k.got || k.detail) ? h('span', { class: 'got' }, k.detail || t('tests.got', { v: k.got })) : null));
        box.appendChild(row);
      }
      if (r.error) box.appendChild(h('pre', { class: 'err', dataset: { label: t('tests.error') } }, r.error));
      const failedOut = r.checks.some((k) => !k.ok);
      if (failedOut || r.errorType) box.appendChild(h('pre', { dataset: { label: t('tests.yourOutput') } }, r.out ? r.out.replace(/\n$/, '') : t('tests.noOutput')));
      return box;
    });
    const ok = passed === total && total > 0 && res.results.every((r) => !r.errorType);
    node.appendChild(h('div', { class: `tests-sum ${ok ? 'ok' : 'bad'}` }, icon(ok ? 'checkCircle' : 'circleX'), ok ? t('tests.passed', { n: total }) : t('tests.failed', { passed, n: total })));
    node.append(...cases);
    return { node, ok, passed, total };
  }

  // ---- start ---------------------------------------------------------------------------------------
  renderTabs();
  showPanel('terminal');
  term.block(t('term.welcome'), 't-info');
  updateStatus();

  const offSettings = onSettings((st, patch) => {
    if (!editor) return;
    if ('fontSize' in patch) editor.updateOptions({ fontSize: st.fontSize, lineHeight: Math.round(st.fontSize * 1.6) });
    if ('wordWrap' in patch) editor.updateOptions({ wordWrap: st.wordWrap ? 'on' : 'off' });
  });

  loadMonaco().then((m) => {
    if (disposed) return;
    monaco = m;
    clear(editorBox);
    editor = createEditor(monaco, editorBox, editorOptions({ model: modelFor(active) }));
    editor.onDidChangeCursorPosition((e) => (sbPos.textContent = t('status.lncol', { line: e.position.lineNumber, col: e.position.column })));
    sbPos.textContent = t('status.lncol', { line: 1, col: 1 });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => (exByFile.has(active) ? check() : run()));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => toast(t('ide.saved'), 'info', 1200));
    syntaxCheck();
    if (opts.focus !== false) editor.focus();
  });

  return {
    run,
    runSnippet,
    check,
    setCode,
    activate,
    open: (file) => activate(file),
    activeFile: () => active,
    markSolved(file, on = true) {
      const ex = exByFile.get(file);
      if (ex) ex.solved = on;
      renderTabs();
    },
    layout: () => editor?.layout(),
    destroy() {
      disposed = true;
      syntaxCheck.cancel();
      offSettings();
      unsub?.();
      if (runId) window.api.kill(runId);
      for (const m of models.values()) m.dispose();
      editor?.dispose();
    },
  };
}
