// ============================================
// DVARY GAMES - Main Application Logic
// ============================================

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    limit, 
    where, 
    doc, 
    getDoc,
    orderBy,
    onSnapshot,
    updateDoc,
    deleteDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCmwASW4XXQ3O0AvsCM_r1WLlrUmGjYVxI",
    authDomain: "dvary-9a7d0.firebaseapp.com",
    projectId: "dvary-9a7d0",
    storageBucket: "dvary-9a7d0.firebasestorage.app",
    messagingSenderId: "107370806066",
    appId: "1:107370806066:web:4c2ce1e6f7b6c32909f52b",
    measurementId: "G-07361LFJEP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================
// STATE
// ============================================
let currentUser = null;
let currentUserData = null;
let allGames = [];

// ============================================
// DOM ELEMENTS - HOMEPAGE
// ============================================
const navMenu = document.getElementById('navMenu');
const menuToggle = document.getElementById('menuToggle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminNav = document.getElementById('adminNav');
const notifBadge = document.getElementById('notifBadge');
const notificationBtn = document.getElementById('notificationBtn');
const notificationModal = document.getElementById('notificationModal');
const closeNotifModal = document.getElementById('closeNotifModal');
const notificationList = document.getElementById('notificationList');
const gameModal = document.getElementById('gameModal');
const closeGameModal = document.getElementById('closeGameModal');

const totalGamesStat = document.getElementById('totalGamesStat');
const totalUsersStat = document.getElementById('totalUsersStat');
const onlineUsersStat = document.getElementById('onlineUsersStat');

// ============================================
// DOM ELEMENTS - SETTINGS
// ============================================
const avatarImage = document.getElementById('avatarImage');
const profileName = document.getElementById('profileName');
const profileUsername = document.getElementById('profileUsername');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const changePhotoBtn = document.getElementById('changePhotoBtn');
const photoInput = document.getElementById('photoInput');
const editProfileBtn = document.getElementById('editProfileBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const backBtn = document.getElementById('backBtn');

// Settings modals
const editProfileModal = document.getElementById('editProfileModal');
const changePasswordModal = document.getElementById('changePasswordModal');
const deleteAccountModal = document.getElementById('deleteAccountModal');

// ============================================
// AUTHENTICATION - MAIN
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('✅ User logged in:', user.email);
        
        await loadUserData(user.uid);
        
        // Check if admin
        const isAdmin = await checkIfAdmin(user.uid);
        if (isAdmin && adminNav) {
            adminNav.style.display = 'block';
        }
        
        // Load homepage data if on index
        const page = window.location.pathname.split('/').pop() || 'index.html';
        if (page === 'index.html' || page === '') {
            await loadAllData();
        }
        
        // Load settings data if on settings page
        if (page === 'setting.html') {
            loadSettingsData();
        }
        
    } else {
        currentUser = null;
        currentUserData = null;
        console.log('❌ User logged out');
        
        const page = window.location.pathname.split('/').pop() || 'index.html';
        if (!['login.html', 'signup.html'].includes(page)) {
            window.location.href = 'login.html';
        }
    }
});

// ============================================
// LOAD USER DATA
// ============================================
async function loadUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            currentUserData = { uid, ...userDoc.data() };
            console.log('✅ User data loaded:', currentUserData.username);
        } else {
            console.error('User document not found');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// ============================================
// CHECK IF ADMIN
// ============================================
async function checkIfAdmin(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data().role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('Error checking admin:', error);
        return false;
    }
}

