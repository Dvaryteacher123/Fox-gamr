const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Kinga: Zuia watu wasisome mafaili nyeti au folda ya .git kupitia mtandao
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
// ROUTES (HTML PAGES)
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
app.get('/refund', (req, res) => res.sendFile(path.join(__dirname, 'refund.html')));

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

// ============================================================
// API ENDPOINT - FIMIPAY PAYMENT (TEST/LIVE)
// ============================================================
app.post('/api/pay-fimipay', async (req, res) => {
    try {
        const { buyer_email, buyer_phone, amount, gameId } = req.body;

        if (!buyer_email || !buyer_phone || !amount) {
            return res.status(400).json({ success: false, error: 'Taarifa za malipo hazijakamilika.' });
        }

        // Hakikisha ufunguo unasomeka vizuri
        const apiKey = process.env.FIMIPAY_SECRET_KEY;
        if (!apiKey) {
            console.error("FimiPay Error: FIMIPAY_SECRET_KEY haijapatikana kwenye .env");
            return res.status(500).json({ success: false, error: 'Ufunguo wa FimiPay haujasanifiwa kwenye seva.' });
        }

        const fimipayResponse = await fetch('https://api.fimipay.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                buyer_email: buyer_email,
                buyer_name: "DVARY Customer",
                buyer_phone: buyer_phone,
                amount: amount,
                currency: "TZS",
                payment_method: "mobile",
                channel: "mobile",
                test_outcome: "success"
            })
        });

        const paymentData = await fimipayResponse.json();
        console.log("Majibu ya FimiPay:", paymentData);

        if (fimipayResponse.ok && paymentData.status === "success") {
            res.json({
                success: true,
                message: "Ombi la malipo limerekodiwa.",
                data: paymentData.data
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: paymentData.message || paymentData.error || 'Imeshindikana kuchakata malipo na FimiPay.' 
            });
        }

    } catch (error) {
        console.error('FimiPay Server Catch Error:', error);
        // Hapa inatuma kosa halisi lililotokea ili likusaidie kuona tatizo kwenye skrini
        res.status(500).json({ success: false, error: 'Hitilafu ya seva: ' + error.message });
    }
});

app.use((req, res) => res.redirect('/main'));

app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
});

