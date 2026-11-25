import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { API_URL, listProblems } from './src/dishes.js';

// A JSON file (data.json locally, DATA_FILE on the Fly volume in production).
function makeStore() {
  const file = process.env.DATA_FILE || path.join(import.meta.dirname, 'data.json');
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
  };
  // Synchronous, so a save's version check and its write can't be split by another request.
  return {
    get: (key) => read()[key] ?? null,
    set: (key, value) => {
      // Write to a temp file and rename so a crash mid-write can't corrupt the data.
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ ...read(), [key]: value }, null, 2));
      fs.renameSync(tmp, file);
    },
  };
}

const app = express();
const db = makeStore();

app.use(express.json());

// A list's version, sent in a Dishes-Version header. A save names the version
// it changes in the same header, so it can't overwrite a save it never saw.
// (Not ETag and If-Match: a proxy that compresses may weaken an ETag, and the
// page would then name a version the server never gave out.)
const versionOf = (dishes) => crypto.createHash('sha256').update(JSON.stringify(dishes)).digest('base64url');

// Only the API's current version is served (API_URL names it), so a page
// loaded before a bump gets 404s at its old URL: it can neither load nor
// save, and says to reload.

// Get all dishes
app.get(`${API_URL}/dishes`, (req, res) => {
  try {
    const dishes = db.get('dishes') || [];
    res.set('Dishes-Version', versionOf(dishes)).json(dishes);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch dishes' });
  }
});

// Update dishes
app.post(`${API_URL}/dishes`, (req, res) => {
  // Refuse, loudly, any list the app couldn't have saved. (Without a JSON
  // content type, Express leaves req.body undefined, which is refused too.)
  const problems = listProblems(req.body);
  if (problems.length > 0) {
    res.status(400).json({ error: problems });
    return;
  }
  try {
    // Someone else saved since this change's version, or it names none: refuse
    // it (the page redoes it on the newer list).
    if (req.get('Dishes-Version') !== versionOf(db.get('dishes') || [])) {
      res.status(409).json({ error: ['This change is not to the current version of the list (Dishes-Version).'] });
      return;
    }
    db.set('dishes', req.body);
    res.set('Dishes-Version', versionOf(req.body)).json(req.body);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to update dishes' });
  }
});

// Serve the built frontend (npm run build). In dev, Vite serves it on port 5173 instead.
app.use(express.static(path.join(import.meta.dirname, 'dist')));

const port = process.env.API_PORT || 3000;
app.listen(port, (err) => {
  assert.ifError(err);  // Express 5 hands listen errors, like a port in use, to this callback
  console.log(`API Server running on port ${port}`);
});
