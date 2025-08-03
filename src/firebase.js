// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC7-csoZhhfuwiDUjT2bzg1vzjmDFdFOZ8",
  authDomain: "airbrushnink-9f735.firebaseapp.com",
  projectId: "airbrushnink-9f735",
  storageBucket: "airbrushnink-9f735.firebasestorage.app",
  messagingSenderId: "215988959144",
  appId: "1:215988959144:web:112df869e6d191c0970f9d"
};
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app); // 🔥 ADD THIS

export { auth, storage, db }; // 🔥 MAKE SURE THIS LINE EXPORTS db
