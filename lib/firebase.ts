import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyCrGWLXtr2_wCczVUnovilqTokF_zcJqI4",
  authDomain: "azisto.firebaseapp.com",
  projectId: "azisto",
  storageBucket: "azisto.firebasestorage.app",
  messagingSenderId: "608836048713",
  appId: "1:608836048713:web:825be31d0e06b05ca2ac98",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

console.log("Firebase app initialized:", app.name);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
