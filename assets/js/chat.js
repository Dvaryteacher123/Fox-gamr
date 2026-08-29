// assets/js/chat.js - Kudhibiti Magame halisi, Search, na Community Real-time Chat
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCmwASW4XXQ3O0AvsCM_r1WLlrUmGjYVxI",
  authDomain: "dvary-9a7d0.firebaseapp.com",
  projectId: "dvary-9a7d0",
  storageBucket: "dvary-9a7d0.firebasestorage.app",
  messagingSenderId: "107370806066",
  appId: "1:107370806066:web:4c2ce1e6f7b6c32909f52b",
  measurementId: "G-07361LFJEP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 1. Kuvuta Magame halisi kutoka Firestore na kuyapanga sehemu husika
const gamesContainer = document.getElementById('games-container');
const vipContainer = document.getElementById('vip-games-container');
const freeContainer = document.getElementById('free-games-container');
const notificationBadge = document.getElementById('notification-badge');
const searchInput = document.getElementById('game-search-input');

let allGamesData = [];

if (gamesContainer) {
    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allGamesData = [];
        snapshot.forEach((docSnap) => {
            allGamesData.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (notificationBadge) {
            notificationBadge.textContent = allGamesData.length;
        }

        renderGames(allGamesData);
    });
}

// Kazi ya kuonyesha magame kulingana na vichujio au search
function renderGames(gamesList) {
    if (!gamesContainer) return;
    
    gamesContainer.innerHTML = '';
    if (vipContainer) vipContainer.innerHTML = '';
    if (freeContainer) freeContainer.innerHTML = '';

    if (gamesList.length === 0) {
        gamesContainer.innerHTML = `<p style="color: #888; text-align: center; grid-column: 1/-1;">Hakuna magame yaliyopatikana.</p>`;
        return;
    }

    gamesList.forEach((game) => {
        const card = document.createElement('div');
        card.className = 'game-card';

        let linksHTML = '';
        if (game.downloadLinks && game.downloadLinks.length > 0) {
            game.downloadLinks.forEach((link, index) => {
                linksHTML += `<a href="${link}" target="_blank" class="download-btn">Download Server ${index + 1}</a>`;
            });
        }

        card.innerHTML = `
            <img src="${game.imageUrl || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=500&q=80'}" alt="${game.title}">
            <h3>${game.title}</h3>
            <div class="game-meta">
                <span>⭐ 4.8</span>
                <span>${game.category || 'Action'}</span>
            </div>
            <div class="download-links-container">
                ${linksHTML}
            </div>
        `;

        // Gawanya kwenye section kuu
        gamesContainer.appendChild(card);
        
        // Mfano wa kutenga VIP na Free kama zinasomeka kwenye database
        if (game.isVip && vipContainer) {
            vipContainer.appendChild(card.cloneNode(true));
        } else if (freeContainer) {
            freeContainer.appendChild(card.cloneNode(true));
        }
    });
}

// Search functionality halisi
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const filtered = allGamesData.filter(g => g.title.toLowerCase().includes(keyword));
        renderGames(filtered);
    });
}

// 2. Mfumo wa Community Chat (Kutumia Authentication jina halisi la user)
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const authWarning = document.getElementById('auth-warning');
const chatMainContainer = document.getElementById('chat-main-container');
const authLink = document.getElementById('auth-link');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (authWarning) authWarning.style.display = 'none';
        if (chatMainContainer) chatMainContainer.style.display = 'block';
        if (authLink) authLink.textContent = "👤 Profile";

        let userName = user.displayName || user.email.split('@')[0];

        if (sendBtn && chatInput) {
            sendBtn.onclick = async () => {
                const text = chatInput.value.trim();
                if (text === '') return;

                try {
                    await addDoc(collection(db, "messages"), {
                        text: text,
                        createdAt: new Date(),
                        userId: user.uid,
                        userName: userName
                    });
                    chatInput.value = '';
                } catch (error) {
                    console.error("Hitilafu ya kutuma ujumbe: ", error);
                }
            };

            chatInput.onkeydown = (e) => {
                if (e.key === 'Enter') sendBtn.click();
            };
        }
    } else {
        if (authWarning) authWarning.style.display = 'block';
        if (chatMainContainer) chatMainContainer.style.display = 'none';
        if (authLink) authLink.textContent = "👤 Login";
    }
});

// Kusoma ujumbe wa Community kwa wakati halisi
if (chatBox) {
    const chatQuery = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(chatQuery, (snapshot) => {
        chatBox.innerHTML = '';
        
        if (snapshot.empty) {
            chatBox.innerHTML = `<p style="text-align: center; color: #777; margin-top: 2rem;">👥 Karibu kwenye DVARY Community<br>Kuwa mtu wa kwanza kutuma ujumbe.</p>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const msgId = docSnap.id;
            const currentUser = auth.currentUser;
            const isMyMessage = currentUser && currentUser.uid === msg.userId;

            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message-item ${isMyMessage ? 'my-message' : 'other-message'}`;

            let actionButtons = '';
            if (isMyMessage) {
                actionButtons = `
                    <div class="message-actions">
                        <button onclick="window.editMessage('${msgId}', '${msg.text.replace(/'/g, "\\'")}')">Edit</button>
                        <button onclick="window.deleteMessage('${msgId}')">Delete</button>
                    </div>
                `;
            }

            msgDiv.innerHTML = `
                <div class="chat-user-name">${msg.userName || 'Mchezaji'}</div>
                <div class="chat-bubble">${msg.text}</div>
                ${actionButtons}
            `;
            chatBox.appendChild(msgDiv);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

window.deleteMessage = async (msgId) => {
    if (confirm('Una uhakika unataka kufuta ujumbe huu?')) {
        try {
            await deleteDoc(doc(db, "messages", msgId));
        } catch (error) {
            alert('Imeshindikana kufuta ujumbe.');
        }
    }
};

window.editMessage = async (msgId, currentText) => {
    const newText = prompt("Hariri ujumbe wako:", currentText);
    if (newText !== null && newText.trim() !== "") {
        try {
            await updateDoc(doc(db, "messages", msgId), { text: newText.trim() });
        } catch (error) {
            alert('Imeshindikana kuhariri ujumbe.');
        }
    }
};
