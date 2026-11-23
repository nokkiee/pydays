// Markdown for lesson text (our own content), with external links opened in the browser.
import { marked } from '../vendor/marked/marked.esm.js';

marked.setOptions({ gfm: true, breaks: false });

export function md(text) {
  const html = marked.parse(String(text || ''));
  const box = document.createElement('div');
  box.innerHTML = html;
  for (const a of box.querySelectorAll('a[href^="http"]')) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  return box;
}

export function mdInline(text) {
  const span = document.createElement('span');
  span.innerHTML = marked.parseInline(String(text || ''));
  return span;
}
