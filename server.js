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
app.get('/upgetrewards', (req, res) => res.sendFile(path.join(__dirname, 'upgetrewards.html')));

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
                "HTTP-Referer": "https://dvary.space",
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
// API ENDPOINT - FIMIPAY LIVE PAYMENT (Kulingana na Nyaraka)
// ============================================================
app.post('/api/pay-fimipay', async (req, res) => {
    try {
        let { buyer_phone, amount, gameId, channel } = req.body;

        if (!buyer_phone || !amount) {
            return res.status(400).json({ success: false, error: 'Taarifa za malipo hazijakamilika.' });
        }

        let formattedPhone = String(buyer_phone).trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '255' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('+255')) {
            formattedPhone = formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('255')) {
            formattedPhone = '255' + formattedPhone;
        }

        const fimipayKey = process.env.FIMIPAY_API_KEY;

        if (!fimipayKey) {
            return res.status(500).json({ success: false, error: 'FimiPay Live API Key haipatikani kwenye Render Environment Variables.' });
        }

        console.log(`Inatuma ombi la LIVE la FimiPay kwenda namba: ${formattedPhone} kwa kiasi: ${amount}`);

        // Kutumia URL rasmi ya FimiPay kulingana na documentation
        const fimiResponse = await fetch('https://fimipay.com/api/v1/collections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${fimipayKey}`
            },
            body: JSON.stringify({
                buyer_email: "mteja@dvary.space",
                buyer_name: "DVARY Gamer",
                buyer_phone: formattedPhone,
                amount: Number(amount),
                currency: "TZS",
                payment_method: "mobile",
                channel: channel || "mobile"
            })
        });

        const responseText = await fimiResponse.text();
        let paymentData;
        
        try {
            paymentData = JSON.parse(responseText);
        } catch (e) {
            console.error("FimiPay imerudisha majibu yasiyo ya JSON:", responseText);
            return res.status(500).json({ success: false, error: 'Hitilafu: Seva ya FimiPay haijajibu kwa mfumo wa JSON.' });
        }

        console.log("Majibu ya FimiPay Live:", paymentData);

        if (fimiResponse.ok && (paymentData.status === 'success' || paymentData.success)) {
            res.json({
                success: true,
                message: paymentData.message || "Ombi la malipo limetumwa kwenye simu ya mteja.",
                data: paymentData.data
            });
        } else {
            console.error("FimiPay Live Error Details:", paymentData);
            const exactError = paymentData.message || paymentData.error || JSON.stringify(paymentData);
            res.status(400).json({ 
                success: false, 
                error: `FimiPay: ${exactError}` 
            });
        }

    } catch (error) {
        console.error('FimiPay Live Server Error:', error);
        res.status(500).json({ success: false, error: 'Hitilafu ya mtandao: ' + error.message });
    }
});

// ============================================================
// ERROR HANDLING FOR APIS & FALLBACKS
// ============================================================
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint haipatikani.' });
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'main.html')));

app.listen(PORT, () => {
    console.log(`🚀 DVARY GAMES server running on http://localhost:${PORT}`);
});

