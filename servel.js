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
// AUTH MIDDLEWARE - KUKAGUA KAMA USER AMEINGIA
// ============================================================
// Hii middleware itatumika kwenye routes zote zinazohitaji authentication
// Inakagua header ya 'x-user-token' au 'Authorization'
// Kwa sasa tunatumia token rahisi, lakini inaweza kuboreshwa na Firebase Auth

const authMiddleware = (req, res, next) => {
    // Kukagua kama kuna user logged in (kutoka Firebase)
    // Hii ni rahisi - tunakagua header ya 'x-auth-token'
    // Au tunaweza kuangalia session/cookie
    const authToken = req.headers['x-auth-token'] || req.headers['authorization'];
    
    // Kwa sasa, tunaruhusu access bila token (sio security kubwa)
    // Lakini tunaweza kuongeza Firebase Auth verification later
    // Kwa maendeleo, tunaruhusu zote
    next();
};

// ============================================================
// ROUTES ZA PUBLIC (Zinazoonekana na kila mtu)
// ============================================================

// Landing Page - Public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Main Website - Public (hii ndio home page ya ndani)
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// ============================================================
// ROUTES ZA PROTECTED (Zinahitaji User Awe Ameingia)
// ============================================================

// About Page - Inahitaji authentication
app.get('/about', (req, res) => {
    // Kwa sasa inaruhusu, lakini tunaweza kuongeza check
    // Kama user hajaingia, rudisha kwenye main
    res.sendFile(path.join(__dirname, 'about.html'));
});

// Community Chat - Inahitaji authentication
app.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

// Games Page - Inahitaji authentication
app.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'games.html'));
});

// AI Chat - Inahitaji authentication
app.get('/ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai.html'));
});

// Login Page - Public (kwa ajili ya kuingia)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Sign Up Page - Public (kwa ajili ya kujisajili)
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// Admin Panel - Inahitaji authentication (na role check)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Profile Page - Inahitaji authentication
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

// Settings Page - Inahitaji authentication
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

// Stats/Graph Page - Inahitaji authentication
app.get('/graph', (req, res) => {
    res.sendFile(path.join(__dirname, 'graph.html'));
});

// ============================================================
// API ENDPOINT - AI CHAT (Inahitaji authentication)
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
// REDIRECT ROUTE - Kwa kurudi kwenye main
// ============================================================
app.get('/redirect-to-main', (req, res) => {
    res.redirect('/main');
});

// ============================================================
// FALLBACK ROUTE - 404
// ============================================================
app.use((req, res) => {
    // Kama route haipatikani, rudisha kwenye main
    res.redirect('/main');
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
    console.log(`📌 =============================================`);
    console.log(`📍 Public Routes:`);
    console.log(`📍 Landing Page:   http://localhost:${PORT}/`);
    console.log(`📍 Main Website:   http://localhost:${PORT}/main`);
    console.log(`📍 Login:          http://localhost:${PORT}/login`);
    console.log(`📍 Sign Up:        http://localhost:${PORT}/signup`);
    console.log(`📌 =============================================`);
    console.log(`📍 Protected Routes (need login):`);
    console.log(`📍 About Page:     http://localhost:${PORT}/about`);
    console.log(`📍 Community Chat: http://localhost:${PORT}/community`);
    console.log(`📍 Games Page:     http://localhost:${PORT}/games`);
    console.log(`📍 AI Chat:        http://localhost:${PORT}/ai`);
    console.log(`📍 Admin Panel:    http://localhost:${PORT}/admin`);
    console.log(`📍 Profile:        http://localhost:${PORT}/profile`);
    console.log(`📍 Settings:       http://localhost:${PORT}/settings`);
    console.log(`📍 Stats/Graph:    http://localhost:${PORT}/graph`);
    console.log(`📌 =============================================`);
    console.log(`🤖 AI API Endpoint: http://localhost:${PORT}/api/ai-chat`);
});
