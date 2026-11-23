// The terminal panel: program output, and an input line right after it while a program
// (or the Python shell) is waiting for what the learner types.
import { h, clear } from './ui.js';

export function createTerminal({ onSubmit, onEof, onInterrupt }) {
  const el = h('div', { class: 'term', tabindex: '0', spellcheck: 'false' });
  const input = h('input', { class: 'term-input', spellcheck: false, autocomplete: 'off' });
  const history = [];
  let histPos = 0;
  let active = false;
  let mode = 'run'; // 'run' | 'repl'

  const autosize = () => (input.style.width = Math.max(2, input.value.length + 2) + 'ch');
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      autosize();
      write(v + '\n', 't-in');
      if (v.trim() && history[history.length - 1] !== v) history.push(v);
      histPos = history.length;
      onSubmit?.(v);
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      histPos = Math.max(0, histPos - 1);
      input.value = history[histPos] || '';
      autosize();
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      histPos = Math.min(history.length, histPos + 1);
      input.value = history[histPos] || '';
      autosize();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      onEof?.();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      write('^C\n', 't-err');
      onInterrupt?.();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      clearAll();
    }
  });
  // a click anywhere in the terminal types into the input line (unless text is being selected)
  el.addEventListener('mouseup', () => {
    if (active && !String(window.getSelection())) input.focus({ preventScroll: true });
  });

  function place(node) {
    if (input.parentNode === el) el.insertBefore(node, input);
    else el.appendChild(node);
    trim();
    el.scrollTop = el.scrollHeight;
  }

  function trim() {
    // a huge output keeps the page responsive: drop the oldest lines
    if (el.textContent.length > 400000) {
      while (el.firstChild && el.firstChild !== input && el.textContent.length > 300000) el.removeChild(el.firstChild);
    }
  }

  function write(text, cls = '') {
    if (!text) return;
    const last = input.parentNode === el ? input.previousSibling : el.lastChild;
    if (last && last.nodeType === 1 && last.tagName === 'SPAN' && last.dataset.stream === cls) {
      last.textContent += text;
      trim();
      el.scrollTop = el.scrollHeight;
      return;
    }
    place(h('span', { class: cls, dataset: { stream: cls } }, text));
  }

  // Python's shell writes its prompts (">>> ", "... ") to stderr, between real error text.
  function writeErr(text) {
    if (mode !== 'repl') return write(text, 't-err');
    for (const part of text.split(/(>>> |\.\.\. )/)) {
      if (part === '>>> ' || part === '... ') write(part, 't-prompt');
      else write(part, 't-err');
    }
  }

  function block(content, cls) {
    const node = h('span', { class: cls }, content);
    place(node);
    return node;
  }

  function clearAll() {
    clear(el);
    if (active) el.appendChild(input);
  }

  function setActive(on, m = mode) {
    active = on;
    mode = m;
    if (on) {
      el.appendChild(input);
      input.value = '';
      autosize();
    } else input.remove();
  }

  return {
    el,
    write,
    writeErr,
    block,
    clear: clearAll,
    setActive,
    focus: () => (active ? input.focus({ preventScroll: true }) : el.focus({ preventScroll: true })),
    isActive: () => active,
    endsWithNewline: () => {
      const last = input.parentNode === el ? input.previousSibling : el.lastChild;
      return !last || /\n$/.test(last.textContent) || last.nodeType === 1 && last.tagName === 'SPAN' && !last.dataset.stream;
    },
  };
}
