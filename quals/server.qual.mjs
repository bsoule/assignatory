// server.js, the Express server production runs, from the outside: its API,
// its data file, and how it fails. Error messages aren't pinned, only status
// codes and what ends up on disk.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DISHES_PATH, FIXTURE, ROOT, buildApp, rer, startServer } from './app.mjs';

await buildApp();

const getDishes = async (server) => {
  const response = await fetch(`${server.url}${DISHES_PATH}`);
  return { status: response.status, body: await response.json().catch(() => null) };  // null: not JSON
};
const postRaw = (server, body, headers = {}) => fetch(`${server.url}${DISHES_PATH}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
});

// A fresh install: no data file. The list is empty and reading it creates no file.
{
  const server = await startServer(undefined);
  try {
    const { status, body } = await getDishes(server);
    assert.deepEqual([status, body], [200, []], rer(`start server.js with no data file; GET ${DISHES_PATH}`,
      '200 and an empty list', `${status} ${JSON.stringify(body)}`));
    assert.ok(!fs.existsSync(server.dataFile), rer('the same GET', 'no data file created by a read', 'the file exists'));
  } finally {
    await server.stop();
  }
}

// Saving: POST replaces the whole list, echoes it back, and lands on disk whole.
{
  const server = await startServer(FIXTURE);
  try {
    const list = [...FIXTURE.slice(1), { id: 8, name: 'Gravy', assignedTo: 'Sam', status: 'pending' }];
    const response = await server.post(list);
    const echoed = await response.json();
    assert.deepEqual([response.status, echoed], [200, list], rer(`POST a list to ${DISHES_PATH}`,
      '200, with the list echoed back', `${response.status} ${JSON.stringify(echoed)}`));
    const { status, body } = await getDishes(server);
    assert.deepEqual([status, body], [200, list], rer(`POST a list, then GET ${DISHES_PATH}`,
      '200 and exactly the posted list', `${status} ${JSON.stringify(body)}`));
    assert.deepEqual(server.stored(), list, rer('POST a list, then read the data file',
      'the file holds exactly the posted list', JSON.stringify(server.stored())));
    const leftovers = fs.readdirSync(path.dirname(server.dataFile)).filter((f) => f !== path.basename(server.dataFile));
    assert.deepEqual(leftovers, [], rer('POST a list, then list the data file\'s folder',
      'only the data file: the temp file a save writes first is renamed over it', `also ${leftovers.join(', ')}`));

    // Malformed JSON, and lists the app would never save (src/dishes.js's
    // listProblems), are refused with a 400 naming the problems, and the
    // stored list is untouched.
    const invalid = [
      ['malformed JSON', '[{"id": 1, "name": '],
      ['an object, not a list', '{"dishes": []}'],
      ['a number', '5'],
      ['a dish with a status the app doesn\'t have', JSON.stringify([{ id: 1, name: 'Turkey', assignedTo: '', status: 'maybe' }])],
      ['two dishes with one id', JSON.stringify([FIXTURE[0], { ...FIXTURE[1], id: FIXTURE[0].id }])],
      ['an assignee ending in a space', JSON.stringify([{ ...FIXTURE[0], assignedTo: 'Alex ' }])],
    ];
    for (const [label, body] of invalid) {
      const bad = await postRaw(server, body);
      const answer = await bad.json().catch(() => null);
      assert.ok(bad.status === 400, rer(`POST ${label} to ${DISHES_PATH}`, '400', `${bad.status} ${JSON.stringify(answer)}`));
      assert.deepEqual(server.stored(), list, rer(`POST ${label}, then read the data file`,
        'the list from before, untouched', JSON.stringify(server.stored())));
    }
    const named = await postRaw(server, invalid[3][1]).then((r) => r.json());
    assert.ok(Array.isArray(named.error) && named.error.length > 0, rer(`POST ${invalid[3][0]}`,
      'a JSON answer whose "error" lists the problems', JSON.stringify(named)));
    // Without a JSON content type, Express 5 leaves the body undefined; that
    // must not reach the store (it would wipe the list).
    const untyped = await fetch(`${server.url}${DISHES_PATH}`, { method: 'POST', body: JSON.stringify(list) });
    assert.equal(untyped.status, 400, rer('POST a valid list as text/plain', '400', String(untyped.status)));
    assert.deepEqual(server.stored(), list, rer('POST a valid list as text/plain, then read the data file',
      'the list from before, untouched', JSON.stringify(server.stored())));
  } finally {
    await server.stop();
  }
}

// Versions ([SIM] in the human's task list): each list has one, sent in a
// Dishes-Version header. A save naming the version it changes (the same header)
// goes through only if that's still the current one, so it can't overwrite a
// save it never saw. A save naming none is refused the same way.
{
  const server = await startServer(FIXTURE);
  try {
    const version = async () => (await fetch(`${server.url}${DISHES_PATH}`)).headers.get('dishes-version');
    const v1 = await version();
    assert.ok(typeof v1 === 'string' && v1 !== '', rer(`GET ${DISHES_PATH}`, 'a Dishes-Version header, the list\'s version', String(v1)));
    const v1again = await version();
    assert.equal(v1again, v1, rer(`GET ${DISHES_PATH} twice, nothing saved in between`, 'the same version both times', `${v1}, then ${v1again}`));

    const theirs = FIXTURE.map((d) => (d.id === 3 ? { ...d, assignedTo: 'Pat', status: 'pending' } : d));
    const saved = await postRaw(server, JSON.stringify(theirs), { 'Dishes-Version': v1 });
    const v2 = saved.headers.get('dishes-version');
    const v2read = await version();
    assert.ok(saved.status === 200 && v2 !== v1 && v2read === v2, rer('POST a changed list naming the current version',
      '200, with a new version, the one a GET now gives', `${saved.status}, version ${v2}; GET gives ${v2read}`));

    const stale = await postRaw(server, JSON.stringify(FIXTURE), { 'Dishes-Version': v1 });
    assert.equal(stale.status, 409, rer('POST another list naming the version from before that save',
      '409: that version is gone', String(stale.status)));
    assert.deepEqual(server.stored(), theirs, rer('POST with the old version, then read the data file',
      'the save it would have overwritten, untouched', JSON.stringify(server.stored())));

    const current = await postRaw(server, JSON.stringify(FIXTURE), { 'Dishes-Version': v2 });
    assert.equal(current.status, 200, rer('POST naming the current version', '200', String(current.status)));
    const unversioned = await postRaw(server, JSON.stringify(theirs));
    assert.equal(unversioned.status, 409, rer('POST naming no version of the list', '409, like a stale version', String(unversioned.status)));
    assert.deepEqual(server.stored(), FIXTURE, rer('POST naming no version of the list, then read the data file',
      'the list from before, untouched', JSON.stringify(server.stored())));

    // The API's version is in its URL (API_URL in src/dishes.js), and nothing
    // is served at any other, so a page older than the server can neither read
    // nor save. Here, one from before API versions existed, which used
    // /api/dishes. Current pages, told 404, say to reload.
    const old = `${server.url}/api/dishes`;
    const read = await fetch(old);
    const write = await fetch(old, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Dishes-Version': await version() }, body: JSON.stringify(theirs),
    });
    assert.deepEqual([read.status, write.status], [404, 404], rer('GET /api/dishes, then POST a valid list there naming the current version',
      '404 both times', `${read.status}, then ${write.status}`));
    assert.deepEqual(server.stored(), FIXTURE, rer('POST a valid list to /api/dishes, then read the data file',
      'the list from before, untouched', JSON.stringify(server.stored())));
  } finally {
    await server.stop();
  }
}

// A data file that isn't JSON fails loudly (500) and is never overwritten.
{
  const server = await startServer([]);
  try {
    fs.writeFileSync(server.dataFile, '{"dishes": [ oops');
    const read = await fetch(`${server.url}${DISHES_PATH}`);
    assert.equal(read.status, 500, rer(`corrupt the data file; GET ${DISHES_PATH}`, '500', String(read.status)));
    const write = await postRaw(server, JSON.stringify(FIXTURE));
    assert.equal(write.status, 500, rer('corrupt the data file; POST a list', '500', String(write.status)));
    const onDisk = fs.readFileSync(server.dataFile, 'utf8');
    assert.equal(onDisk, '{"dishes": [ oops', rer('corrupt the data file; GET, then POST',
      'the corrupt file left exactly as it was, for a human to look at', JSON.stringify(onDisk)));
  } finally {
    await server.stop();
  }
}

// The built page is served at /, and unknown paths are 404s.
{
  const server = await startServer([]);
  try {
    const page = await fetch(`${server.url}/`);
    const html = await page.text();
    const built = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');
    assert.ok(page.status === 200 && html === built, rer('build the app; GET /',
      '200 and the built dist/index.html', `${page.status}, ${html === built ? 'same' : 'different'} HTML`));
    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
    const script = await fetch(`${server.url}${asset}`);
    assert.equal(script.status, 200, rer(`GET the page's script, ${asset}`, '200', String(script.status)));
    const missing = await fetch(`${server.url}/no-such-page`);
    assert.equal(missing.status, 404, rer('GET /no-such-page', '404', String(missing.status)));
  } finally {
    await server.stop();
  }
}

// Started on a port that's already taken, the server crashes instead of
// claiming to run.
{
  const server = await startServer([]);
  try {
    const port = new URL(server.url).port;
    const second = spawn(process.execPath, ['server.js'], {
      cwd: ROOT, env: { ...process.env, API_PORT: port, DATA_FILE: server.dataFile }, stdio: 'ignore',
    });
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => { second.kill(); resolve('still running after 5s'); }, 5000);
      second.once('exit', (exitCode) => { clearTimeout(timer); resolve(exitCode); });
    });
    assert.ok(typeof code === 'number' && code !== 0, rer(`start a second server.js on port ${port}, which the first one holds`,
      'it exits at once with a nonzero code', String(code)));
  } finally {
    await server.stop();
  }
}

console.log('qual pass: server API, data file, static page, and loud failures');
