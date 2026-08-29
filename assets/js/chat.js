// assets/js/chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);

// 1. Kuonyesha Games na link zake zote za download kwenye ukurasa wa nyumbani
const gamesContainer = document.getElementById('games-container');
const notificationBadge = document.getElementById('notification-badge');

if (gamesContainer) {
    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        gamesContainer.innerHTML = '';
        let gameCount = snapshot.docs.length;
        
        // Sasisha idadi kwenye notification badge
        if (notificationBadge) {
            notificationBadge.textContent = gameCount;
        }

        snapshot.forEach((docSnap) => {
            const game = docSnap.data();
            const card = document.createElement('div');
            card.className = 'game-card';

            // Kutengeneza vifungo vya kupakua (Download Links) vilivyowekwa na admin
            let linksHTML = '';
            if (game.downloadLinks && game.downloadLinks.length > 0) {
                game.downloadLinks.forEach((link, index) => {
                    linksHTML += `<a href="${link}" target="_blank" class="download-btn">Download Server ${index + 1}</a>`;
                });
            }

            card.innerHTML = `
                <img src="${game.imageUrl}" alt="${game.title}">
                <h3>${game.title}</h3>
                <div class="download-links-container">
                    ${linksHTML}
                </div>
            `;
            gamesContainer.appendChild(card);
        });
    });
}

// 2. Mfumo wa Chat ya Jamii (Community Chat)
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

if (chatBox && chatInput && sendBtn) {
    // Tuma ujumbe mpya kwenye Firestore
    sendBtn.addEventListener('click', async () => {
        const text = chatInput.value.trim();
        if (text === '') return;

        try {
            await addDoc(collection(db, "messages"), {
                text: text,
                createdAt: new Date(),
                user: "Mchezaji"
            });
            chatInput.value = '';
        } catch (error) {
            console.error("Hitilafu ya kutuma ujumbe: ", error);
        }
    });

    // Kusoma na kusasisha jumbe kwa wakati halisi (Real-time chat)
    const chatQuery = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(chatQuery, (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const msgDiv = document.createElement('div');
            msgDiv.style.marginBottom = '0.5rem';
            msgDiv.innerHTML = `<strong style="color: #ff4757;">${msg.user}:</strong> ${msg.text}`;
            chatBox.appendChild(msgDiv);
        });
        chatBox.scrollTop = chatBox.scrollHeight; // Kushusha sehemu ya chat chini moja kwa moja
    });
}

