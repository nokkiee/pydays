// Loads the Monaco editor (VS Code's editor, AMD build) once and hands out `monaco`.
import { getSettings } from './store.js';
import { queueScript } from './ui.js';
import { lang } from './i18n.js';

let loading = null;

export function loadMonaco() {
  if (loading) return loading;
  const script = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  loading = queueScript(async () => {
    // Menus and messages in the interface language: the translation sets a global that the
    // editor reads at start, so it goes in first (and a language change reloads the page).
    if (lang !== 'en') await script(`vendor/monaco/vs/nls/lang/${lang}.js`).catch(() => console.warn('Monaco: no translation for ' + lang));
    await script('vendor/monaco/vs/loader.js');
  }).then(
    () =>
      new Promise((resolve, reject) => {
        window.require.config({ paths: { vs: 'vendor/monaco/vs' } });
        window.require(['vs/editor/editor.main'], () => {
          const monaco = window.monaco;
          // A worker shut down while still loading reports a harmless load error.
          const factory = self.MonacoEnvironment?.getWorker;
          if (factory) {
            self.MonacoEnvironment.getWorker = (id, label) => {
              const w = factory(id, label);
              w.addEventListener('error', (e) => {
                e.preventDefault();
                console.warn('Monaco worker:', e.message);
              });
              return w;
            };
          }
          defineTheme(monaco);
          registerPython(monaco);
          document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
          resolve(monaco);
        }, reject);
      }),
  );
  return loading;
}

function defineTheme(monaco) {
  monaco.editor.defineTheme('pydays', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7d7a70', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'e48a6b' },
      { token: 'string', foreground: 'b5c98d' },
      { token: 'number', foreground: 'dcb062' },
      { token: 'identifier', foreground: 'e6e3d9' },
      { token: 'delimiter', foreground: 'a9a69c' },
      { token: 'type', foreground: '8fb3d9' },
    ],
    colors: {
      'editor.background': '#1b1a19',
      'editorGutter.background': '#1b1a19',
      'editor.foreground': '#e6e3d9',
      'editor.lineHighlightBackground': '#22211f',
      'editor.lineHighlightBorder': '#22211f',
      'editorLineNumber.foreground': '#4d4b46',
      'editorLineNumber.activeForeground': '#a9a69c',
      'editorCursor.foreground': '#d97757',
      'editor.selectionBackground': '#d977573a',
      'editor.inactiveSelectionBackground': '#d9775722',
      'editor.wordHighlightBackground': '#ffffff10',
      'editorBracketMatch.background': '#d9775722',
      'editorBracketMatch.border': '#d9775766',
      'editorIndentGuide.background1': '#2a2926',
      'editorIndentGuide.activeBackground1': '#3d3c38',
      'editorWidget.background': '#2f2e2b',
      'editorWidget.border': '#3a3935',
      'editorSuggestWidget.background': '#2f2e2b',
      'editorSuggestWidget.border': '#3a3935',
      'editorSuggestWidget.selectedBackground': '#43423d',
      'editorSuggestWidget.highlightForeground': '#e48a6b',
      'editorHoverWidget.background': '#2f2e2b',
      'editorHoverWidget.border': '#3a3935',
      'editorError.foreground': '#e5786d',
      'scrollbarSlider.background': '#ffffff14',
      'scrollbarSlider.hoverBackground': '#ffffff22',
    },
  });
}

