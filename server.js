const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const router = require('./router');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// FIREBASE ADMIN INIT
// ============================================================
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
            })
        });
    }
    console.log('✅ Firebase Admin initialized');
} catch (error) {
    console.error('❌ Firebase Admin init error:', error.message);
}

const db = admin.firestore();
const paymentsCol = db.collection('payments');

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

// Hifadhi raw body kwa webhook signature verification
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({ extended: true }));

// Zuia mafaili nyeti
app.use((req, res, next) => {
    const blockedPaths = ['/.env', '/package.json', '/config.json'];
    if (blockedPaths.includes(req.path) || req.path.startsWith('/.git')) {
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
        firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
        fimipay: process.env.FIMIPAY_API_KEY ? 'configured' : 'not configured',
        time: new Date().toISOString()
    });
});

// ============================================================
// HTML ROUTES
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
            return res.status(400).json({ success: false, error: 'Message is required' });
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
                { role: 'system', content: 'You are a helpful gaming assistant for DVARY GAMES platform. Answer clearly and helpfully.' },
                { role: 'user', content: message }
            ],
            extra_headers: {
                'HTTP-Referer': 'https://dvary.space',
                'X-Title': 'DVARY GAMES'
            }
        });

        const aiResponse = completion?.choices?.[0]?.message?.content || 'Samahani, sijapata jibu.';
        return res.json({ success: true, response: aiResponse });

    } catch (error) {
        console.error('AI Chat Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to get AI response' });
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
        environment: key.startsWith('sk_live_') ? 'live'
            : key.startsWith('sk_test_') ? 'test'
            : 'unknown',
        webhookConfigured: !!process.env.FIMIPAY_WEBHOOK_SECRET,
        endpoint: 'https://fimipay.com/api/v1/create_order'
    });
});

// ============================================================
// HELPER: Verify FimiPay signature
// ============================================================
function verifyFimiPaySignature(rawBody, signature) {
    const secret = process.env.FIMIPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.warn('⚠️ FIMIPAY_WEBHOOK_SECRET haipo — kuruka verification');
        return true;
    }
    if (!signature) {
        return false;
    }
    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'hex'),
            Buffer.from(signature, 'hex')
        );
    } catch (e) {
        return false;
    }
}

