// Calendar: which dates you studied, what you completed on them, streaks and milestones.
import { h, btn, icon, clear } from '../ui.js';
import { t, pick, weekStart, weekdayNames, fmtDate, capFirst } from '../i18n.js';
import { progress, onProgress, localDate, parseDate, addDays, studied, intensity, streak, studiedDates, MILESTONES, doneCount } from '../progress.js';
import { getDay } from '../course.js';
import { msName, msText } from '../milestones.js';

export function render(root, params) {
  const now = new Date();
  let year = params.year ?? now.getFullYear();
  let month = params.month ?? now.getMonth();
  let selected = localDate();
  const page = h('div', { class: 'page' });
  root.appendChild(page);

  const draw = () => page.replaceChildren(build());
  const move = (delta) => {
    const d = new Date(year, month + delta, 1);
    year = d.getFullYear();
    month = d.getMonth();
    draw();
  };

  function build() {
    const p = progress();
    const inner = h('div', { class: 'page-inner', style: { maxWidth: '1180px' } });
    inner.append(h('h1', { class: 'page-title' }, t('cal.title')), h('p', { class: 'page-sub' }, t('cal.sub')));

    // milestone dates: date -> highest milestone reached that day
    const msOn = {};
    for (const m of MILESTONES) if (p.milestones[m]) msOn[p.milestones[m]] = Math.max(msOn[p.milestones[m]] || 0, m);

    const first = new Date(year, month, 1);
    const lead = (first.getDay() - weekStart() + 7) % 7;
    const start = addDays(localDate(first), -lead);
    const days = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7;
    const today = localDate();
    const names = weekdayNames('short');

    const grid = h('div', { class: 'cal-grid' });
    for (let i = 0; i < 7; i++) grid.appendChild(h('div', { class: 'cal-wd' }, names[(i + weekStart()) % 7]));
    for (let i = 0; i < days; i++) {
      const ds = addDays(start, i);
      const date = parseDate(ds);
      const a = p.activity[ds];
      const lvl = intensity(a);
      const cell = h(
        'button',
        {
          class: `cal-day ${date.getMonth() !== month ? 'other' : ''} ${ds === today ? 'today' : ''} ${lvl ? 'lvl' + lvl : ''} ${ds === selected ? 'sel' : ''}`,
          title: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }),
          onclick: () => {
            selected = ds;
            draw();
          },
        },
        h('div', { class: 'num' }, h('b', null, String(date.getDate())), a?.minutes ? h('span', { class: 'small' }, `${a.minutes} ${t('common.min')}`) : null),
      );
      for (const n of a?.done || []) cell.appendChild(h('span', { class: 'cal-chip', title: pick(getDay(n)?.title) }, `✓ ${t('common.day', { n })}`));
      if (studied(a) && !(a.done || []).length && a.solved) cell.appendChild(h('span', { class: 'cal-chip plain' }, t('cal.solvedN', { n: a.solved })));
      if (msOn[ds]) cell.appendChild(h('span', { class: 'cal-ms', title: msName(msOn[ds]) }, String(msOn[ds])));
      grid.appendChild(cell);
    }

    const monthName = capFirst(fmtDate(first, { month: 'long', year: 'numeric' }));
    const main = h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'cal-head' },
        h('h2', null, monthName),
        h('button', { class: 'icon-btn', title: t('cal.prev'), onclick: () => move(-1) }, icon('left')),
        h('button', { class: 'icon-btn', title: t('cal.next'), onclick: () => move(1) }, icon('right')),
        h('div', { class: 'grow' }),
        btn(t('cal.today'), {
          small: true,
          onClick: () => {
            year = now.getFullYear();
            month = now.getMonth();
            selected = localDate();
            draw();
          },
        }),
      ),
      grid,
      h('div', { class: 'legend' }, t('cal.less'), h('i'), h('i', { class: 'l1' }), h('i', { class: 'l2' }), h('i', { class: 'l3' }), t('cal.more'), h('span', { class: 'grow' }), h('span', { class: 'cal-ms', style: { position: 'static', width: '18px', height: '18px', fontSize: '9px' } }, '7'), t('cal.milestoneLegend')),
    );

    inner.appendChild(h('div', { class: 'cal-layout' }, main, side(p, msOn)));
    return inner;
  }

  function side(p) {
    const s = streak(p);
    const dates = studiedDates(p);
    const inMonth = dates.filter((d) => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
    const minutes = Object.values(p.activity).reduce((n, a) => n + (a.minutes || 0), 0);
    const done = doneCount(p);
    const sel = p.activity[selected];
    const selDate = parseDate(selected);

    const detail = h('div', { class: 'card day-detail' }, h('h4', null, capFirst(fmtDate(selDate, { weekday: 'long', day: 'numeric', month: 'long' }))));
    if (!studied(sel)) detail.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, selected > localDate() ? t('cal.future') : t('cal.nothing')));
    else {
      const ul = h('ul');
      for (const n of sel.done || []) ul.appendChild(h('li', null, h('a', { href: `#/day/${n}` }, t('cal.completedDay', { n, title: pick(getDay(n)?.title) }))));
      if (sel.solved) ul.appendChild(h('li', null, t('cal.solvedN', { n: sel.solved })));
      if (sel.runs) ul.appendChild(h('li', null, t('cal.runsN', { n: sel.runs })));
      if (sel.minutes) ul.appendChild(h('li', null, t('cal.minutesN', { n: sel.minutes })));
      for (const m of MILESTONES) if (p.milestones[m] === selected) ul.appendChild(h('li', null, '🏅 ', msName(m)));
      detail.appendChild(ul);
    }

    return h(
      'div',
      { class: 'cal-side' },
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'big-streak' }, h('div', { class: 'flame' }, icon('flame', 24)), h('div', null, h('div', { class: 'v' }, String(s.current)), h('div', { class: 'muted small' }, t('cal.currentStreak', { n: s.current })))),
        h('p', { class: 'muted small', style: { margin: '12px 0 6px' } }, s.current && !s.today ? t('cal.streakToday') : s.today ? t('cal.streakSafe') : t('cal.streakStart')),
        h('div', { class: 'kv' }, t('cal.bestStreak'), h('b', null, t('streak.daysN', { n: s.best }))),
        h('div', { class: 'kv' }, t('cal.studiedMonth'), h('b', null, t('streak.daysN', { n: inMonth }))),
        h('div', { class: 'kv' }, t('cal.studiedTotal'), h('b', null, t('streak.daysN', { n: dates.length }))),
        h('div', { class: 'kv' }, t('cal.totalTime'), h('b', null, fmtMinutes(minutes))),
      ),
      detail,
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', null, t('home.milestones'))),
        MILESTONES.map((m) =>
          h(
            'div',
            { class: `ms-row ${p.milestones[m] ? 'reached' : ''}`, title: msText(m) },
            h('div', { class: 'medal' }, String(m)),
            h('div', { class: 't' }, h('b', null, msName(m)), h('span', null, p.milestones[m] ? t('course.reachedOn', { date: fmtDate(parseDate(p.milestones[m]), { day: 'numeric', month: 'long' }) }) : t('cal.daysLeft', { n: m - done, m }))),
            p.milestones[m] ? h('a', { href: `#/calendar/${p.milestones[m].slice(0, 7)}`, class: 'small' }, icon('calendar', 14)) : null,
          ),
        ),
      ),
    );
  }

  draw();
  return { destroy: onProgress(draw) };
}

function fmtMinutes(n) {
  if (n < 60) return `${n} ${t('common.min')}`;
  return `${Math.floor(n / 60)} h ${n % 60} ${t('common.min')}`;
}
