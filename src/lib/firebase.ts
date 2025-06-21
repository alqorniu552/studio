import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

// Check if all necessary client-side Firebase config values are present.
// If not, the app can still run, but auth features will be disabled.
const isFirebaseClientConfigured = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;

if (isFirebaseClientConfigured) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app!);
} else {
    // The app will not crash, and the UI will show a warning.
    console.warn("Client-side Firebase config is missing. Auth features will be disabled.");
}

export { app, auth, isFirebaseClientConfigured };
