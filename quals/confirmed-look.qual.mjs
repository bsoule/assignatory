// [CHK] in the human's task list: turning green is how a dish shows it's
// confirmed, so at rest the confirmed color marks a confirmed dish's name pill
// and nothing else in the list: not the check buttons (confirm, and save in the
// editor), which turn green only while hovered or pressed. No color is
// pinned: the confirmed color is read off a confirmed dish's name pill,
// whatever it is. Rows are checked with nothing hovered or pressed.
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, startServer } from './app.mjs';

const confirmed = FIXTURE.find((dish) => dish.status === 'confirmed');
assert.ok(FIXTURE.some((dish) => dish.status === 'pending') && confirmed !== undefined, rer(
  'look through FIXTURE', 'at least one pending and one confirmed dish, as this qual assumes', JSON.stringify(FIXTURE)));

// Which elements of a dish's row have this background color: each one's
// data-qual, or its tag name when it has none.
const inColor = (page, id, color) => row(page, id).evaluate((li, c) =>
  [li, ...li.querySelectorAll('*')].filter((el) => getComputedStyle(el).backgroundColor === c)
    .map((el) => el.dataset.qual ?? el.tagName.toLowerCase()), color);

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    await page.mouse.move(0, 0);  // away from every button: nothing hovered
    const green = await row(page, confirmed.id).locator('[data-qual="assignee"]')
      .evaluate((pill) => getComputedStyle(pill).backgroundColor);

    for (const dish of FIXTURE) {
      const found = await inColor(page, dish.id, green);
      const expected = dish.status === 'confirmed' ? ['assignee'] : [];
      assert.deepEqual(found, expected, rer(
        `${engine}: open the page; with nothing hovered, look at the row for ${dish.name} (${dish.status})`,
        `the confirmed color (${green}) on ${expected.length ? 'its name pill only' : 'nothing'}`,
        `it's on ${JSON.stringify(found)}`));
    }

    // The editor, opened on a dish in each state.
    for (const status of ['confirmed', 'pending', 'unassigned']) {
      const dish = FIXTURE.find((d) => d.status === status);
      await row(page, dish.id).locator('[data-qual="edit"]').click();
      await row(page, dish.id).locator('[data-qual="edit-name"]').waitFor();
      await page.mouse.move(0, 0);
      const found = await inColor(page, dish.id, green);
      assert.deepEqual(found, [], rer(`${engine}: open the editor on ${dish.name} (${status}); move the mouse away`,
        `nothing in the editor with the confirmed color (${green})`, `it's on ${JSON.stringify(found)}`));
      await row(page, dish.id).locator('[data-qual="cancel"]').click();
      await row(page, dish.id).locator('[data-qual="edit"]').waitFor();
    }
    assert.deepEqual(page.uncaught, [], rer(`${engine}: open the page and the editor`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: at rest, only confirmed dishes\' names show the confirmed color (chromium, firefox, webkit)');
