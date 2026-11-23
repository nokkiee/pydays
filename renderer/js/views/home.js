// Home: what's next, the numbers that matter, milestones and this week.
import { h, icon, btn } from '../ui.js';
import { t, pick, weekStart, weekdayNames, fmtDate } from '../i18n.js';
import { progress, doneCount, nextDay, isDone, streak, totalSolved, weekMinutes, MILESTONES, TOTAL_DAYS, localDate, addDays, studied, solvedExercises, nextMilestone, onProgress } from '../progress.js';
import { course, getDay } from '../course.js';
import { msName } from '../milestones.js';
import { python } from '../ide.js';

export function render(root) {
  const page = h('div', { class: 'page' });
  root.appendChild(page);
  const draw = () => {
    page.replaceChildren(build());
  };
  draw();
  const off = onProgress(draw);
  return { destroy: off };
}

function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? t('home.night') : hr < 12 ? t('home.morning') : hr < 18 ? t('home.afternoon') : t('home.evening');
}

function build() {
  const p = progress();
  const done = doneCount(p);
  const next = nextDay(p);
  const d = getDay(next);
  const s = streak(p);
  const allDone = done >= TOTAL_DAYS;
  const solvedHere = solvedExercises(p, next).length;
  const inner = h('div', { class: 'page-inner' });

  const banner = h('div');
  python().then((py) => {
    if (py.ok) return;
    banner.replaceChildren(
      h('div', { class: 'banner' }, icon('alert', 18), h('div', null, h('b', null, t('term.noPython')), h('div', null, t('home.noPythonText')), h('a', { href: '#/settings' }, t('home.noPythonLink')))),
    );
  });

  const sub = allDone ? t('home.subDone') : done === 0 ? t('home.subStart') : t('home.subNext', { n: next, done });

  inner.append(
    banner,
    h('div', { class: 'greet' }, h('img', { class: 'mark', src: 'img/logo.svg', alt: '' }), h('h1', null, greeting())),
    h('p', { class: 'page-sub' }, sub),
  );

  if (d) {
    inner.appendChild(
      h(
        'div',
        { class: 'continue' },
        h('div', { class: 'big-day' }, h('small', null, t('common.dayShort')), h('b', null, String(next))),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'kicker' }, allDone ? t('home.reviewKicker') : solvedHere ? t('home.continueKicker') : t('home.nextKicker')),
          h('h2', null, pick(d.title)),
          h('p', null, pick(d.summary)),
        ),
        btn(allDone ? t('home.review') : solvedHere ? t('home.continue') : t('home.start'), { kind: 'primary', big: true, icon: 'play', onClick: () => (location.hash = `#/day/${next}`) }),
      ),
    );
  }

  const nm = nextMilestone(p);
  inner.appendChild(
    h(
      'div',
      { class: 'stats' },
      stat(icon('book', 13), t('home.statDays'), [String(done), h('small', null, `/ ${TOTAL_DAYS}`)], h('div', { class: 'bar' }, h('i', { style: { width: (done / TOTAL_DAYS) * 100 + '%' } }))),
      stat(icon('flame', 13), t('home.statStreak'), [String(s.current), h('small', null, t('streak.days', { n: s.current }))], h('div', { class: 'foot' }, s.today || !s.current ? t('home.best', { n: s.best }) : t('home.keepStreak'))),
      stat(icon('clock', 13), t('home.statTime'), [String(weekMinutes(p)), h('small', null, t('common.min'))], h('div', { class: 'foot' }, t('home.last7'))),
      stat(icon('trophy', 13), t('home.statMilestone'), nm ? [String(nm - done), h('small', null, t('home.daysToGoWord', { n: nm - done }))] : ['30', h('small', null, '✓')], h('div', { class: 'foot' }, nm ? t('home.toMilestone', { name: msName(nm) }) : t('home.allMilestones'))),
    ),
  );

  inner.appendChild(h('div', { class: 'home-grid' }, milestoneCard(p, done), weekCard(p)));

  // the next few days of the course
  const upcoming = course().filter((x) => x.day >= next).slice(allDone ? 0 : 1, allDone ? 0 : 5);
  if (upcoming.length) {
    inner.appendChild(h('div', { class: 'section-title' }, t('home.comingUp')));
    inner.appendChild(h('div', { class: 'days-grid' }, upcoming.map((x) => dayCard(p, x, next))));
  }
  return inner;
}

