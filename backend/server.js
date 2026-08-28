// ============================================
// DVARY GAMES - Backend Server
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// SERVE STATIC FILES (FRONTEND)
// ============================================
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================
// FIREBASE ADMIN SETUP
// ============================================
let admin;
let db;

try {
    admin = require('firebase-admin');
    
    // Try to use service account from base64 env
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
        );
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID
        });
    }
    
    db = admin.firestore();
    console.log('✅ Firebase Admin initialized');
} catch (error) {
    console.error('❌ Firebase error:', error.message);
}

// ============================================
// IN-MEMORY DATABASE (Fallback)
// ============================================
const memoryDB = {
    users: new Map(),
    games: new Map(),
    messages: new Map(),
    reports: new Map(),
    notifications: new Map(),
    
    init() {
        const adminId = 'admin_' + uuidv4();
        const hashedPassword = bcrypt.hashSync('Admin@12345', 10);
        this.users.set(adminId, {
            userId: adminId,
            fullName: 'DVARY Admin',
            username: 'dvary_admin',
            email: 'admin@dvarygames.com',
            phone: '+255700000000',
            profileImage: 'https://ui-avatars.com/api/?name=DVARY+Admin&background=7c3aed&color=fff&size=128',
            onlineStatus: false,
            lastSeen: new Date().toISOString(),
            role: 'admin',
            createdAt: new Date().toISOString(),
            isActive: true,
            password: hashedPassword
        });
    }
};
memoryDB.init();

const getDB = () => db ? { type: 'firestore', instance: db } : { type: 'memory', instance: memoryDB };
const database = getDB();

// ============================================
// AUTH MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let user = null;
        
        if (database.type === 'firestore') {
            const doc = await database.instance.collection('users').doc(decoded.userId).get();
            if (doc.exists) user = { userId: doc.id, ...doc.data() };
        } else {
            user = database.instance.users.get(decoded.userId);
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        if (user.isActive === false) {
            return res.status(403).json({ success: false, message: 'Account blocked' });
        }

        req.user = decoded;
        req.userData = user;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
    }
};

