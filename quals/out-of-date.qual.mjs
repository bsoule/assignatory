// A page older than the server, as when a deploy bumps the API's version
// (API_URL in src/dishes.js) while the page is open: the server no longer
// serves the page's URL for the list (a 404), so the page can neither load nor
// save. It says so with one alert, the same whether it was refreshing or
// saving, and not either alert a plain failure shows: trying again can't help,
// only reloading can. Made out of date by sending its requests for the list to
// /api/dishes, where pages from before API versions sent them. Alert words
// aren't pinned.
import assert from 'node:assert/strict';
import { DISHES_PATH, FIXTURE, buildApp, inEveryEngine, openApp, rer, row, settled, startServer } from './app.mjs';

// The window regains focus (a refresh); then, once that's answered, Mashed
// potatoes gets assigned to Pat. Returns the alerts' words after each.
async function refreshThenAssign(page) {
  const asked = (method) => page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname.endsWith('/dishes'));
  const refreshed = asked('GET');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refreshed;
  await settled(() => page.getByRole('alert').count(), 1);
  const afterRefresh = await page.getByRole('alert').allTextContents();
  await row(page, 3).locator('[data-qual="assign"]').fill('Pat');
  const tried = asked('GET');  // a save first loads the latest list
  await row(page, 3).locator('[data-qual="assign-submit"]').click();
  await tried;
  await page.waitForTimeout(300);
  const afterAssign = await page.getByRole('alert').allTextContents();
  return { afterRefresh, afterAssign };
}

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const stale = await openApp(browser, server);
    await stale.route(`**${DISHES_PATH}`, (route) => route.continue({ url: new URL('/api/dishes', route.request().url()).href }));
    const act = `${engine}: open the page; the server stops serving ${DISHES_PATH} (requests go to /api/dishes); the window regains focus`;
    const outdated = await refreshThenAssign(stale);
    assert.equal(outdated.afterRefresh.length, 1, rer(act, 'an alert', JSON.stringify(outdated.afterRefresh)));
    assert.deepEqual(outdated.afterAssign, outdated.afterRefresh, rer(`${act}; then assign Mashed potatoes to Pat`,
      'still just that one alert', JSON.stringify(outdated.afterAssign)));
    assert.deepEqual(server.stored(), FIXTURE, rer(`${act}; then assign Mashed potatoes to Pat`, 'the store unchanged',
      JSON.stringify(server.stored())));

    // The same two things on a page whose requests plainly fail (500).
    const failing = await openApp(browser, server);
    await failing.route(`**${DISHES_PATH}`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    const plain = await refreshThenAssign(failing);
    const [mark] = outdated.afterRefresh;
    assert.ok(plain.afterAssign.length === 2 && !plain.afterAssign.includes(mark), rer(
      `${engine}: open the page; make loading and saving fail (500); the window regains focus; then assign Mashed potatoes to Pat`,
      `two alerts (one for the refresh, one for the save), neither the out-of-date page's ${JSON.stringify(mark)}`,
      JSON.stringify(plain.afterAssign)));
    assert.deepEqual([...stale.uncaught, ...failing.uncaught], [], rer(`${engine}: an out-of-date page, and a failing one`,
      'no uncaught errors', JSON.stringify([...stale.uncaught, ...failing.uncaught])));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: an out-of-date page says so (to reload), once, whether refreshing or saving, in chromium, firefox and webkit');
