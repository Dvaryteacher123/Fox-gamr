const express = require('express');
const router = express.Router();

// GET all games
router.get('/', (req, res) => {
  res.json({ games: [] });
});

// POST new game
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Game added successfully' });
});

module.exports = router;
