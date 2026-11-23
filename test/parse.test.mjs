import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDay, parseOpts, exerciseFile } from '../renderer/js/parse.js';

const SRC = `@day 9
@source 09/x.md
@title
en: Conditionals
pl: Warunki
@md
en: First line

second paragraph
pl: Pierwszy
@code stdin="5\\n"
@decorator
def f():
    pass
@end
@exercise is-adult
@title
en: Adult
@starter
age = int(input())
@end
@solution
print('ok')
@end
@case stdin="18\\n"
out: ok
expr: 1 + 1 == 2
`;

test('parses text, code with decorators, exercises and cases', () => {
  const { day, errors } = parseDay(SRC);
  assert.deepEqual(errors, []);
  assert.equal(day.day, 9);
  assert.equal(day.blocks[0].text.en, 'First line\n\nsecond paragraph');
  assert.equal(day.blocks[1].code.split('\n')[0], '@decorator');
  assert.equal(day.blocks[1].opts.stdin, '5\n');
  const ex = day.exercises[0];
  assert.equal(ex.cases[0].stdin, '18\n');
  assert.deepEqual(ex.cases[0].checks, [{ type: 'out', value: 'ok' }, { type: 'expr', value: '1 + 1 == 2' }]);
  assert.equal(exerciseFile(0, ex.id), 'ex1_is_adult.py');
});

test('options', () => {
  assert.deepEqual(parseOpts('norun error stdin="a b"'), { norun: true, error: true, stdin: 'a b' });
});
