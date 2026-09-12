const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
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

// ============================================================
// OPENROUTER / OPENAI
// ============================================================
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================
// EMAIL TRANSPORTER
// ============================================================
let mailTransporter = null;

try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        mailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('✅ Email transporter configured');
    } else {
        console.warn('⚠️ EMAIL_USER / EMAIL_PASS haipo — email haitatumwa');
    }
} catch (error) {
    console.error('❌ Email transporter error:', error.message);
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Zuia mafaili nyeti
app.use((req, res, next) => {
    const blockedPaths = ['/.env', '/package.json', '/config.json'];
    if (blockedPaths.includes(req.path) || req.path.startsWith('/.git')) {
        return res.status(403).send('Access Denied');
    }
    next();
});

// ============================================================
// HTML ROUTES  ←  KWANZA
// ============================================================
app.use('/', router);

// ============================================================
// STATIC FILES  ←  BAADAYE
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'DVARY GAMES server is running',
        firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
        email: mailTransporter ? 'configured' : 'not configured',
        time: new Date().toISOString()
    });
});

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
                {
                    role: 'system',
                    content: 'You are a helpful gaming assistant for DVARY GAMES platform. Answer clearly and helpfully in the language the user uses (Swahili or English).'
                },
                { role: 'user', content: message }
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
// SEND REPLY TO USER EMAIL
// ============================================================
app.post('/api/send-reply', async (req, res) => {
    try {
        const { messageId, to, subject, replyMessage, adminName } = req.body;

        if (!messageId || !to || !replyMessage) {
            return res.status(400).json({
                success: false,
                error: 'messageId, to, na replyMessage zinahitajika'
            });
        }

        if (!mailTransporter) {
            return res.status(500).json({
                success: false,
                error: 'Email haijapangiliwa. Weka EMAIL_USER na EMAIL_PASS kwenye .env'
            });
        }

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'DVARY GAMES'}" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: `Re: ${subject || 'Ujumbe wako - DVARY GAMES'}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8"></head>
                <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Tahoma,sans-serif;">
                    <div style="max-width:600px;margin:0 auto;padding:30px 20px;">
                        <div style="text-align:center;padding:20px 0 30px;border-bottom:1px solid rgba(255,255,255,0.08);">
                            <h1 style="color:#6366f1;margin:0;font-size:26px;letter-spacing:-0.5px;">
                                🎮 DVARY <span style="color:#e2e8f0;">GAMES</span>
                            </h1>
                            <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Jukwaa la Michezo Kali</p>
                        </div>

                        <div style="padding:30px 0;">
                            <h2 style="color:#e2e8f0;font-size:20px;margin:0 0 20px;">
                                📧 Jibu la Ujumbe Wako
                            </h2>

                            <div style="background:rgba(99,102,241,0.08);border-left:3px solid #6366f1;padding:14px 18px;border-radius:8px;margin-bottom:24px;">
                                <p style="color:#94a3b8;font-size:13px;margin:0 0 6px;">
                                    <strong style="color:#e2e8f0;">Somo lililotangulia:</strong>
                                </p>
                                <p style="color:#e2e8f0;font-size:14px;margin:0;">
                                    ${(subject || 'Ujumbe wako').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                                </p>
                            </div>

                            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);padding:20px;border-radius:12px;margin-bottom:24px;">
                                <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0;white-space:pre-wrap;">${replyMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                            </div>

                            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 10px;">
                                Kama una swali lingine, jisikie huru kuwasiliana nasi tena.
                            </p>

                            <p style="color:#94a3b8;font-size:13px;margin-top:24px;">
                                Karibu,<br>
                                <strong style="color:#e2e8f0;">${(adminName || 'Timu ya DVARY GAMES').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>
                            </p>
                        </div>

                        <div style="border-top:1px solid rgba(255,255,255,0.08);padding:20px 0;text-align:center;">
                            <p style="color:#94a3b8;font-size:12px;margin:0 0 10px;">
                                <a href="https://dvary.space" style="color:#6366f1;text-decoration:none;">dvary.space</a>
                            </p>
                            <p style="color:#64748b;font-size:11px;margin:0;">
                                © 2026 DVARY GAMES. Haki zote zimehifadhiwa.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await mailTransporter.sendMail(mailOptions);
        console.log('📧 Email sent:', info.messageId, '→', to);

        try {
            await db.collection('messages').doc(messageId).update({
                status: 'replied',
                read: true,
                replied: true,
                repliedAt: admin.firestore.FieldValue.serverTimestamp(),
                repliedBy: adminName || 'Admin',
                replyMessage: replyMessage,
                emailMessageId: info.messageId
            });
        } catch (dbErr) {
            console.error('Firestore update error:', dbErr.message);
        }

        res.json({
            success: true,
            message: 'Email imetumwa kwa mafanikio',
            messageId: info.messageId
        });

    } catch (error) {
        console.error('❌ Send reply error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Hitilafu wakati wa kutuma email'
        });
    }
});

// ============================================================
// API 404 — BAADA ya API routes zote
// ============================================================
app.use('/api', (req, res) => {
    return res.status(404).json({
        success: false,
        error: 'API endpoint haipatikani.'
    });
});

// ============================================================
// WEBSITE FALLBACK — MWISHO
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
    console.log(`Firebase: ${admin.apps.length > 0 ? '✅ Connected' : '❌ Not connected'}`);
    console.log(`Email: ${mailTransporter ? '✅ Configured' : '⚠️ Not configured'}`);
    console.log(`OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌'}`);
    console.log('==========================================');
    console.log('📌 Endpoints:');
    console.log('   GET  /api/health');
    console.log('   POST /api/ai-chat');
    console.log('   POST /api/send-reply');
    console.log('==========================================');
    console.log('');
});
