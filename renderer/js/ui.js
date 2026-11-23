// Small DOM helpers shared by all views.
import { t } from './i18n.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function debounce(fn, ms) {
  let timer = null;
  const d = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  d.cancel = () => clearTimeout(timer);
  return d;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---- icons (Lucide-style strokes, drawn inline) ----------------------------------------

const P = {
  play: '<polygon points="7 4 19 12 7 20 7 4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><polyline points="16 9.5 10.5 15 8 12.5"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.2-2-5.4-3.6-7.2-.3 1.6-1.1 2.8-2.4 3.3.2-3.3-1.3-6.3-4-8.3.1 3-1.4 5-3 6.8C4.6 11.4 5 12.8 5 15.2 5 19.2 8 22 12 22z"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><line x1="9" y1="3" x2="9" y2="21"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.2.9 2V16h6v-.1c0-.8.3-1.5.9-2A6.5 6.5 0 0 0 12 2.5z"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"/><path d="M7.5 15h9"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  refresh: '<polyline points="21 3 21 9 15 9"/><path d="M21 9a9 9 0 1 0-2.6 6.4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M14 6l4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r=".6"/>',
  alert: '<path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r=".6"/>',
  circleX: '<circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  shell: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><polyline points="7 10 10 12.5 7 15"/><line x1="12" y1="15" x2="16" y2="15"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};

export function icon(name, size = 16) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  return span;
}

export function btn(label, opts = {}) {
  const cls = ['btn', opts.kind, opts.small && 'small', opts.big && 'big', opts.cls].filter(Boolean).join(' ');
  const b = h('button', { class: cls, title: opts.title, type: 'button', disabled: opts.disabled, onclick: opts.onClick });
  if (opts.icon) b.appendChild(icon(opts.icon, opts.small ? 14 : 16));
  if (label) b.appendChild(h('span', null, label));
  if (opts.kbd) b.appendChild(h('kbd', null, opts.kbd));
  return b;
}

// ---- toasts & dialogs -------------------------------------------------------------------

let toastBox = null;
export function toast(msg, kind = 'info', ms = 3200) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts' });
    document.body.appendChild(toastBox);
  }
  const same = [...toastBox.children].find((x) => x.textContent === String(msg) && !x.classList.contains('out'));
  if (same) same.remove();
  const el = h('div', { class: `toast ${kind}` }, msg);
  toastBox.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export function modal({ title, body, actions = [], wide = false, onClose, closable = true, cls = '' }) {
  let busy = false;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && closable) close();
  };
  const box = h(
    'div',
    { class: `modal ${wide ? 'wide' : ''} ${cls}`, role: 'dialog' },
    h('div', { class: 'modal-head' }, h('h3', null, title), closable ? h('button', { class: 'icon-btn', title: t('common.close'), onclick: close }, icon('x')) : null),
    h('div', { class: 'modal-body' }, body),
    actions.length
      ? h(
          'div',
          { class: 'modal-actions' },
          actions.map((a) =>
            btn(a.label, {
              kind: a.kind,
              icon: a.icon,
              onClick: async () => {
                if (busy) return;
                busy = true;
                let keep;
                try {
                  keep = await a.onClick?.();
                } catch (err) {
                  console.error(err);
                  toast(err?.message || String(err), 'error');
                  keep = true;
                } finally {
                  busy = false;
                }
                if (keep !== true) close();
              },
            }),
          ),
        )
      : null,
  );
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => closable && e.target === overlay && close() }, box);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);
  return { close, box };
}

export function confirmDialog(title, text, okLabel, kind = 'primary') {
  return new Promise((resolve) => {
    let done = false;
    modal({
      title,
      body: h('p', null, text),
      actions: [
        { label: t('common.cancel'), kind: 'ghost', onClick: () => ((done = true), resolve(false)) },
        { label: okLabel || t('common.ok'), kind, onClick: () => ((done = true), resolve(true)) },
      ],
      onClose: () => !done && resolve(false),
    });
  });
}

// Draggable divider: resizes the element before it.
export function splitter(el, { min = 200, max = () => 2000, onResize, vertical = false, onDone }) {
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const start = vertical ? e.clientY : e.clientX;
    const prev = el.previousElementSibling;
    const startSize = vertical ? prev.getBoundingClientRect().height : prev.getBoundingClientRect().width;
    document.body.classList.add(vertical ? 'resizing-v' : 'resizing');
    const move = (ev) => {
      const d = (vertical ? ev.clientY : ev.clientX) - start;
      onResize(Math.max(min, Math.min(max(), startSize + d)));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing', 'resizing-v');
      onDone?.();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

// Scripts that set globals load one at a time, together with Monaco's AMD loader.
let queue = Promise.resolve();
export function queueScript(task) {
  const p = queue.then(task);
  queue = p.catch(() => {});
  return p;
}

export function confetti() {
  const box = h('div', { class: 'confetti' });
  const colors = ['#d97757', '#e48a6b', '#f0eee6', '#8fb573', '#dcb062'];
  for (let i = 0; i < 70; i++) {
    const c = h('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * 0.5 + 's';
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}
