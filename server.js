const express = require('express');
const cors = require('cors');
const Database = require('@replit/database');

const app = express();
const db = new Database();

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

const port = 3000;
app.listen(port, () => {
  console.log(`API Server running on port ${port}`);
});