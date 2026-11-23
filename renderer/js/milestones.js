// Milestone badges (3, 7, 14, 21 and 30 completed days) and the celebration when one is reached.
import { h, btn, modal, confetti } from './ui.js';
import { t } from './i18n.js';
import { MILESTONES } from './progress.js';

export const msName = (m) => t(`ms.${m}.name`);
export const msText = (m) => t(`ms.${m}.text`);

export function celebrate(reached) {
  if (!reached?.length) return;
  const m = Math.max(...reached);
  confetti();
  modal({
    title: t('ms.reachedTitle'),
    cls: 'celebrate-modal',
    body: h(
      'div',
      { class: 'celebrate' },
      h('div', { class: 'medal-big' }, String(m)),
      h('h2', null, msName(m)),
      h('p', null, msText(m)),
      m < 30 ? h('p', { class: 'muted small', style: { marginTop: '12px' } }, t('ms.nextGoal', { n: MILESTONES.find((x) => x > m) })) : null,
    ),
    actions: [{ label: t('ms.keepGoing'), kind: 'primary', onClick: () => {} }],
  });
}

export function dayCelebration(day, next, goNext) {
  modal({
    title: t('day.completeTitle'),
    body: h('div', { class: 'celebrate' }, h('div', { class: 'medal-big', style: { fontSize: '30px' } }, '✓'), h('h2', null, t('day.completeHead', { n: day })), h('p', null, t('day.completeText'))),
    actions: [
      { label: t('common.close'), kind: 'ghost', onClick: () => {} },
      next ? { label: t('day.goNext', { n: next }), kind: 'primary', onClick: () => goNext(next) } : null,
    ].filter(Boolean),
  });
  return btn;
}
