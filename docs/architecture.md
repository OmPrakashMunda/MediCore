# MediCore — System Architecture

## Overview

MediCore uses a three-tier architecture:

1. **Frontend** — static HTML pages hosted on Firebase Hosting (or any static file server)
2. **Node.js API Server** — Express.js on port 3001, responsible for auth-protected APIs, email, AI chat, and ML inference routing
3. **Python Worker** — a persistent child process spawned by Node.js, which holds the Keras model in memory and performs brain tumor classification

Firebase provides the database (Firestore), object storage, and user authentication as managed backend-as-a-service.

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                           BROWSER                                │
│                                                                  │
│  Patient / Doctor / Lab / Admin portals                          │
│  Tailwind CSS · Font Awesome · Inter                             │
│  Firebase JS SDK v11.4.0                                         │
│                                                                  │
│  ┌───────────────────────┐   ┌────────────────────────────────┐ │
│  │  Firebase SDK (client)│   │  Fetch   /predict  /api/aiChat │ │
│  │  Auth · Firestore     │   │  (HTTPS to Node.js server)     │ │
│  │  Storage              │   └──────────────┬─────────────────┘ │
│  └───────────┬───────────┘                  │                   │
└──────────────│──────────────────────────────│───────────────────┘
               │ Firebase SDK calls           │ HTTP/HTTPS
               ▼                              ▼
  ┌────────────────────┐        ┌────────────────────────────────┐
  │   Firebase Platform │        │      Node.js Express Server    │
  │                    │        │       server/index.js          │
  │  • Auth service    │        │       Port 3001                │
  │  • Firestore DB    │        │                                │
  │  • Cloud Storage   │        │  ┌─────────────────────────┐  │
  │  • Firebase Hosting│        │  │  verifyAuth middleware   │  │
  └────────────────────┘        │  │  (Firebase ID token)     │  │
                                │  └─────────────────────────┘  │
                                │                                │
                                │  Routes:                       │
                                │  GET  /health                  │
                                │  GET  /metadata                │
                                │  POST /predict ──────────┐    │
                                │  POST /api/aiChat        │    │
                                │  POST /api/sendWelcomeEmail    │
                                │  GET  /api/health        │    │
                                └──────────────────────────│────┘
                                                           │ stdin/stdout (JSON)
                                                           ▼
                                         ┌─────────────────────────────┐
                                         │   Python Worker (child proc) │
                                         │   server/python-worker.py   │
                                         │                             │
                                         │   EfficientNetV2S (Keras 3) │
                                         │   260×260 RGB, 4 classes    │
                                         │   98.69% validation accuracy│
                                         │                             │
                                         │   Loads model at startup,   │
                                         │   stays alive for all reqs  │
                                         └─────────────────────────────┘
```

---

## Data Flows

### 1. Patient Login

```
Browser (patient-login)
  → Firebase Auth: signInWithEmailAndPassword / signInWithPopup (Google)
  → onAuthStateChanged fires
  → auth-guard.js reads users/{uid} from Firestore
  → checks role == "patient" && phoneVerified == true
  → redirects to /patient/dashboard/
```

### 2. Book an Appointment

```
Browser (patient/appointments)
  → Firestore: query doctors/ for availability slots
  → Firestore: query appointments/ for existing bookings on that date
  → Firestore: addDoc to appointments/ with {patientId, doctorId, date, slot, status: "pending"}
  → Doctor dashboard updates in real-time via onSnapshot listener
```

### 3. Brain Tumor Prediction

```
Browser (doctor/predict)
  → Multipart POST /predict to Node.js server (image in 'file' field)
     │
     ▼ server/index.js
  → Extension validation (.jpg/.jpeg/.png/.bmp/.webp)
  → requestPrediction(req.file.buffer)
     │
     │  Serialization:
     │  { type: "predict", id: "<uuid>", imageBase64: "<base64>" }
     │  Written to python worker's stdin as a single JSON line
     │
     ▼ server/python-worker.py
  → base64 decode → tf.io.decode_image → tf.image.resize([260,260])
  → model(batch, training=False) → softmax probabilities
  → { id, success:true, prediction:{class, confidence}, probabilities:{...} }
  → Written to stdout as a single JSON line
     │
     ▼ server/index.js (readline listener)
  → Matches response to pending UUID in pendingPredictions Map
  → Resolves the Promise
  → Returns JSON to browser: { success, prediction, probabilities }
