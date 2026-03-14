# MediCore — Security Guide

This document covers the known security issues found during the project audit, required actions before production deployment, and an ongoing hardening checklist.

---

## Severity Levels

| Level | Meaning |
|-------|---------|
| 🔴 Critical | Exploitable right now, must fix before any production use |
| 🟠 High | Significant risk, fix before going live |
| 🟡 Medium | Reduces attack surface considerably, should fix |
| 🟢 Low | Defense-in-depth hardening, fix when practical |

---

## Known Issues

### 🔴 Wildcard CORS (Node.js server)

**File**: `server/index.js`, line 31  
**Issue**: `app.use(cors())` allows requests from **any origin**. An attacker on any website can make cross-origin requests to your server using a victim's session.

**Fix**:
```javascript
// Replace:
app.use(cors());

// With:
app.use(cors({
  origin: [
    "https://your-project.web.app",
    "https://your-custom-domain.com",
    // Add localhost for development:
    "http://localhost:5500",
    "http://localhost:8080",
  ]
}));
```

---

### 🔴 Gemini API Key in Frontend Code

**File**: Some `doctor/ai-tools/index.html` variants call Gemini directly from browser JavaScript.  
**Issue**: Any visitor can read the API key from the browser DevTools Network tab or page source and use your quota without restriction.

**Fix**: All Gemini calls must go through the authenticated `/api/aiChat` endpoint on the Node.js server. The server-side route already exists and is protected by `verifyAuth`. Remove any client-side `GoogleGenAI` calls and replace them with `fetch('/api/aiChat', ...)` with the Firebase ID token.

---

### 🟠 Stored XSS via innerHTML with Unsanitized Firestore Data

**Affected files** (non-exhaustive):
- `patient/dashboard/index.html`
- `doctor/patients/index.html`
- `admin/staff/index.html`
- `doctor/reports/index.html`

**Issue**: Firestore document fields (e.g. patient names, notes, report contents) are interpolated directly into HTML strings set via `innerHTML`:

```javascript
// Vulnerable pattern:
container.innerHTML = `<div>${userData.name}</div>`;
// If userData.name = "<script>alert(1)</script>", the script executes.
```

An attacker with write access to Firestore (e.g. a patient who sets their name to a script tag) can execute arbitrary JavaScript in the browser of any user who views that data.

**Fix (option 1 — preferred)**: Use `textContent` or `innerText` for any field that comes from user input or Firestore:
```javascript
const el = document.createElement("div");
el.textContent = userData.name;  // Safe — browser escapes HTML
container.appendChild(el);
```

**Fix (option 2)**: Use a DOM sanitizer for the few cases where HTML formatting is genuinely needed:
```javascript
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.es.mjs";
container.innerHTML = DOMPurify.sanitize(userData.bio);
```

---

### 🟠 Overly Permissive Firestore Rules

**File**: `firestore.rules`

#### Issue 1 — Any authenticated user can read all other users' profiles

```javascript
// Current (overly broad):
match /users/{uid} {
  allow read: if isSignedIn();
  // ...
}
```

A patient can query `users?where role == "admin"` and get all admin profiles, including names and emails.

**Fix**: Allow users to read their own profile; allow staff to read patient profiles; restrict admin profile lookups:
```javascript
match /users/{uid} {
  allow read: if isOwner(uid)  // own profile
           || hasAnyRole(["doctor", "lab", "admin"]);  // staff can look up anyone
  // Patients can only see their own profile via isOwner
```

#### Issue 2 — Any authenticated user can read all appointments

```javascript
// Current:
match /appointments/{apptId} {
  allow read: if isSignedIn();
```

A patient can list all appointments for all doctors and all other patients.

**Fix**: Scope reads to the authenticated user's own appointments:
```javascript
match /appointments/{apptId} {
  allow read: if isSignedIn()
           && (resource.data.patientId == request.auth.uid
               || resource.data.doctorId == request.auth.uid
               || hasRole("admin"));
```

Note: appointment slot availability checking (for booking) requires a different query shape — use a Cloud Function or a separate `availability/{doctorId}/slots` subcollection that is publicly readable.

#### Issue 3 — Any authenticated user can read all reports

```javascript
// Current:
match /reports/{reportId} {
  allow read: if isSignedIn();
```

Patients can read other patients' lab reports.

**Fix**: Already partially addressed in the rules — verify the rule grants read access only to the patient on the report, the assigned doctor, and admin.

---

### 🟡 serviceAccountKey.json Committed to Repository

**Files**: `server/serviceAccountKey.json`, `functions/serviceAccountKey.json`

**Issue**: The Firebase service account private key grants full admin access to your Firebase project. If this is in git history, it is permanently exposed.

**Status**: Both files are now in `.gitignore` and should not be committed going forward.

