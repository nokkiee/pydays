// A day's class: the explanation and exercises on the left, the editor and terminal on the right.
import { h, btn, icon, clear, toast, splitter, modal } from '../ui.js';
import { t, pick, fmtDate } from '../i18n.js';
import { getDay, sourceUrl, course } from '../course.js';
import { md } from '../markdown.js';
import { colorize } from '../monaco.js';
import { createIde } from '../ide.js';
import { exerciseFile, lessonFile } from '../parse.js';
import { getSettings, setSettings } from '../store.js';
import { progress, updateProgress, logRun, solveExercise, completeDay, uncompleteDay, isDone, solvedExercises, TOTAL_DAYS } from '../progress.js';
import { celebrate, dayCelebration } from '../milestones.js';

export function render(root, params) {
  const d = getDay(params.day);
  if (!d) {
    root.appendChild(h('div', { class: 'page' }, h('div', { class: 'page-inner' }, h('h1', { class: 'page-title' }, t('day.notFound')), h('a', { href: '#/course' }, t('nav.course')))));
    return null;
  }
  const key = 'day' + String(d.day).padStart(2, '0');
  const exFiles = d.exercises.map((e, i) => exerciseFile(i, e.id));
  let tab = params.tab || 'lesson';
  let ide = null;
  let destroyed = false;
  let activeFile = null;

  // ---- layout ---------------------------------------------------------------------------
  const scroll = h('div', { class: 'lesson-scroll' });
  const tabsEl = h('div', { class: 'tabs' });
  const actions = h('div', { class: 'actions' });
  const head = h(
    'div',
    { class: 'lesson-head' },
    h('div', { class: 'kicker' }, h('b', null, t('common.day', { n: d.day })), h('span', null, t('day.of', { n: TOTAL_DAYS })), h('div', { class: 'grow' }), actions),
    h('h1', null, pick(d.title)),
    tabsEl,
  );
  const pane = h('div', { class: 'lesson-pane' }, head, scroll);
  const ideBox = h('div', { class: 'ide' });
  const vsplit = h('div', { class: 'vsplit' });
  const layout = h('div', { class: 'lesson-layout' }, pane, vsplit, ideBox);
  root.appendChild(layout);
  const w = getSettings().lessonWidth;
  if (w) pane.style.width = w + 'px';
  splitter(vsplit, {
    min: 360,
    max: () => layout.getBoundingClientRect().width - 420,
    onResize: (size) => (pane.style.width = size + 'px'),
    onDone: () => setSettings({ lessonWidth: parseInt(pane.style.width, 10) }),
  });

  // ---- header: tabs and completion ---------------------------------------------------------
  function solvedCount() {
    const s = new Set(solvedExercises(progress(), d.day));
    return d.exercises.filter((e) => s.has(e.id)).length;
  }

  function renderHead() {
    clear(tabsEl).append(
      h('button', { class: `tab ${tab === 'lesson' ? 'active' : ''}`, onclick: () => (location.hash = `#/day/${d.day}/lesson`) }, icon('book', 15), t('day.lesson')),
      h(
        'button',
        { class: `tab ${tab === 'exercises' ? 'active' : ''}`, onclick: () => (location.hash = `#/day/${d.day}/exercises`) },
        icon('target', 15),
        t('day.exercises'),
        h('span', { class: `pill ${solvedCount() === d.exercises.length && d.exercises.length ? 'ok' : ''}` }, `${solvedCount()}/${d.exercises.length}`),
      ),
    );
    const p = progress();
    clear(actions);
    if (isDone(p, d.day)) {
      const day = p.days[d.day];
      actions.append(h('span', { class: 'pill ok', title: day.manual ? t('day.markedByHand') : '' }, icon('check', 12), t('day.completedOn', { date: fmtDate(new Date(day.done + 'T12:00'), { day: 'numeric', month: 'short' }) })));
      if (day.manual)
        actions.append(
          btn(t('day.undo'), {
            small: true,
            kind: 'ghost',
            onClick: () => {
              updateProgress((pp) => uncompleteDay(pp, d.day));
              renderHead();
            },
          }),
        );
    } else {
      actions.append(btn(t('day.markDone'), { small: true, kind: 'ghost', icon: 'check', title: t('day.markDoneTitle'), onClick: () => finishDay(true) }));
    }
  }

  function setTab(next) {
    tab = next;
    renderHead();
    clear(scroll).appendChild(tab === 'exercises' ? exercisesView() : lessonView());
    scroll.scrollTop = 0;
  }

  // ---- lesson ---------------------------------------------------------------------------------------
  function lessonView() {
    const box = h('div');
    for (const b of d.blocks) {
      if (b.type === 'md') box.appendChild(h('div', { class: 'prose' }, ...md(pick(b.text)).childNodes));
      else box.appendChild(snippet(b));
    }
    const n = d.exercises.length;
    box.appendChild(
      h(
        'div',
        { class: 'lesson-end' },
        icon('target', 20),
        h('p', null, n ? t('day.readyText', { n }) : t('day.readyNoEx')),
        n ? btn(t('day.toExercises'), { kind: 'primary', icon: 'right', onClick: () => (location.hash = `#/day/${d.day}/exercises`) }) : null,
      ),
    );
    box.appendChild(dayNav());
    box.appendChild(credit());
    return box;
  }

  function snippet(b) {
    const pre = h('pre', null, b.code);
    colorize(b.code).then((html) => !destroyed && (pre.innerHTML = html));
    const bar = h('div', { class: 'snippet-bar' }, h('span', { class: 'lang', dataset: { note: t('day.raisesError') } }, 'python'), h('div', { class: 'grow' }));
    bar.appendChild(
      btn(t('day.copyToEditor'), {
        small: true,
        kind: 'ghost',
        icon: 'edit',
        title: t('day.copyToEditorTitle', { file: lessonFile(d.day) }),
        onClick: () => {
          ide?.setCode(lessonFile(d.day), b.code + '\n');
          toast(t('day.copied', { file: lessonFile(d.day) }), 'info', 2600);
        },
      }),
    );
    if (!b.opts.norun) bar.appendChild(btn(t('ide.run'), { small: true, kind: 'ghost', icon: 'play', onClick: () => ide?.runSnippet(b.code) }));
    return h('div', { class: `snippet ${b.opts.error ? 'error' : ''}` }, bar, pre);
  }

  function dayNav() {
    const prev = course().find((x) => x.day === d.day - 1);
    const next = course().find((x) => x.day === d.day + 1);
    return h(
      'div',
      { class: 'lesson-nav' },
      prev ? btn(`${t('common.day', { n: prev.day })} · ${pick(prev.title)}`, { kind: 'ghost', icon: 'left', onClick: () => (location.hash = `#/day/${prev.day}`) }) : h('span'),
      next ? btn(`${t('common.day', { n: next.day })} · ${pick(next.title)}`, { kind: 'ghost', onClick: () => (location.hash = `#/day/${next.day}`) }) : h('span'),
    );
  }

  function credit() {
    return h('div', { class: 'credit' }, t('day.credit'), ' ', h('a', { href: sourceUrl(d), target: '_blank' }, t('day.creditLink', { n: d.day })), ' ↗');
  }

  // ---- exercises ------------------------------------------------------------------------------------
  const cardEls = new Map();
  function exercisesView() {
    cardEls.clear();
    const solved = new Set(solvedExercises(progress(), d.day));
    const list = h('div', { class: 'ex-list' });
    if (!d.exercises.length) list.appendChild(h('p', { class: 'muted' }, t('day.readyNoEx')));
    d.exercises.forEach((e, i) => {
      const file = exFiles[i];
      const result = h('span', { class: `ex-result ${solved.has(e.id) ? 'ok' : ''}` }, solved.has(e.id) ? [icon('check', 13), t('day.solved')] : null);
      let hintBox = null;
      const card = h(
        'div',
        { class: `ex ${solved.has(e.id) ? 'solved' : ''} ${activeFile === file ? 'active' : ''}` },
        h('div', { class: 'ex-head' }, h('span', { class: 'ex-num' }, solved.has(e.id) ? '✓' : String(i + 1)), h('h3', null, pick(e.title))),
        h('div', { class: 'ex-body prose' }, ...md(pick(e.text)).childNodes),
      );
      const acts = h(
        'div',
        { class: 'ex-actions' },
        btn(t('day.openExercise'), { small: true, icon: 'edit', onClick: () => ide?.open(file) }),
        btn(t('ide.check'), {
          small: true,
          icon: 'flask',
          cls: 'ex-check',
          onClick: async () => {
            ide?.open(file);
            const ok = await ide?.check(file);
            if (ok === false) {
              clear(result).append(icon('x', 13), t('day.notYet'));
              result.className = 'ex-result bad';
            }
          },
        }),
        e.hint
          ? btn(t('day.hint'), {
              small: true,
              kind: 'ghost',
              icon: 'bulb',
              onClick: () => {
                if (hintBox) {
                  hintBox.remove();
                  hintBox = null;
                } else {
                  hintBox = h('div', { class: 'ex-hint' }, ...md(pick(e.hint)).childNodes);
                  card.appendChild(hintBox);
                }
              },
            })
          : null,
        e.solution ? btn(t('day.solution'), { small: true, kind: 'ghost', icon: 'sparkle', onClick: () => showSolution(e, file) }) : null,
        result,
      );
      card.insertBefore(acts, null);
      cardEls.set(file, card);
      list.appendChild(card);
    });
    const box = h('div', null, list);
    box.appendChild(dayNav());
    return box;
  }

  function showSolution(e, file) {
    const pre = h('pre', null, e.solution);
    colorize(e.solution).then((html) => (pre.innerHTML = html));
    modal({
      title: t('day.solutionTitle', { title: pick(e.title) }),
      wide: true,
      body: h('div', null, h('p', { class: 'muted small' }, t('day.solutionNote')), h('div', { class: 'snippet' }, pre)),
      actions: [
        { label: t('common.close'), kind: 'ghost', onClick: () => {} },
        {
          label: t('day.solutionToEditor'),
          kind: 'primary',
          onClick: () => {
            ide?.setCode(file, e.solution + '\n');
          },
        },
      ],
    });
  }

  // ---- progress ---------------------------------------------------------------------------------------
  function finishDay(manual) {
    const reached = updateProgress((p) => completeDay(p, d.day, { manual }));
    renderHead();
    const next = d.day < TOTAL_DAYS ? d.day + 1 : null;
    if (reached.length) celebrate(reached);
    else dayCelebration(d.day, next, (n) => (location.hash = `#/day/${n}`));
  }

  function onChecked(ex, ok) {
    if (!ok) return;
    const first = updateProgress((p) => solveExercise(p, d.day, ex.id));
    if (first) toast(t('day.exerciseSolved', { title: ex.title }), 'ok');
    renderHead();
    if (tab === 'exercises') {
      const y = scroll.scrollTop;
      setTab('exercises');
      scroll.scrollTop = y;
    }
    const all = d.exercises.every((e) => solvedExercises(progress(), d.day).includes(e.id));
    if (all && !isDone(progress(), d.day)) finishDay(false);
  }

  // ---- start ------------------------------------------------------------------------------------------
  setTab(tab);
  const firstCode = d.blocks.find((b) => b.type === 'code' && !b.opts.norun && !b.opts.error);
  const solved = new Set(solvedExercises(progress(), d.day));
  createIde(ideBox, {
    key,
    base: { file: lessonFile(d.day), starter: `# ${t('common.day', { n: d.day })}: ${pick(d.title)}\n# ${t('day.scratchComment')}\n\n${firstCode ? firstCode.code + '\n' : ''}` },
    exercises: d.exercises.map((e, i) => ({ id: e.id, file: exFiles[i], starter: e.starter ? e.starter + '\n' : '', cases: e.cases, title: pick(e.title), solved: solved.has(e.id) })),
    files: d.files,
    onRun: () => updateProgress((p) => logRun(p)),
    onChecked,
    onActive: (file) => {
      activeFile = file;
      for (const [f, el] of cardEls) el.classList.toggle('active', f === file);
    },
  }).then((x) => {
    if (destroyed) x.destroy();
    else ide = x;
  });

  return {
    setTab,
    destroy() {
      destroyed = true;
      ide?.destroy();
    },
  };
}
