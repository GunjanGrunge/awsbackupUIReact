import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Add authorized domains
const authorizedDomains = [
  'localhost',
  'backupapp-bbf71.firebaseapp.com',
  'backupapp-bbf71.web.app',
  'main.ddw9ju6w12x1q.amplifyapp.com'
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Update reCAPTCHA configuration for production
auth.settings.appVerificationDisabledForTesting = false;
auth.useDeviceLanguage(); // Use the default browser language

// Force reCAPTCHA v2
auth.settings = {
  ...auth.settings,
  recaptchaParameters: {
    size: 'normal',
    badge: 'bottomright',
    theme: 'light'
  }
};

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
