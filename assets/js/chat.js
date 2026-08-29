// assets/js/chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const authWarning = document.getElementById('auth-warning');
const chatMainContainer = document.getElementById('chat-main-container');
const authLink = document.getElementById('auth-link');

// Angalia hali ya Login ya mtumiaji
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Mtumiaji amelogin
        if (authWarning) authWarning.style.display = 'none';
        if (chatMainContainer) chatMainContainer.style.display = 'block';
        if (authLink) {
            authLink.textContent = "👤 Profile";
            authLink.href = "profile.html"; // Badilisha kama unayo ukurasa wa profile
        }

        // Pata jina halisi la mtumiaji (Kutoka displayName au sehemu ya email yake)
        let userName = user.displayName;
        if (!userName) {
            userName = user.email.split('@')[0]; // Tumia sehemu ya kwanza ya email kama jina kama hana displayName
        }

        // Kuwezesha kutuma ujumbe
        if (sendBtn && chatInput) {
            // Ondoa eventListeners za zamani kwa kusafisha au tumia moja kwa moja
            sendBtn.onclick = async () => {
                const text = chatInput.value.trim();
                if (text === '') return;

                try {
                    await addDoc(collection(db, "messages"), {
                        text: text,
                        createdAt: new Date(),
                        userId: user.uid, // Muhimu kwa usalama: inazuia mtu kujifanya mwingine
                        userName: userName
                    });
                    chatInput.value = '';
                } catch (error) {
                    console.error("Hitilafu ya kutuma ujumbe: ", error);
                }
            };

            // Kutuma kwa kubonyeza Enter
            chatInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    sendBtn.click();
                }
            };
        }

    } else {
        // Mtu haja login
        if (authWarning) authWarning.style.display = 'block';
        if (chatMainContainer) chatMainContainer.style.display = 'none';
        if (authLink) {
            authLink.textContent = "👤 Login";
            authLink.href = "login.html";
        }
    }
});

// Kusoma ujumbe kwa wakati halisi (Real-time chat)
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
            // Ruhusu Edit/Delete kama ni ujumbe wake mwenyewe
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
                <div class="chat-bubble">
                    ${msg.text}
                </div>
                ${actionButtons}
            `;
            chatBox.appendChild(msgDiv);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// Vitendo vya Edit na Delete kuvisajili kwenye window global ili viweze kuitwa na HTML inline
window.deleteMessage = async (msgId) => {
    if (confirm('Una uhakika unataka kufuta ujumbe huu?')) {
        try {
            await deleteDoc(doc(db, "messages", msgId));
        } catch (error) {
            alert('Imeshindikana kufuta ujumbe: ' + error.message);
        }
    }
};

window.editMessage = async (msgId, currentText) => {
    const newText = prompt("Hariri ujumbe wako:", currentText);
    if (newText !== null && newText.trim() !== "") {
        try {
            await updateDoc(doc(db, "messages", msgId), {
                text: newText.trim()
            });
        } catch (error) {
            alert('Imeshindikana kuhariri ujumbe: ' + error.message);
        }
    }
};

