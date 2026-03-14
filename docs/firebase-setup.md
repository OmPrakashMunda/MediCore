# MediCore — Firebase Setup Guide

This guide walks through creating and configuring the Firebase project that backs MediCore.

---

## 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Enter a project name (e.g. `medicore-hospital`)
4. Choose whether to enable Google Analytics (optional)
5. Click **Create project**

---

## 2. Enable Authentication

1. In the Firebase Console, go to **Authentication** → **Get started**
2. Enable the **Email/Password** provider:
   - Click **Email/Password** → Enable → Save
3. Enable the **Google** provider:
   - Click **Google** → Enable
   - Set a support email address
   - Save
4. (Optional) Enable **Phone** authentication for patient OTP verification:
   - Click **Phone** → Enable → Save

### Creating the First Admin Account

There is no `setup.html` bootstrapper (it was removed for security). Create the first admin manually:

1. In Firebase Console → **Authentication** → **Add user**
2. Enter the admin's email and a strong password → **Add user**
3. Note the generated **UID**
4. In **Firestore Database** → start a collection `users`
5. Add a document with the ID set to the admin's UID:
   ```
   name: "Admin Name"
   email: "admin@hospital.com"
   role: "admin"
   phoneVerified: true
   createdAt: (server timestamp)
   ```
6. The admin can now log in at `/auth/staff-login/` and use the admin portal to create additional staff accounts.

---

## 3. Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Choose **Start in production mode** (rules will be deployed via CLI)
3. Select a Cloud Firestore location near your users
4. Click **Enable**

### Deploy Security Rules

The rules are in `firestore.rules` at the project root. Deploy them with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # Select your project if not already linked
firebase deploy --only firestore:rules
```

Verify the rules were applied by checking **Firestore → Rules** in the console.

---

## 4. Enable Cloud Storage

1. Go to **Storage** → **Get started**
2. Choose **Start in production mode**
3. Select a storage location (should match your Firestore region)
4. Click **Next** → **Done**

Storage is used for:
- Lab report PDFs uploaded by lab technicians
- Hospital logo images uploaded from Admin Settings

---

## 5. Get the Firebase Web Configuration

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** → click **Add app** → select the **Web** platform (`</>`)
3. Register the app with a nickname (e.g. `MediCore Web`)
4. Copy the `firebaseConfig` object

Create `assets/js/firebase-config.js` (do **not** commit this file — it is in `.gitignore`):

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

An example template is at `assets/js/firebase-config.example.js`.

---

## 6. Get a Service Account Key (for the Node.js Server)

The Node.js server uses the Firebase Admin SDK to verify ID tokens and read/write Firestore server-side.

1. In Firebase Console → **Project Settings** → **Service accounts**
2. Click **Generate new private key** → **Generate key**
3. Save the downloaded JSON as `server/serviceAccountKey.json`

**Never commit this file.** It is listed in `.gitignore`.

If `server/serviceAccountKey.json` is not present, the Admin SDK falls back to **Application Default Credentials** (ADC). On Google Cloud services (Cloud Run, App Engine, GCE), ADC is automatically configured. For local development, always use the service account key file.

---

## 7. Configure Firebase Hosting

`firebase.json` is already configured for hosting. To point Firebase Hosting to your project:

```bash
firebase use --add
# Select your project from the list
# Assign an alias, e.g. "default"
```

Deploy the frontend:

```bash
firebase deploy --only hosting
```

Your site will be available at `https://your-project.web.app`.

---

## 8. Configure Authorized Domains

For the Google OAuth popup to work on your production domain:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add your production domain (e.g. `your-project.web.app` is added automatically; add any custom domains)

---

## 9. Phone Authentication (Optional)

Phone OTP is used for patient verification after registration.

1. Enable **Phone** in **Authentication → Sign-in method** (done in step 2)
2. For local development, add test phone numbers:
   - **Authentication → Sign-in method → Phone → Phone numbers for testing**
   - Add a number like `+1 555-000-0000` with a fixed OTP code `123456`
3. The `auth/verify-phone/` page uses `RecaptchaVerifier` + `signInWithPhoneNumber` from Firebase Auth

---

## Firestore Indexes

Some queries in MediCore require composite indexes. Firebase will log a link in the browser console when an index is missing. Click the link to create the index automatically, or create the indexes manually in **Firestore → Indexes**.

Common indexes needed:
- `appointments` — `doctorId` + `date` + `status`
- `appointments` — `patientId` + `date`
- `reports` — `patientId` + `createdAt`
- `activity_logs` — `userId` + `timestamp`

---

## Summary Checklist

- [ ] Firebase project created
- [ ] Email/Password and Google Auth providers enabled
- [ ] First admin account created manually in Auth + Firestore
- [ ] Firestore database created and rules deployed
- [ ] Cloud Storage enabled
- [ ] `assets/js/firebase-config.js` created from the web app config
- [ ] `server/serviceAccountKey.json` downloaded and placed in `server/`
- [ ] Firebase Hosting linked to project (`firebase use --add`)
- [ ] Authorized domains configured for production
