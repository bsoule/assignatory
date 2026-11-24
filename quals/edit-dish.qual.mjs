// Editing a dish: the editor starts from the dish as stored (its category, or
// the guess when none is stored); Enter in a field or save stores the name and
// notes trimmed and the category picked, leaving who brings it alone; Escape
// or cancel stores nothing; a blank name doesn't save.
import assert from 'node:assert/strict';
import { CATEGORIES, categoryOf } from '../src/dishes.js';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, savesDuring, saving, startServer } from './app.mjs';

const field = (page, id, qual) => row(page, id).locator(`[data-qual="${qual}"]`);

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    const stuffing = FIXTURE.find((d) => d.id === 2);

    await field(page, 2, 'edit').click();
    const prefilled = [
      await field(page, 2, 'edit-name').inputValue(),
      await field(page, 2, 'edit-category').inputValue(),
      await field(page, 2, 'edit-notes').inputValue(),
    ];
    assert.deepEqual(prefilled, [stuffing.name, stuffing.category, stuffing.notes], rer(`${engine}: click edit on Stuffing`,
      'the editor holds its stored name, category and notes', JSON.stringify(prefilled)));

    const picked = CATEGORIES.find((c) => c !== stuffing.category);
    let before = server.stored();
    await saving(page, async () => {
      await field(page, 2, 'edit-name').fill('  Cornbread stuffing  ');
      await field(page, 2, 'edit-category').selectOption(picked);
      await field(page, 2, 'edit-notes').fill('  extra sage  ');
      await field(page, 2, 'edit-name').press('Enter');
    });
    let expected = before.map((d) => (d.id === 2 ? { ...d, name: 'Cornbread stuffing', category: picked, notes: 'extra sage' } : d));
    assert.deepEqual(server.stored(), expected, rer(`${engine}: edit Stuffing to "  Cornbread stuffing  ", ${JSON.stringify(picked)}, notes "  extra sage  "; press Enter in the name`,
      'name and notes trimmed, the picked category, still Sam\'s and pending; no other dish changed',
      JSON.stringify(server.stored().find((d) => d.id === 2))));
    await field(page, 2, 'edit').waitFor();

    // Enter in the notes field and the save button save too.
    before = server.stored();
    await saving(page, async () => {
      await field(page, 7, 'edit').click();
      await field(page, 7, 'edit-notes').fill('paper ones');
      await field(page, 7, 'edit-notes').press('Enter');
    });
    await saving(page, async () => {
      await field(page, 6, 'edit').click();
      await field(page, 6, 'edit-name').fill('Red wine');
      await field(page, 6, 'save').click();
    });
    expected = before.map((d) => (d.id === 7 ? { ...d, notes: 'paper ones', category: categoryOf(d) }
      : d.id === 6 ? { ...d, name: 'Red wine', category: categoryOf(d) } : d));
    assert.deepEqual(server.stored(), expected, rer(`${engine}: edit Napkins' notes and press Enter there; edit Wine's name and click save`,
      'both saved, each now with its category stored', JSON.stringify(server.stored())));

    // Escape and cancel store nothing and close the editor.
    before = server.stored();
    for (const [how, close] of [['press Escape', () => field(page, 1, 'edit-name').press('Escape')],
      ['click cancel', () => field(page, 1, 'cancel').click()]]) {
      await field(page, 1, 'edit').click();
      const saves = await savesDuring(page, async () => {
        await field(page, 1, 'edit-name').fill('Tofurky');
        await close();
      });
      assert.equal(saves, 0, rer(`${engine}: edit Turkey's name to Tofurky, then ${how}`, 'no save', `${saves} saves`));
      assert.equal(await field(page, 1, 'edit-name').count(), 0, rer(`${engine}: edit Turkey, then ${how}`, 'the editor closed', 'it is still open'));
    }
    assert.deepEqual(server.stored(), before, rer(`${engine}: edit Turkey twice, abandoning both`, 'the store unchanged', JSON.stringify(server.stored())));

    // A blank name doesn't save, and the editor stays open.
    await field(page, 1, 'edit').click();
    const blank = await savesDuring(page, async () => {
      await field(page, 1, 'edit-name').fill('   ');
      await field(page, 1, 'edit-name').press('Enter');
    });
    assert.ok(blank === 0 && await field(page, 1, 'edit-name').count() === 1, rer(`${engine}: blank Turkey's name in the editor, press Enter`,
      'no save, the editor still open', `${blank} saves, editor ${await field(page, 1, 'edit-name').count() ? 'open' : 'closed'}`));
    await field(page, 1, 'cancel').click();

    // A dish with no stored category opens with the guessed one.
    await field(page, 3, 'edit').click();
    const shownCategory = await field(page, 3, 'edit-category').inputValue();
    const guessed = categoryOf(FIXTURE.find((d) => d.id === 3));
    assert.equal(shownCategory, guessed, rer(`${engine}: click edit on Mashed potatoes, which has no stored category`,
      `the guess, ${JSON.stringify(guessed)}`, JSON.stringify(shownCategory)));
    assert.deepEqual(page.uncaught, [], rer(`${engine}: edit dishes`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: editing dishes (prefill, Enter/save, Escape/cancel, blank refused)');
