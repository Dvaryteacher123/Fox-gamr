const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Kusoma mafaili ya mbele (Frontend) kutoka kwenye folda zake sahihi
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Njia kuu (Home Route)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mfano wa API route ya AI Chat kupitia OpenRouter
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "OpenRouter API Key haijasakinishwa." });
        }

        res.json({ reply: "Ujumbe umepokewa na seva kwa usalama!" });
    } catch (error) {
        console.error("Hitilafu kwenye AI route:", error);
        res.status(500).json({ error: "Imeshindikana kuwasiliana na AI." });
    }
});

// Anzisha Seva
app.listen(PORT, () => {
    console.log(`🚀 Seva inaendelea kwenye port ${PORT}`);
});
