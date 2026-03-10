import { initializeApp }  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider  }        from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_AUTH_DOMAIN",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app            = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();