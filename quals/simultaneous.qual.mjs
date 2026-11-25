// [SIM] in the human's task list: two people changing the list at once. Each
// change is applied to the newest list, and the server takes a save only if
// it names the version it changes (a Dishes-Version header). So:
//  - changes to different dishes both land, with no alert, even when they
//    cross in flight (the late one is redone against the newer list);
//  - an action on a dish that someone else changed since you saw it is
//    refused, loudly: an alert, the other person's change kept, and your page
//    showing the dish as it is now. That covers assigning a dish someone just
//    took, confirming one someone just declined, and saving an edit to a dish
//    someone just edited (whose editor then closes).
// "At once" is made exact by holding one page's save in flight until the
// other's has landed. Alert words aren't pinned.
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, saving, settled, startServer } from './app.mjs';

// Holds the page's next save in flight: `held` resolves once it's being held,
// and release() lets it go on.
async function holdNextSave(page) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let heldIt;
  const held = new Promise((resolve) => { heldIt = resolve; });
  let used = false;
  await page.route('**/api/dishes', async (route) => {
    if (route.request().method() === 'POST' && !used) {
      used = true;
      heldIt();
      await gate;
    }
    await route.continue();
  });
  return { held, release };
}

const alerts = (page, want) => settled(() => page.getByRole('alert').count(), want);
// The name on a dish's row, as a list (empty when its row shows no name), without waiting for one to appear.
const namesShown = (page, id, want) => settled(() => row(page, id).locator('[data-qual="assignee"]').allTextContents(), want);
const withDish = (id, fields) => FIXTURE.map((d) => (d.id === id ? { ...d, ...fields } : d));

const SCENARIOS = [
  ['different dishes, crossing in flight', async (a, b, server, engine) => {
    const hold = await holdNextSave(a);
    await row(a, 3).locator('[data-qual="assign"]').fill('Pat');
    await row(a, 3).locator('[data-qual="assign-submit"]').click();
    await hold.held;
    await saving(b, () => row(b, 2).locator('[data-qual="confirm"]').click());
    hold.release();
    const act = `${engine}: A assigns Mashed potatoes to Pat; while A's save is in flight, B confirms Stuffing and B's save lands`;
    const expected = withDish(3, { assignedTo: 'Pat', status: 'pending' }).map((d) => (d.id === 2 ? { ...d, status: 'confirmed' } : d));
    const stored = await settled(() => server.stored(), expected);
    assert.deepEqual(stored, expected, rer(act, 'both changes stored', JSON.stringify(stored.filter((d) => d.id === 2 || d.id === 3))));
    const [onA, onB] = [await alerts(a, 0), await alerts(b, 0)];
    assert.deepEqual([onA, onB], [0, 0], rer(act, 'no alert on either page', `${onA} on A, ${onB} on B`));
  }],

  ['the same dish, crossing in flight', async (a, b, server, engine) => {
    const hold = await holdNextSave(a);
    await row(a, 3).locator('[data-qual="assign"]').fill('Pat');
    await row(a, 3).locator('[data-qual="assign-submit"]').click();
    await hold.held;
    await row(b, 3).locator('[data-qual="assign"]').fill('Lee');
    await saving(b, () => row(b, 3).locator('[data-qual="assign-submit"]').click());
    hold.release();
    const act = `${engine}: A assigns Mashed potatoes to Pat; while A's save is in flight, B assigns it to Lee and B's save lands`;
    const expected = withDish(3, { assignedTo: 'Lee', status: 'pending' });
    const stored = await settled(() => server.stored(), expected);
    assert.deepEqual(stored, expected, rer(act, 'Lee\'s assignment kept, Pat\'s refused', JSON.stringify(stored.find((d) => d.id === 3))));
    const onA = await alerts(a, 1);
    assert.equal(onA, 1, rer(act, 'an alert on A', `${onA} alerts`));
    const shown = await namesShown(a, 3, ['Lee']);
    assert.deepEqual(shown, ['Lee'], rer(act, 'A\'s page now showing Lee on it', JSON.stringify(shown)));
  }],

  ['confirming a dish someone just declined', async (a, b, server, engine) => {
    await saving(b, () => row(b, 2).locator('[data-qual="decline"]').click());
    await row(a, 2).locator('[data-qual="confirm"]').click();
    const act = `${engine}: B declines Stuffing (Sam, pending); then A, whose page still shows it pending, clicks confirm`;
    const expected = withDish(2, { assignedTo: '', status: 'unassigned' });
    const stored = await settled(() => server.stored(), expected);
    assert.deepEqual(stored, expected, rer(act, 'Stuffing still unclaimed', JSON.stringify(stored.find((d) => d.id === 2))));
    const onA = await alerts(a, 1);
    assert.equal(onA, 1, rer(act, 'an alert on A', `${onA} alerts`));
    const box = await settled(() => row(a, 2).locator('[data-qual="assign"]').count(), 1);
    assert.equal(box, 1, rer(act, 'A\'s page now showing Stuffing unclaimed (its name box)', `${box} name boxes`));
  }],

  ['saving an edit to a dish someone just edited', async (a, b, server, engine) => {
    await row(a, 2).locator('[data-qual="edit"]').click();
    await row(b, 2).locator('[data-qual="edit"]').click();
    await row(b, 2).locator('[data-qual="edit-name"]').fill('Cornbread stuffing');
    await saving(b, () => row(b, 2).locator('[data-qual="save"]').click());
    await row(a, 2).locator('[data-qual="edit-notes"]').fill('no sausage');
    await row(a, 2).locator('[data-qual="save"]').click();
    const act = `${engine}: A opens the editor on Stuffing; B renames it Cornbread stuffing and saves; then A changes its notes and saves`;
    const expected = withDish(2, { name: 'Cornbread stuffing', category: FIXTURE[1].category, notes: FIXTURE[1].notes });
    const stored = await settled(() => server.stored(), expected);
    assert.deepEqual(stored, expected, rer(act, 'B\'s rename kept, A\'s edit refused', JSON.stringify(stored.find((d) => d.id === 2))));
    const onA = await alerts(a, 1);
    assert.equal(onA, 1, rer(act, 'an alert on A', `${onA} alerts`));
    const editors = await settled(() => row(a, 2).locator('[data-qual="edit-name"]').count(), 0);
    assert.equal(editors, 0, rer(act, 'A\'s editor closed, the row showing the dish as it is now', `${editors} editors open`));
  }],
];

await buildApp();
await inEveryEngine(async (browser, engine) => {
  for (const [, scenario] of SCENARIOS) {
    const server = await startServer(FIXTURE);
    try {
      const a = await openApp(browser, server);
      const b = await openApp(browser, server);
      await scenario(a, b, server, engine);
      assert.deepEqual([...a.uncaught, ...b.uncaught], [], rer(`${engine}: two pages changing the list at once`,
        'no uncaught errors', JSON.stringify([...a.uncaught, ...b.uncaught])));
    } finally {
      await server.stop();
    }
  }
});

console.log('qual pass: simultaneous changes (reconciled, or refused loudly), in chromium, firefox and webkit');
