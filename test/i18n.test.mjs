// Every interface string exists in every language, with the same {placeholders}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, LANG_CODES } from '../renderer/js/i18n.js';

const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const forms = (v) => (typeof v === 'object' ? Object.values(v) : [v]);

test('all languages have every key', () => {
  const en = dictionaries.en;
  for (const code of LANG_CODES) {
    const d = dictionaries[code];
    const missing = Object.keys(en).filter((k) => !(k in d));
    const extra = Object.keys(d).filter((k) => !(k in en));
    assert.deepEqual(missing, [], `${code} misses keys`);
    assert.deepEqual(extra, [], `${code} has unknown keys`);
  }
});

test('placeholders match English', () => {
  const en = dictionaries.en;
  for (const code of LANG_CODES) {
    for (const [k, v] of Object.entries(dictionaries[code])) {
      const want = holes(forms(en[k]).join(' '));
      for (const f of forms(v)) {
        // a plural form may leave out {n} (Polish "one" says "1 dzień" as "dzień")
        const got = holes(f);
        for (const h of got.split(',').filter(Boolean)) assert.ok(want.split(',').includes(h), `${code} ${k}: unknown {${h}}`);
      }
      const all = holes(forms(v).join(' ')).split(',').filter(Boolean);
      for (const h of want.split(',').filter(Boolean)) if (h !== 'n') assert.ok(all.includes(h), `${code} ${k}: missing {${h}}`);
    }
  }
});

test('plural entries cover the language', () => {
  for (const code of LANG_CODES) {
    const cats = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const [k, v] of Object.entries(dictionaries[code])) {
      if (typeof v !== 'object') continue;
      for (const c of cats) if (c !== 'other') assert.ok(v[c] != null || v.other != null, `${code} ${k}: no ${c}`);
      assert.ok(v.other != null, `${code} ${k}: no other`);
      if (code === 'pl') for (const c of ['one', 'few', 'many']) assert.ok(v[c] != null, `pl ${k}: no ${c}`);
    }
  }
});
