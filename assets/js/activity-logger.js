// assets/js/activity-logger.js
import { auth, db } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

export async function logActivity(action, details = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;   // ← silently skip if not logged in

    await addDoc(collection(db, "activity_logs"), {
      uid:       user.uid,
      email:     user.email || "",
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch(e) {
    // ← Never throw — logging should never break main flow
    console.warn("Activity log failed (non-critical):", e.message);
  }
}
