// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ruhusu seva kusoma data za JSON kutoka kwa wateja
app.use(express.json());

// Ruhusu seva kusoma mafolda ya nje (kama assets, html n.k)
app.use(express.static(path.join(__dirname)));

// Njia ya ukurasa wa mbele (Home)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Hapa utaweka API yako ya malipo hapo mbeleni
app.post('/api/pay', (req, res) => {
    res.json({ success: true, message: "Malipo yamepokelewa (Mfano tu)" });
});

app.listen(PORT, () => {
    console.log(`Seva inaendelea vizuri kwenye http://localhost:${PORT}`);
});