// ============================================
// LOAD ALL DATA - HOMEPAGE
// ============================================
async function loadAllData() {
    try {
        await loadGames();
        await loadUsersStats();
        await loadNotifications();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ============================================
// LOAD GAMES FROM FIRESTORE
// ============================================
async function loadGames() {
    try {
        await loadFeaturedGames();
        await loadVIPGames();
        await loadFreeGames();
        await loadAllGamesList();
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

async function loadFeaturedGames() {
    const container = document.getElementById('featuredGames');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Loading featured games...</div>';
    
    try {
        const q = query(collection(db, 'games'), where('featured', '==', true), limit(6));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎮</div>
                    <h3>No featured games yet</h3>
                    <p>Check back soon</p>
                </div>
            `;
            return;
        }
        
        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        
        container.innerHTML = games.map(game => createGameCard(game)).join('');
        
        if (games.length > 0) {
            setHeroGame(games[0]);
        }
        
    } catch (error) {
        console.error('Error loading featured games:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>⚠️ Failed to load featured games</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

async function loadVIPGames() {
    const container = document.getElementById('vipGames');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Loading VIP games...</div>';
    
    try {
        const q = query(collection(db, 'games'), where('type', '==', 'vip'), limit(6));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👑</div>
                    <h3>No VIP games available</h3>
                    <p>VIP games coming soon</p>
                </div>
            `;
            return;
        }
        
        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        
        container.innerHTML = games.map(game => createGameCard(game)).join('');
        
    } catch (error) {
        console.error('Error loading VIP games:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>⚠️ Failed to load VIP games</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

async function loadFreeGames() {
    const container = document.getElementById('freeGames');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Loading free games...</div>';
    
    try {
        const q = query(collection(db, 'games'), where('type', '==', 'free'), limit(6));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎁</div>
                    <h3>No free games available</h3>
                    <p>Free games coming soon</p>
                </div>
            `;
            return;
        }
        
        const games = [];
        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });
        
        container.innerHTML = games.map(game => createGameCard(game)).join('');
        
    } catch (error) {
        console.error('Error loading free games:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>⚠️ Failed to load free games</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

async function loadAllGamesList() {
    try {
        const snapshot = await getDocs(collection(db, 'games'));
        allGames = [];
        snapshot.forEach(doc => {
            allGames.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading all games:', error);
    }
}

// ============================================
// LOAD USERS STATS FROM FIRESTORE
// ============================================
async function loadUsersStats() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        let total = 0;
        let online = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            total++;
            if (data.onlineStatus === true) {
                online++;
            }
        });
        
        if (totalGamesStat) totalGamesStat.textContent = allGames.length || 0;
        if (totalUsersStat) totalUsersStat.textContent = total || 0;
        if (onlineUsersStat) onlineUsersStat.textContent = online || 0;
        
        // Update hero stats
        const statNumbers = document.querySelectorAll('.hero-stat .stat-number');
        if (statNumbers.length >= 3) {
            statNumbers[0].textContent = allGames.length || 0;
            statNumbers[1].textContent = total || 0;
            statNumbers[2].textContent = online || 0;
        }
        
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// ============================================
// CREATE GAME CARD
// ============================================
function createGameCard(game) {
    const badge = game.type === 'vip' 
        ? '<span class="game-card-badge badge-vip">VIP</span>'
        : '<span class="game-card-badge badge-free">FREE</span>';
    
    const featuredBadge = game.featured 
        ? '<span class="game-card-badge badge-featured">★ Featured</span>'
        : '';
    
    const imageStyle = game.image 
        ? `background-image: url('${game.image}');`
        : `background: linear-gradient(135deg, #1a1a2e, #2d1b69);`;
    
    return `
        <div class="game-card" onclick="openGameDetail('${game.id}')">
            <div class="game-card-image" style="${imageStyle}">
                ${badge}
                ${featuredBadge}
            </div>
            <div class="game-card-content">
                <h4>${game.name || 'Unknown Game'}</h4>
                <div class="category">${game.category || 'Other'}</div>
                <div class="game-card-meta">
                    <span><i class="fas fa-code-branch"></i> ${game.version || '1.0'}</span>
                    <span><i class="fas fa-hdd"></i> ${game.size || 'Unknown'}</span>
                </div>
                <button class="btn-primary" onclick="event.stopPropagation(); openGameDetail('${game.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        </div>
    `;
}

// ============================================
// SET HERO GAME
// ============================================
function setHeroGame(game) {
    const heroImage = document.getElementById('heroGameImage');
    const heroName = document.getElementById('heroGameName');
    const heroCategory = document.getElementById('heroGameCategory');
    const heroBtn = document.getElementById('heroGameBtn');
    
    if (!heroImage || !heroName) return;
    
    if (game.image) {
        heroImage.style.backgroundImage = `url('${game.image}')`;
    }
    
    heroName.textContent = game.name || 'Featured Game';
    heroCategory.textContent = game.category || 'Featured';
    if (heroBtn) {
        heroBtn.onclick = (e) => {
            e.preventDefault();
            openGameDetail(game.id);
        };
    }
}

// ============================================
// OPEN GAME DETAIL
// ============================================
window.openGameDetail = async function(gameId) {
    const modal = document.getElementById('gameModal');
    const detailContainer = document.getElementById('gameDetail');
    
    if (!modal || !detailContainer) return;
    
    detailContainer.innerHTML = '<div class="loading-spinner">Loading game details...</div>';
    modal.classList.add('active');
    
    try {
        const docRef = doc(db, 'games', gameId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            detailContainer.innerHTML = `
                <div class="error-state">
                    <p>⚠️ Game not found</p>
                </div>
            `;
            return;
        }
        
        const game = { id: docSnap.id, ...docSnap.data() };
        
        const imageStyle = game.image 
            ? `background-image: url('${game.image}');`
            : `background: linear-gradient(135deg, #1a1a2e, #2d1b69);`;
        
        detailContainer.innerHTML = `
            <div class="game-detail-image" style="${imageStyle}"></div>
            <div class="game-detail-info">
                <h2>${game.name || 'Unknown Game'}</h2>
                <p class="detail-category"><i class="fas fa-tag"></i> ${game.category || 'Other'}</p>
                <p class="detail-description">${game.description || 'No description available'}</p>
                <div class="detail-meta">
                    <span><i class="fas fa-${game.type === 'vip' ? 'crown' : 'gift'}"></i> ${game.type === 'vip' ? 'VIP' : 'Free'}</span>
                    <span><i class="fas fa-code-branch"></i> ${game.version || '1.0.0'}</span>
                    <span><i class="fas fa-hdd"></i> ${game.size || 'Unknown'}</span>
                    <span><i class="fas fa-tag"></i> ${game.genre || 'Other'}</span>
                </div>
                <div class="detail-actions">
                    <a href="${game.downloadUrl || '#'}" class="btn-primary" target="_blank">
                        <i class="fas fa-download"></i> Download
                    </a>
                    ${game.trailerUrl ? `<a href="${game.trailerUrl}" class="btn-secondary" target="_blank">
                        <i class="fas fa-play"></i> Watch Trailer
                    </a>` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading game details:', error);
        detailContainer.innerHTML = `
            <div class="error-state">
                <p>⚠️ Failed to load game details</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
};

// ============================================
// SEARCH GAMES
// ============================================
if (searchBtn) {
    searchBtn.addEventListener('click', searchGames);
}
if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchGames();
        }
    });
}

function searchGames() {
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        loadGames();
        return;
    }
    
    const filtered = allGames.filter(game => 
        game.name?.toLowerCase().includes(query) ||
        game.category?.toLowerCase().includes(query) ||
        game.description?.toLowerCase().includes(query)
    );
    
    const sections = ['featuredGames', 'vipGames', 'freeGames'];
    sections.forEach(sectionId => {
        const container = document.getElementById(sectionId);
        if (!container) return;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No games found</h3>
                    <p>Try searching with different keywords</p>
                </div>
            `;
        } else {
            container.innerHTML = filtered.map(game => createGameCard(game)).join('');
        }
    });
}

// ============================================
// NOTIFICATIONS
// ============================================
if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
        if (notificationModal) {
            notificationModal.classList.add('active');
        }
    });
}

if (closeNotifModal) {
    closeNotifModal.addEventListener('click', () => {
        if (notificationModal) {
            notificationModal.classList.remove('active');
        }
    });
}

if (notificationModal) {
    notificationModal.addEventListener('click', (e) => {
        if (e.target === notificationModal) {
            notificationModal.classList.remove('active');
        }
    });
}

async function loadNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    
    list.innerHTML = '<div class="loading-spinner">Loading notifications...</div>';
    
    try {
        const snapshot = await getDocs(
            query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
        );
        
        if (snapshot.empty) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <h3>No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            `;
            if (notifBadge) notifBadge.textContent = '0';
            return;
        }
        
        const notifs = [];
        snapshot.forEach(doc => {
            notifs.push({ id: doc.id, ...doc.data() });
        });
        
        list.innerHTML = notifs.map(notif => `
            <div class="notification-item">
                <h4>${notif.title || 'Notification'}</h4>
                <p>${notif.message || ''}</p>
                <div class="time">${formatTime(notif.createdAt)}</div>
            </div>
        `).join('');
        
        if (notifBadge) notifBadge.textContent = notifs.length;
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        list.innerHTML = `
            <div class="error-state">
                <p>⚠️ Failed to load notifications</p>
            </div>
        `;
    }
}

// ============================================
// HELPERS
// ============================================
function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    
    return date.toLocaleDateString();
}

// ============================================
// MENU TOGGLE
// ============================================
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        if (navMenu) {
            navMenu.classList.toggle('active');
        }
    });
}

