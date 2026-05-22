import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";
import { getStorage } from "firebase/storage";

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

// TODO: Enable Firebase App Check before production.
export const auth = getAuth(app);
export const authPersistenceReady =
  typeof window === "undefined"
    ? Promise.resolve()
    : setPersistence(auth, browserLocalPersistence)
        .then(() => {
          console.log("Firebase auth persistence set to browser local storage");
        })
        .catch((error) => {
          console.error("Firebase auth persistence setup failed:", error);
        });
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
