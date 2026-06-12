import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBEjcUQOjls3jYvrPiF4eillLdvWT0V1RE",
    authDomain: "diacare-project-6bb9e.firebaseapp.com",
    projectId: "diacare-project-6bb9e",
    storageBucket: "diacare-project-6bb9e.firebasestorage.app",
    messagingSenderId: "881722261956",
    appId: "1:881722261956:web:78afaf70f40e15d1c46491",
    measurementId: "G-BZKT00E3C5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