const authenticateAdmin = async (req, res, next) => {
    await authenticateToken(req, res, () => {
        if (req.userData.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        next();
    });
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const generateToken = (user) => {
    return jwt.sign(
        { userId: user.userId, email: user.email, role: user.role || 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const hashPassword = async (password) => bcrypt.hash(password, 10);
const comparePassword = async (password, hash) => bcrypt.compare(password, hash);

// ============================================
// API ROUTES - AUTH
// ============================================
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { fullName, username, email, phone, password, confirmPassword } = req.body;

        if (!fullName || !username || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password min 6 characters' });
        }

        // Check if user exists
        if (database.type === 'firestore') {
            const emailCheck = await database.instance.collection('users').where('email', '==', email).get();
            if (!emailCheck.empty) {
                return res.status(400).json({ success: false, message: 'Email already registered' });
            }
            const usernameCheck = await database.instance.collection('users').where('username', '==', username).get();
            if (!usernameCheck.empty) {
                return res.status(400).json({ success: false, message: 'Username taken' });
            }
        } else {
            for (const [, user] of database.instance.users) {
                if (user.email === email) return res.status(400).json({ success: false, message: 'Email already registered' });
                if (user.username === username) return res.status(400).json({ success: false, message: 'Username taken' });
            }
        }

        const userId = 'user_' + uuidv4();
        const hashedPassword = await hashPassword(password);
        const profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=7c3aed&color=fff&size=128`;

        const newUser = {
            userId,
            fullName,
            username,
            email,
            phone,
            profileImage,
            onlineStatus: false,
            lastSeen: new Date().toISOString(),
            role: 'user',
            createdAt: new Date().toISOString(),
            isActive: true,
            password: hashedPassword
        };

        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).set({
                userId,
                fullName,
                username,
                email,
                phone,
                profileImage,
                onlineStatus: false,
                lastSeen: new Date().toISOString(),
                role: 'user',
                createdAt: new Date().toISOString(),
                isActive: true
            });
        } else {
            database.instance.users.set(userId, newUser);
        }

        const token = generateToken({ userId, email, role: 'user' });
        const { password: _, ...userData } = newUser;

        res.status(201).json({ success: true, message: 'Account created', token, user: userData });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' });
        }

        let user = null;
        let userId = null;

        if (database.type === 'firestore') {
            const query = await database.instance.collection('users').where('email', '==', email).get();
            if (!query.empty) {
                const doc = query.docs[0];
                userId = doc.id;
                user = { userId, ...doc.data() };
            }
        } else {
            for (const [id, data] of database.instance.users) {
                if (data.email === email) {
                    userId = id;
                    user = { userId, ...data };
                    break;
                }
            }
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.isActive === false) {
            return res.status(403).json({ success: false, message: 'Account blocked' });
        }

        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Update online status
        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).update({
                onlineStatus: true,
                lastSeen: new Date().toISOString()
            });
        } else {
            user.onlineStatus = true;
            user.lastSeen = new Date().toISOString();
            database.instance.users.set(userId, user);
        }

        const token = generateToken({ userId, email: user.email, role: user.role || 'user' });
        const { password: _, ...userData } = user;

        res.json({ success: true, message: 'Login successful', token, user: userData });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    res.json({ success: true, user: req.userData });
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).update({
                onlineStatus: false,
                lastSeen: new Date().toISOString()
            });
        } else {
            const user = database.instance.users.get(userId);
            if (user) {
                user.onlineStatus = false;
                user.lastSeen = new Date().toISOString();
                database.instance.users.set(userId, user);
            }
        }
        res.json({ success: true, message: 'Logged out' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// API ROUTES - USERS
// ============================================
app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fullName, username, phone } = req.body;

        const updates = {};
        if (fullName) updates.fullName = fullName;
        if (username) updates.username = username;
        if (phone) updates.phone = phone;

        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).update(updates);
        } else {
            const user = database.instance.users.get(userId);
            if (user) Object.assign(user, updates);
        }

        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/users/password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }

        let user = null;
        if (database.type === 'firestore') {
            const doc = await database.instance.collection('users').doc(userId).get();
            if (doc.exists) user = { userId: doc.id, ...doc.data() };
        } else {
            user = database.instance.users.get(userId);
        }

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const passwordMatch = await comparePassword(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Current password incorrect' });
        }

        const hashedPassword = await hashPassword(newPassword);

        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).update({ password: hashedPassword });
        } else {
            user.password = hashedPassword;
            database.instance.users.set(userId, user);
        }

        res.json({ success: true, message: 'Password changed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/users/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).delete();
        } else {
            database.instance.users.delete(userId);
        }
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// API ROUTES - GAMES
// ============================================
app.get('/api/games', async (req, res) => {
    try {
        let games = [];
        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('games').get();
            games = snapshot.docs.map(doc => ({ gameId: doc.id, ...doc.data() }));
        } else {
            games = Array.from(database.instance.games.values());
        }
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/games/featured', async (req, res) => {
    try {
        let games = [];
        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('games')
                .where('featured', '==', true)
                .limit(6)
                .get();
            games = snapshot.docs.map(doc => ({ gameId: doc.id, ...doc.data() }));
        } else {
            games = Array.from(database.instance.games.values())
                .filter(g => g.featured)
                .slice(0, 6);
        }
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/games/vip', async (req, res) => {
    try {
        let games = [];
        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('games')
                .where('type', '==', 'vip')
                .limit(6)
                .get();
            games = snapshot.docs.map(doc => ({ gameId: doc.id, ...doc.data() }));
        } else {
            games = Array.from(database.instance.games.values())
                .filter(g => g.type === 'vip')
                .slice(0, 6);
        }
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/games/free', async (req, res) => {
    try {
        let games = [];
        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('games')
                .where('type', '==', 'free')
                .limit(6)
                .get();
            games = snapshot.docs.map(doc => ({ gameId: doc.id, ...doc.data() }));
        } else {
            games = Array.from(database.instance.games.values())
                .filter(g => g.type === 'free')
                .slice(0, 6);
        }
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/games/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, games: [] });

        let games = [];
        const searchTerm = q.toLowerCase();

        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('games').get();
            games = snapshot.docs
                .map(doc => ({ gameId: doc.id, ...doc.data() }))
                .filter(g => 
                    g.name?.toLowerCase().includes(searchTerm) ||
                    g.category?.toLowerCase().includes(searchTerm) ||
                    g.description?.toLowerCase().includes(searchTerm)
                );
        } else {
            games = Array.from(database.instance.games.values())
                .filter(g => 
                    g.name?.toLowerCase().includes(searchTerm) ||
                    g.category?.toLowerCase().includes(searchTerm) ||
                    g.description?.toLowerCase().includes(searchTerm)
                );
        }
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/games/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        let game = null;

        if (database.type === 'firestore') {
            const doc = await database.instance.collection('games').doc(gameId).get();
            if (doc.exists) game = { gameId: doc.id, ...doc.data() };
        } else {
            game = database.instance.games.get(gameId);
        }

        if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
        res.json({ success: true, game });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// ADMIN ROUTES - GAMES
// ============================================
app.post('/api/admin/games', authenticateAdmin, async (req, res) => {
    try {
        const { name, description, category, genre, version, size, type, downloadUrl, trailerUrl, featured, trending } = req.body;

        if (!name || !description || !category) {
            return res.status(400).json({ success: false, message: 'Name, description, category required' });
        }

        const gameId = 'game_' + uuidv4();
        const newGame = {
            gameId,
            name,
            description,
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&size=300x200`,
            category,
            genre: genre || 'Other',
            version: version || '1.0.0',
            size: size || 'Unknown',
            type: type || 'free',
            downloadUrl: downloadUrl || '#',
            trailerUrl: trailerUrl || '',
            featured: featured === 'true' || featured === true,
            trending: trending === 'true' || trending === true,
            createdAt: new Date().toISOString()
        };

        if (database.type === 'firestore') {
            await database.instance.collection('games').doc(gameId).set(newGame);
        } else {
            database.instance.games.set(gameId, newGame);
        }

        res.status(201).json({ success: true, message: 'Game added', game: newGame });
    } catch (error) {
        console.error('Add game error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/admin/games/:gameId', authenticateAdmin, async (req, res) => {
    try {
        const { gameId } = req.params;
        const updates = req.body;

        if (database.type === 'firestore') {
            await database.instance.collection('games').doc(gameId).update(updates);
        } else {
            const game = database.instance.games.get(gameId);
            if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
            Object.assign(game, updates);
        }

        res.json({ success: true, message: 'Game updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/games/:gameId', authenticateAdmin, async (req, res) => {
    try {
        const { gameId } = req.params;

        if (database.type === 'firestore') {
            await database.instance.collection('games').doc(gameId).delete();
        } else {
            if (!database.instance.games.has(gameId)) {
                return res.status(404).json({ success: false, message: 'Game not found' });
            }
            database.instance.games.delete(gameId);
        }

        res.json({ success: true, message: 'Game deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// ADMIN ROUTES - USERS
// ============================================
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        let users = [];
        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('users').get();
            users = snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() }));
        } else {
            users = Array.from(database.instance.users.values());
        }
        users = users.map(({ password, ...user }) => user);
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/admin/users/:userId/block', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).update({ isActive });
        } else {
            const user = database.instance.users.get(userId);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            user.isActive = isActive;
        }

        res.json({ success: true, message: `User ${isActive ? 'unblocked' : 'blocked'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (database.type === 'firestore') {
            await database.instance.collection('users').doc(userId).delete();
        } else {
            if (!database.instance.users.has(userId)) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            database.instance.users.delete(userId);
        }

        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// API ROUTES - CHAT
// ============================================
app.get('/api/chat/messages', authenticateToken, async (req, res) => {
    try {
        let messages = [];

        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('messages')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            messages = snapshot.docs.map(doc => ({ messageId: doc.id, ...doc.data() }));
        } else {
            messages = Array.from(database.instance.messages.values())
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 100);
        }

        // Enrich with user data
        const enriched = await Promise.all(messages.map(async (msg) => {
            let sender = null;
            if (database.type === 'firestore') {
                const doc = await database.instance.collection('users').doc(msg.senderId).get();
                if (doc.exists) sender = { userId: doc.id, ...doc.data() };
            } else {
                sender = database.instance.users.get(msg.senderId);
            }
            return {
                ...msg,
                sender: sender ? {
                    userId: sender.userId,
                    fullName: sender.fullName,
                    username: sender.username,
                    profileImage: sender.profileImage,
                    onlineStatus: sender.onlineStatus
                } : null
            };
        }));

        res.json({ success: true, messages: enriched });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/chat/messages', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        const senderId = req.user.userId;

        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message cannot be empty' });
        }

        const sanitized = message.replace(/<[^>]*>/g, '').trim();
        const messageId = 'msg_' + uuidv4();

        const newMessage = {
            messageId,
            groupId: 'dvary_community',
            senderId,
            message: sanitized,
            createdAt: new Date().toISOString(),
            readBy: [senderId]
        };

        if (database.type === 'firestore') {
            await database.instance.collection('messages').doc(messageId).set(newMessage);
        } else {
            database.instance.messages.set(messageId, newMessage);
        }

        res.status(201).json({ success: true, message: 'Sent', data: newMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/chat/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        let message = null;
        if (database.type === 'firestore') {
            const doc = await database.instance.collection('messages').doc(messageId).get();
            if (doc.exists) message = { messageId: doc.id, ...doc.data() };
        } else {
            message = database.instance.messages.get(messageId);
        }

        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
        if (message.senderId !== userId) {
            return res.status(403).json({ success: false, message: 'Cannot delete others messages' });
        }

        if (database.type === 'firestore') {
            await database.instance.collection('messages').doc(messageId).delete();
        } else {
            database.instance.messages.delete(messageId);
        }

        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// API ROUTES - CHAT STATS
// ============================================
app.get('/api/chat/stats', authenticateToken, async (req, res) => {
    try {
        let total = 0, online = 0;

        if (database.type === 'firestore') {
            const users = await database.instance.collection('users').get();
            total = users.size;
            const onlineUsers = await database.instance.collection('users')
                .where('onlineStatus', '==', true)
                .get();
            online = onlineUsers.size;
        } else {
            const users = Array.from(database.instance.users.values());
            total = users.length;
            online = users.filter(u => u.onlineStatus === true).length;
        }

        res.json({ success: true, stats: { totalMembers: total, onlineMembers: online } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// API ROUTES - NOTIFICATIONS
// ============================================
app.get('/api/admin/notifications', authenticateAdmin, async (req, res) => {
    try {
        let notifications = [];

        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('notifications')
                .orderBy('createdAt', 'desc')
                .get();
            notifications = snapshot.docs.map(doc => ({ notificationId: doc.id, ...doc.data() }));
        } else {
            notifications = Array.from(database.instance.notifications.values())
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        res.json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/admin/notifications', authenticateAdmin, async (req, res) => {
    try {
        const { title, message } = req.body;

        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message required' });
        }

        const notificationId = 'notif_' + uuidv4();
        const newNotification = {
            notificationId,
            title,
            message,
            createdAt: new Date().toISOString()
        };

        if (database.type === 'firestore') {
            await database.instance.collection('notifications').doc(notificationId).set(newNotification);
        } else {
            database.instance.notifications.set(notificationId, newNotification);
        }

        res.status(201).json({ success: true, message: 'Notification created', notification: newNotification });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/notifications/:notificationId', authenticateAdmin, async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (database.type === 'firestore') {
            await database.instance.collection('notifications').doc(notificationId).delete();
        } else {
            if (!database.instance.notifications.has(notificationId)) {
                return res.status(404).json({ success: false, message: 'Notification not found' });
            }
            database.instance.notifications.delete(notificationId);
        }

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// API ROUTES - REPORTS
// ============================================
app.post('/api/reports', authenticateToken, async (req, res) => {
    try {
        const { reportedUserId, reason, details } = req.body;

        if (!reportedUserId || !reason) {
            return res.status(400).json({ success: false, message: 'User and reason required' });
        }

        const reportId = 'rpt_' + uuidv4();
        const newReport = {
            reportId,
            reportedUserId,
            reportedBy: req.user.userId,
            reason,
            details: details || '',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        if (database.type === 'firestore') {
            await database.instance.collection('reports').doc(reportId).set(newReport);
        } else {
            database.instance.reports.set(reportId, newReport);
        }

        res.status(201).json({ success: true, message: 'Report submitted', report: newReport });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/admin/reports', authenticateAdmin, async (req, res) => {
    try {
        let reports = [];

        if (database.type === 'firestore') {
            const snapshot = await database.instance.collection('reports')
                .orderBy('createdAt', 'desc')
                .get();
            reports = snapshot.docs.map(doc => ({ reportId: doc.id, ...doc.data() }));
        } else {
            reports = Array.from(database.instance.reports.values())
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Enrich with user data
        const enriched = await Promise.all(reports.map(async (report) => {
            let reportedUser = null, reporter = null;

            if (database.type === 'firestore') {
                const doc1 = await database.instance.collection('users').doc(report.reportedUserId).get();
                if (doc1.exists) reportedUser = { userId: doc1.id, ...doc1.data() };
                const doc2 = await database.instance.collection('users').doc(report.reportedBy).get();
                if (doc2.exists) reporter = { userId: doc2.id, ...doc2.data() };
            } else {
                reportedUser = database.instance.users.get(report.reportedUserId);
                reporter = database.instance.users.get(report.reportedBy);
            }

            return {
                ...report,
                reportedUser: reportedUser ? {
                    userId: reportedUser.userId,
                    fullName: reportedUser.fullName,
                    username: reportedUser.username,
                    profileImage: reportedUser.profileImage
                } : null,
                reporter: reporter ? {
                    userId: reporter.userId,
                    fullName: reporter.fullName,
                    username: reporter.username
                } : null
            };
        }));

        res.json({ success: true, reports: enriched });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/admin/reports/:reportId', authenticateAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status } = req.body;

        if (!status || !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        if (database.type === 'firestore') {
            await database.instance.collection('reports').doc(reportId).update({ status });
        } else {
            const report = database.instance.reports.get(reportId);
            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
            report.status = status;
        }

        res.json({ success: true, message: 'Report updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// SERVE FRONTEND
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/:page.html', (req, res) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, '../frontend', `${page}.html`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('========================================');
    console.log('🎮 DVARY GAMES SERVER');
    console.log('========================================');
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`📁 Frontend: ${path.join(__dirname, '../frontend')}`);
    console.log('========================================');
    console.log('🔐 Admin Login:');
    console.log('   Email: admin@dvarygames.com');
    console.log('   Password: Admin@12345');
    console.log('========================================');
});
