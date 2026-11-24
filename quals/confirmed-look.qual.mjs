// [CHK] in the human's task list: turning green is how a dish shows it's
// confirmed, so at rest a dish's row shows the confirmed color only when the
// dish is confirmed. No color is pinned: the confirmed color is read off a
// confirmed dish's name pill, whatever it is. Hovering or pressing a button
// may preview it, so rows are checked with nothing hovered or pressed.
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, startServer } from './app.mjs';

const confirmed = FIXTURE.find((dish) => dish.status === 'confirmed');
assert.ok(FIXTURE.some((dish) => dish.status === 'pending') && confirmed !== undefined, rer(
  'look through FIXTURE', 'at least one pending and one confirmed dish, as this qual assumes', JSON.stringify(FIXTURE)));

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    await page.mouse.move(0, 0);  // away from every button: nothing hovered
    const green = await row(page, confirmed.id).locator('[data-qual="assignee"]')
      .evaluate((pill) => getComputedStyle(pill).backgroundColor);
    for (const dish of FIXTURE) {
      const colors = await row(page, dish.id).evaluate((li) =>
        [li, ...li.querySelectorAll('*')].map((el) => getComputedStyle(el).backgroundColor));
      const showsGreen = colors.includes(green);
      const isConfirmed = dish.status === 'confirmed';
      assert.equal(showsGreen, isConfirmed, rer(
        `${engine}: open the page; with nothing hovered, look at the row for ${dish.name} (${dish.status})`,
        isConfirmed ? `the confirmed color (${green}) somewhere in it` : `nothing in it with the confirmed color (${green})`,
        showsGreen ? 'something in it has the confirmed color' : 'nothing in it has the confirmed color'));
    }
    assert.deepEqual(page.uncaught, [], rer(`${engine}: open the page`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: only confirmed dishes show the confirmed color (chromium, firefox, webkit)');
