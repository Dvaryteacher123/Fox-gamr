const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');
const router = require('./router'); // Inaita faili letu la router

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// OPENROUTER / OPENAI
// ============================================================

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(express.json({
    limit: '1mb'
}));

// Zuia mafaili nyeti
app.use((req, res, next) => {
    const blockedPaths = [
        '/.env',
        '/package.json',
        '/config.json'
    ];

    if (
        blockedPaths.includes(req.path) ||
        req.path.startsWith('/.git')
    ) {
        return res.status(403).send('Access Denied');
    }

    next();
});

// Static files (Kusoma mafaili ya public kama CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// BASIC HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'DVARY GAMES server is running',
        time: new Date().toISOString()
    });
});

// ============================================================
// HTML ROUTES (Zinasimamiwa na router.js)
// ============================================================

app.use('/', router);

// ============================================================
// AI CHAT
// ============================================================

app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;

        console.log('AI request:', message);

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'OPENROUTER_API_KEY haijawekwa kwenye Environment Variables.'
            });
        }

        const completion = await openai.chat.completions.create({
            model: 'openrouter/auto',

            messages: [
                {
                    role: 'system',
                    content:
                        'You are a helpful gaming assistant for DVARY GAMES platform. Answer clearly and helpfully.'
                },
                {
                    role: 'user',
                    content: message
                }
            ],

            extra_headers: {
                'HTTP-Referer': 'https://dvary.space',
                'X-Title': 'DVARY GAMES'
            }
        });

        const aiResponse =
            completion?.choices?.[0]?.message?.content ||
            'Samahani, sijapata jibu.';

        return res.json({
            success: true,
            response: aiResponse
        });

    } catch (error) {
        console.error('AI Chat Error:', error);

        return res.status(500).json({
            success: false,
            error: 'Failed to get AI response'
        });
    }
});

// ============================================================
// FIMIPAY CONFIG CHECK
// ============================================================

app.get('/api/fimipay/check', (req, res) => {

    const key = process.env.FIMIPAY_API_KEY;

    if (!key) {
        return res.status(500).json({
            success: false,
            configured: false,
            error: 'FIMIPAY_API_KEY haijawekwa kwenye Render Environment Variables.'
        });
    }

    return res.json({
        success: true,
        configured: true,
        environment: key.startsWith('sk_live_')
            ? 'live'
            : key.startsWith('sk_test_')
                ? 'test'
                : 'unknown'
    });
});

// ============================================================
// CREATE FIMIPAY LIVE PAYMENT
// ============================================================

app.post('/api/pay-fimipay', async (req, res) => {

    try {

        let {
            buyer_phone,
            amount,
            gameId,
            channel,
            buyer_email,
            buyer_name
        } = req.body;

        if (!buyer_phone) {
            return res.status(400).json({
                success: false,
                error: 'Namba ya simu inahitajika.'
            });
        }

        if (!amount) {
            return res.status(400).json({
                success: false,
                error: 'Kiasi cha malipo kinahitajika.'
            });
        }

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Kiasi cha malipo si sahihi.'
            });
        }

        let formattedPhone = String(buyer_phone)
            .trim()
            .replace(/\s+/g, '');

        if (formattedPhone.startsWith('+255')) {
            formattedPhone = formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('255')) {
            // Tayari ipo sawa
        } else if (formattedPhone.startsWith('0')) {
            formattedPhone = '255' + formattedPhone.substring(1);
        } else {
            formattedPhone = '255' + formattedPhone;
        }

        if (!/^255\d{9}$/.test(formattedPhone)) {
            return res.status(400).json({
                success: false,
                error: 'Namba ya simu si sahihi. Tumia mfano 255682812345.'
            });
        }

        const fimipayKey = process.env.FIMIPAY_API_KEY;

        if (!fimipayKey) {
            return res.status(500).json({
                success: false,
                error: 'FimiPay API Key haipatikani kwenye Environment Variables.'
            });
        }

        const cleanFimipayKey = String(fimipayKey).trim();

        const fimipayResponse = await fetch(
            'https://fimipay.com/api/v1/collections',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${cleanFimipayKey}`
                },
                body: JSON.stringify({
                    buyer_email: buyer_email || 'mteja@dvary.space',
                    buyer_name: buyer_name || 'DVARY Gamer',
                    buyer_phone: formattedPhone,
                    amount: numericAmount,
                    currency: 'TZS',
                    payment_method: 'mobile',
                    channel: channel || 'mobile'
                })
            }
        );

        const responseText = await fimipayResponse.text();
        let paymentData;

        try {
            paymentData = JSON.parse(responseText);
        } catch (parseError) {
            return res.status(502).json({
                success: false,
                error: 'FimiPay imerudisha majibu ambayo si JSON.',
                raw: responseText.substring(0, 500)
            });
        }

        if (
            fimipayResponse.ok &&
            (paymentData.status === 'success' || paymentData.success === true)
        ) {
            const data = paymentData.data || {};
            return res.json({
                success: true,
                message: paymentData.message || 'Payment request initiated',
                payment: {
                    order_id: data.order_id || null,
                    payment_status: data.payment_status || 'PENDING',
                    payment_method: data.payment_method || 'mobile',
                    channel: data.channel || channel || 'mobile',
                    amount: data.amount || numericAmount,
                    currency: data.currency || 'TZS',
                    buyer_phone: data.buyer_phone || formattedPhone,
                    simulated: data.simulated ?? false
                },
                data: data,
                payment_confirmed: false
            });
        }

        const exactError =
            paymentData.message ||
            paymentData.error ||
            paymentData.detail ||
            'FimiPay payment request failed.';

        return res.status(
            fimipayResponse.status >= 400 ? fimipayResponse.status : 400
        ).json({
            success: false,
            error: `FimiPay: ${exactError}`,
            data: paymentData
        });

    } catch (error) {
        console.error('FimiPay Server Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Hitilafu ya server wakati wa kutuma malipo.',
            details: error.message
        });
    }
});

// ============================================================
// PAYMENT RESULT HELPER
// ============================================================

app.get('/api/payment-result', (req, res) => {
    const { order_id, status } = req.query;
    res.json({
        success: true,
        order_id: order_id || null,
        status: status || 'PENDING',
        message: status === 'PAID' ? 'Malipo yamethibitishwa.' : 'Malipo bado hayajathibitishwa.'
    });
});

// ============================================================
// API 404
// ============================================================

app.use('/api', (req, res) => {
    return res.status(404).json({
        success: false,
        error: 'API endpoint haipatikani.'
    });
});

// ============================================================
// WEBSITE FALLBACK
// ============================================================

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// ============================================================
// SERVER
// ============================================================

app.listen(PORT, () => {
    console.log('');
    console.log('==========================================');
    console.log('🚀 DVARY GAMES SERVER');
    console.log('==========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log('==========================================');
    console.log('');
});

