import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForInitialization-PCCC-2026",
  authDomain: "test-e0aa0.firebaseapp.com",
  projectId: "test-e0aa0",
  storageBucket: "test-e0aa0.appspot.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
