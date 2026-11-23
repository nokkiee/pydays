// Learning progress: which course days are done, what was studied on which calendar date,
// the streak and the milestones (3, 7, 14, 21 and 30 completed days).
//
// Dates are local calendar dates ("2026-11-23"), never UTC: studying at 00:30 in Warsaw
// belongs to that day, not to the day before.

export const MILESTONES = [3, 7, 14, 21, 30];
export const TOTAL_DAYS = 30;

export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export function emptyProgress() {
  return { days: {}, activity: {}, milestones: {} };
}

export function normalize(p) {
  const out = emptyProgress();
  if (!p || typeof p !== 'object') return out;
  for (const k of ['days', 'activity', 'milestones']) if (p[k] && typeof p[k] === 'object') out[k] = p[k];
  return out;
}

export const doneDays = (p) => Object.keys(p.days).filter((d) => p.days[d]?.done).map(Number).sort((a, b) => a - b);
export const doneCount = (p) => doneDays(p).length;
export const isDone = (p, day) => !!p.days[day]?.done;

export function solvedExercises(p, day) {
  return Object.keys(p.days[day]?.exercises || {});
}

export function totalSolved(p) {
  return Object.values(p.days).reduce((n, d) => n + Object.keys(d?.exercises || {}).length, 0);
}

/** The first course day not done yet (or 30 when all are). */
export function nextDay(p) {
  for (let d = 1; d <= TOTAL_DAYS; d++) if (!isDone(p, d)) return d;
  return TOTAL_DAYS;
}

/** A calendar date counts as studied when anything was done on it. */
export function studied(entry) {
  if (!entry) return false;
  return (entry.runs || 0) + (entry.solved || 0) + (entry.done || []).length > 0 || (entry.minutes || 0) >= 5;
}

/** 0 – nothing, 1 – a little, 2 – a solid session, 3 – a course day completed or a long session. */
export function intensity(entry) {
  if (!studied(entry)) return 0;
  if ((entry.done || []).length || (entry.minutes || 0) >= 45) return 3;
  if ((entry.solved || 0) >= 2 || (entry.minutes || 0) >= 20) return 2;
  return 1;
}

export function studiedDates(p) {
  return Object.keys(p.activity).filter((d) => studied(p.activity[d])).sort();
}

/**
 * current: consecutive studied dates ending today – or yesterday, because a streak isn't
 * lost before the day is over. best: the longest such run ever.
 */
export function streak(p, today = localDate()) {
  const dates = new Set(studiedDates(p));
  let current = 0;
  let cursor = dates.has(today) ? today : addDays(today, -1);
  while (dates.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of [...dates].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, today: dates.has(today) };
}

function touch(p, date) {
  p.activity[date] = p.activity[date] || { runs: 0, solved: 0, minutes: 0, done: [] };
  return p.activity[date];
}

export function logRun(p, date = localDate()) {
  touch(p, date).runs++;
}

export function logMinute(p, date = localDate()) {
  touch(p, date).minutes++;
}

/** Records a solved exercise; returns true the first time. */
export function solveExercise(p, day, id, date = localDate()) {
  const d = (p.days[day] = p.days[day] || { exercises: {} });
  d.exercises = d.exercises || {};
  if (d.exercises[id]) return false;
  d.exercises[id] = date;
  touch(p, date).solved++;
  return true;
}

/**
 * Marks a course day as done and returns the milestones it unlocked (usually none).
 * manual: the learner pressed "Mark as done" instead of solving every exercise.
 */
export function completeDay(p, day, { date = localDate(), manual = false } = {}) {
  const d = (p.days[day] = p.days[day] || { exercises: {} });
  if (d.done) return [];
  d.done = date;
  if (manual) d.manual = true;
  const a = touch(p, date);
  if (!a.done.includes(day)) a.done.push(day);
  const count = doneCount(p);
  const reached = [];
  for (const m of MILESTONES) {
    if (count >= m && !p.milestones[m]) {
      p.milestones[m] = date;
      reached.push(m);
    }
  }
  return reached;
}

/** Undo "done" (only for days marked by hand); milestones already reached stay. */
export function uncompleteDay(p, day) {
  const d = p.days[day];
  if (!d?.done) return;
  const a = p.activity[d.done];
  if (a) a.done = (a.done || []).filter((x) => x !== day);
  delete d.done;
  delete d.manual;
}

export function nextMilestone(p) {
  const count = doneCount(p);
  return MILESTONES.find((m) => m > count) ?? null;
}

/** Minutes studied in the 7 days ending today. */
export function weekMinutes(p, today = localDate()) {
  let n = 0;
  for (let i = 0; i < 7; i++) n += p.activity[addDays(today, -i)]?.minutes || 0;
  return n;
}

// ---- the live copy, saved through the main process ----------------------------------------

let state = emptyProgress();
const listeners = new Set();

export async function loadProgress() {
  state = normalize(await window.api.storeGet('progress'));
  return state;
}

export const progress = () => state;

export function updateProgress(fn) {
  const result = fn(state);
  window.api.storeSet('progress', state);
  for (const l of listeners) l(state);
  return result;
}

export function resetProgress() {
  state = emptyProgress();
  window.api.storeSet('progress', state);
  for (const l of listeners) l(state);
}

export function onProgress(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