document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        if (navMenu) {
            navMenu.classList.remove('active');
        }
    });
});

// ============================================
// LOGOUT
// ============================================
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (confirm('Are you sure you want to logout?')) {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                alert('Failed to logout. Please try again.');
            }
        }
    });
}

// ============================================
// MODAL CLOSE
// ============================================
if (closeGameModal) {
    closeGameModal.addEventListener('click', () => {
        if (gameModal) {
            gameModal.classList.remove('active');
        }
    });
}

if (gameModal) {
    gameModal.addEventListener('click', (e) => {
        if (e.target === gameModal) {
            gameModal.classList.remove('active');
        }
    });
}

// ============================================
// BACK BUTTON - SETTINGS
// ============================================
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// ============================================
// SETTINGS - LOAD PROFILE DATA
// ============================================
function loadSettingsData() {
    if (!currentUserData) {
        // Try to load from Firebase
        if (currentUser) {
            loadUserData(currentUser.uid).then(() => {
                updateSettingsUI();
            });
        }
        return;
    }
    updateSettingsUI();
}

function updateSettingsUI() {
    const data = currentUserData;
    if (!data) return;
    
    if (avatarImage) {
        avatarImage.src = data.profileImage || 'https://ui-avatars.com/api/?name=User&background=7c3aed&color=fff&size=128';
    }
    if (profileName) profileName.textContent = data.fullName || 'No Name';
    if (profileUsername) profileUsername.textContent = '@' + (data.username || 'username');
    if (profileEmail) profileEmail.textContent = data.email || 'email@example.com';
    if (profilePhone) profilePhone.textContent = data.phone || '+255 700 000 000';
}

