// The views: each route in the URL (#all, #pies, #unclaimed, #mine/Name,
// #schedule) shows exactly the dishes the helpers in src/dishes.js pick, in
// order; any other hash (one the app wouldn't have written) shows everything
// under an alert, and a good one shows none; the active view's button is
// pressed; the counts match the store; and the person picked in the Mine view
// lands in the URL and is remembered.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { allPeople, groupByCategory, isBringing, isPie, isUnclaimed } from '../src/dishes.js';
import { parseSchedule } from '../src/parseSchedule.js';
import { FIXTURE, ROOT, buildApp, expectShown, inEveryEngine, openApp, rer, startServer } from './app.mjs';

const ids = (dishes) => dishes.map((d) => d.id);
const everything = ids(groupByCategory(FIXTURE).flatMap((group) => group.dishes));
const mine = (person) => ids(FIXTURE.filter((d) => isBringing(d, person)));
// [hash, the view whose button is pressed, the dishes shown, whether the alert shows]
const ROUTES = [
  ['all', 'all', everything, false],
  ['pies', 'pies', ids(FIXTURE.filter(isPie)), false],
  ['unclaimed', 'unclaimed', ids(FIXTURE.filter(isUnclaimed)), false],
  ['mine', 'mine', [], false],
  ['mine/Alex', 'mine', mine('Alex'), false],
  ['mine/ALEX', 'mine', mine('Alex'), false],
  ['mine/Kim', 'mine', mine('Kim'), false],
  ['mine/Nobody%20Here', 'mine', [], false],
  ['schedule', 'schedule', [], false],
  ['', 'all', everything, false],
  ['bogus', 'all', everything, true],
  ['Pies', 'all', everything, true],
  ['%E0%A4%A', 'all', everything, true],
  ['pies/Alex', 'all', everything, true],
  ['mine/', 'all', everything, true],
  ['mine/Alex/x', 'all', everything, true],
  ['mine/Jo&Kim', 'all', everything, true],
];
assert.ok(mine('Alex').length === 2 && mine('Kim').length === 1, rer('count FIXTURE\'s dishes for Alex and for Kim',
  'two for Alex (Alex and alex) and one for Kim (Jo & Kim), as these quals assume', `${mine('Alex').length} and ${mine('Kim').length}`));

const schedule = parseSchedule(fs.readFileSync(path.join(ROOT, 'src/schedule.txt'), 'utf8'));

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    for (const [hash, view, expected, alerts] of ROUTES) {
      const act = `${engine}: go to #${hash}`;
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await expectShown(page, expected, act, `dishes ${JSON.stringify(expected)}, in that order`);
      const pressed = await page.locator('[data-view][aria-pressed="true"]').evaluateAll((buttons) => buttons.map((b) => b.dataset.view));
      assert.deepEqual(pressed, [view], rer(act, `only the ${view} button pressed`, `pressed: ${JSON.stringify(pressed)}`));
      const shown = await page.getByRole('alert').count();
      assert.equal(shown, alerts ? 1 : 0, rer(act, alerts ? 'an alert: the app never writes that hash' : 'no alert',
        `${shown} alerts`));
    }

    // The schedule view lists the schedule's rows, each time in its own column.
    await page.evaluate(() => { window.location.hash = 'schedule'; });
    const items = await page.locator('[data-qual="schedule-item"]').evaluateAll((lis) => lis.map((li) => ({
      time: li.querySelector('[data-qual="time"]')?.textContent ?? '',
      what: li.querySelector('[data-qual="what"]').textContent,
    })));
    assert.deepEqual(items, schedule, rer(`${engine}: go to #schedule`, 'one row per line parseSchedule finds in src/schedule.txt',
      JSON.stringify(items)));

    // Counts on the buttons match the store; Mine has none until someone is picked.
    await page.evaluate(() => { window.location.hash = 'all'; });
    const counts = await page.locator('[data-view]').evaluateAll((buttons) =>
      Object.fromEntries(buttons.map((b) => [b.dataset.view, b.querySelector('[data-qual="count"]')?.textContent ?? null])));
    const expectedCounts = {
      all: String(FIXTURE.length), mine: null, pies: String(FIXTURE.filter(isPie).length),
      unclaimed: String(FIXTURE.filter(isUnclaimed).length), schedule: null,
    };
    assert.deepEqual(counts, expectedCounts, rer(`${engine}: go to #all with nobody picked`,
      `counts ${JSON.stringify(expectedCounts)}`, JSON.stringify(counts)));

    // Each button goes to its view.
    for (const view of ['pies', 'unclaimed', 'schedule', 'all', 'mine']) {
      await page.locator(`[data-view="${view}"]`).click();
      const hash = await page.evaluate(() => window.location.hash);
      assert.equal(hash, `#${view}`, rer(`${engine}: click the ${view} button`, `the URL ends in #${view}`, hash));
    }

    // Picking a person puts them in the URL, counts their dishes, and is remembered.
    const people = allPeople(FIXTURE);
    assert.ok(people.includes('Sam'), rer('allPeople(FIXTURE)', 'Sam among them, as this qual assumes', JSON.stringify(people)));
    await page.locator('[data-qual="me"]').selectOption('Sam');
    await expectShown(page, mine('Sam'), `${engine}: in the Mine view, pick Sam`, 'Sam\'s dishes');
    const picked = await page.evaluate(() => window.location.hash);
    assert.equal(picked, '#mine/Sam', rer(`${engine}: in the Mine view, pick Sam`, 'the URL ends in #mine/Sam', picked));
    const mineCount = await page.locator('[data-view="mine"] [data-qual="count"]').textContent();
    assert.equal(mineCount, String(mine('Sam').length), rer(`${engine}: pick Sam`, `the Mine count is ${mine('Sam').length}`, mineCount));
    await page.goto(`${server.url}/#mine`);
    await page.locator('[data-qual="new-dish"]').waitFor();
    await expectShown(page, mine('Sam'), `${engine}: pick Sam; then load the page fresh at #mine, with no name`, 'Sam\'s dishes: the pick is remembered');

    // A name from the URL with a space in it comes back whole.
    await page.evaluate(() => { window.location.hash = 'mine/Mary%20Ann'; });
    await page.waitForFunction(() => document.querySelector('[data-qual="me"]')?.value === 'Mary Ann', null, { timeout: 3000 }).catch(() => {});
    const who = await page.locator('[data-qual="me"]').inputValue();
    assert.equal(who, 'Mary Ann', rer(`${engine}: go to #mine/Mary%20Ann`, 'the Mine view is for "Mary Ann"', JSON.stringify(who)));
    assert.deepEqual(page.uncaught, [], rer(`${engine}: visit every view`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: views, routes, counts and the remembered person');
