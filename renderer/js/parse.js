// Parser for the course files (content/days/NN.txt). One file holds a day in every
// interface language; code is shared. The format, line by line:
//
//   @day 3                       day number
//   @source 03_Day_Operators/…   the matching chapter of 30 Days Of Python (for the credit link)
//   @title / @summary / @md      text blocks: "en: …", "pl: …", … entries; an entry runs on
//                                (blank lines included) until the next "xx:" entry or "@" line
//   @code [norun] [error] [stdin="…"]
//   …python…
//   @end                         a code example (run in the terminal unless norun)
//   @file name.txt … @end        a data file written next to the learner's program
//   @exercise id                 starts an exercise; then @title, @text, @hint,
//   @starter … @end, @solution … @end,
//   @case [stdin="…"]            one run of the program, followed by its checks:
//     out: text                  the output contains text (whitespace-insensitive)
//     re: regex                  the output matches a regular expression
//     expr: python expression    true in the program's namespace (_out = the output)

export const LANGS = ['en', 'pl', 'de', 'es', 'fr'];
const TEXT_BLOCKS = new Set(['title', 'summary', 'md', 'text', 'hint']);
const RAW_BLOCKS = new Set(['code', 'file', 'starter', 'solution']);
const DIRECTIVE = /^@(day|source|title|summary|md|code|file|exercise|text|hint|starter|solution|case)\b\s*(.*)$/;
const ENTRY = new RegExp(`^(${LANGS.join('|')}):\\s?(.*)$`);

export function parseOpts(s) {
  const opts = {};
  const re = /(\w+)(?:=("(?:[^"\\]|\\.)*"|\S+))?/g;
  let m;
  while ((m = re.exec(s || ''))) {
    let v = m[2];
    if (v == null) v = true;
    else if (v.startsWith('"')) v = JSON.parse(v);
    opts[m[1]] = v;
  }
  return opts;
}

export function parseDay(text, name = 'day') {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const day = { day: null, source: null, title: {}, summary: {}, blocks: [], files: [], exercises: [] };
  const errors = [];
  let i = 0;
  let ex = null; // the exercise being read
  let kase = null; // its current test case
  const err = (msg, line = i) => errors.push(`${name}:${line + 1}: ${msg}`);

  const readRaw = () => {
    const start = i;
    const body = [];
    i++;
    while (i < lines.length && lines[i] !== '@end') body.push(lines[i++]);
    if (i >= lines.length) err('missing @end', start);
    i++; // past @end
    return body.join('\n');
  };

  const readText = () => {
    const out = {};
    let cur = null;
    i++;
    while (i < lines.length && !DIRECTIVE.test(lines[i])) {
      const m = lines[i].match(ENTRY);
      if (m) {
        cur = m[1];
        if (out[cur] != null) err(`duplicate "${cur}" entry`);
        out[cur] = m[2];
      } else if (cur) out[cur] += '\n' + lines[i];
      else if (lines[i].trim()) err('text before the first language entry');
      i++;
    }
    for (const k of Object.keys(out)) out[k] = out[k].replace(/\s+$/, '');
    return out;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (kase && !line.startsWith('@')) {
      const m = line.match(/^(out|re|expr):\s?(.*)$/);
      if (m) kase.checks.push({ type: m[1], value: m[2] });
      else err('unknown check: ' + line);
      i++;
      continue;
    }
    const d = line.match(DIRECTIVE);
    if (!d) {
      err('unexpected line: ' + line.slice(0, 60));
      i++;
      continue;
    }
    const [, kind, rest] = d;
    if (kind !== 'case') kase = null;
    if (kind === 'day') {
      day.day = Number(rest);
      i++;
    } else if (kind === 'source') {
      day.source = rest.trim();
      i++;
    } else if (kind === 'exercise') {
      ex = { id: rest.trim(), title: {}, text: {}, hint: null, starter: '', solution: null, cases: [] };
      if (!/^[a-z0-9-]+$/.test(ex.id)) err('exercise id must be lowercase letters, digits and dashes');
      day.exercises.push(ex);
      i++;
    } else if (kind === 'case') {
      if (!ex) err('@case outside an exercise');
      const o = parseOpts(rest);
      kase = { stdin: o.stdin || '', checks: [] };
      ex?.cases.push(kase);
      i++;
    } else if (TEXT_BLOCKS.has(kind)) {
      const text = readText();
      if (kind === 'md') {
        if (ex) err('@md after an exercise');
        day.blocks.push({ type: 'md', text });
      } else if (kind === 'title' || kind === 'summary') (ex && kind === 'title' ? ex : day)[kind] = text;
      else if (!ex) err(`@${kind} outside an exercise`);
      else ex[kind] = text;
    } else if (RAW_BLOCKS.has(kind)) {
      const opts = parseOpts(rest);
      const body = readRaw();
      if (kind === 'code') {
        if (ex) err('@code after an exercise');
        day.blocks.push({ type: 'code', code: body, opts });
      } else if (kind === 'file') {
        day.files.push({ name: rest.trim(), text: body + '\n' });
        // shown in the lesson where it is defined (files defined among the exercises stay hidden)
        if (!ex) day.blocks.push({ type: 'file', name: rest.trim(), code: body });
      } else if (!ex) err(`@${kind} outside an exercise`);
      else ex[kind] = body;
    }
  }
  if (!day.day) errors.push(`${name}: missing @day`);
  return { day, errors };
}

/** File name of an exercise's editor tab: ex1_triangle_area.py */
export function exerciseFile(index, id) {
  return `ex${index + 1}_${id.replace(/-/g, '_')}.py`;
}

export const lessonFile = (day) => `day${String(day).padStart(2, '0')}.py`;
