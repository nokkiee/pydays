import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../renderer/js/progress.js';

test('local dates do not shift around midnight', () => {
  assert.equal(P.localDate(new Date(2026, 10, 23, 0, 30)), '2026-11-23');
  assert.equal(P.localDate(new Date(2026, 10, 23, 23, 59)), '2026-11-23');
  assert.equal(P.addDays('2026-03-28', 2), '2026-03-30'); // across a DST change
  assert.equal(P.addDays('2026-12-31', 1), '2027-01-01');
});

test('streak counts consecutive studied days and survives until the day ends', () => {
  const p = P.emptyProgress();
  for (const d of ['2026-11-18', '2026-11-20', '2026-11-21', '2026-11-22']) P.logRun(p, d);
  assert.deepEqual(P.streak(p, '2026-11-22'), { current: 3, best: 3, today: true });
  assert.deepEqual(P.streak(p, '2026-11-23'), { current: 3, best: 3, today: false });
  assert.equal(P.streak(p, '2026-11-24').current, 0);
  assert.equal(P.streak(p, '2026-11-24').best, 3);
});

test('milestones unlock at 3, 7, 14, 21 and 30 completed days', () => {
  const p = P.emptyProgress();
  const reached = [];
  for (let d = 1; d <= 30; d++) reached.push(...P.completeDay(p, d, { date: P.addDays('2026-11-01', d) }));
  assert.deepEqual(reached, [3, 7, 14, 21, 30]);
  assert.equal(p.milestones[7], '2026-11-08');
  assert.deepEqual(P.completeDay(p, 5), []);
  assert.equal(P.nextMilestone(p), null);
});

test('solving and completing are recorded on the calendar', () => {
  const p = P.emptyProgress();
  assert.equal(P.solveExercise(p, 2, 'a', '2026-11-23'), true);
  assert.equal(P.solveExercise(p, 2, 'a', '2026-11-23'), false);
  P.completeDay(p, 2, { date: '2026-11-23', manual: true });
  assert.deepEqual(p.activity['2026-11-23'].done, [2]);
  assert.equal(P.intensity(p.activity['2026-11-23']), 3);
  assert.equal(P.nextDay(p), 1);
  P.uncompleteDay(p, 2);
  assert.equal(P.isDone(p, 2), false);
  assert.deepEqual(p.activity['2026-11-23'].done, []);
});
