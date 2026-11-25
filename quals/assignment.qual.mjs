// Who brings what: typing a name into an unclaimed dish's box asks that person
// (pending), confirm makes it confirmed, decline or release clears it. Each
// change touches only its own dish, and the name suggestions are everyone
// already assigned. The name box has its own button ([ENT] in the human's
// task list): Enter isn't the only way, which matters on a phone. The button
// is grayed out (disabled) until there's a name to send.
import assert from 'node:assert/strict';
import { allPeople } from '../src/dishes.js';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, savesDuring, saving, settled, startServer } from './app.mjs';

// Saves `act` on dish `id`, then checks the store: that dish now has `fields`,
// every other dish is as it was.
async function changes(page, server, id, act, fields, replicata, expectata) {
  const before = server.stored();
  await saving(page, act);
  const after = server.stored();
  const expected = before.map((dish) => (dish.id === id ? { ...dish, ...fields } : dish));
  assert.deepEqual(after, expected, rer(replicata, expectata, JSON.stringify(after.find((d) => d.id === id))));
}

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);

    const assignBox = row(page, 3).locator('[data-qual="assign"]');
    await changes(page, server, 3, async () => {
      await assignBox.fill('  Pat  ');
      await assignBox.press('Enter');
    }, { assignedTo: 'Pat', status: 'pending' }, `${engine}: type "  Pat  " into unclaimed Mashed potatoes' box, press Enter`,
    'Pat asked (pending), name trimmed; no other dish changed');
    await row(page, 3).locator('[data-qual="confirm"]').waitFor();
    assert.equal(await row(page, 3).locator('[data-qual="assign"]').count(), 0, rer(`${engine}: assign Mashed potatoes to Pat`,
      'its row offers confirm and decline instead of the name box', 'the name box is still there'));

    const blank = await savesDuring(page, async () => {
      await row(page, 5).locator('[data-qual="assign"]').fill('   ');
      await row(page, 5).locator('[data-qual="assign"]').press('Enter');
    });
    assert.equal(blank, 0, rer(`${engine}: type only spaces into Pumpkin pie's box, press Enter`, 'no save', `${blank} saves`));

    // The button: grayed out until there's a name, and enough on its own.
    const box5 = row(page, 5).locator('[data-qual="assign"]');
    const send5 = row(page, 5).locator('[data-qual="assign-submit"]');
    const buttons = await send5.count();
    assert.equal(buttons, 1, rer(`${engine}: look next to unclaimed Pumpkin pie's name box`, 'a button that sends the name',
      `${buttons} buttons`));
    for (const [typed, disabled] of [['', true], ['   ', true], ['Lee', false]]) {
      await box5.fill(typed);
      const state = await settled(() => send5.isDisabled(), disabled);
      assert.equal(state, disabled, rer(`${engine}: type ${JSON.stringify(typed)} into Pumpkin pie's box`,
        `its button ${disabled ? 'grayed out (disabled)' : 'enabled'}`, state ? 'disabled' : 'enabled'));
    }
    await changes(page, server, 5, () => send5.click(), { assignedTo: 'Lee', status: 'pending' },
      `${engine}: with "Lee" typed into Pumpkin pie's box, click its button (no Enter)`, 'Lee asked (pending)');

    // On a phone: a touch screen and no Enter key. Tapping the button assigns.
    const phone = await openApp(browser, server, { context: { hasTouch: true, viewport: { width: 390, height: 844 } } });
    const box7 = row(phone, 7).locator('[data-qual="assign"]');
    await box7.tap();
    await box7.fill('Kai');
    await changes(phone, server, 7, () => row(phone, 7).locator('[data-qual="assign-submit"]').tap(),
      { assignedTo: 'Kai', status: 'pending' }, `${engine}, as a phone: tap Napkins' box, type "Kai", tap its button`, 'Kai asked (pending)');
    assert.deepEqual(phone.uncaught, [], rer(`${engine}, as a phone: assign by tapping`, 'no uncaught errors', JSON.stringify(phone.uncaught)));

    await changes(page, server, 2, () => row(page, 2).locator('[data-qual="confirm"]').click(),
      { status: 'confirmed' }, `${engine}: click confirm on Stuffing (Sam, pending)`, 'confirmed, still Sam');
    await row(page, 2).locator('[data-qual="release"]').waitFor();

    await changes(page, server, 6, () => row(page, 6).locator('[data-qual="decline"]').click(),
      { assignedTo: '', status: 'unassigned' }, `${engine}: click decline on Wine (alex, pending)`, 'unclaimed, no name');
    await row(page, 6).locator('[data-qual="assign"]').waitFor();

    await changes(page, server, 1, () => row(page, 1).locator('[data-qual="release"]').click(),
      { assignedTo: '', status: 'unassigned' }, `${engine}: click release on Turkey (Alex, confirmed)`, 'unclaimed, no name');
    await row(page, 1).locator('[data-qual="assign"]').waitFor();

    const suggested = await row(page, 1).locator('[data-qual="assign"]')
      .evaluate((box) => [...box.list.options].map((option) => option.value));
    const people = allPeople(server.stored());
    assert.deepEqual(suggested, people, rer(`${engine}: after those changes, read the suggestions of a name box`,
      `everyone assigned now: ${JSON.stringify(people)}`, JSON.stringify(suggested)));
    assert.deepEqual(page.uncaught, [], rer(`${engine}: assign, confirm, decline, release`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: assigning, confirming, declining and releasing dishes');
