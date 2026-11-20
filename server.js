const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Replit's key-value DB when running on Replit; a JSON file anywhere else
// (data.json locally, DATA_FILE on the Fly volume in production).
function makeStore() {
  if (process.env.REPLIT_DB_URL || fs.existsSync('/tmp/replitdb')) {
    const Database = require('@replit/database');
    return new Database();
  }
  const file = process.env.DATA_FILE || path.join(__dirname, 'data.json');
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

app.use(cors());
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
  try {
    await db.set('dishes', req.body);
    res.json(req.body);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to update dishes' });
  }
});

// Serve the built frontend (npm run build). In dev, Vite serves it on port 5000 instead.
app.use(express.static(path.join(__dirname, 'dist')));

const port = process.env.API_PORT || 3000;
app.listen(port, () => {
  console.log(`API Server running on port ${port}`);
});