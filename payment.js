// ============================================================
// payment.js — FimiPay Integration (PRODUCTION / LIVE)
// Kampuni: FimiPay
// Mode:   LIVE (pesa halisi)
// ============================================================

const express = require('express');
const axios = require('axios');
const router = express.Router();

// ============================================================
// CONFIG
// ============================================================
const FIMIPAY_SECRET = process.env.FIMIPAY_SECRET_KEY;
const FIMIPAY_BASE_URL = process.env.FIMIPAY_BASE_URL || 'https://fimipay.com/api/v1';
const FIMIPAY_CALLBACK_URL = process.env.FIMIPAY_CALLBACK_URL;

// Validation ya config mara moja wakati server inaanza
if (!FIMIPAY_SECRET) {
    console.error('❌ FIMIPAY_SECRET_KEY haipo kwenye .env — malipo hayatofanya kazi!');
}
if (FIMIPAY_SECRET && !FIMIPAY_SECRET.startsWith('sk_live_')) {
    console.warn('⚠️  Secret key haianzi na sk_live_ — huenda unatumia TEST mode');
}
if (!FIMIPAY_CALLBACK_URL) {
    console.warn('⚠️  FIMIPAY_CALLBACK_URL haipo — callbacks hazitafika');
}

// ============================================================
// STORAGE (memory — kwa production tumia Firestore)
// TODO: Badilisha kuwa Firestore
// ============================================================
const payments = new Map();

// ============================================================
// HELPERS
// ============================================================
function formatPhone(phone) {
    return String(phone)
        .replace(/\s+/g, '')
        .replace(/^\+/, '')
        .replace(/^0/, '255');
}

function generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `DVARY-${timestamp}-${random}`;
}

