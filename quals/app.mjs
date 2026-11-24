// Shared by the quals that drive the real app: builds it with Vite, serves it
// with server.js (the Express server production runs) on a free port with a
// data file of its own, and opens it in Playwright's Chromium, Firefox and
// WebKit. Needs those browsers (npx playwright-core install chromium firefox
// webkit); without them launching throws, so a qual that can't run fails
// rather than passing unchecked.
//
// Quals find things through hooks, never through words or looks, so rewording
// or restyling the page can't break them: data-dish={id} on each dish's row,
// data-view={id} on each view's button, and data-qual="..." on each control.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright-core';
import { build } from 'vite';
import { CATEGORIES } from '../src/dishes.js';

export const ROOT = path.dirname(import.meta.dirname);
export const ENGINES = { chromium, firefox, webkit };

// An assert message in the three parts of a proper bug report (AGENTS.md rule 14).
export const rer = (replicata, expectata, resultata) =>
  `\nReplicata: ${replicata}\nExpectata: ${expectata}\nResultata: ${resultata}`;

const [MAIN, SIDE, DESSERT] = CATEGORIES;
// A dish in every state the page draws: confirmed, pending (one with notes),
// unclaimed, with and without a stored category, two pies, a person named in
// two capitalizations (Alex, alex), and a dish two people share.
export const FIXTURE = [
  { id: 1, name: 'Turkey', category: MAIN, notes: '', assignedTo: 'Alex', status: 'confirmed' },
  { id: 2, name: 'Stuffing', category: SIDE, notes: 'with sausage', assignedTo: 'Sam', status: 'pending' },
  { id: 3, name: 'Mashed potatoes', assignedTo: '', status: 'unassigned' },
  { id: 4, name: 'Pecan pie', category: DESSERT, notes: '', assignedTo: 'Jo & Kim', status: 'confirmed' },
  { id: 5, name: 'Pumpkin pie', assignedTo: '', status: 'unassigned' },
  { id: 6, name: 'Wine', notes: 'red and white', assignedTo: 'alex', status: 'pending' },
  { id: 7, name: 'Napkins', assignedTo: '', status: 'unassigned' },
];

export async function buildApp() {
  await build({ root: ROOT, logLevel: 'error' });
}

const freePort = () => new Promise((resolve) => {
  const probe = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

// server.js on a free port, its data file holding `dishes` (no file at all
// when dishes is undefined, as on a fresh install).
export async function startServer(dishes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assignatory-qual-'));
  const dataFile = path.join(dir, 'data.json');
  if (dishes !== undefined) fs.writeFileSync(dataFile, JSON.stringify({ dishes }));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, API_PORT: String(port), DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const url = `http://127.0.0.1:${port}`;
  // Ready once it answers (not on its log line, whose words may change).
  for (let tries = 0; ; tries++) {
    const answered = await fetch(`${url}/api/dishes`).then((r) => r.status, () => 0);
    if (answered !== 0) break;
    assert.ok(tries < 200 && child.exitCode === null, rer(`node server.js with API_PORT=${port} and DATA_FILE=${dataFile}`,
      'it answers GET /api/dishes within 5 seconds', `it ${child.exitCode === null ? 'never answered' : `exited (${child.exitCode})`}. Its output:\n${output}`));
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return {
    url,
    dataFile,
    // The stored list, or undefined while there's no data file.
    stored: () => (fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')).dishes : undefined),
    // What another guest's tab would do: save a whole list straight to the API.
    post: (list) => fetch(`${url}/api/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    }),
    stop: async () => {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await exited;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Runs `qual` once in each engine, closing the browser even if the qual fails.
export async function inEveryEngine(qual) {
  for (const [engine, launcher] of Object.entries(ENGINES)) {
    const browser = await launcher.launch();
    try {
      await qual(browser, engine);
    } finally {
      await browser.close();
    }
  }
}

// The app in a fresh browser context, loaded. Requests that would leave the
// machine (the web font) get an empty answer, so no qual depends on the
// network. Unless dismissHelp is false, the first-visit instructions are
// closed. apiFails makes every /api/dishes request fail with a 500. Uncaught
// errors are collected in page.uncaught for the qual to assert on.
export async function openApp(browser, server, { hash = '', dismissHelp = true, apiFails = false } = {}) {
  const context = await browser.newContext();
  await context.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.fulfill({ status: 200, body: '' }));
  if (apiFails) {
    await context.route('**/api/dishes', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  }
  const page = await context.newPage();
  page.uncaught = [];
  page.on('pageerror', (error) => page.uncaught.push(error.message));
  await page.goto(`${server.url}/${hash ? `#${hash}` : ''}`);
  await page.locator('[data-qual="new-dish"]').waitFor();  // drawn once the list has loaded
  if (dismissHelp) await page.locator('[data-qual="close-help"]').click();
  return page;
}

export const row = (page, id) => page.locator(`[data-dish="${id}"]`);

export const shownIds = (page) =>
  page.locator('[data-dish]').evaluateAll((rows) => rows.map((r) => Number(r.dataset.dish)));

// Waits (briefly) for the page to show exactly these dish ids, in this order,
// then asserts it.
export async function expectShown(page, ids, replicata, expectata) {
  await page.waitForFunction(
    (want) => JSON.stringify([...document.querySelectorAll('[data-dish]')].map((r) => Number(r.dataset.dish))) === want,
    JSON.stringify(ids),
    { timeout: 3000 },
  ).catch(() => {});
  const shown = await shownIds(page);
  assert.deepEqual(shown, ids, rer(replicata, expectata, `the page shows dish ids ${JSON.stringify(shown)}`));
}

const isSave = (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/dishes';

// Does `act`, then waits for the page's save of the list to come back.
export async function saving(page, act) {
  const saved = page.waitForResponse((response) => isSave(response.request()));
  await act();
  return saved;
}

// Does `act` and returns how many saves the page sent in the next 400ms.
export async function savesDuring(page, act) {
  let saves = 0;
  const count = (request) => { if (isSave(request)) saves++; };
  page.on('request', count);
  await act();
  await page.waitForTimeout(400);
  page.off('request', count);
  return saves;
}
