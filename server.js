const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');
const admin = require('firebase-admin'); // Ongeza hii kama unatumia Firebase Admin kwenye backend

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Anzisha Firebase Admin (Hakikisha unaweka mafaili ya credential au environment variables)
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });
// const db = admin.firestore();

// Initialize OpenAI client configured for OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    if (
        req.path === '/.env' || 
        req.path === '/package.json' || 
        req.path === '/config.json' || 
        req.path.startsWith('/.git')
    ) {
        return res.status(403).send('Access Denied');
    }
    next();
});

app.use(express.static(__dirname));

// ============================================================
// ROUTES
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/main', (req, res) => res.sendFile(path.join(__dirname, 'main.html')));
app.get('/games', (req, res) => res.sendFile(path.join(__dirname, 'games.html')));
app.get('/ai', (req, res) => res.sendFile(path.join(__dirname, 'ai.html')));
app.get('/community', (req, res) => res.sendFile(path.join(__dirname, 'community.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/graph', (req, res) => res.sendFile(path.join(__dirname, 'graph.html')));

// ============================================================
// API ENDPOINT - FETCH GAMES FROM FIRESTORE
// ============================================================
app.get('/api/games', async (req, res) => {
    try {
        const snapshot = await db.collection('games').get();
        let games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// API ENDPOINT - AI CHAT
// ============================================================
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log("Ombi la chat limepokelewa:", message);
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const completion = await openai.chat.completions.create({
            model: "openrouter/auto",
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful gaming assistant for DVARY GAMES platform.'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            extra_headers: {
                "HTTP-Referer": "https://fox-gamr.onrender.com",
                "X-Title": "DVARY GAMES"
            }
        });

        const aiResponse = completion.choices[0].message.content;
        res.json({ response: aiResponse });
        
    } catch (error) {
        console.error('AI Chat Error Kinaeleweka:', error.error || error.message || error);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.message || 'Unknown error'
        });
    }
});

app.use((req, res) => res.redirect('/main'));

app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
});