function getHeaders() {
    return {
        'Authorization': `Bearer ${FIMIPAY_SECRET}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

// ============================================================
// Tuma ombi kwa FimiPay
// ============================================================
async function createFimiPayOrder({ phone, amount, orderId, gameName }) {
    const payload = {
        buyer_phone: formatPhone(phone),
        amount: Number(amount),
        currency: 'TZS',
        payment_method: 'mobile',
        reference: orderId,
        description: `DVARY GAMES - ${gameName || 'Purchase'}`,
        callback_url: FIMIPAY_CALLBACK_URL
    };

    console.log('📤 FimiPay request:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
        `${FIMIPAY_BASE_URL}/create_order`,
        payload,
        { headers: getHeaders(), timeout: 30000 }
    );

    return response.data;
}

// ============================================================
// ROUTES
// ============================================================

// ---------- HEALTH CHECK ----------
router.get('/status', (req, res) => {
    res.json({
        success: true,
        provider: 'FimiPay',
        mode: FIMIPAY_SECRET?.startsWith('sk_live_') ? 'LIVE' : 
              FIMIPAY_SECRET?.startsWith('sk_test_') ? 'TEST' : 'NOT_CONFIGURED',
        baseUrl: FIMIPAY_BASE_URL,
        callbackConfigured: !!FIMIPAY_CALLBACK_URL,
        activePayments: payments.size,
        timestamp: new Date().toISOString()
    });
});

// ---------- INITIATE PAYMENT ----------
router.post('/initiate', async (req, res) => {
    try {
        const { phone, amount, gameId, gameName, userId, userEmail } = req.body;

        // Validation
        if (!phone || !amount || !gameId) {
            return res.status(400).json({
                success: false,
                error: 'phone, amount, na gameId zinahitajika'
            });
        }

        const amountNum = Number(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Kiasi lazima kiwe namba zaidi ya 0'
            });
        }

        if (amountNum < 100) {
            return res.status(400).json({
                success: false,
                error: 'Kiasi cha chini ni TZS 100'
            });
        }

        if (formatPhone(phone).length !== 12) {
            return res.status(400).json({
                success: false,
                error: 'Namba ya simu si sahihi (mfano: 0712345678)'
            });
        }

        if (!FIMIPAY_SECRET) {
            return res.status(500).json({
                success: false,
                error: 'Malipo hayapangiliwa. Wasiliana na admin.'
            });
        }

        // Tengeneza order ID yetu
        const orderId = generateOrderId();

        // Tuma kwa FimiPay
        const fimipayRes = await createFimiPayOrder({
            phone,
            amount: amountNum,
            orderId,
            gameName
        });

        console.log('📥 FimiPay response:', JSON.stringify(fimipayRes, null, 2));

        if (fimipayRes.status !== 'success') {
            return res.status(400).json({
                success: false,
                error: fimipayRes.message || 'FimiPay imekataa ombi'
            });
        }

        // Hifadhi order yetu
        const payment = {
            orderId,
            fimipayOrderId: fimipayRes.data?.order_id,
            phone: formatPhone(phone),
            amount: amountNum,
            gameId,
            gameName,
            userId,
            userEmail,
            status: 'pending',
            provider: 'fimipay',
            createdAt: new Date().toISOString()
        };
        payments.set(orderId, payment);

        // TODO: Hifadhi Firestore
        // await db.collection('payments').doc(orderId).set(payment);

        console.log(`✅ Order imetengenezwa: ${orderId} | ${formatPhone(phone)} | TZS ${amountNum}`);

        res.json({
            success: true,
            message: 'Angalia simu yako ili kuthibitisha malipo',
            orderId,
            fimipayOrderId: fimipayRes.data?.order_id,
            status: fimipayRes.data?.payment_status || 'PENDING'
        });

    } catch (error) {
        console.error('❌ FimiPay error:', error.response?.data || error.message);

        const errMsg = error.response?.data?.message
            || error.response?.data?.error
            || error.message
            || 'Hitilafu wakati wa kutuma malipo';

        res.status(error.response?.status || 500).json({
            success: false,
            error: errMsg
        });
    }
});

// ---------- CHECK STATUS ----------
router.get('/status/:orderId', (req, res) => {
    const payment = payments.get(req.params.orderId);

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
            gameName: payment.gameName,
            createdAt: payment.createdAt,
            completedAt: payment.completedAt
        }
    });
});

// ---------- WEBHOOK kutoka FimiPay ----------
router.post('/callback', async (req, res) => {
    try {
        const data = req.body;
        console.log('📥 FimiPay callback:', JSON.stringify(data, null, 2));

        // Extract
        const orderId = data.order_id || data.reference || data.data?.order_id;
        const fimipayStatus = data.payment_status || data.status || data.data?.payment_status;
        const isSuccess = ['SUCCESS', 'COMPLETED', 'PAID', 'success'].includes(fimipayStatus);

        if (!orderId) {
            console.warn('⚠️ Callback haina order_id');
            return res.json({ success: true, message: 'No order_id' });
        }

        console.log(`📊 Callback: ${orderId} → ${fimipayStatus}`);

        const payment = payments.get(orderId);

        if (payment) {
            // Sasisha
            payment.status = isSuccess ? 'success' : 'failed';
            payment.fimipayStatus = fimipayStatus;
            payment.callbackData = data;
            payment.completedAt = new Date().toISOString();
            payments.set(orderId, payment);

            // TODO: Sasisha Firestore
            // await db.collection('payments').doc(orderId).update({...});

            if (isSuccess && payment.userId && payment.gameId) {
                console.log(`🎉 SUCCESS: Fungua game "${payment.gameName}" kwa ${payment.userEmail}`);

                // TODO: Fungua game kwa mtumiaji
                // await db.collection('users').doc(payment.userId)
                //     .collection('unlockedGames').doc(payment.gameId)
                //     .set({
                //         unlocked: true,
                //         gameId: payment.gameId,
                //         gameName: payment.gameName,
                //         paymentOrderId: orderId,
                //         amount: payment.amount,
                //         unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
                //     });

                // TODO: Tuma notification
                // await db.collection('notifications').add({
                //     title: '🎉 Malipo Yamefanikiwa!',
                //     message: `Umefungua "${payment.gameName}" kwa TZS ${payment.amount}. Asante!`,
                //     icon: '🎉',
                //     read: false,
                //     userId: payment.userId,
                //     createdAt: firebase.firestore.FieldValue.serverTimestamp()
                // });
            } else if (!isSuccess) {
                console.log(`❌ FAILED: ${orderId}`);
            }
        } else {
            console.warn(`⚠️ Payment haipo kwenye memory: ${orderId}`);
        }

        // Lazima urudishe 200 OK
        res.json({
            success: true,
            received: true,
            orderId,
            status: fimipayStatus
        });

    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---------- LIST PAYMENTS (kwa admin) ----------
router.get('/list', (req, res) => {
    const allPayments = Array.from(payments.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100);

    res.json({
        success: true,
        total: allPayments.length,
        payments: allPayments
    });
});

// ============================================================
// EXPORT
// ============================================================
module.exports = router;
