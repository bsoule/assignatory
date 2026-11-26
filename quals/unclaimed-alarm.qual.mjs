// The human's ask (2026-11-25): a red "!" after the Unclaimed button's count
// while that count is above zero, since some dish still needs someone. No
// other view's button has one. Only whether it shows is pinned, not its color,
// glyph or place.
import assert from 'node:assert/strict';
import { isUnclaimed } from '../src/dishes.js';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, saving, settled, startServer } from './app.mjs';

const stuffing = FIXTURE.find((dish) => dish.id === 2);
assert.ok(FIXTURE.some(isUnclaimed) && stuffing.status === 'pending', rer('look through FIXTURE',
  'some dish unclaimed, and Stuffing (id 2) pending, as this qual assumes', JSON.stringify(FIXTURE)));

// The views whose button shows the "!" (by data-view), in page order.
const alarmed = (page) => page.locator('[data-qual="alarm"]').filter({ visible: true })
  .evaluateAll((marks) => marks.map((mark) => mark.closest('[data-view]')?.dataset.view ?? '(not on a view button)'));

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    const opened = await settled(() => alarmed(page), ['unclaimed']);
    assert.deepEqual(opened, ['unclaimed'], rer(`${engine}: open the page on a list with ${FIXTURE.filter(isUnclaimed).length} dishes unclaimed`,
      'a "!" on the Unclaimed button and no other', JSON.stringify(opened)));

    await server.post(FIXTURE.map((dish) => (isUnclaimed(dish) ? { ...dish, assignedTo: 'Robin', status: 'pending' } : dish)));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const allClaimed = await settled(() => alarmed(page), []);
    const claimedAct = `${engine}: open the page; another guest gives Robin every unclaimed dish; the window regains focus`;
    assert.deepEqual(allClaimed, [], rer(claimedAct, 'no "!" anywhere: nothing is unclaimed', JSON.stringify(allClaimed)));

    await saving(page, () => row(page, 2).locator('[data-qual="decline"]').click());
    const declined = await settled(() => alarmed(page), ['unclaimed']);
    assert.deepEqual(declined, ['unclaimed'], rer(`${claimedAct}; then Stuffing is declined`,
      'the "!" back on the Unclaimed button', JSON.stringify(declined)));
    assert.deepEqual(page.uncaught, [], rer(`${engine}: unclaimed dishes come and go`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: a "!" on the Unclaimed button exactly while some dish is unclaimed, in chromium, firefox and webkit');
