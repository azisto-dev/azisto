import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCrGWLXtr2_wCczVUnovilqTokF_zcJqI4",
  authDomain: "azisto.firebaseapp.com",
  projectId: "azisto",
  storageBucket: "azisto.firebasestorage.app",
  messagingSenderId: "608836048713",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
