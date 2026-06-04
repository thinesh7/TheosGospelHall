import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDSSa5Ve3B7uP4yu1lZteCtlaY_Lm0egnI",
  authDomain: "tgh-theosgospelhall.firebaseapp.com",
  projectId: "tgh-theosgospelhall",
  storageBucket: "tgh-theosgospelhall.firebasestorage.app",
  messagingSenderId: "770231202555",
  appId: "1:770231202555:web:2f7f1295615eb3e27e365e",
  measurementId: "G-KVJVX4Q2RJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);