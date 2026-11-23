// Loads the 30 course days from content/days/.
import { parseDay } from './parse.js';
import { TOTAL_DAYS } from './progress.js';

let days = [];

export async function loadCourse() {
  const texts = await Promise.all(
    Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return fetch(`content/days/${n}.txt`)
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null);
    }),
  );
  days = [];
  texts.forEach((text, i) => {
    if (text == null) return;
    const { day, errors } = parseDay(text, `${i + 1}.txt`);
    if (errors.length) console.warn(errors.join('\n'));
    days.push(day);
  });
  days.sort((a, b) => a.day - b.day);
  return days;
}

export const course = () => days;
export const getDay = (n) => days.find((d) => d.day === Number(n)) || null;

export const SOURCE_REPO = 'https://github.com/Asabeneh/30-Days-Of-Python';
export const sourceUrl = (d) => (d?.source ? `${SOURCE_REPO}/blob/master/${d.source}` : SOURCE_REPO);
