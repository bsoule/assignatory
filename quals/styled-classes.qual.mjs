// Every class the page puts on an HTML element has a CSS rule in the built
// stylesheet. Tailwind writes rules only for the classes it finds in
// index.html and src (src/index.css's @source lines), so a class it can't see,
// like one pieced together at runtime ("bg-" + color), would leave its element
// unstyled with no error. This pins no style: change any font or color and it
// still passes. The page is visited in every state: each view, the editor, the
// instructions, and the error alert. (SVG icons' own marker classes from
// lucide-react aren't the page's and aren't checked.)
import assert from 'node:assert/strict';
import { FIXTURE, buildApp, inEveryEngine, openApp, rer, row, startServer } from './app.mjs';

const classesInUse = (page) => page.evaluate(() =>
  [...document.querySelectorAll('*')].filter((el) => el instanceof HTMLElement).flatMap((el) => [...el.classList]));

const classesWithRules = (page) => page.evaluate(() => {
  const found = new Set();
  const walk = (rules) => {
    for (const rule of rules) {
      for (const [, name] of (rule.selectorText ?? '').matchAll(/\.((?:\\.|[\w-])+)/g)) found.add(name.replace(/\\(.)/g, '$1'));
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.href === null || new URL(sheet.href).origin === window.location.origin) walk(sheet.cssRules);
  }
  return [...found];
});

await buildApp();
await inEveryEngine(async (browser, engine) => {
  const server = await startServer(FIXTURE);
  try {
    const used = new Set();
    const page = await openApp(browser, server, { dismissHelp: false });
    for (const c of await classesInUse(page)) used.add(c);  // with the instructions open
    await page.locator('[data-qual="close-help"]').click();
    for (const hash of ['all', 'mine/Alex', 'pies', 'unclaimed', 'schedule', 'mine']) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await page.waitForTimeout(150);
      for (const c of await classesInUse(page)) used.add(c);
    }
    await page.evaluate(() => { window.location.hash = 'all'; });
    await row(page, 2).locator('[data-qual="edit"]').click();
    for (const c of await classesInUse(page)) used.add(c);  // with the editor open
    const withRules = new Set(await classesWithRules(page));

    const broken = await openApp(browser, server, { apiFails: true });
    await broken.getByRole('alert').waitFor();
    for (const c of await classesInUse(broken)) used.add(c);  // with the error alert

    const missing = [...used].filter((c) => !withRules.has(c));
    assert.deepEqual(missing, [], rer(`${engine}: visit every view, the editor, the instructions and the error alert; ` +
      'collect the classes on their HTML elements and the classes the stylesheet has rules for',
      'every class used has a rule', `no rule for ${JSON.stringify(missing)} (of ${used.size} classes used)`));
  } finally {
    await server.stop();
  }
});

console.log('qual pass: every class the page uses has a CSS rule');
