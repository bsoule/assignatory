// When the server fails, the page says so (an alert) instead of failing
// silently or crashing: on loading the list; on refreshing it when the tab
// comes back into view, keeping the list it had; on loading a stored list the
// app would never save (src/dishes.js's listProblems), which it refuses to
// show; and on saving a change, where what was typed is kept for another try.
// The next load or save that works clears the alert. The alert's words aren't
// pinned.
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, saving, shownIds, startServer } from './app.mjs';

const alertShows = (page) => page.getByRole('alert').waitFor({ timeout: 3000 }).then(() => true, () => false);
const alertGoes = (page) => page.getByRole('alert').waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false);

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    // Loading fails.
    const broken = await openApp(browser, server, { apiFails: true });
    const loadAlert = await broken.getByRole('alert').waitFor({ timeout: 3000 }).then(() => true, () => false);
    assert.ok(loadAlert, rer(`${engine}: open the page while /api/dishes answers 500`, 'an alert on the page', 'no alert'));
    assert.deepEqual(broken.uncaught, [], rer(`${engine}: open the page while /api/dishes answers 500`,
      'no uncaught errors: the failure is handled', JSON.stringify(broken.uncaught)));

    // Refreshing fails, then works.
    const refreshing = await openApp(browser, server);
    const shownBefore = await shownIds(refreshing);
    await refreshing.route('**/api/dishes', (route) => (route.request().method() === 'GET'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.continue()));
    await refreshing.evaluate(() => window.dispatchEvent(new Event('focus')));
    const failedRefresh = `${engine}: open the page; make loading fail (500); the window regains focus`;
    assert.ok(await alertShows(refreshing), rer(failedRefresh, 'an alert on the page', 'no alert'));
    assert.deepEqual(await shownIds(refreshing), shownBefore, rer(failedRefresh, 'the list it had still shown',
      JSON.stringify(await shownIds(refreshing))));
    await refreshing.unroute('**/api/dishes');
    await refreshing.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.ok(await alertGoes(refreshing), rer(`${failedRefresh}; let loading work again; the window regains focus`,
      'the alert gone', 'it is still there'));

    // A stored list the app would never save is refused, loudly.
    const odd = await startServer([{ id: 1, name: 'Turkey', assignedTo: '', status: 'maybe' }]);
    try {
      const refused = await openApp(browser, odd);
      const act = `${engine}: store a dish whose status is "maybe" (bypassing the API); open the page`;
      assert.ok(await alertShows(refused), rer(act, 'an alert on the page', 'no alert'));
      assert.deepEqual(await shownIds(refused), [], rer(act, 'no dishes shown', JSON.stringify(await shownIds(refused))));
      assert.deepEqual(refused.uncaught, [], rer(act, 'no uncaught errors', JSON.stringify(refused.uncaught)));
    } finally {
      await odd.stop();
    }

    // Saving fails, then works.
    const page = await openApp(browser, server);
    const before = server.stored();
    await page.route('**/api/dishes', (route) => (route.request().method() === 'POST'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.continue()));
    const box = page.locator('[data-qual="new-dish"]');
    await box.fill('Rolls');
    await box.press('Enter');
    const saveAlert = await page.getByRole('alert').waitFor({ timeout: 3000 }).then(() => true, () => false);
    const failedAdd = `${engine}: make saves fail (500); type "Rolls" and press Enter`;
    assert.ok(saveAlert, rer(failedAdd, 'an alert on the page', 'no alert'));
    assert.equal(await box.inputValue(), 'Rolls', rer(failedAdd, 'what was typed still in the box', JSON.stringify(await box.inputValue())));
    assert.deepEqual(server.stored(), before, rer(failedAdd, 'the store unchanged', JSON.stringify(server.stored())));

    await page.unroute('**/api/dishes');
    await saving(page, () => box.press('Enter'));
    await page.getByRole('alert').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    const retried = `${failedAdd}; let saves work again; press Enter`;
    assert.equal(await page.getByRole('alert').count(), 0, rer(retried, 'the alert gone', 'it is still there'));
    assert.ok(server.stored().some((d) => d.name === 'Rolls'), rer(retried, 'Rolls in the store', JSON.stringify(server.stored())));
    assert.equal(await box.inputValue(), '', rer(retried, 'the box emptied', JSON.stringify(await box.inputValue())));
    assert.deepEqual(page.uncaught, [], rer(failedAdd, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: failed loads, refreshes and saves, and refused lists, show an alert that clears on success');
