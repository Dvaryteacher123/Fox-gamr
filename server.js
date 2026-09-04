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
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
});

// ============================================================
// API ENDPOINT - FIMIPAY PAYMENT (TEST/LIVE) - KULINGANA NA DOCS
// ============================================================
app.post('/api/pay-fimipay', async (req, res) => {
    try {
        const { buyer_email, buyer_phone, amount, gameId } = req.body;

        if (!buyer_email || !buyer_phone || !amount) {
            return res.status(400).json({ success: false, error: 'Taarifa za malipo hazijakamilika.' });
        }

        const apiKey = process.env.FIMIPAY_SECRET_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: 'Ufunguo wa FimiPay haujapatikana kwenye seva (.env).' });
        }

        // Tumetumia Base URL sahihi kulingana na docs zao: https://fimipay.com/api/v1/payments
        const fimipayResponse = await fetch('https://fimipay.com/api/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                buyer_email: buyer_email,
                buyer_name: "DVARY Customer",
                buyer_phone: buyer_phone,
                amount: Number(amount),
                currency: "TZS",
                payment_method: "mobile",
                test_outcome: "success" // Inaruhusiwa kwenye test keys kuiga mafanikio
            })
        });

        const paymentData = await fimipayResponse.json();
        console.log("Majibu ya FimiPay:", paymentData);

        // Kulingana na docs, FimiPay ikifanikiwa inarudisha status: "success"
        if (paymentData.status === "success") {
            res.json({
                success: true,
                message: paymentData.message || "Malipo yamefanikiwa.",
                data: paymentData.data
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: paymentData.message || 'Imeshindikana kuchakata malipo.' 
            });
        }

    } catch (error) {
        console.error('FimiPay Server Error:', error);
        res.status(500).json({ success: false, error: 'Hitilafu ya mtandao na FimiPay: ' + error.message });
    }
});

// ============================================================
// ERROR HANDLING FOR APIS & FALLBACKS (ILI KUZUIA HTML RESPONSES Kwenye API)
// ============================================================
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint haipatikani.' });
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'main.html')));

app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
});

