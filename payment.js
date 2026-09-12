// ============================================================
// payment.js — FimiPay Integration (faili moja)
// Kampuni: FimiPay (https://fimipay.com)
// Inashughulikia: Malipo + Callbacks + Status
// ============================================================

const express = require('express');
const axios = require('axios');
const router = express.Router();

// ============================================================
// CONFIG — kutoka .env
// ============================================================
const FIMIPAY_SECRET = process.env.FIMIPAY_SECRET_KEY;   // sk_live_... au sk_test_...
const FIMIPAY_BASE_URL = process.env.FIMIPAY_BASE_URL || 'https://fimipay.com/api/v1';
const FIMIPAY_CALLBACK_URL = process.env.FIMIPAY_CALLBACK_URL;

// ============================================================
// HELPERS
// ============================================================

/**
 * Format namba ya simu: 0712345678 → 255712345678
 */
function formatPhone(phone) {
    return phone
        .replace(/\s+/g, '')
        .replace(/^\+/, '')
        .replace(/^0/, '255');
}

/**
 * Tengeneza order ID yetu (ya kufuatilia)
 */
function generateOrderId() {
    return `DVARY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Headers za FimiPay API
 */
function getHeaders() {
    return {
        'Authorization': `Bearer ${FIMIPAY_SECRET}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

// ============================================================
// CORE: Tuma ombi la malipo kwa FimiPay
// ============================================================
async function createFimiPayOrder({ phone, amount, orderId, gameName, currency = 'TZS' }) {
    const payload = {
        buyer_phone: formatPhone(phone),
        amount: Number(amount),
        currency: currency,
        payment_method: 'mobile',
        reference: orderId,
        description: `DVARY GAMES - ${gameName || 'Purchase'}`,
        callback_url: FIMIPAY_CALLBACK_URL,
        // Kwa testing tu — ondoa kwenye production
        // test_outcome: 'success'
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
        baseUrl: FIMIPAY_BASE_URL,
        hasKey: !!FIMIPAY_SECRET,
        mode: FIMIPAY_SECRET?.startsWith('sk_live_') ? 'LIVE' :
              FIMIPAY_SECRET?.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN',
        timestamp: new Date().toISOString()
    });
});

// ---------- INITIATE PAYMENT ----------
// POST /payments/initiate
// Body: { phone, amount, gameId, gameName, userId, userEmail }
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
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Kiasi lazima kiwe zaidi ya 0'
            });
        }
        if (!FIMIPAY_SECRET) {
            return res.status(500).json({
                success: false,
                error: 'FimiPay secret key haipo kwenye .env'
            });
        }

        // Tengeneza order ID yetu
        const orderId = generateOrderId();

        // Tuma kwa FimiPay
        const fimipayRes = await createFimiPayOrder({
            phone,
            amount,
            orderId,
            gameName
        });

        console.log('📥 FimiPay response:', JSON.stringify(fimipayRes, null, 2));

        // Angalia kama FimiPay imekubali
        if (fimipayRes.status !== 'success') {
            return res.status(400).json({
                success: false,
                error: fimipayRes.message || 'FimiPay imekataa ombi'
            });
        }

        // Hifadhi order yetu (kwa sasa memory, unaweza kuweka Firestore)
        const paymentRecord = {
            orderId: orderId,
            fimipayOrderId: fimipayRes.data?.order_id,
            phone: formatPhone(phone),
            amount: Number(amount),
            gameId,
            gameName,
            userId,
            userEmail,
            status: 'pending',        // pending | success | failed
            provider: 'fimipay',
            fimipayResponse: fimipayRes.data,
            createdAt: new Date().toISOString()
        };

        // TODO: Hifadhi Firestore:
        // await db.collection('payments').doc(orderId).set(paymentRecord);

        console.log(`✅ Order imetengenezwa: ${orderId}`);

        res.json({
            success: true,
            message: 'Malipo yameanzishwa. Angalia simu yako kuthibitisha.',
            orderId: orderId,
            fimipayOrderId: fimipayRes.data?.order_id,
            status: fimipayRes.data?.payment_status || 'PENDING',
            simulated: fimipayRes.data?.simulated || false
        });

    } catch (error) {
        console.error('❌ FimiPay error:', error.response?.data || error.message);

        const errMsg = error.response?.data?.message
            || error.response?.data?.error
            || error.message
            || 'Hitilafu wakati wa kutuma malipo';

        res.status(error.response?.status || 500).json({
            success: false,
            error: errMsg,
            details: error.response?.data || null
        });
    }
});

// ---------- CHECK STATUS ----------
// GET /payments/status/:orderId
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // TODO: Chukua kutoka Firestore
        // const doc = await db.collection('payments').doc(orderId).get();
        // if (!doc.exists) return res.status(404).json({...});
        // const payment = doc.data();

        // Kwa sasa rudisha placeholder
        // Ukishapata endpoint ya FimiPay ya kuangalia status,
        // unaweza kuifanya hapa:
        // const response = await axios.get(
        //     `${FIMIPAY_BASE_URL}/orders/${orderId}`,
        //     { headers: getHeaders() }
        // );

        res.json({
            success: true,
            orderId,
            message: 'Angalia Firestore kwa status kamili',
            note: 'Ongeza code ya Firestore hapa'
        });

    } catch (error) {
        console.error('Status error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ---------- WEBHOOK / CALLBACK kutoka FimiPay ----------
// POST /payments/callback
// FimiPay inatuma hapa baada ya malipo kukamilika
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

        // TODO: Sasisha Firestore
        // const paymentRef = db.collection('payments').doc(orderId);
        // const paymentDoc = await paymentRef.get();
        //
        // if (paymentDoc.exists) {
        //     const payment = paymentDoc.data();
        //
        //     await paymentRef.update({
        //         status: isSuccess ? 'success' : 'failed',
        //         fimipayStatus: fimipayStatus,
        //         callbackData: data,
        //         completedAt: firebase.firestore.FieldValue.serverTimestamp()
        //     });
        //
        //     if (isSuccess && payment.userId && payment.gameId) {
        //         // Fungua game kwa mtumiaji
        //         await db.collection('users')
        //             .doc(payment.userId)
        //             .collection('unlockedGames')
        //             .doc(payment.gameId)
        //             .set({
        //                 unlocked: true,
        //                 gameId: payment.gameId,
        //                 gameName: payment.gameName,
        //                 paymentOrderId: orderId,
        //                 amount: payment.amount,
        //                 unlockedAt: firebase.firestore.FieldValue.serverTimestamp()
        //             });
        //
        //         // Tuma notification
        //         await db.collection('notifications').add({
        //             title: '🎉 Malipo Yamefanikiwa!',
        //             message: `Umefungua "${payment.gameName}" kwa TZS ${payment.amount}. Asante!`,
        //             icon: '🎉',
        //             read: false,
        //             userId: payment.userId,
        //             createdAt: firebase.firestore.FieldValue.serverTimestamp()
        //         });
        //     }
        // }

        // FimiPay inahitaji response 200 OK
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
// GET /payments/list
router.get('/list', async (req, res) => {
    try {
        // TODO: Chukua kutoka Firestore
        // const snapshot = await db.collection('payments')
        //     .orderBy('createdAt', 'desc').limit(100).get();
        // const payments = [];
        // snapshot.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));

        res.json({
            success: true,
            message: 'Ongeza code ya Firestore hapa',
            payments: []
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// EXPORT
// ============================================================
module.exports = router;
