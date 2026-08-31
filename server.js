const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================================
// ROUTES - HTML PAGES
// ============================================================

// Landing Page (ya kwanza)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Main Website
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// About Page
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

// Community Chat Page
app.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

// Games Page
app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'games.html'));
});

// AI Chat Page
app.get('/ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai.html'));
});

// Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Sign Up Page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// Admin Panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Profile Page
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

// Settings Page
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

// ============================================================
// API ENDPOINT - AI CHAT
// ============================================================
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'mistralai/mistral-7b-instruct:free',
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
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'DVARY GAMES'
                }
            }
        );

        const aiResponse = response.data.choices[0].message.content;
        res.json({ response: aiResponse });
        
    } catch (error) {
        console.error('AI Chat Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.response?.data || error.message
        });
    }
});

// ============================================================
// FALLBACK ROUTE - 404
// ============================================================
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
    console.log(`📌 =============================================`);
    console.log(`📍 Landing Page:   http://localhost:${PORT}/`);
    console.log(`📍 Main Website:   http://localhost:${PORT}/main`);
    console.log(`📍 About Page:     http://localhost:${PORT}/about`);
    console.log(`📍 Community Chat: http://localhost:${PORT}/community`);
    console.log(`📍 Games Page:     http://localhost:${PORT}/games`);
    console.log(`📍 AI Chat:        http://localhost:${PORT}/ai`);
    console.log(`📍 Login:          http://localhost:${PORT}/login`);
    console.log(`📍 Sign Up:        http://localhost:${PORT}/signup`);
    console.log(`📍 Admin Panel:    http://localhost:${PORT}/admin`);
    console.log(`📍 Profile:        http://localhost:${PORT}/profile`);
    console.log(`📍 Settings:       http://localhost:${PORT}/settings`);
    console.log(`📌 =============================================`);
    console.log(`🤖 AI API Endpoint: http://localhost:${PORT}/api/ai-chat`);
});