**Action required**:
1. Check if either file was ever committed: `git log --all --full-history -- "server/serviceAccountKey.json"`
2. If yes, **revoke the compromised key immediately**:
   - Firebase Console → Project Settings → Service Accounts → Find the key → Delete
   - Generate a new key
3. If the git history contains the key, rewrite history with `git filter-repo` or consider the repository compromised and rotate all credentials.

---

### 🟡 Real Credentials in functions/.env

**File**: `functions/.env`

**Issue**: Real SMTP credentials (Gmail App Password) and Gemini API key were found committed in plaintext.

**Status**: `functions/.env` is now in `.gitignore`.

**Action required**:
1. Check git history: `git log --all --full-history -- "functions/.env"`
2. If committed, **immediately**:
   - Revoke the Gmail App Password (Google Account → Security → App Passwords → Delete)
   - Rotate the Gemini API key (Google AI Studio → API Keys → Delete → Create new)
3. If using Firebase Cloud Functions, set secrets via the CLI instead of `.env` files:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   firebase functions:secrets:set MAIL_PASS
   ```

---

### 🟡 Firebase API Key Hardcoded in firebase-config.js

**File**: `assets/js/firebase-config.js`

**Clarification**: Firebase web API keys are **not secret** — they are intentionally public and identify your Firebase project to the SDK. They cannot be used to access Firestore or Auth without proper rules/tokens. However, an exposed API key can be misused to:
- Spam your Authentication endpoint (sign-up flooding)
- Misuse Firebase App Check bypass

**Mitigations**:
1. Add your site's domain to **Firebase Console → Authentication → Settings → Authorized domains** (prevents the Auth API from accepting requests from unknown domains)
2. Enable **Firebase App Check** with reCAPTCHA v3 for Auth and Firestore
3. Set **API key restrictions** in Google Cloud Console (restrict to specific HTTP referers / APIs)

`firebase-config.js` is in `.gitignore`. Do not commit it.

---

### 🟢 Missing Rate Limiting on /predict

**Issue**: `POST /predict` is unauthenticated and allows unlimited requests. An attacker could spam the endpoint to consume CPU resources and deny service to legitimate users.

**Fix**: Add rate limiting using `express-rate-limit`:
```bash
npm install express-rate-limit
```
```javascript
import rateLimit from "express-rate-limit";

const predictLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,               // 10 requests per IP per minute
  message: { error: "Too many requests. Please wait before trying again." }
});

app.post("/predict", predictLimiter, upload.single("file"), async (req, res) => { ... });
```

---

### 🟢 No Input Validation on /api/aiChat Message

**Issue**: The `message` field passed to Gemini is not sanitized or length-limited. A very long message could cause excessive API usage or token costs.

**Fix**:
```javascript
if (!message || typeof message !== "string") {
  return res.status(400).json({ error: "Message is required." });
}
if (message.length > 4000) {
  return res.status(400).json({ error: "Message too long (max 4000 characters)." });
}
```

---

## Secrets That Must Never Be Committed

| File | Contains |
|------|----------|
| `server/serviceAccountKey.json` | Firebase Admin private key (full project access) |
| `functions/serviceAccountKey.json` | Same — full project access |
| `server/.env` | Gemini API key, SMTP password |
| `functions/.env` | Gemini API key, SMTP password |
| `assets/js/firebase-config.js` | Firebase web config (not secret, but still excluded) |

All of the above are listed in `.gitignore`. Verify with `git status` before every commit.

---

## Pre-Production Hardening Checklist

- [ ] **CORS**: Restrict `cors()` to your production domain(s) only
- [ ] **XSS**: Audit all `innerHTML` assignments — replace with `textContent` or DOMPurify
- [ ] **Firestore rules**: Scope appointment and report reads to owner/doctor/admin only
- [ ] **Rate limiting**: Add `express-rate-limit` to `/predict` and `/api/aiChat`
- [ ] **Gemini key**: Remove from any frontend code; ensure it is only in `server/.env`
- [ ] **Service account keys**: Verify not in git history; rotate if ever committed
- [ ] **SMTP credentials**: Verify not in git history; rotate Gmail App Password if ever committed
- [ ] **Firebase App Check**: Enable for Auth and Firestore to prevent API abuse
- [ ] **HTTPS only**: Ensure the Node.js server is behind a TLS-terminating reverse proxy (nginx/Caddy) in production
- [ ] **Helmet.js**: Add `helmet` middleware to the Express server:
  ```bash
  npm install helmet
  ```
  ```javascript
  import helmet from "helmet";
  app.use(helmet());
  ```
- [ ] **Logging & monitoring**: Enable Firebase alerting for Auth sign-in anomalies; add server-side request logging

---

## Responsible Disclosure

If you discover a security vulnerability in this project, please report it privately by contacting the project maintainer before publishing any details.
