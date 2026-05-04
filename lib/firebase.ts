// Import Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCrGWLXtr2_wCczVUnovilqTokF_zcJqI4",
  authDomain: "azisto.firebaseapp.com",
  projectId: "azisto",
  storageBucket: "azisto.firebasestorage.app",
  messagingSenderId: "608836048713",
  appId: "YOUR_APP_ID_HERE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth (THIS was missing earlier)
export const auth = getAuth(app);