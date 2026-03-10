// assets/js/activity-logger.js

import { db, auth } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/**
 * @param {string} action - e.g. "LOGIN", "BOOK_APPOINTMENT", "UPLOAD_REPORT"
 * @param {object} metadata - any extra info
 */
export async function logActivity(action, metadata = {}) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "activityLogs"), {
      uid: user.uid,
      action,
      metadata,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Activity log failed:", err);
  }
}
