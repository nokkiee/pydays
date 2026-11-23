// Playground: the editor and terminal on their own, for trying anything.
import { h } from '../ui.js';
import { t } from '../i18n.js';
import { createIde } from '../ide.js';
import { updateProgress, logRun } from '../progress.js';

export function render(root) {
  const box = h('div', { class: 'ide' });
  root.appendChild(h('div', { class: 'lesson-layout' }, box));
  let ide = null;
  let destroyed = false;
  createIde(box, {
    key: 'playground',
    base: { file: 'playground.py', starter: `# ${t('play.comment1')}\n# ${t('play.comment2')}\n\nname = input("${t('play.askName')} ")\nprint(f"${t('play.hello')}, {name}!")\n` },
    exercises: [],
    onRun: () => updateProgress((p) => logRun(p)),
  }).then((x) => {
    if (destroyed) x.destroy();
    else ide = x;
  });
  return {
    destroy() {
      destroyed = true;
      ide?.destroy();
    },
  };
}
