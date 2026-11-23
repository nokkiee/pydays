// Settings: language, editor, Python, progress reset, about.
import { h, btn, icon, clear, toast, confirmDialog } from '../ui.js';
import { t, lang, LANGUAGES } from '../i18n.js';
import { getSettings, setSettings, clearAllCode } from '../store.js';
import { resetProgress, TOTAL_DAYS } from '../progress.js';
import { python } from '../ide.js';
import { SOURCE_REPO } from '../course.js';

export function render(root) {
  const page = h('div', { class: 'page' });
  root.appendChild(page);
  const st = getSettings();
  const inner = h('div', { class: 'page-inner settings' }, h('h1', { class: 'page-title' }, t('set.title')), h('p', { class: 'page-sub' }, t('set.sub')));

  // language
  const langSel = h('select', { class: 'select' }, LANGUAGES.map(([c, name]) => h('option', { value: c, selected: c === lang }, name)));
  langSel.addEventListener('change', () => {
    setSettings({ lang: langSel.value });
    setTimeout(() => location.reload(), 50);
  });
  inner.appendChild(group(t('set.general'), [row(t('set.language'), t('set.languageText'), langSel)]));

  // editor
  const size = h('select', { class: 'select' }, [12, 13, 14, 15, 16, 18, 20].map((n) => h('option', { value: n, selected: n === st.fontSize }, `${n} px`)));
  size.addEventListener('change', () => setSettings({ fontSize: Number(size.value) }));
  inner.appendChild(group(t('set.editor'), [row(t('set.fontSize'), t('set.fontSizeText'), size), row(t('set.wrap'), t('set.wrapText'), toggle(st.wordWrap, (v) => setSettings({ wordWrap: v })))]));

  // python
  const status = h('span', { class: 'muted small' });
  const showStatus = (p) => {
    clear(status);
    if (p.ok) status.append(icon('checkCircle', 13), ' ', t('set.pythonFound', { v: p.version, cmd: p.cmd.join(' ') }));
    else status.append(icon('alert', 13), ' ', t(p.error === 'bad-python-path' ? 'term.badPath' : 'term.noPython'));
  };
  python().then(showStatus);
  const pathIn = h('input', { class: 'input', style: { width: '260px' }, placeholder: t('set.pythonAuto'), value: st.pythonPath || '', spellcheck: false });
  const detectBtn = btn(t('set.detect'), {
    small: true,
    onClick: async () => {
      setSettings({ pythonPath: pathIn.value.trim() });
      clear(status).append(h('span', { class: 'spin' }));
      showStatus(await python(true));
    },
  });
  inner.appendChild(
    group(t('set.python'), [
      row(t('set.pythonPath'), status, h('div', { style: { display: 'flex', gap: '8px' } }, pathIn, detectBtn)),
      row(t('set.installTitle'), t('set.installText'), btn(t('set.download'), { small: true, icon: 'external', onClick: () => window.api.openExternal('https://www.python.org/downloads/') })),
    ]),
  );

  // progress
  inner.appendChild(
    group(t('set.progress'), [
      row(
        t('set.reset'),
        t('set.resetText'),
        btn(t('set.resetBtn'), {
          small: true,
          kind: 'danger',
          icon: 'trash',
          onClick: async () => {
            if (!(await confirmDialog(t('set.reset'), t('set.resetConfirm'), t('set.resetBtn'), 'danger'))) return;
            resetProgress();
            toast(t('set.resetDone'), 'ok');
          },
        }),
      ),
      row(
        t('set.resetCode'),
        t('set.resetCodeText'),
        btn(t('set.resetCodeBtn'), {
          small: true,
          kind: 'danger',
          icon: 'trash',
          onClick: async () => {
            if (!(await confirmDialog(t('set.resetCode'), t('set.resetCodeConfirm'), t('set.resetCodeBtn'), 'danger'))) return;
            const keys = ['playground', ...Array.from({ length: TOTAL_DAYS }, (_, i) => 'day' + String(i + 1).padStart(2, '0'))];
            await clearAllCode(keys);
            toast(t('set.resetDone'), 'ok');
          },
        }),
      ),
    ]),
  );

  // about
  const version = h('span');
  window.api.appInfo().then((i) => (version.textContent = i.version));
  inner.appendChild(
    group(t('set.about'), [
      row('PyDays', [t('set.version'), ' ', version], null),
      row(t('set.curriculum'), [t('set.curriculumText'), ' ', h('a', { href: SOURCE_REPO, target: '_blank' }, '30 Days Of Python'), ' – Asabeneh Yetayeh.'], null),
    ]),
  );
  page.appendChild(inner);
  return null;
}

function group(title, rows) {
  return h('div', { class: 'set-group' }, h('h3', null, title), ...rows);
}

function row(label, text, control) {
  return h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, h('b', null, label), h('span', null, text)), control);
}

function toggle(on, onChange) {
  const input = h('input', { type: 'checkbox', checked: !!on });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' }, input, h('i'));
}
