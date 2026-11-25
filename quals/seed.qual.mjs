// An empty list gets the app's default dishes on the first load, once. Which
// dishes those are isn't pinned: only that the page and the store agree. A
// refresh never seeds: a list emptied while the page was open stays empty.
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, expectShown, inEveryEngine, openApp, rer, startServer } from './app.mjs';

await buildApp();
await inEveryEngine(async (browser, engine) => {
  for (const [start, dishes] of [['no data file', undefined], ['an empty list', []]]) {
    const server = await startServer(dishes);
    try {
      const page = await openApp(browser, server);
      const seeded = server.stored();
      assert.ok(Array.isArray(seeded) && seeded.length > 0, rer(`${engine}: start server.js with ${start}; open the page`,
        'the store now holds the default dishes', `the store holds ${JSON.stringify(seeded)}`));
      const ids = [...seeded.map((dish) => dish.id)].sort((a, b) => a - b);
      const shown = await page.locator('[data-dish]').evaluateAll((rows) => rows.map((r) => Number(r.dataset.dish)));
      assert.deepEqual([...shown].sort((a, b) => a - b), ids, rer(`${engine}: start with ${start}; open the page`,
        `the page shows each seeded dish once: ids ${JSON.stringify(ids)}`, `it shows ${JSON.stringify(shown)}`));

      await page.reload();
      await page.locator('[data-qual="new-dish"]').waitFor();
      assert.deepEqual(server.stored(), seeded, rer(`${engine}: start with ${start}; open the page; reload it`,
        'the store unchanged: seeding happens once', JSON.stringify(server.stored())));
      await expectShown(page, shown, `${engine}: start with ${start}; open the page; reload it`, 'the same dishes as before');
      assert.deepEqual(page.uncaught, [], rer(`${engine}: start with ${start}; open and reload the page`, 'no uncaught errors',
        JSON.stringify(page.uncaught)));
    } finally {
      await server.stop();
    }
  }

  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    assert.deepEqual(server.stored(), FIXTURE, rer(`${engine}: start server.js with a full list; open the page`,
      'the list untouched: only an empty list gets seeded', JSON.stringify(server.stored())));
    await server.post([]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const act = `${engine}: open the page on a full list; another guest saves an empty list; the window regains focus`;
    await expectShown(page, [], act, 'no dishes shown');
    await page.waitForTimeout(400);
    assert.deepEqual(server.stored(), [], rer(act, 'the store still empty: refreshing never seeds', JSON.stringify(server.stored())));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: an empty list gets the default dishes once (chromium, firefox, webkit)');
