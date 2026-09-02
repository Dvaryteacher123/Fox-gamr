const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { OpenRouter } = require("@openrouter/sdk");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// OPENROUTER INITIALIZATION
// ============================================================
const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const authMiddleware = (req, res, next) => {
    const authToken = req.headers['x-auth-token'] || req.headers['authorization'];
    next();
};

// ============================================================
// PUBLIC ROUTES
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// ============================================================
// PROTECTED ROUTES
// ============================================================
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'games.html'));
});

app.get('/ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

app.get('/graph', (req, res) => {
    res.sendFile(path.join(__dirname, 'graph.html'));
});

// ============================================================
// API ENDPOINT - AI CHAT
// ============================================================
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const completion = await openrouter.chat.send({
            model: "mistralai/mistral-7b-instruct:free",
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful gaming assistant for DVARY GAMES platform. You help users with game recommendations, gaming tips, and general gaming queries.'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            session_id: sessionId || "dvary-default-session"
        });

        let aiResponse = "Samahani, sijapata jibu.";
        
        if (typeof completion === 'string') {
            aiResponse = completion;
        } else if (completion.choices && completion.choices[0]) {
            aiResponse = completion.choices[0].message?.content || completion.choices[0].text;
        } else if (completion.content) {
            aiResponse = completion.content;
        } else {
            aiResponse = JSON.stringify(completion);
        }

        res.json({ response: aiResponse });
        
    } catch (error) {
        console.error('AI Chat Error:', error.message || error);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.message 
        });
    }
});

// ============================================================
// REDIRECT & FALLBACK ROUTES
// ============================================================
app.get('/redirect-to-main', (req, res) => {
    res.redirect('/main');
});

app.use((req, res) => {
    res.redirect('/main');
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
});

