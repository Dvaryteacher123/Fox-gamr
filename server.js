const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');
const router = require('./router');

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
// PAYMENT STORAGE (memory — kwa production tumia Firestore)
// ============================================================
const paymentStore = new Map();

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

// Static files
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
                    content: 'You are a helpful gaming assistant for DVARY GAMES platform. Answer clearly and helpfully.'
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

        const aiResponse = completion?.choices?.[0]?.message?.content || 'Samahani, sijapata jibu.';

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
            error: 'FIMIPAY_API_KEY haijawekwa kwenye Environment Variables.'
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
            gameName,
            channel,
            buyer_email,
            buyer_name
        } = req.body;

        // ---------- VALIDATION ----------
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

        if (numericAmount < 100) {
            return res.status(400).json({
                success: false,
                error: 'Kiasi cha chini ni TZS 100.'
            });
        }

        // ---------- FORMAT PHONE ----------
        let formattedPhone = String(buyer_phone)
            .trim()
            .replace(/\s+/g, '');

        if (formattedPhone.startsWith('+255')) {
            formattedPhone = formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('255')) {
            // tayari ipo sawa
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

        // ---------- API KEY ----------
        const fimipayKey = process.env.FIMIPAY_API_KEY;

        if (!fimipayKey) {
            return res.status(500).json({
                success: false,
                error: 'FimiPay API Key haipatikani kwenye Environment Variables.'
            });
        }

        const cleanFimipayKey = String(fimipayKey).trim();

        // ---------- TENGENEZA ORDER ID YETU ----------
        const internalOrderId = `DVARY-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        // ---------- TUMA KWA FIMIPAY ----------
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
                    channel: channel || 'mobile',
                    reference: internalOrderId
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

        // ---------- HANDLE SUCCESS ----------
        if (
            fimipayResponse.ok &&
            (paymentData.status === 'success' || paymentData.success === true)
        ) {
            const data = paymentData.data || {};
            const orderId = data.order_id || internalOrderId;

            // Hifadhi order kwenye memory
            paymentStore.set(orderId, {
                orderId: orderId,
                internalOrderId: internalOrderId,
                phone: formattedPhone,
                amount: numericAmount,
                gameId: gameId || null,
                gameName: gameName || null,
                buyerEmail: buyer_email || null,
                buyerName: buyer_name || null,
                status: 'pending',
                provider: 'fimipay',
                createdAt: new Date().toISOString()
            });

            console.log(`📦 Order stored: ${orderId} | ${formattedPhone} | TZS ${numericAmount} | game: ${gameId || 'N/A'}`);

            return res.json({
                success: true,
                message: paymentData.message || 'Payment request initiated',
                payment: {
                    order_id: orderId,
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

        // ---------- HANDLE ERROR ----------
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
// FIMIPAY CALLBACK / WEBHOOK
// FimiPay inatuma hapa baada ya malipo kukamilika
// ============================================================
app.post('/api/fimipay/callback', async (req, res) => {
    try {
        const data = req.body;
        console.log('📥 FimiPay callback:', JSON.stringify(data, null, 2));

        const orderId = data.order_id || data.reference || data.data?.order_id;
        const status = data.payment_status || data.status || data.data?.payment_status;
        const isSuccess = ['SUCCESS', 'COMPLETED', 'PAID', 'success'].includes(status);

        if (!orderId) {
            console.warn('⚠️ Callback haina order_id');
            return res.json({ success: true, message: 'No order_id' });
        }

        console.log(`📊 Callback: ${orderId} → ${status}`);

        const payment = paymentStore.get(orderId);

        if (payment) {
            payment.status = isSuccess ? 'success' : 'failed';
            payment.completedAt = new Date().toISOString();
            payment.callbackData = data;
            paymentStore.set(orderId, payment);

            if (isSuccess && payment.gameId) {
                console.log(`🎉 SUCCESS: Fungua game "${payment.gameName}" (${payment.gameId}) kwa ${payment.buyerEmail}`);
                // TODO: Firestore — fungua game kwa mtumiaji
                // await db.collection('users').doc(payment.userId)
                //     .collection('unlockedGames').doc(payment.gameId).set({...});
            } else if (!isSuccess) {
                console.log(`❌ FAILED: ${orderId}`);
            }
        } else {
            console.warn(`⚠️ Order haipo kwenye memory: ${orderId}`);
        }

        // FimiPay inahitaji 200 OK
        res.json({
            success: true,
            received: true,
            orderId,
            status
        });
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PAYMENT STATUS CHECK (frontend inaita hii)
// ============================================================
app.get('/api/payment-status/:orderId', (req, res) => {
    const { orderId } = req.params;
    const payment = paymentStore.get(orderId);

    if (!payment) {
        return res.status(404).json({
            success: false,
            error: 'Malipo hayakupatikana'
        });
    }

    res.json({
        success: true,
        payment: {
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            gameId: payment.gameId,
            gameName: payment.gameName,
            createdAt: payment.createdAt,
            completedAt: payment.completedAt
        }
    });
});

// ============================================================
// PAYMENT RESULT HELPER (redirect target)
// ============================================================
app.get('/api/payment-result', (req, res) => {
    const { order_id, status } = req.query;
    res.json({
        success: true,
        order_id: order_id || null,
        status: status || 'PENDING',
        message: status === 'PAID'
            ? 'Malipo yamethibitishwa.'
            : 'Malipo bado hayajathibitishwa.'
    });
});

// ============================================================
// LIST ALL PAYMENTS (kwa admin)
// ============================================================
app.get('/api/payments/list', (req, res) => {
    const all = Array.from(paymentStore.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100);

    res.json({
        success: true,
        total: all.length,
        payments: all
    });
});

// ============================================================
// API 404 — Lazima iwe BAADA ya API zote
// ============================================================
app.use('/api', (req, res) => {
    return res.status(404).json({
        success: false,
        error: 'API endpoint haipatikani.'
    });
});

// ============================================================
// WEBSITE FALLBACK — Lazima iwe MWISHO
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
    console.log(`FimiPay: ${process.env.FIMIPAY_API_KEY
        ? (process.env.FIMIPAY_API_KEY.startsWith('sk_live_') ? '✅ LIVE' : '⚠️ TEST')
        : '❌ NOT CONFIGURED'}`);
    console.log(`OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'}`);
    console.log('==========================================');
    console.log('📌 Endpoints:');
    console.log('   GET  /api/health');
    console.log('   POST /api/ai-chat');
    console.log('   GET  /api/fimipay/check');
    console.log('   POST /api/pay-fimipay');
    console.log('   POST /api/fimipay/callback');
    console.log('   GET  /api/payment-status/:orderId');
    console.log('   GET  /api/payments/list');
    console.log('==========================================');
    console.log('');
});
