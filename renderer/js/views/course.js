// Course: the 30 days by week, with the milestones between them.
import { h } from '../ui.js';
import { t, fmtDate } from '../i18n.js';
import { progress, doneCount, nextDay, MILESTONES, TOTAL_DAYS, onProgress } from '../progress.js';
import { course, SOURCE_REPO } from '../course.js';
import { msName } from '../milestones.js';
import { dayCard } from './home.js';

const WEEKS = [
  [1, 7],
  [8, 14],
  [15, 21],
  [22, 28],
  [29, 30],
];

export function render(root) {
  const page = h('div', { class: 'page' });
  root.appendChild(page);
  const draw = () => page.replaceChildren(build());
  draw();
  return { destroy: onProgress(draw) };
}

function build() {
  const p = progress();
  const next = nextDay(p);
  const done = doneCount(p);
  const inner = h(
    'div',
    { class: 'page-inner' },
    h('h1', { class: 'page-title' }, t('course.title')),
    h('p', { class: 'page-sub' }, t('course.sub', { done, n: TOTAL_DAYS }), ' ', h('a', { href: SOURCE_REPO, target: '_blank' }, t('course.basedOn'))),
  );
  WEEKS.forEach(([from, to], w) => {
    const items = [];
    for (const d of course().filter((x) => x.day >= from && x.day <= to)) {
      items.push(dayCard(p, d, next));
      if (MILESTONES.includes(d.day)) items.push(milestoneCard(p, d.day));
    }
    inner.append(h('div', { class: 'section-title' }, w < 4 ? t('course.week', { n: w + 1 }) : t('course.finalDays')), h('div', { class: 'week-block days-grid' }, items));
  });
  return inner;
}

function milestoneCard(p, m) {
  const reached = p.milestones[m];
  return h(
    'div',
    { class: `ms-card ${reached ? 'reached' : ''}` },
    h('div', { class: 'medal' }, String(m)),
    h('b', null, msName(m)),
    h('span', null, reached ? t('course.reachedOn', { date: fmtDate(new Date(reached + 'T12:00'), { day: 'numeric', month: 'long' }) }) : t('course.milestoneAfter', { n: m })),
  );
}
