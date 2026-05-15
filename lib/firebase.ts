import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrGWLXtr2_wCczVUnovilqTokF_zcJqI4",
  authDomain: "azisto.firebaseapp.com",
  projectId: "azisto",
  storageBucket: "azisto.firebasestorage.app",
  messagingSenderId: "608836048713",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

console.log("Firebase app initialized:", app.name);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
