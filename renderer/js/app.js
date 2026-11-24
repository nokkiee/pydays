// Shell: sidebar, routing, first-start language picker and the study-time counter.
import { h, icon, clear, modal } from './ui.js';
import { t, tIn, setLanguage, pickLanguage, LANGUAGES, pick, lang } from './i18n.js';
import { loadSettings, getSettings, setSettings, flushCode } from './store.js';
import { loadProgress, progress, onProgress, updateProgress, streak, doneCount, isDone, nextDay, logMinute, TOTAL_DAYS } from './progress.js';
import { loadCourse, course } from './course.js';
import * as home from './views/home.js';
import * as courseView from './views/course.js';
import * as dayView from './views/day.js';
import * as calendar from './views/calendar.js';
import * as playground from './views/playground.js';
import * as settingsView from './views/settings.js';

const sidebar = document.getElementById('sidebar');
const viewEl = document.getElementById('view');
let current = null;
let route = { name: 'home', params: {} };

const ROUTES = [
  [/^#?\/?$/, 'home', home],
  [/^#\/course$/, 'course', courseView],
  [/^#\/day\/(\d+)(?:\/(lesson|exercises))?$/, 'day', dayView, (m) => ({ day: Number(m[1]), tab: m[2] || null })],
  [/^#\/calendar(?:\/(\d{4})-(\d{2}))?$/, 'calendar', calendar, (m) => (m[1] ? { year: Number(m[1]), month: Number(m[2]) - 1 } : {})],
  [/^#\/playground$/, 'playground', playground],
  [/^#\/settings$/, 'settings', settingsView],
];

export const go = (hash) => (location.hash = hash);

function navigate() {
  const hash = location.hash || '#/';
  let match = null;
  for (const [re, name, mod, params] of ROUTES) {
    const m = hash.match(re);
    if (m) {
      match = { name, mod, params: params ? params(m) : {} };
      break;
    }
  }
  if (!match) match = { name: 'home', mod: home, params: {} };
  // the same lesson with another tab: let the view switch tabs itself
  if (current && route.name === 'day' && match.name === 'day' && route.params.day === match.params.day && current.setTab) {
    route = match;
    current.setTab(match.params.tab || 'lesson');
    return;
  }
  try {
    current?.destroy?.();
  } catch (e) {
    console.error(e);
  }
  flushCode();
  route = match;
  clear(viewEl);
  current = match.mod.render(viewEl, match.params) || null;
  renderSidebar();
}

// ---- sidebar ------------------------------------------------------------------------------------

function navItem(hash, ico, label, active, extra) {
  return h('a', { class: `nav-item ${active ? 'active' : ''}`, href: hash, title: label }, icon(ico, 17), h('span', null, label), extra || null);
}

export function renderSidebar() {
  const p = progress();
  const s = streak(p);
  const next = nextDay(p);
  const days = course();
  const activeDay = route.name === 'day' ? route.params.day : null;
  const toggle = () => {
    const on = !document.body.classList.contains('side-collapsed');
    document.body.classList.toggle('side-collapsed', on);
    setSettings({ sidebarCollapsed: on });
  };
  clear(sidebar).append(
    h(
      'div',
      { class: 'side-head' },
      h('div', { class: 'brand', onclick: () => (document.body.classList.contains('side-collapsed') ? toggle() : go('#/')), title: 'PyDays' }, h('img', { src: 'img/logo.svg', alt: '' }), h('span', null, 'PyDays')),
      h('div', { class: 'grow' }),
      h('button', { class: 'icon-btn collapse', title: t('nav.collapse'), onclick: toggle }, icon('panel', 17)),
    ),
    h(
      'nav',
      { class: 'side-nav' },
      navItem('#/', 'home', t('nav.home'), route.name === 'home'),
      navItem('#/course', 'book', t('nav.course'), route.name === 'course', h('span', { class: 'count' }, `${doneCount(p)}/${TOTAL_DAYS}`)),
      navItem('#/calendar', 'calendar', t('nav.calendar'), route.name === 'calendar'),
      navItem('#/playground', 'terminal', t('nav.playground'), route.name === 'playground'),
    ),
    h('div', { class: 'side-label' }, h('span', null, t('nav.days'))),
    h(
      'div',
      { class: 'side-days' },
      days.map((d) =>
        h(
          'a',
          {
            class: `day-link ${isDone(p, d.day) ? 'done' : ''} ${d.day === next && !isDone(p, d.day) ? 'next' : ''} ${d.day === activeDay ? 'active' : ''}`,
            href: `#/day/${d.day}`,
            title: `${t('common.day', { n: d.day })} · ${pick(d.title)}`,
          },
          h('span', { class: 'dn' }, String(d.day).padStart(2, '0')),
          h('span', { class: 'dt' }, pick(d.title)),
          h('span', { class: 'st' }, isDone(p, d.day) ? icon('check', 13) : null),
        ),
      ),
    ),
    h('div', { class: 'side-spacer' }),
    h(
      'div',
      { class: 'side-foot' },
      h(
        'div',
        { class: `streak-chip ${s.current ? '' : 'cold'}`, title: t('streak.title'), onclick: () => go('#/calendar') },
        h('span', { class: 'flame' }, icon('flame', 17)),
        h('span', null, h('b', null, String(s.current)), ' ', t('streak.days', { n: s.current })),
      ),
      h('button', { class: 'icon-btn', title: t('nav.language'), onclick: () => languagePicker({}) }, icon('globe', 17)),
      h('a', { class: `icon-btn ${route.name === 'settings' ? 'active' : ''}`, href: '#/settings', title: t('nav.settings') }, icon('settings', 17)),
    ),
  );
  sidebar.querySelector('.day-link.active')?.scrollIntoView({ block: 'nearest' });
}

// ---- language picker ---------------------------------------------------------------------------

export function languagePicker({ first = false }) {
  let chosen = lang;
  const list = h('div', { class: 'lang-list' });
  const render = () => {
    clear(list).append(
      ...LANGUAGES.map(([code, name]) =>
        h(
          'button',
          {
            class: `lang-opt ${code === chosen ? 'sel' : ''}`,
            onclick: () => {
              chosen = code;
              render();
            },
            ondblclick: () => apply(),
          },
          h('span', { class: 'code' }, code),
          h('span', null, name),
          h('span', { class: 'hello' }, tIn(code, 'lang.hello')),
        ),
      ),
    );
  };
  const apply = () => {
    const changed = chosen !== lang || !getSettings().lang;
    setSettings({ lang: chosen });
    dlg.close();
    // Monaco reads its interface language at start, so a change reloads the page
    if (changed && chosen !== lang) setTimeout(() => location.reload(), 50);
    else askStarters();
  };
  render();
  const dlg = modal({
    title: first ? tIn(chosen, 'lang.welcome') : t('lang.title'),
    closable: !first,
    body: h('div', null, h('p', null, first ? t('lang.firstText') : t('lang.text')), list),
    actions: [{ label: t('lang.apply'), kind: 'primary', onClick: () => (apply(), true) }],
  });
}

// Asked once: should exercises open with starter code? The answer lives in Settings → Editor.
function askStarters() {
  if (getSettings().starters != null) return;
  const answer = (v) => () => void setSettings({ starters: v });
  modal({
    title: t('starters.title'),
    closable: false,
    body: h('p', null, t('starters.text')),
    actions: [
      { label: t('starters.blank'), kind: 'ghost', onClick: answer(false) },
      { label: t('starters.keep'), kind: 'primary', onClick: answer(true) },
    ],
  });
}

// ---- study time -----------------------------------------------------------------------------------

function startActivityTimer() {
  let lastInput = Date.now();
  const mark = () => (lastInput = Date.now());
  for (const ev of ['keydown', 'mousedown', 'wheel']) window.addEventListener(ev, mark, { passive: true, capture: true });
  let moveThrottle = 0;
  window.addEventListener('mousemove', () => {
    const now = Date.now();
    if (now - moveThrottle > 5000) {
      moveThrottle = now;
      mark();
    }
  });
  // one minute is counted for every minute spent in a lesson or the playground with the window
  // focused and some activity in the last two minutes
  setInterval(() => {
    if (!['day', 'playground'].includes(route.name)) return;
    if (!document.hasFocus() || Date.now() - lastInput > 120000) return;
    updateProgress((p) => logMinute(p));
  }, 60000);
}

// ---- boot -----------------------------------------------------------------------------------------

async function boot() {
  await loadSettings();
  const info = await window.api.appInfo().catch(() => ({}));
  setLanguage(pickLanguage(getSettings().lang, navigator.language || info.locale));
  await Promise.all([loadProgress(), loadCourse()]);
  if (getSettings().sidebarCollapsed) document.body.classList.add('side-collapsed');
  onProgress(() => renderSidebar());
  window.addEventListener('hashchange', navigate);
  window.addEventListener('beforeunload', flushCode);
  navigate();
  document.body.classList.remove('loading');
  if (!getSettings().lang) languagePicker({ first: true });
  else askStarters();
  startActivityTimer();
  window.pydaysReady = true;
}

boot().catch((e) => {
  console.error(e);
  document.body.classList.remove('loading');
  viewEl.textContent = 'PyDays failed to start: ' + e.message;
});
