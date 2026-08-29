// assets/js/admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const addGameForm = document.getElementById('add-game-form');
if (addGameForm) {
    addGameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('game-title').value;
        const imageUrl = document.getElementById('game-image').value;
        
        // Kukusanya URL zote za download (hadi 7) zilijazwa na admin
        const urlInputs = document.querySelectorAll('input[name="download-url"]');
        const downloadLinks = [];
        urlInputs.add ? urlInputs.forEach(input => {
            if (input.value.trim() !== '') {
                downloadLinks.push(input.value.trim());
            }
        }) : null;

        try {
            await addDoc(collection(db, "games"), {
                title: title,
                imageUrl: imageUrl,
                downloadLinks: downloadLinks,
                createdAt: new Date()
            });
            
            alert('Game limechapishwa kwa mafanikio!');
            addGameForm.reset();
        } catch (error) {
            alert('Hitilafu wakati wa kuchapisha: ' + error.message);
        }
    });
}

