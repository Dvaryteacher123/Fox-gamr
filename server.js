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
// API ENDPOINT - SPEEDPESA PAYMENT 
// ============================================================
app.post('/api/pay-speedpesa', async (req, res) => {
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

        const apiKey = process.env.SPEEDPESA_API_KEY;
        const apiSecret = process.env.SPEEDPESA_API_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(500).json({ success: false, error: 'API Key au Secret ya SpeedPesa haipatikani kwenye .env.' });
        }

        console.log(`Inatuma ombi la SpeedPesa kwenda namba: ${formattedPhone} kwa kiasi: ${amount}`);

        const speedPesaResponse = await fetch('https://sandbox.speedpesapro.com/api/v1/collections/ussd-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'X-API-Secret': apiSecret
            },
            body: JSON.stringify({
                msidn: formattedPhone,
                amount: Number(amount),
                currency: "TZS",
                channel: channel || "MPESA",
                reference: `DVARY-${gameId || Date.now()}`,
                callback_url: "https://dvary.space/api/webhook"
            })
        });

        const responseText = await speedPesaResponse.text();
        let paymentData;
        
        try {
            paymentData = JSON.parse(responseText);
        } catch (e) {
            console.error("SpeedPesa imerudisha majibu yasiyo ya JSON:", responseText);
            return res.status(500).json({ success: false, error: 'Hitilafu kutoka kwenye seva ya SpeedPesa.' });
        }

        console.log("Majibu ya SpeedPesa:", paymentData);

        if (speedPesaResponse.ok) {
            res.json({
                success: true,
                message: paymentData.message || "Ombi la malipo limetumwa kwenye simu.",
                data: paymentData
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: paymentData.message || 'Imeshindwa kuchakata malipo kupitia SpeedPesa.' 
            });
        }

    } catch (error) {
        console.error('SpeedPesa Server Error:', error);
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

