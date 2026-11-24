import assert from 'assert';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { listProblems } from './src/dishes.js';

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
  return {
    get: async (key) => read()[key] ?? null,
    set: async (key, value) => {
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

// Get all dishes
app.get('/api/dishes', async (req, res) => {
  try {
    const dishes = await db.get('dishes') || [];
    res.json(dishes);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch dishes' });
  }
});

// Update dishes
app.post('/api/dishes', async (req, res) => {
  // Refuse, loudly, any list the app couldn't have saved. (Without a JSON
  // content type, Express leaves req.body undefined, which is refused too.)
  const problems = listProblems(req.body);
  if (problems.length > 0) {
    res.status(400).json({ error: problems });
    return;
  }
  try {
    await db.set('dishes', req.body);
    res.json(req.body);
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
