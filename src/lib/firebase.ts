import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase config — replace with actual values in production
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

if ((import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-project') === 'demo-project') {
  console.warn(
    '[firebase] VITE_FIREBASE_PROJECT_ID is not configured — falling back to "demo-project". ' +
    'Firestore writes will be rejected in production. Set the VITE_FIREBASE_* env variables.'
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export default app;