// ============================================
// SETTINGS - EDIT PROFILE
// ============================================
if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
        if (!currentUserData) {
            alert('Please wait, loading profile...');
            return;
        }
        
        const modal = document.getElementById('editProfileModal');
        if (!modal) return;
        
        document.getElementById('editFullName').value = currentUserData.fullName || '';
        document.getElementById('editUsername').value = currentUserData.username || '';
        document.getElementById('editPhone').value = currentUserData.phone || '';
        
        modal.classList.add('active');
    });
}

// Close edit profile modal
document.getElementById('closeEditProfile')?.addEventListener('click', () => {
    document.getElementById('editProfileModal')?.classList.remove('active');
});

// Edit profile form submit
document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('editFullName').value.trim();
    const username = document.getElementById('editUsername').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    
    if (!fullName || !username) {
        document.getElementById('editError').textContent = 'Full name and username required';
        document.getElementById('editError').style.display = 'flex';
        return;
    }
    
    try {
        const userId = currentUser.uid;
        await updateDoc(doc(db, 'users', userId), {
            fullName,
            username,
            phone
        });
        
        // Update local data
        currentUserData.fullName = fullName;
        currentUserData.username = username;
        currentUserData.phone = phone;
        updateSettingsUI();
        
        document.getElementById('editProfileModal').classList.remove('active');
        alert('Profile updated successfully!');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        document.getElementById('editError').textContent = 'Failed to update profile';
        document.getElementById('editError').style.display = 'flex';
    }
});