const KEYWORDS = 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' ');
const BUILTINS = {
  print: 'print(*values, sep=" ", end="\\n")',
  input: 'input(prompt="") -> str',
  len: 'len(obj) -> int',
  range: 'range(start, stop, step)',
  int: 'int(x) -> int',
  float: 'float(x) -> float',
  str: 'str(obj) -> str',
  bool: 'bool(x) -> bool',
  list: 'list(iterable) -> list',
  tuple: 'tuple(iterable) -> tuple',
  set: 'set(iterable) -> set',
  dict: 'dict(**kwargs) -> dict',
  type: 'type(obj) -> type',
  isinstance: 'isinstance(obj, cls) -> bool',
  sum: 'sum(iterable, start=0)',
  min: 'min(iterable)',
  max: 'max(iterable)',
  abs: 'abs(x)',
  round: 'round(number, ndigits=None)',
  sorted: 'sorted(iterable, key=None, reverse=False) -> list',
  reversed: 'reversed(sequence)',
  enumerate: 'enumerate(iterable, start=0)',
  zip: 'zip(*iterables)',
  map: 'map(function, iterable)',
  filter: 'filter(function, iterable)',
  any: 'any(iterable) -> bool',
  all: 'all(iterable) -> bool',
  open: 'open(file, mode="r", encoding=None)',
  help: 'help(obj)',
  dir: 'dir(obj) -> list',
  id: 'id(obj) -> int',
  pow: 'pow(base, exp)',
  divmod: 'divmod(a, b) -> (a // b, a % b)',
  chr: 'chr(i) -> str',
  ord: 'ord(c) -> int',
  hex: 'hex(x) -> str',
  bin: 'bin(x) -> str',
  complex: 'complex(real, imag)',
  format: 'format(value, spec)',
  hash: 'hash(obj) -> int',
  iter: 'iter(obj)',
  next: 'next(iterator)',
  frozenset: 'frozenset(iterable)',
  super: 'super()',
  property: 'property(fget)',
  staticmethod: 'staticmethod(function)',
  classmethod: 'classmethod(function)',
  getattr: 'getattr(obj, name, default)',
  setattr: 'setattr(obj, name, value)',
  hasattr: 'hasattr(obj, name) -> bool',
  callable: 'callable(obj) -> bool',
  vars: 'vars(obj) -> dict',
  globals: 'globals() -> dict',
  locals: 'locals() -> dict',
  Exception: 'class Exception',
  ValueError: 'class ValueError',
  TypeError: 'class TypeError',
  KeyError: 'class KeyError',
  IndexError: 'class IndexError',
  ZeroDivisionError: 'class ZeroDivisionError',
  FileNotFoundError: 'class FileNotFoundError',
};
const SNIPPETS = [
  ['def', 'def ${1:name}(${2:params}):\n\t${3:pass}', 'def name(params): …'],
  ['for', 'for ${1:item} in ${2:items}:\n\t${3:pass}', 'for item in items: …'],
  ['forr', 'for ${1:i} in range(${2:10}):\n\t${3:pass}', 'for i in range(n): …'],
  ['while', 'while ${1:condition}:\n\t${2:pass}', 'while condition: …'],
  ['if', 'if ${1:condition}:\n\t${2:pass}', 'if condition: …'],
  ['ifelse', 'if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}', 'if … else …'],
  ['class', 'class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t${3:pass}', 'class Name: …'],
  ['try', 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:print(e)}', 'try … except …'],
  ['with', "with open(${1:'file.txt'}) as ${2:f}:\n\t${3:pass}", 'with open(…) as f: …'],
  ['main', "if __name__ == '__main__':\n\t${1:main()}", "if __name__ == '__main__': …"],
  ['lambda', 'lambda ${1:x}: ${2:x}', 'lambda x: …'],
  ['listcomp', '[${1:x} for ${2:x} in ${3:items}]', '[x for x in items]'],
];

function registerPython(monaco) {
  const K = monaco.languages.CompletionItemKind;
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      // after a dot it's an attribute, which these lists don't know about
      const before = model.getLineContent(position.lineNumber).slice(0, word.startColumn - 1);
      if (/\.\s*$/.test(before)) return { suggestions: [] };
      const rule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      return {
        suggestions: [
          ...KEYWORDS.map((k) => ({ label: k, kind: K.Keyword, insertText: k, range })),
          ...Object.entries(BUILTINS).map(([k, sig]) => ({
            label: k,
            kind: /^[A-Z]/.test(k) ? K.Class : K.Function,
            detail: sig,
            insertText: /^[A-Z]/.test(k) ? k : k + '($0)',
            insertTextRules: rule,
            range,
          })),
          ...SNIPPETS.map(([label, body, detail]) => ({ label, kind: K.Snippet, detail, insertText: body, insertTextRules: rule, range, sortText: '~' + label })),
        ],
      };
    },
  });
}

export function editorOptions(extra = {}) {
  const st = getSettings();
  return {
    theme: 'pydays',
    fontSize: st.fontSize,
    lineHeight: Math.round(st.fontSize * 1.6),
    fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', 'Cascadia Code', 'DejaVu Sans Mono', Consolas, monospace",
    fontLigatures: false,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
    wordWrap: st.wordWrap ? 'on' : 'off',
    fixedOverflowWidgets: true,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'all',
    bracketPairColorization: { enabled: false },
    guides: { indentation: true },
    padding: { top: 12 },
    stickyScroll: { enabled: false },
    ...extra,
  };
}

export function createEditor(monaco, box, options) {
  // the right-click menu is drawn inside `box`, which needs Monaco's theme variables
  box.classList.add('monaco-component');
  return monaco.editor.create(box, options);
}

/** Syntax-highlighted HTML for a lesson's code example. */
export async function colorize(code) {
  const monaco = await loadMonaco();
  return monaco.editor.colorize(code, 'python', { tabSize: 4 });
}
