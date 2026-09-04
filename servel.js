const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');
const crypto = require('crypto');

// Firebase Admin SDK
const admin = require('firebase-admin');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================
let db;
try {
    // Check if we have service account in environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized with service account');
    } else {
        // Try default credentials (for local development)
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        console.log('✅ Firebase Admin initialized with default credentials');
    }
    db = admin.firestore();
    console.log('✅ Firestore database connected');
} catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.warn('⚠️ API Key features will not work without Firebase Admin');
    db = null;
}

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

// Kinga: Zuia watu wasisome mafaili nyeti
app.use((req, res, next) => {
    const blockedPaths = [
        '/.env',
        '/package.json',
        '/config.json',
        '/serviceAccountKey.json',
        '/.git',
        '/.env.local',
        '/.env.production'
    ];
    
    if (blockedPaths.some(path => req.path === path || req.path.startsWith('/.git'))) {
        return res.status(403).send('⛔ Access Denied');
    }
    next();
});

app.use(express.static(__dirname));

// ============================================================
// API KEY MIDDLEWARE
// ============================================================
async function validateAPIKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    // Public endpoints that don't require API Key
    const publicEndpoints = [
        '/api/request-key',
        '/api/key-info',
        '/api/revoke-key',
        '/api/ai-chat',
        '/api/pay-fimipay'
    ];
    
    if (publicEndpoints.includes(req.path)) {
        return next();
    }
    
    // Check if this is a /api/v1/* endpoint
    if (req.path.startsWith('/api/v1/')) {
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: '🔑 API Key required. Please provide x-api-key header.'
            });
        }
        
        // If Firebase Admin is not available, return error
        if (!db) {
            return res.status(503).json({
                success: false,
                error: 'Firebase Admin is not available. Please try again later.'
            });
        }
        
        try {
            const snapshot = await db.collection('api_keys')
                .where('key', '==', apiKey)
                .where('isActive', '==', true)
                .get();
            
            if (snapshot.empty) {
                return res.status(403).json({
                    success: false,
                    error: '❌ Invalid or inactive API Key'
                });
            }
            
            const doc = snapshot.docs[0];
            const data = doc.data();
            
            // Check if expired
            if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < new Date()) {
                return res.status(403).json({
                    success: false,
                    error: '⏳ API Key has expired. Please request a new one.'
                });
            }
            
            // Update usage count
            await db.collection('api_keys').doc(doc.id).update({
                usageCount: admin.firestore.FieldValue.increment(1),
                lastUsed: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Log API request
            await db.collection('api_requests').add({
                apiKey: apiKey,
                endpoint: req.path,
                method: req.method,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });
            
            req.apiKeyData = data;
            next();
        } catch (error) {
            console.error('API Key validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Server error validating API Key'
            });
        }
    } else {
        next();
    }
}

// Apply API Key validation middleware to all /api/v1 routes
app.use('/api/v1', validateAPIKey);

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
app.get('/api-request', (req, res) => res.sendFile(path.join(__dirname, 'api-request.html')));

// ============================================================
// API KEY ENDPOINTS
// ============================================================

// 1. REQUEST API KEY - Kwa wateja kuomba
app.post('/api/request-key', async (req, res) => {
    const { email, appName, description, allowedGames } = req.body;
    
    // Validate required fields
    if (!email || !appName) {
        return res.status(400).json({
            success: false,
            error: '📧 Email na 📱 Jina la App vinahitajika'
        });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: '📧 Barua pepe si sahihi'
        });
    }
    
    // Check if Firebase Admin is available
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available. Please try again later.'
        });
    }
    
    try {
        // Check if user already has an active key
        const existing = await db.collection('api_keys')
            .where('ownerEmail', '==', email)
            .where('isActive', '==', true)
            .get();
        
        if (!existing.empty) {
            const existingData = existing.docs[0].data();
            return res.status(400).json({
                success: false,
                error: '⚠️ Tayari una API Key inayofanya kazi',
                apiKey: existingData.key,
                message: `API Key yako: ${existingData.key}`
            });
        }
        
        // Generate new API Key
        const newKey = 'dvary_' + crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year
        
        // Save to Firestore
        await db.collection('api_keys').add({
            key: newKey,
            ownerEmail: email,
            appName: appName,
            description: description || '',
            allowedGames: allowedGames || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            isActive: true,
            usageCount: 0,
            lastUsed: null
        });
        
        // Send notification to admin
        await db.collection('notifications').add({
            title: '🔑 New API Key Request',
            message: `${email} requested an API Key for "${appName}"`,
            icon: '🔑',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            type: 'api_key_request',
            userEmail: email
        });
        
        console.log(`✅ API Key generated for ${email}: ${newKey}`);
        
        res.json({
            success: true,
            apiKey: newKey,
            message: '✅ API Key imeundwa kikamilifu! Ihifadhi salama.',
            expiresAt: expiresAt,
            appName: appName
        });
        
    } catch (error) {
        console.error('Error generating API Key:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kuunda API Key: ' + error.message
        });
    }
});

