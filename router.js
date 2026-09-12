const express = require('express');
const router = express.Router();
const path = require('path');

// ============================================================
// PUBLIC PAGES
// ============================================================

// Landing page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Main hub (Free games moja kwa moja)
router.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// 🆓 FREE GAMES
router.get('/free', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'free.html'));
});

// ⭐ VIP GAMES (Claim only)
router.get('/vip', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vip-payment.html'));
});

// Alias kwa /vip
router.get('/vip-payment', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vip-payment.html'));
});

router.get('/games', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'games.html'));
});

router.get('/ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ai.html'));
});

router.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'community.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

router.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

router.get('/graph', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'graph.html'));
});

router.get('/refund', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'refund.html'));
});

router.get('/upgetrewards', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upgetrewards.html'));
});

router.get('/rewardclaim', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rewardclaim.html'));
});

// 📧 CONTACT PAGE (MPYA)
router.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// ============================================================
// ADMIN PAGES  →  public/admin/*.html
// ============================================================

// /admin  →  Dashboard
router.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// /admin/dashboard  →  Dashboard (alias)
router.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// /admin/businesses  →  Games (Add + Manage)
router.get('/admin/businesses', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'businesses.html'));
});

// /admin/claims  →  Claims
router.get('/admin/claims', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'claims.html'));
});

// /admin/reviews  →  Users
router.get('/admin/reviews', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'reviews.html'));
});

// /admin/settings  →  Notifications + Clean Data
router.get('/admin/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'settings.html'));
});

// 📧 /admin/messages  →  Contact Messages (MPYA)
router.get('/admin/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'messages.html'));
});

module.exports = router;