```

### 4. AI Chat

```
Browser (doctor/ai-tools)
  → POST /api/aiChat with Bearer token
     │
     ▼ server/index.js
  → verifyAuth: firebase-admin.auth().verifyIdToken(token)
  → GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  → Gemini 2.5 Flash: system prompt + chat history + user message
  → Returns AI response text
```

### 5. Staff Email

```
Browser (admin/staff)
  → POST /api/sendWelcomeEmail with Bearer token
     │
     ▼ server/index.js
  → verifyAuth
  → Nodemailer transporter.sendMail() via SMTP (Gmail App Password)
  → Returns { success: true }
```

---

## Python Worker IPC Protocol

The Node.js server and Python worker communicate over stdio using newline-delimited JSON (NDJSON).

### Startup

Node spawns Python with `PYTHONUNBUFFERED=1` so stdout is not buffered.  
Python emits a single ready message on startup:

```json
{ "type": "ready", "classes": ["glioma", "meningioma", "notumor", "pituitary"] }
```

If startup fails, Python emits a fatal message and exits:

```json
{ "type": "fatal", "error": "Keras model not found at ..." }
```

### Prediction Request (Node → Python, on stdin)

```json
{ "type": "predict", "id": "550e8400-e29b-41d4-a716-446655440000", "imageBase64": "<base64-encoded-image-bytes>" }
```

### Prediction Response (Python → Node, on stdout)

**Success:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "prediction": { "class": "glioma", "confidence": 0.9821 },
  "probabilities": { "glioma": 0.9821, "meningioma": 0.0098, "notumor": 0.0062, "pituitary": 0.0019 }
}
```

**Failure:**
```json
{ "id": "550e8400-e29b-41d4-a716-446655440000", "success": false, "error": "Decode error: ..." }
```

### Request Tracking

Node uses a `Map<uuid, {resolve, reject}>` (`pendingPredictions`) to match responses to outstanding requests by UUID. Multiple concurrent requests are supported — they are serialized on the Python side by the stdin loop (Python processes one at a time, but Node can pipeline requests while Python catches up).

---

## Auth Guard

Every protected page loads `assets/js/auth-guard.js` which:

1. Calls `onAuthStateChanged` (Firebase Auth)
2. Reads `users/{uid}` from Firestore
3. Validates `role` matches the page's allowed roles
4. For patients: validates `phoneVerified == true`
5. On failure: redirects to the appropriate login page

```javascript
// Usage in every protected page:
guardPage(["doctor"], (user, userData) => {
  // page initialization with verified user context
});
```

---

## Firestore Data Model

```
users/{uid}
  role: "patient" | "doctor" | "lab" | "admin"
  name, email, phone, photoURL
  phoneVerified: boolean  (patients only)
  └── vitals/{vitalId}
        bp, heartRate, temperature, spo2, weight, height
        recordedBy: doctorId, timestamp

doctors/{uid}
  specialty, bio, maxPatientsPerDay
  availability: { monday: {enabled, slots:[]}, ... }

appointments/{apptId}
  patientId, doctorId
  date (YYYY-MM-DD), slot (e.g. "09:00")
  status: "pending" | "confirmed" | "completed" | "cancelled"

reports/{reportId}
  patientId, doctorId, uploadedBy (lab uid)
  testName, fileUrl (Storage), status
  verificationStatus: "pending" | "verified" | "rejected"

analyses/{analysisId}
  doctorId, patientId (optional)
  imageUrl, prediction, confidence, probabilities
  timestamp

activity_logs/{logId}
  userId, action, details, timestamp, ipAddress

settings/hospital
  hospitalName, logoUrl, primaryColor, secondaryColor, font
  smtp: { host, port, user }  (password NOT stored here — stored server-side in .env)
```

---

## Security Model

- **Authentication**: Firebase Auth issues ID tokens, verified server-side with `firebase-admin.auth().verifyIdToken()` on all `/api/*` routes.
- **Authorization**: Firestore RBAC rules enforce role-based access at the database level. Rules live in `firestore.rules` and are deployed separately from the frontend code.
- **File upload**: Multer limits file size to 10 MB and the `POST /predict` route validates file extension before sending to the Python worker.
- **Secrets**: All secrets (Gemini key, SMTP password, service account key) are stored in `server/.env` and `server/serviceAccountKey.json`, neither of which is committed to version control.

See [security.md](security.md) for the full security audit and hardening checklist.