// 2. GET API KEY INFO - Kwa mteja kuangalia status
app.post('/api/key-info', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            error: '📧 Email inahitajika'
        });
    }
    
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('api_keys')
            .where('ownerEmail', '==', email)
            .get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                hasKey: false,
                message: 'Huna API Key yetu'
            });
        }
        
        const keys = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            keys.push({
                key: data.key,
                appName: data.appName,
                description: data.description || '',
                isActive: data.isActive,
                createdAt: data.createdAt?.toDate?.() || null,
                expiresAt: data.expiresAt?.toDate?.() || null,
                usageCount: data.usageCount || 0,
                allowedGames: data.allowedGames || []
            });
        });
        
        res.json({
            success: true,
            hasKey: true,
            keys: keys
        });
        
    } catch (error) {
        console.error('Error getting API Key info:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kupata taarifa: ' + error.message
        });
    }
});

// 3. REVOKE API KEY - Kwa mteja kufuta key yake
app.post('/api/revoke-key', async (req, res) => {
    const { email, apiKey } = req.body;
    
    if (!email || !apiKey) {
        return res.status(400).json({
            success: false,
            error: '📧 Email na 🔑 API Key zinahitajika'
        });
    }
    
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('api_keys')
            .where('key', '==', apiKey)
            .where('ownerEmail', '==', email)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                error: '🔑 API Key haipatikani'
            });
        }
        
        const doc = snapshot.docs[0];
        await db.collection('api_keys').doc(doc.id).update({
            isActive: false,
            revokedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ API Key revoked for ${email}: ${apiKey}`);
        
        res.json({
            success: true,
            message: '✅ API Key imefutwa kikamilifu'
        });
        
    } catch (error) {
        console.error('Error revoking API Key:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kufuta API Key: ' + error.message
        });
    }
});

// 4. REGENERATE API KEY - Kwa mteja kucreate key mpya
app.post('/api/regenerate-key', async (req, res) => {
    const { email, oldApiKey } = req.body;
    
    if (!email || !oldApiKey) {
        return res.status(400).json({
            success: false,
            error: '📧 Email na 🔑 API Key zinahitajika'
        });
    }
    
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        // Find the old key
        const snapshot = await db.collection('api_keys')
            .where('key', '==', oldApiKey)
            .where('ownerEmail', '==', email)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                error: '🔑 API Key haipatikani'
            });
        }
        
        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // Deactivate old key
        await db.collection('api_keys').doc(doc.id).update({
            isActive: false,
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'Regenerated'
        });
        
        // Generate new key
        const newKey = 'dvary_' + crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        
        // Create new key with same data
        await db.collection('api_keys').add({
            key: newKey,
            ownerEmail: email,
            appName: data.appName || 'App',
            description: data.description || '',
            allowedGames: data.allowedGames || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            isActive: true,
            usageCount: 0,
            lastUsed: null,
            regeneratedFrom: oldApiKey
        });
        
        console.log(`✅ API Key regenerated for ${email}: ${newKey}`);
        
        res.json({
            success: true,
            apiKey: newKey,
            message: '✅ API Key mpya imeundwa! Ihifadhi salama.',
            expiresAt: expiresAt
        });
        
    } catch (error) {
        console.error('Error regenerating API Key:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kuunda API Key mpya: ' + error.message
        });
    }
});

// ============================================================
// PROTECTED API ENDPOINTS - Zinahitaji API Key
// ============================================================

// 5. GET ALL GAMES (Protected)
app.get('/api/v1/games', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('games').get();
        const games = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            games.push({
                id: doc.id,
                name: data.name || 'Unnamed',
                genre: data.genre || 'General',
                platform: data.platform || 'Multi-platform',
                price: data.price || 0,
                currency: data.currency || 'TZS',
                rating: data.rating || null,
                imageUrl: data.imageUrl || null,
                isFree: data.isFree || false,
                isVip: data.isVip || false,
                isPremium: data.isPremium || false,
                isFeatured: data.isFeatured || false,
                isTrending: data.isTrending || false,
                fileSize: data.fileSize || 'Unknown',
                released: data.released || null,
                description: data.description || '',
                downloadLinks: data.downloadLinks || []
            });
        });
        
        res.json({
            success: true,
            count: games.length,
            games: games
        });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kupata michezo: ' + error.message
        });
    }
});

// 6. GET SINGLE GAME (Protected)
app.get('/api/v1/games/:id', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const doc = await db.collection('games').doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: '🎮 Mchezo haupatikani'
            });
        }
        const data = doc.data();
        res.json({
            success: true,
            game: {
                id: doc.id,
                name: data.name || 'Unnamed',
                genre: data.genre || 'General',
                platform: data.platform || 'Multi-platform',
                price: data.price || 0,
                currency: data.currency || 'TZS',
                rating: data.rating || null,
                imageUrl: data.imageUrl || null,
                isFree: data.isFree || false,
                isVip: data.isVip || false,
                isPremium: data.isPremium || false,
                isFeatured: data.isFeatured || false,
                isTrending: data.isTrending || false,
                fileSize: data.fileSize || 'Unknown',
                released: data.released || null,
                description: data.description || '',
                downloadLinks: data.downloadLinks || []
            }
        });
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kupata mchezo: ' + error.message
        });
    }
});

// 7. VERIFY CLAIM CODE (Protected)
app.post('/api/v1/verify-claim', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({
            success: false,
            error: '🎫 Claim code inahitajika'
        });
    }
    
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('claims')
            .where('code', '==', code.toUpperCase())
            .get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                isValid: false,
                isUsed: false,
                message: '🎫 Claim code haipo'
            });
        }
        
        const doc = snapshot.docs[0];
        const data = doc.data();
        
        res.json({
            success: true,
            isValid: data.isUsed === false,
            isUsed: data.isUsed === true,
            assignedTo: data.assignedToEmail || null,
            code: data.code,
            message: data.isUsed ? '🔴 Claim tayari imetumiwa' : '🟢 Claim ni sahihi'
        });
        
    } catch (error) {
        console.error('Error verifying claim:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kuthibitisha claim: ' + error.message
        });
    }
});

// 8. GET GAMES BY GENRE (Protected)
app.get('/api/v1/games/genre/:genre', async (req, res) => {
    const { genre } = req.params;
    
    if (!genre) {
        return res.status(400).json({
            success: false,
            error: '🎮 Genre inahitajika'
        });
    }
    
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('games')
            .where('genre', '==', genre)
            .get();
        
        const games = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            games.push({
                id: doc.id,
                name: data.name || 'Unnamed',
                genre: data.genre || 'General',
                price: data.price || 0,
                rating: data.rating || null,
                imageUrl: data.imageUrl || null
            });
        });
        
        res.json({
            success: true,
            count: games.length,
            genre: genre,
            games: games
        });
    } catch (error) {
        console.error('Error fetching games by genre:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kupata michezo: ' + error.message
        });
    }
});

// 9. GET VIP GAMES (Protected)
app.get('/api/v1/games/vip', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('games')
            .where('isVip', '==', true)
            .get();
        
        const games = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            games.push({
                id: doc.id,
                name: data.name || 'Unnamed',
                genre: data.genre || 'General',
                price: data.price || 0,
                currency: data.currency || 'TZS',
                rating: data.rating || null,
                imageUrl: data.imageUrl || null
            });
        });
        
        res.json({
            success: true,
            count: games.length,
            games: games
        });
    } catch (error) {
        console.error('Error fetching VIP games:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kupata michezo ya VIP: ' + error.message
        });
    }
});

// 10. GET FREE GAMES (Protected)
app.get('/api/v1/games/free', async (req, res) => {
    if (!db) {
        return res.status(503).json({
            success: false,
            error: '⚠️ Firebase Admin is not available'
        });
    }
    
    try {
        const snapshot = await db.collection('games')
            .where('isFree', '==', true)
            .get();
        
        const games = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            games.push({
                id: doc.id,
                name: data.name || 'Unnamed',
                genre: data.genre || 'General',
                rating: data.rating || null,
                imageUrl: data.imageUrl || null
            });
        });
        
        res.json({
            success: true,
            count: games.length,
            games: games
        });
    } catch (error) {
        console.error('Error fetching free games:', error);
        res.status(500).json({
            success: false,
            error: '❌ Hitilafu wakati wa kupata michezo ya bure: ' + error.message
        });
    }
});

// ============================================================
// API ENDPOINT - AI CHAT
// ============================================================
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log("💬 Ombi la chat limepokelewa:", message);
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const completion = await openai.chat.completions.create({
            model: "openrouter/auto",
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful gaming assistant for DVARY GAMES platform. Help users with game recommendations, claims, and general gaming questions.'
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
        res.status(500).json({ error: 'Failed to get AI response: ' + error.message });
    }
});

// ============================================================
// API ENDPOINT - FIMIPAY PAYMENT 
// ============================================================
app.post('/api/pay-fimipay', async (req, res) => {
    try {
        let { buyer_phone, amount, gameId, buyer_email, buyer_name } = req.body;

        if (!buyer_phone || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Taarifa za malipo hazijakamilika (namba ya simu na kiasi zinahitajika).' 
            });
        }

        // FimiPay inahitaji namba ianze na 255 (mfano: 255724525910)
        let formattedPhone = String(buyer_phone).trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '255' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('+255')) {
            formattedPhone = formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('255')) {
            formattedPhone = '255' + formattedPhone;
        }

        const apiKey = process.env.FIMIPAY_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ 
                success: false, 
                error: 'Ufunguo wa FimiPay (API Key) haujapatikana kwenye faili la .env.' 
            });
        }

        console.log(`💳 Inatuma ombi la malipo FimiPay kwenda namba: ${formattedPhone} kwa kiasi cha: ${amount}`);

        const fimiResponse = await fetch('https://fimipay.com/api/v1/payment/create_order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                buyer_phone: formattedPhone,
                amount: Number(amount),
                currency: "TZS",
                payment_method: "mobile",
                buyer_email: buyer_email || "customer@dvary.space",
                buyer_name: buyer_name || "DVARY Customer"
            })
        });

        const responseText = await fimiResponse.text();
        let paymentData;
        
        try {
            paymentData = JSON.parse(responseText);
        } catch (e) {
            console.error("FimiPay imerudisha HTML badala ya JSON:", responseText);
            return res.status(500).json({ 
                success: false, 
                error: 'API ya FimiPay haipatikani au imerudisha majibu yasiyo sahihi.' 
            });
        }

        console.log("📦 Majibu kamili ya FimiPay:", paymentData);

        if (paymentData.status === "success" || paymentData.success === true) {
            res.json({
                success: true,
                message: paymentData.message || "Malipo yameanzishwa kikamilifu.",
                order_id: paymentData.data?.order_id || paymentData.order_id,
                data: paymentData
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: paymentData.message || 'Malipo yameshindikana kuchakatwa na FimiPay.' 
            });
        }

    } catch (error) {
        console.error('FimiPay Server Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Hitilafu ya mtandao na FimiPay: ' + error.message 
        });
    }
});

// ============================================================
// ERROR HANDLING FOR APIS & FALLBACKS
// ============================================================
app.use('/api', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint haipatikani. Angalia URL yako.' 
    });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log('=' .repeat(50));
    console.log('🚀 DVARY GAMES server running on http://localhost:' + PORT);
    console.log('=' .repeat(50));
    console.log('');
    console.log('📋 API Endpoints:');
    console.log('   🔑 POST /api/request-key     - Request API Key');
    console.log('   📋 POST /api/key-info        - Get API Key info');
    console.log('   🗑️  POST /api/revoke-key     - Revoke API Key');
    console.log('   🔄 POST /api/regenerate-key  - Regenerate API Key');
    console.log('   🎮 GET  /api/v1/games        - Get all games');
    console.log('   🎮 GET  /api/v1/games/:id    - Get single game');
    console.log('   🎮 GET  /api/v1/games/genre/:genre - Get games by genre');
    console.log('   ⭐ GET  /api/v1/games/vip    - Get VIP games');
    console.log('   🆓 GET  /api/v1/games/free   - Get free games');
    console.log('   🎫 POST /api/v1/verify-claim - Verify claim code');
    console.log('   💬 POST /api/ai-chat         - AI Chat');
    console.log('   💳 POST /api/pay-fimipay     - FimiPay payment');
    console.log('');
    console.log('📁 HTML Pages:');
    console.log('   🏠 /main      - Main page');
    console.log('   🔑 /api-request - Request API Key page');
    console.log('   ⚙️ /admin     - Admin panel');
    console.log('   🎫 /upgetrewards - Claim rewards');
    console.log('=' .repeat(50));
});
