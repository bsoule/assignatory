// Two promises from ThanksgivingPlanner.jsx's comments:
//  - "Apply each change to the latest saved list rather than this tab's copy,
//    so a tab left open for days can't overwrite what everyone else has done
//    since." Each kind of change (add, assign/confirm, edit) is made after
//    another guest has saved a different list behind this tab's back.
//  - The list reloads whenever the tab comes back into view (window focus, or
//    the page becoming visible).
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, saving, startServer } from './app.mjs';

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);

    // Another guest asks Robin for the potatoes and adds cranberry sauce.
    const elsewhere = [
      ...FIXTURE.map((d) => (d.id === 3 ? { ...d, assignedTo: 'Robin', status: 'pending' } : d)),
      { id: 99, name: 'Cranberry sauce', assignedTo: '', status: 'unassigned' },
    ];
    await server.post(elsewhere);
    // This tab, still showing the old list, confirms Stuffing.
    await saving(page, () => row(page, 2).locator('[data-qual="confirm"]').click());
    const expected = elsewhere.map((d) => (d.id === 2 ? { ...d, status: 'confirmed' } : d));
    assert.deepEqual(server.stored(), expected, rer(
      `${engine}: open the page; another guest saves a list with Robin on the potatoes and cranberry sauce added; this tab confirms Stuffing`,
      'all three changes kept', JSON.stringify(server.stored())));

    // Another guest adds rolls; this tab, not yet showing them, adds gravy.
    await server.post([...server.stored(), { id: 100, name: 'Rolls', assignedTo: '', status: 'unassigned' }]);
    await saving(page, async () => {
      await page.locator('[data-qual="new-dish"]').fill('Gravy');
      await page.locator('[data-qual="new-dish"]').press('Enter');
    });
    const names = server.stored().map((d) => d.name);
    assert.ok(names.includes('Rolls') && names.includes('Gravy'), rer(
      `${engine}: another guest adds Rolls; this tab, not showing them yet, adds Gravy`, 'both in the store', JSON.stringify(names)));

    // Another guest adds notes to the napkins; this tab renames the turkey.
    const before = server.stored().map((d) => (d.id === 7 ? { ...d, notes: 'paper' } : d));
    await server.post(before);
    await saving(page, async () => {
      await row(page, 1).locator('[data-qual="edit"]').click();
      await row(page, 1).locator('[data-qual="edit-name"]').fill('Heritage turkey');
      await row(page, 1).locator('[data-qual="save"]').click();
    });
    const after = server.stored();
    assert.ok(after.find((d) => d.id === 7).notes === 'paper' && after.find((d) => d.id === 1).name === 'Heritage turkey', rer(
      `${engine}: another guest gives Napkins notes; this tab renames Turkey`, 'both edits kept',
      JSON.stringify(after.filter((d) => d.id === 1 || d.id === 7))));

    // Coming back to the tab shows what changed meanwhile, without a reload.
    const visibility = await page.evaluate(() => document.visibilityState);
    assert.equal(visibility, 'visible', rer(`${engine}: open the page; read document.visibilityState`,
      '"visible", or the refresh below can\'t happen', JSON.stringify(visibility)));
    for (const [id, how, event] of [[101, 'the window regains focus', "window.dispatchEvent(new Event('focus'))"],
      [102, 'the page becomes visible', "document.dispatchEvent(new Event('visibilitychange'))"]]) {
      await server.post([...server.stored(), { id, name: `Dish ${id}`, assignedTo: '', status: 'unassigned' }]);
      await page.evaluate(event);
      const shown = await row(page, id).waitFor({ timeout: 3000 }).then(() => true, () => false);
      assert.ok(shown, rer(`${engine}: another guest adds a dish; then ${how}`, 'the page shows the new dish', 'it does not'));
    }
    assert.deepEqual(page.uncaught, [], rer(`${engine}: changes made against other guests' changes`, 'no uncaught errors',
      JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: changes apply to the latest list, and the list refreshes on return');
