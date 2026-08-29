// assets/js/chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

// Ingiza mtu moja kwa moja kimya kimya (Anonymous) kama hajalogin ili aweze kuchat bila shida
signInAnonymously(auth).catch((error) => {
  console.error("Hitilafu ya kuingia kimya kimya:", error);
});

const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Pata jina lake: Kama kasajiliwa litumie, kama ni mgeni mpe jina la Mchezaji + namba fupi
        let userName = user.displayName;
        if (!userName && user.email) {
            userName = user.email.split('@')[0];
        }
        if (!userName) {
            userName = "Mchezaji_" + user.uid.substring(0, 4);
        }

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

