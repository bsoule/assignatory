// Adding a dish: Enter or the add button stores it unclaimed, its name
// trimmed, under the category picked or else the one guessed from its name;
// then the form clears. A blank name adds nothing.
import assert from 'node:assert/strict';
import { CATEGORIES, guessCategory } from '../src/dishes.js';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, savesDuring, saving, settled, startServer } from './app.mjs';

const newOnes = (before, after) => after.filter((dish) => !before.some((old) => old.id === dish.id));
const oldOnes = (before, after) => after.filter((dish) => before.some((old) => old.id === dish.id));

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server);
    const name = page.locator('[data-qual="new-dish"]');
    const category = page.locator('[data-qual="new-category"]');

    // Typed with stray spaces, category left on auto, Enter.
    let before = server.stored();
    await saving(page, async () => {
      await name.fill('  Sweet potato pie  ');
      await name.press('Enter');
    });
    let after = server.stored();
    let added = newOnes(before, after);
    const act1 = `${engine}: type "  Sweet potato pie  " into the new-dish box and press Enter`;
    assert.equal(added.length, 1, rer(act1, 'one dish added', `${added.length} added: ${JSON.stringify(added)}`));
    assert.deepEqual(oldOnes(before, after), before, rer(act1, 'every other dish unchanged', JSON.stringify(after)));
    const { id, ...fields } = added[0];
    assert.equal(typeof id, 'number', rer(act1, 'a numeric id', JSON.stringify(id)));
    assert.deepEqual(fields, {
      name: 'Sweet potato pie', category: guessCategory('Sweet potato pie'), notes: '', assignedTo: '', status: 'unassigned',
    }, rer(act1, 'name trimmed, the guessed category, no notes, unclaimed', JSON.stringify(fields)));
    await row(page, id).waitFor();
    const emptied = await settled(() => name.inputValue(), '');
    assert.equal(emptied, '', rer(act1, 'the box emptied', JSON.stringify(emptied)));

    // A category picked by hand beats the guess, and goes back to auto afterwards.
    const dish = 'Pie-flavored soda';
    const picked = CATEGORIES.find((c) => c !== guessCategory(dish));
    before = server.stored();
    await saving(page, async () => {
      await category.selectOption(picked);
      await name.fill(dish);
      await page.locator('[data-qual="add"]').click();
    });
    after = server.stored();
    added = newOnes(before, after);
    const act2 = `${engine}: pick the category ${JSON.stringify(picked)}, type "${dish}" (guessed as ${JSON.stringify(guessCategory(dish))}), click add`;
    assert.deepEqual(added.map((d) => [d.name, d.category]), [[dish, picked]], rer(act2,
      `one dish added, filed under ${JSON.stringify(picked)}`, JSON.stringify(added)));
    const reset = await settled(() => category.inputValue(), '');
    assert.equal(reset, '', rer(act2, 'the category back on auto (empty value)', JSON.stringify(reset)));
    const emptiedAgain = await settled(() => name.inputValue(), '');
    assert.equal(emptiedAgain, '', rer(act2, 'the box emptied', JSON.stringify(emptiedAgain)));

    // Blank names add nothing.
    before = server.stored();
    const blankEnter = await savesDuring(page, async () => {
      await name.fill('   ');
      await name.press('Enter');
    });
    const blankClick = await savesDuring(page, async () => {
      await name.fill('');
      await page.locator('[data-qual="add"]').click();
    });
    assert.deepEqual([blankEnter, blankClick], [0, 0], rer(`${engine}: press Enter with only spaces typed; click add with nothing typed`,
      'no save either time', `${blankEnter} and ${blankClick} saves`));
    assert.deepEqual(server.stored(), before, rer(`${engine}: try to add blank names`, 'the store unchanged', JSON.stringify(server.stored())));
    assert.deepEqual(page.uncaught, [], rer(`${engine}: add dishes`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: adding dishes (trim, guessed or picked category, blank refused)');
