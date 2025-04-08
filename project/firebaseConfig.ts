// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAhhsZ2bmpr85rQ5p9PPwFmxd1KOZEEXuU",
  authDomain: "sc2006-75145.firebaseapp.com",
  projectId: "sc2006-75145",
  storageBucket: "sc2006-75145.firebasestorage.app",
  messagingSenderId: "293976246944",
  appId: "1:293976246944:web:8111803c48e8aa710357c5",
  measurementId: "G-CJ6KL48GM2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);