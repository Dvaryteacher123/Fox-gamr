// assets/js/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// Mantiki ya Kujisajili (Signup)
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            alert('Akaunti imetengenezwa kwa mafanikio!');
            window.location.href = 'index.html';
        } catch (error) {
            alert('Hitilafu: ' + error.message);
        }
    });
}

// Mantiki ya Kuingia (Login)
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert('Umeingia kwenye akaunti kwa mafanikio!');
            window.location.href = 'index.html';
        } catch (error) {
            alert('Hitilafu: ' + error.message);
        }
    });
}

