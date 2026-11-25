// The instructions: they open by themselves on a first visit as a modal
// dialog holding the keyboard (focus on its one button, Tab stays there, the
// page behind doesn't scroll); Escape, the button, or a click outside closes
// them, handing focus back to the help button; once closed they stay closed
// on later visits; the help button reopens them.
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, settled, startServer } from './app.mjs';

const focused = (page) => page.evaluate(() => document.activeElement?.dataset.qual ?? document.activeElement?.tagName);
const bodyOverflow = (page) => page.evaluate(() => document.body.style.overflow);

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const page = await openApp(browser, server, { dismissHelp: false });
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const first = `${engine}: open the page for the first time`;
    const modal = await dialog.getAttribute('aria-modal');
    assert.equal(modal, 'true', rer(first, 'a modal dialog (aria-modal="true")', String(modal)));
    const focus = await settled(() => focused(page), 'close-help');
    assert.equal(focus, 'close-help', rer(first, 'focus on its close button', String(focus)));
    const locked = await settled(() => bodyOverflow(page), 'hidden');
    assert.equal(locked, 'hidden', rer(first, 'the page behind locked from scrolling', JSON.stringify(locked)));

    for (const key of ['Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      const stayed = await focused(page);
      assert.equal(stayed, 'close-help', rer(`${first}; press ${key}`, 'focus stays on the close button', String(stayed)));
    }
    await dialog.click({ position: { x: 12, y: 12 } });
    await page.waitForTimeout(300);  // time enough for it to close, if it were going to
    assert.equal(await dialog.count(), 1, rer(`${first}; click inside the dialog, away from its button`, 'the dialog stays open', 'it closed'));

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    const back = await settled(() => focused(page), 'help');
    assert.equal(back, 'help', rer(`${first}; press Escape`, 'focus back on the help button', String(back)));
    const unlocked = await settled(() => bodyOverflow(page), '');
    assert.equal(unlocked, '', rer(`${first}; press Escape`, 'the page scrolls again', JSON.stringify(unlocked)));

    await page.reload();
    await page.locator('[data-qual="new-dish"]').waitFor();
    await page.waitForTimeout(300);
    assert.equal(await dialog.count(), 0, rer(`${engine}: close the instructions once; reload`, 'no instructions', 'they opened again'));

    await page.locator('[data-qual="help"]').click();
    await dialog.waitFor();
    await page.mouse.click(4, 4);
    await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    assert.equal(await dialog.count(), 0, rer(`${engine}: click the help button; click the page's corner, outside the dialog`,
      'the dialog closes', 'it is still open'));

    await page.locator('[data-qual="help"]').click();
    await page.locator('[data-qual="close-help"]').click();
    await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    assert.equal(await dialog.count(), 0, rer(`${engine}: click the help button; click the dialog's close button`,
      'the dialog closes', 'it is still open'));
    assert.deepEqual(page.uncaught, [], rer(`${engine}: open and close the instructions`, 'no uncaught errors', JSON.stringify(page.uncaught)));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: the instructions dialog (first visit, keyboard, closing, remembered)');