// ============================================
// SETTINGS - CHANGE PASSWORD
// ============================================
if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
        document.getElementById('changePasswordModal')?.classList.add('active');
    });
}

document.getElementById('closePasswordModal')?.addEventListener('click', () => {
    document.getElementById('changePasswordModal')?.classList.remove('active');
});

document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        document.getElementById('passwordError').textContent = 'All fields required';
        document.getElementById('passwordError').style.display = 'flex';
        return;
    }
    
    if (newPassword.length < 6) {
        document.getElementById('passwordError').textContent = 'New password must be at least 6 characters';
        document.getElementById('passwordError').style.display = 'flex';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        document.getElementById('passwordError').textContent = 'Passwords do not match';
        document.getElementById('passwordError').style.display = 'flex';
        return;
    }
    
    try {
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        
        document.getElementById('changePasswordModal').classList.remove('active');
        alert('Password changed successfully!');
        
    } catch (error) {
        console.error('Error changing password:', error);
        document.getElementById('passwordError').textContent = error.message || 'Failed to change password';
        document.getElementById('passwordError').style.display = 'flex';
    }
});

// ============================================
// SETTINGS - DELETE ACCOUNT
// ============================================
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => {
        document.getElementById('deleteAccountModal')?.classList.add('active');
    });
}

document.getElementById('closeDeleteModal')?.addEventListener('click', () => {
    document.getElementById('deleteAccountModal')?.classList.remove('active');
});

document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    document.getElementById('deleteAccountModal')?.classList.remove('active');
});

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    const confirm = document.getElementById('deleteConfirm').value;
    
    if (confirm !== 'DELETE') {
        document.getElementById('deleteError').textContent = 'Please type "DELETE" to confirm';
        document.getElementById('deleteError').style.display = 'flex';
        return;
    }
    
    try {
        const userId = currentUser.uid;
        
        // Delete from Firestore
        await deleteDoc(doc(db, 'users', userId));
        
        // Delete user from Auth
        const user = auth.currentUser;
        await user.delete();
        
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('Error deleting account:', error);
        document.getElementById('deleteError').textContent = error.message || 'Failed to delete account';
        document.getElementById('deleteError').style.display = 'flex';
    }
});

// ============================================
// SETTINGS - CHANGE PHOTO
// ============================================
if (changePhotoBtn) {
    changePhotoBtn.addEventListener('click', () => {
        if (photoInput) {
            photoInput.click();
        }
    });
}

if (photoInput) {
    photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert('File too large. Max 5MB');
            return;
        }
        
        // For now, show placeholder
        alert('Profile picture upload coming soon!');
        photoInput.value = '';
    });
}

// ============================================
// TOGGLE PASSWORD VISIBILITY
// ============================================
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        btn.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (gameModal?.classList.contains('active')) {
            gameModal.classList.remove('active');
        }
        if (notificationModal?.classList.contains('active')) {
            notificationModal.classList.remove('active');
        }
        if (editProfileModal?.classList.contains('active')) {
            editProfileModal.classList.remove('active');
        }
        if (changePasswordModal?.classList.contains('active')) {
            changePasswordModal.classList.remove('active');
        }
        if (deleteAccountModal?.classList.contains('active')) {
            deleteAccountModal.classList.remove('active');
        }
    }
});

console.log('✅ DVARY GAMES app.js loaded');
