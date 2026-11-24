// The schedule parser (src/parseSchedule.js). Its spec is the comments in
// src/parseSchedule.js and src/schedule.txt: a line that starts with a time gets the
// time in its own column, any other line is shown as written, and blank lines
// and lines starting with # are skipped. Nothing here pins what the real
// schedule says.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSchedule } from '../src/parseSchedule.js';
import { ROOT, rer } from './app.mjs';

const parsesAs = (line, time, what) => {
  const rows = parseSchedule(line);
  assert.deepEqual(rows, [{ time, what }], rer(`parseSchedule(${JSON.stringify(line)})`,
    `one row, time ${JSON.stringify(time)} and item ${JSON.stringify(what)}`, JSON.stringify(rows)));
};

// The comments' own examples.
parsesAs('4:30 Dinner', '4:30', 'Dinner');
parsesAs('2pm - Appetizers', '2pm', 'Appetizers');
parsesAs('2:00-4:00 Games', '2:00-4:00', 'Games');
parsesAs('4pm Pie', '4pm', 'Pie');
parsesAs('noon Lunch', 'noon', 'Lunch');

// Other ways to write a time, and to separate it from the item.
parsesAs('4:30pm Dinner', '4:30pm', 'Dinner');
parsesAs('4:30 PM Dinner', '4:30 PM', 'Dinner');
parsesAs('4:30 p.m. Dinner', '4:30 p.m.', 'Dinner');
parsesAs('10am Brunch', '10am', 'Brunch');
parsesAs('9 am Coffee', '9 am', 'Coffee');
parsesAs('Noon: Lunch', 'Noon', 'Lunch');
parsesAs('midnight Leftovers', 'midnight', 'Leftovers');
parsesAs('4:30 – Dinner', '4:30', 'Dinner');
parsesAs('4:30 — Dinner', '4:30', 'Dinner');
parsesAs('2:00 – 4:00 Games', '2:00 – 4:00', 'Games');
parsesAs('2pm–4pm Games', '2pm–4pm', 'Games');
parsesAs('12:00 Drinks, snacks: and more', '12:00', 'Drinks, snacks: and more');
parsesAs('  5:30 Pie  ', '5:30', 'Pie');

// Lines that don't start with a time followed by an item are shown as written.
for (const line of ['Dinner at 4:30', 'MSU v Arkansas tipoff', '1999 was a good year', '4:30Dinner', '4pm', 'Bring chairs!']) {
  parsesAs(line, '', line);
}

// Skipped lines; the rest keep their order.
const text = '# The schedule\n\n  # indented comment\n4:30 Dinner\n   \nBring chairs\n5:30 Pie\n';
assert.deepEqual(parseSchedule(text), [
  { time: '4:30', what: 'Dinner' }, { time: '', what: 'Bring chairs' }, { time: '5:30', what: 'Pie' },
], rer(`parseSchedule(${JSON.stringify(text)})`, 'Dinner, Bring chairs, Pie in that order; comments and blank lines skipped',
  JSON.stringify(parseSchedule(text))));
assert.deepEqual(parseSchedule(''), [], rer('parseSchedule("")', '[]', JSON.stringify(parseSchedule(''))));

// The real schedule: one row per line that isn't blank or a comment, none of them empty.
const real = fs.readFileSync(path.join(ROOT, 'src/schedule.txt'), 'utf8');
const lines = real.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const rows = parseSchedule(real);
assert.equal(rows.length, lines.length, rer('parseSchedule(src/schedule.txt)',
  `${lines.length} rows, one per line that isn't blank or a comment`, `${rows.length} rows`));
assert.ok(rows.every((r) => r.what.length > 0), rer('parseSchedule(src/schedule.txt)', 'every row has an item',
  JSON.stringify(rows.filter((r) => !r.what))));

console.log('qual pass: schedule lines (times, separators, comments, order)');