// ============================================================
// CREATE FIMIPAY LIVE PAYMENT → SAVE TO FIRESTORE
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
            buyer_name,
            userId
        } = req.body;

        // ---------- VALIDATION ----------
        if (!buyer_phone) {
            return res.status(400).json({ success: false, error: 'Namba ya simu inahitajika.' });
        }
        if (!amount) {
            return res.status(400).json({ success: false, error: 'Kiasi cha malipo kinahitajika.' });
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Kiasi cha malipo si sahihi.' });
        }
        if (numericAmount < 100) {
            return res.status(400).json({ success: false, error: 'Kiasi cha chini ni TZS 100.' });
        }

        // ---------- FORMAT PHONE (255XXXXXXXXX) ----------
        let formattedPhone = String(buyer_phone).trim().replace(/\s+/g, '');
        if (formattedPhone.startsWith('+255')) {
            formattedPhone = formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('255')) {
            // tayari
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

        // ---------- TENGENEZA ORDER ID ----------
        const internalOrderId = `DVARY-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        // ---------- HIFADHI KWA FIRESTORE ----------
        await paymentsCol.doc(internalOrderId).set({
            orderId: internalOrderId,
            phone: formattedPhone,
            amount: numericAmount,
            currency: 'TZS',
            gameId: gameId || null,
            gameName: gameName || null,
            userId: userId || null,
            buyerEmail: buyer_email || null,
            buyerName: buyer_name || null,
            provider: 'fimipay',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`📦 Order imehifadhiwa Firestore: ${internalOrderId}`);

        // ---------- PAYLOAD KWA FIMIPAY ----------
        const fimipayPayload = {
            buyer_email: buyer_email || 'mteja@dvary.space',
            buyer_name: buyer_name || 'DVARY Gamer',
            buyer_phone: formattedPhone,
            amount: numericAmount,
            currency: 'TZS',
            payment_method: 'mobile',
            channel: channel || 'mobile'
        };

        // ---------- ENDPOINT SAHIHI: create_order ----------
        const FIMIPAY_URL = 'https://fimipay.com/api/v1/create_order';

        console.log('📤 FimiPay URL:', FIMIPAY_URL);
        console.log('📤 FimiPay payload:', JSON.stringify(fimipayPayload, null, 2));
        console.log('📤 FimiPay auth:', `Bearer ${cleanFimipayKey.substring(0, 15)}...`);

        const fimipayResponse = await fetch(FIMIPAY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${cleanFimipayKey}`
            },
            body: JSON.stringify(fimipayPayload)
        });

        console.log('📥 FimiPay HTTP status:', fimipayResponse.status);

        const responseText = await fimipayResponse.text();
        console.log('📥 FimiPay response body:', responseText);

        let paymentData;
        try {
            paymentData = JSON.parse(responseText);
        } catch (parseError) {
            await paymentsCol.doc(internalOrderId).update({
                status: 'error',
                error: 'FimiPay non-JSON response',
                rawResponse: responseText.substring(0, 500),
                httpStatus: fimipayResponse.status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(502).json({
                success: false,
                error: 'FimiPay imerudisha majibu ambayo si JSON.',
                raw: responseText.substring(0, 500),
                httpStatus: fimipayResponse.status
            });
        }

        // ---------- HANDLE SUCCESS ----------
        if (
            fimipayResponse.ok &&
            (paymentData.status === 'success' || paymentData.success === true)
        ) {
            const data = paymentData.data || {};
            const fimipayOrderId = data.order_id;

            await paymentsCol.doc(internalOrderId).update({
                fimipayOrderId: fimipayOrderId || null,
                fimipayStatus: data.payment_status || 'PENDING',
                fimipayChannel: data.channel || channel || 'mobile',
                fimipaySimulated: data.simulated ?? false,
                fimipayRawResponse: paymentData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Payment initiated: ${internalOrderId} | FimiPay: ${fimipayOrderId}`);

            return res.json({
                success: true,
                message: paymentData.message || 'Payment request initiated',
                payment: {
                    order_id: internalOrderId,
                    fimipay_order_id: fimipayOrderId || null,
                    payment_status: data.payment_status || 'PENDING',
                    payment_method: data.payment_method || 'mobile',
                    channel: data.channel || channel || 'mobile',
                    amount: data.amount || numericAmount,
                    currency: data.currency || 'TZS',
                    buyer_phone: data.buyer_phone || formattedPhone,
                    simulated: data.simulated ?? false
                },
                payment_confirmed: false
            });
        }

        // ---------- HANDLE ERROR ----------
        const exactError =
            paymentData.message ||
            paymentData.error ||
            paymentData.detail ||
            paymentData.error_message ||
            `FimiPay error (HTTP ${fimipayResponse.status})`;

        await paymentsCol.doc(internalOrderId).update({
            status: 'failed',
            error: exactError,
            httpStatus: fimipayResponse.status,
            fimipayResponse: paymentData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`❌ FimiPay error: ${exactError}`);

        return res.status(
            fimipayResponse.status >= 400 ? fimipayResponse.status : 400
        ).json({
            success: false,
            error: `FimiPay: ${exactError}`,
            httpStatus: fimipayResponse.status,
            data: paymentData
        });

    } catch (error) {
        console.error('❌ FimiPay Server Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Hitilafu ya server wakati wa kutuma malipo.',
            details: error.message
        });
    }
});

// ============================================================
// FIMIPAY CALLBACK / WEBHOOK
// ============================================================
app.post('/api/fimipay/callback', async (req, res) => {
    try {
        const signature = req.headers['x-fimipay-signature'];
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

        if (!verifyFimiPaySignature(rawBody, signature)) {
            console.error('❌ Webhook signature verification FAILED');
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }

        const data = req.body;
        console.log('📥 FimiPay callback (verified):', JSON.stringify(data, null, 2));

        const orderId = data.order_id || data.reference || data.data?.order_id;
        const fimipayStatus = data.payment_status || data.status || data.data?.payment_status;
        const isSuccess = ['SUCCESS', 'COMPLETED', 'PAID', 'success'].includes(fimipayStatus);

        if (!orderId) {
            console.warn('⚠️ Callback haina order_id');
            return res.json({ success: true, message: 'No order_id' });
        }

        console.log(`📊 Callback: ${orderId} → ${fimipayStatus}`);

        let doc = await paymentsCol.doc(orderId).get();

        if (!doc.exists) {
            const snap = await paymentsCol
                .where('fimipayOrderId', '==', orderId)
                .limit(1)
                .get();
            if (!snap.empty) doc = snap.docs[0];
        }

        if (!doc.exists) {
            console.warn(`⚠️ Order haipo Firestore: ${orderId}`);
            return res.json({ success: true, message: 'Order not found' });
        }

        const payment = doc.data();
        const docRef = doc.ref;

        await docRef.update({
            status: isSuccess ? 'success' : 'failed',
            fimipayStatus: fimipayStatus,
            callbackData: data,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Firestore updated: ${doc.id} → ${isSuccess ? 'success' : 'failed'}`);

        if (isSuccess && payment.userId && payment.gameId) {
            try {
                await db
                    .collection('users')
                    .doc(payment.userId)
                    .collection('unlockedGames')
                    .doc(payment.gameId)
                    .set({
                        unlocked: true,
                        gameId: payment.gameId,
                        gameName: payment.gameName || 'Unknown',
                        paymentOrderId: doc.id,
                        amount: payment.amount,
                        currency: payment.currency || 'TZS',
                        unlockedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                console.log(`🎉 Game unlocked for ${payment.userId}: ${payment.gameId}`);

                await db.collection('notifications').add({
                    title: '🎉 Malipo Yamefanikiwa!',
                    message: `Umefungua "${payment.gameName}" kwa TZS ${payment.amount}. Asante!`,
                    icon: '🎉',
                    read: false,
                    userId: payment.userId,
                    userEmail: payment.buyerEmail || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`🔔 Notification sent to ${payment.userId}`);
            } catch (unlockError) {
                console.error('❌ Error unlocking game:', unlockError.message);
            }
        }

        res.json({
            success: true,
            received: true,
            orderId: doc.id,
            status: fimipayStatus
        });

    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PAYMENT STATUS CHECK
// ============================================================
app.get('/api/payment-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const doc = await paymentsCol.doc(orderId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Malipo hayakupatikana'
            });
        }

        const p = doc.data();

        res.json({
            success: true,
            payment: {
                orderId: doc.id,
                status: p.status,
                amount: p.amount,
                currency: p.currency,
                gameId: p.gameId,
                gameName: p.gameName,
                createdAt: p.createdAt,
                completedAt: p.completedAt || null
            }
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ success: false, error: error.message });
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
        message: status === 'PAID'
            ? 'Malipo yamethibitishwa.'
            : 'Malipo bado hayajathibitishwa.'
    });
});

// ============================================================
// LIST ALL PAYMENTS (kwa admin)
// ============================================================
app.get('/api/payments/list', async (req, res) => {
    try {
        const snap = await paymentsCol
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const payments = [];
        snap.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));

        res.json({
            success: true,
            total: payments.length,
            payments
        });
    } catch (error) {
        console.error('List payments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
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
    console.log(`Domain: https://dvary.space`);
    console.log(`Firebase: ${admin.apps.length > 0 ? '✅ Connected' : '❌ Not connected'}`);
    console.log(`FimiPay: ${process.env.FIMIPAY_API_KEY
        ? (process.env.FIMIPAY_API_KEY.startsWith('sk_live_') ? '✅ LIVE' : '⚠️ TEST')
        : '❌ NOT CONFIGURED'}`);
    console.log(`Webhook Secret: ${process.env.FIMIPAY_WEBHOOK_SECRET ? '✅ Set' : '⚠️ NOT SET'}`);
    console.log(`OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'}`);
    console.log('==========================================');
    console.log('📌 FimiPay endpoint: https://fimipay.com/api/v1/create_order');
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
