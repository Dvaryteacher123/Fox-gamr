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
// API ENDPOINT - HARAKAPAY PAYMENT 
// ============================================================
app.post('/api/pay-harakapay', async (req, res) => {
    try {
        let { buyer_phone, amount, gameId } = req.body;

        if (!buyer_phone || !amount) {
            return res.status(400).json({ success: false, error: 'Taarifa za malipo hazijakamilika (namba ya simu na kiasi zinahitajika).' });
        }

        // Kusafisha namba ya simu ianze na 0 (kama inavyotakiwa na mfumo)
        let formattedPhone = String(buyer_phone).trim();
        if (formattedPhone.startsWith('+255')) {
            formattedPhone = '0' + formattedPhone.substring(4);
        } else if (formattedPhone.startsWith('255')) {
            formattedPhone = '0' + formattedPhone.substring(3);
        } else if (!formattedPhone.startsWith('0')) {
            formattedPhone = '0' + formattedPhone;
        }

        const apiKey = process.env.HARAKAPAY_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: 'Ufunguo wa HarakaPay (API Key) haujapatikana kwenye faili la .env.' });
        }

        console.lgu ? null : console.log(`Inatuma ombi la malipo HarakaPay kwenda namba: ${formattedPhone} kwa kiasi cha: ${amount}`);

        // Ombi kwenda HarakaPay API kulingana na docs zao rasmi
        const harakaResponse = await fetch('https://harakapay.net/api/v1/collect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                phone: formattedPhone,
                amount: Number(amount),
                description: `DVARY Games Payment - ID: ${gameId || 'General'}`
            })
        });

        const responseText = await harakaResponse.text();
        let paymentData;
        
        try {
            paymentData = JSON.parse(responseText);
        } catch (e) {
            console.error("HarakaPay imerudisha HTML badala ya JSON:", responseText);
            return res.status(500).json({ 
                success: false, 
                error: 'API ya HarakaPay haipatikani au imerudisha majibu yasiyo sahihi.' 
            });
        }

        console.log("Majibu kamili ya HarakaPay:", paymentData);

        if (paymentData.success === true) {
            res.json({
                success: true,
                message: paymentData.message || "USSD push imetumwa kwenye simu.",
                order_id: paymentData.order_id,
                data: paymentData
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: paymentData.message || 'Malipo yameshindikana kuchakatwa na HarakaPay.' 
            });
        }

    } catch (error) {
        console.error('HarakaPay Server Error:', error);
        res.status(500).json({ success: false, error: 'Hitilafu ya mtandao na HarakaPay: ' + error.message });
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