function stat(ico, label, value, foot) {
  return h('div', { class: 'stat' }, h('div', { class: 'label' }, ico, label), h('div', { class: 'value' }, value), foot);
}

function milestoneCard(p, done) {
  const reachedCount = MILESTONES.filter((m) => p.milestones[m]).length;
  // the fill runs between the first and last medal (10% .. 90% of the width)
  const pos = (i) => 10 + i * 20;
  let fill = 0;
  for (let i = 0; i < MILESTONES.length; i++) {
    const prev = i ? MILESTONES[i - 1] : 0;
    if (done >= MILESTONES[i]) fill = pos(i);
    else {
      if (i > 0) fill = pos(i - 1) + 20 * Math.max(0, (done - prev) / (MILESTONES[i] - prev));
      break;
    }
  }
  const next = MILESTONES.find((m) => !p.milestones[m]);
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', null, t('home.milestones')), h('span', { class: 'muted small' }, t('home.reached', { n: reachedCount, total: MILESTONES.length }))),
    h(
      'div',
      { class: 'track' },
      h('div', { class: 'fill', style: { width: Math.max(0, fill - 10) + '%' } }),
      MILESTONES.map((m) =>
        h(
          'div',
          { class: `ms ${p.milestones[m] ? 'reached' : ''} ${m === next ? 'nextup' : ''}`, title: msName(m) },
          h('div', { class: 'medal' }, String(m)),
          h('div', { class: 'ms-name' }, msName(m)),
          h('div', { class: 'ms-sub' }, p.milestones[m] ? fmtDate(new Date(p.milestones[m] + 'T12:00'), { day: 'numeric', month: 'short' }) : t('home.daysToGo', { n: Math.max(0, m - done) })),
        ),
      ),
    ),
  );
}

function weekCard(p) {
  const today = localDate();
  const now = new Date();
  const offset = (now.getDay() - weekStart() + 7) % 7;
  const first = addDays(today, -offset);
  const names = weekdayNames('short');
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const count = days.filter((d) => studied(p.activity[d])).length;
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', null, t('home.thisWeek')), h('a', { href: '#/calendar', class: 'small' }, t('home.openCalendar'))),
    h(
      'div',
      { class: 'week' },
      days.map((d, i) => {
        const a = p.activity[d];
        const isToday = d === today;
        const dayNum = Number(d.slice(8));
        return h(
          'div',
          { class: `wd ${studied(a) ? 'studied' : ''} ${isToday ? 'today' : ''}`, title: fmtDate(new Date(d + 'T12:00'), { weekday: 'long', day: 'numeric', month: 'long' }) },
          names[(i + weekStart()) % 7],
          h('div', { class: 'dot' }, String(dayNum)),
        );
      }),
    ),
    h('div', { class: 'muted small', style: { marginTop: '10px' } }, t('home.weekCount', { n: count })),
  );
}

export function dayCard(p, d, next) {
  const total = d.exercises.length;
  const solved = solvedExercises(p, d.day).filter((id) => d.exercises.some((e) => e.id === id)).length;
  const done = isDone(p, d.day);
  const state = done ? t('course.done') : d.day === next ? t('course.next') : solved ? t('course.inProgress') : '';
  return h(
    'a',
    { class: `day-card ${done ? 'done' : ''} ${d.day === next && !done ? 'next' : ''}`, href: `#/day/${d.day}` },
    h('div', { class: 'top' }, h('b', null, t('common.day', { n: d.day })), h('span', { class: 'state' }, done ? [icon('check', 12), ' ', state] : state)),
    h('h4', null, pick(d.title)),
    h('p', null, pick(d.summary)),
    h('div', { class: 'foot' }, h('div', { class: 'mini-bar' }, h('i', { style: { width: total ? (solved / total) * 100 + '%' : done ? '100%' : '0' } })), t('course.exercisesShort', { solved, n: total })),
  );
}
