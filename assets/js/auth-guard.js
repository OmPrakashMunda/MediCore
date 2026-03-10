// assets/js/auth-guard.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/**
 * Call this on every protected page.
 * @param {string[]} allowedRoles - e.g. ["patient"] or ["doctor", "admin"]
 * @param {function} onAuthorized - callback receives (user, userData)
 */
export function guardPage(allowedRoles, onAuthorized) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        redirectToLogin();
        return;
      }

      const userData = userDoc.data();

      // Check role
      if (!allowedRoles.includes(userData.role)) {
        redirectToLogin();
        return;
      }

      // Check phone verified for patients
      if (userData.role === "patient" && !userData.phoneVerified) {
        window.location.href = "/auth/verify-phone.html";
        return;
      }

      // All good — run page logic
      onAuthorized(user, userData);

    } catch (err) {
      console.error("Auth guard error:", err);
      redirectToLogin();
    }
  });
}

function redirectToLogin() {
  // Detect current path to redirect to correct login page
  const path = window.location.pathname;
  if (path.startsWith("/admin") || path.startsWith("/doctor") || path.startsWith("/lab")) {
    window.location.href = "/auth/staff-login/?role="+( path.startsWith("/admin") ? "admin" : path.startsWith("/doctor") ? "doctor" : "lab" );
  } else {
    window.location.href = "/auth/patient-login/";
  }
}
