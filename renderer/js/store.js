// Settings, progress and saved code, kept as JSON files by the main process.

const DEFAULTS = {
  lang: null, // null until the first-start language picker has been answered
  fontSize: 14,
  wordWrap: false,
  starters: null, // exercises open with starter code; null until the first-start question is answered
  pythonPath: '',
  sidebarCollapsed: false,
  lessonWidth: null,
  panelHeight: 230,
};

let settings = { ...DEFAULTS };
const listeners = new Set();

export async function loadSettings() {
  const saved = (await window.api.storeGet('settings')) || {};
  settings = { ...DEFAULTS, ...saved };
  return settings;
}

export const getSettings = () => settings;

export function setSettings(patch) {
  settings = { ...settings, ...patch };
  window.api.storeSet('settings', settings);
  for (const fn of listeners) fn(settings, patch);
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Code per day (one file per lesson: the scratch tab and the exercise tabs).
const codeCache = new Map();
export async function loadCode(key) {
  if (codeCache.has(key)) return codeCache.get(key);
  const c = (await window.api.storeGet('code/' + key)) || { files: {}, open: [], active: null };
  codeCache.set(key, c);
  return c;
}

const timers = new Map();
export function saveCode(key, value) {
  codeCache.set(key, value);
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      window.api.storeSet('code/' + key, value);
    }, 400),
  );
}

export function flushCode() {
  for (const [key, timer] of timers) {
    clearTimeout(timer);
    window.api.storeSet('code/' + key, codeCache.get(key));
  }
  timers.clear();
}

export async function clearAllCode(keys) {
  for (const key of keys) {
    codeCache.delete(key);
    await window.api.storeDel('code/' + key);
  }
}
