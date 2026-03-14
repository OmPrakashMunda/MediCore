# MediCore — Hospital Management System

A full-stack, multi-role healthcare web application. MediCore provides separate portals for **Patients**, **Doctors**, **Lab Technicians**, and **Admins** — covering appointment scheduling, lab report management, AI-powered medical assistance, brain tumor detection from MRI scans, and patient vitals tracking.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Patient  │ │  Doctor  │ │   Lab    │ │  Admin   │          │
│  │  Portal  │ │  Portal  │ │  Portal  │ │  Portal  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│        Firebase JS SDK v11.4.0 (Auth · Firestore · Storage)   │
│        Tailwind CSS CDN · Font Awesome · Inter font           │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS
           ┌────────────────┼──────────────────┐
           ▼                ▼                  ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
  │   Firebase   │  │  Node.js API │  │  Python Worker       │
  │   Platform   │  │  Express     │  │  (child process)     │
  │              │  │  Port 3001   │  │                      │
  │ • Auth       │  │              │  │  EfficientNetV2S     │
  │ • Firestore  │  │ • /predict   │  │  Keras model loaded  │
  │ • Storage    │  │ • AI Chat    │  │  in memory           │
  │ • Hosting    │  │ • Email      │  │                      │
  └──────────────┘  │ • RBAC auth  │  │  JSON over stdin/    │
                    └──────┬───────┘  │  stdout (IPC)        │
                           └──────────┤                      │
                            spawns    └──────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                                                               |
|----------------|--------------------------------------------------------------------------|
| **Frontend**   | HTML5, Tailwind CSS (CDN), Font Awesome 6.5, Inter font                  |
| **Auth**       | Firebase Authentication (Email/Password + Google OAuth + Phone OTP)      |
| **Database**   | Cloud Firestore (NoSQL, real-time)                                       |
| **Storage**    | Firebase Cloud Storage (logos, report PDFs)                              |
| **Node API**   | Express.js — AI chat (Gemini 2.5 Flash), email (Nodemailer SMTP), RBAC   |
| **ML Worker**  | Python child process — EfficientNetV2S, 4-class MRI classification        |
| **ML Model**   | EfficientNetV2S fine-tuned on Brain Tumor MRI Dataset — 98.69% val acc   |
| **Hosting**    | Firebase Hosting (frontend) + Node.js server (port 3001)                 |

---

## Project Structure

```
medicore/
├── index.html                    # Landing page (role selection)
├── firebase.json                 # Firebase Hosting & project config
├── firestore.rules               # Firestore security rules (RBAC)
│
├── assets/js/
│   ├── firebase-config.js        # Firebase SDK init (Auth, Firestore, Storage)
│   ├── auth-guard.js             # Role-based page protection
│   └── activity-logger.js        # User activity tracking
│
├── auth/
│   ├── patient-login/            # Patient login (Email + Google OAuth)
│   ├── staff-login/              # Staff login (Doctor, Lab, Admin)
│   └── verify-phone/             # OTP phone verification for patients
│
├── patient/
│   ├── dashboard/                # Welcome, stats, appointments, reports, vitals
│   ├── appointments/             # Book & manage appointments
│   ├── reports/                  # View lab reports & PDFs
│   └── profile/                  # Personal info, medical info, change password
│
├── doctor/
│   ├── dashboard/                # Overview stats, today's schedule
│   ├── appointments/             # Manage patient appointments
│   ├── patients/                 # Patient list, detail panel (vitals recording)
│   ├── reports/                  # Review & verify lab reports
│   ├── ai-tools/                 # AI medical assistant (Gemini chat)
│   ├── predict/                  # Brain tumor detection from MRI
│   ├── availability/             # Set weekly schedule & time slots
│   └── profile/                  # Doctor profile management
│
├── lab/
│   ├── dashboard/                # Lab overview & pending work
│   ├── upload/                   # Upload lab reports (PDF)
│   ├── reports/                  # Manage uploaded reports
│   ├── patients/                 # View patient info
│   └── profile/                  # Lab tech profile
│
├── admin/
│   ├── dashboard/                # System-wide analytics
│   ├── staff/                    # Manage staff accounts
│   ├── doctors/                  # Manage doctor profiles
│   ├── analytics/                # Activity logs & usage stats
│   └── settings/                 # Hospital branding, theme, SMTP config
│
└── server/
    ├── index.js                  # Node.js Express API server
    ├── python-worker.py          # Persistent Python inference worker (Keras)
    ├── package.json              # Node.js dependencies
    ├── .env.example              # Environment variable template
    └── model/
        ├── best_phase2.keras     # Original trained model (EfficientNetV2S)
        ├── best_phase2.fixed.keras # Auto-generated clean copy (worker uses this)
        └── metadata.json         # Class names & model metadata
```

---

## Core Features

### Patient Portal
- **Dashboard** — appointment count, upcoming visits, lab reports, latest vitals (recorded by doctor)
- **Appointments** — book with a specific doctor, select date/time slot, track status (pending → confirmed → completed)
- **Lab Reports** — view reports uploaded by lab, download PDFs, see verification status
- **Profile** — edit personal info, medical history (allergies, medications, conditions), change password with strength meter

### Doctor Portal
- **Dashboard** — today's appointments, patient count, report stats
- **Patients** — searchable patient grid with detail slide-out panel containing 4 tabs:
  - **Overview** — patient info, quick stats, links to appointments/reports
  - **Appointments** — full appointment history with status badges
  - **Reports** — lab report history with PDF downloads
  - **Vitals** — record BP, heart rate, temperature, SpO2, respiratory rate, weight, height with clinical notes; view history with color-coded indicators and SVG trend charts
- **AI Assistant** — conversational medical AI powered by Google Gemini 2.5 Flash (drug interactions, differential diagnosis, dosage lookup)
- **Tumor Predict** — upload brain MRI images for AI classification (glioma, meningioma, pituitary tumor, or no tumor) with confidence scores, severity ratings, and clinical recommendations
- **Availability** — set weekly schedule with per-day toggle, custom time slots, max patients/day
- **Order Tests** — order lab tests for patients (haematology, biochemistry, radiology, etc.) with priority levels

### Lab Portal
- **Upload** — upload lab report PDFs linked to patients and doctors
- **Reports** — manage report status, view doctor verification/rejection
- **Patients** — browse patient list for report association

### Admin Portal
- **Dashboard** — system-wide statistics and activity overview
- **Staff Management** — create/edit staff accounts (doctor, lab roles)
- **Settings** — hospital name, logo upload, color theme (primary/secondary with presets), font selection, SMTP email configuration
- **Analytics** — activity logs, usage patterns

---

## Firestore Data Model

```
Firestore
├── users/{uid}                   # All user profiles (name, email, role, phone, etc.)
│   └── vitals/{vitalId}          # Patient vitals (BP, HR, temp, SpO2, weight, height)
│
├── doctors/{uid}                 # Doctor-specific data (availability, maxPatients)
├── appointments/{apptId}         # Appointments (patientId, doctorId, date, slot, status)
├── reports/{reportId}            # Lab reports (patientId, doctorId, testName, fileUrl, status)
├── tests/{testId}                # Doctor-ordered lab tests (pending → in_progress → completed)
├── analyses/{analysisId}         # AI brain tumor analysis results (doctorId, prediction)
├── activity_logs/{logId}         # User activity audit trail (action, timestamp, details)
└── settings/hospital             # Hospital config (name, logo, theme, SMTP)
```

### Security Rules
Role-based access control (RBAC) enforced at database level:
- **Patients** — read/write own profile, read own vitals, create appointments
- **Doctors** — read patient data, record vitals, verify reports, order tests, manage own availability
- **Lab** — create/manage reports, read patient data
- **Admin** — full access to staff management, settings, analytics

---

## ML Pipeline — Brain Tumor Detection

```
                    ┌──────────────────────────┐
                    │  Kaggle Brain Tumor MRI   │
                    │  Dataset (4 classes)      │
                    │                           │
                    │  Training/                │
                    │  ├── glioma/              │
                    │  ├── meningioma/          │
                    │  ├── pituitary/           │
                    │  └── notumor/             │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  train_model.py           │
                    │                           │
                    │  MobileNetV2 (frozen)     │
                    │  + GlobalAvgPool          │
                    │  + Dense(128, ReLU)       │
                    │  + Dropout(0.3)           │
                    │  + Dense(4, Softmax)      │
                    │                           │
                    │  ImageDataGenerator       │
                    │  (rotation, zoom, flip)   │
                    │                           │
                    │  EarlyStopping + LR decay │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  model/                   │
                    │  ├── brain_tumor_model    │
                    │  │   .keras               │
                    │  └── metadata.json        │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  Flask API (app.py)       │
                    │  POST /predict            │
                    │                           │
                    │  Upload MRI → Resize 224  │
                    │  → Predict → Return:      │
                    │    class, confidence,      │
                    │    severity, description,  │
                    │    recommendation          │
                    └──────────────────────────┘
```

| Class        | Severity | Description                                      |
|--------------|----------|--------------------------------------------------|
| Glioma       | High     | Aggressive brain tumor from glial cells           |
| Meningioma   | Moderate | Usually benign tumor from meninges                |
| Pituitary    | Moderate | Tumor in the pituitary gland                      |
| No Tumor     | Low      | No detectable tumor in the scan                   |

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- Python 3.9+
- Firebase project with Auth, Firestore, and Storage enabled

### 1. Firebase Configuration
```bash
# Copy the example config
cp assets/js/firebase-config.example.js assets/js/firebase-config.js

# Edit firebase-config.js with your Firebase project credentials
```

### 2. Python (for ML Worker)

The Node.js server spawns a persistent Python child process for inference. Python 3.9+ with TensorFlow must be installed:

```bash
# Verify Python is available
python3 --version   # Linux/macOS
c:/python312/python.exe --version  # Windows default

pip install tensorflow
```

The Python executable path defaults to `c:/python312/python.exe` on Windows or `python3` on Linux/macOS. Override with the `PYTHON_EXECUTABLE` environment variable.

### 3. Node.js Server
```bash
cd server
npm install

# Copy and populate the environment file
cp .env.example .env
# Edit .env with your Gemini API key, SMTP credentials, and PORT

# Place serviceAccountKey.json from Firebase Console:
#   Project Settings → Service Accounts → Generate New Private Key
#   Save as server/serviceAccountKey.json

node index.js
# Server starts on port 3001; Python worker is spawned automatically
```

### 4. Frontend
```bash
# Serve from project root using any static server
# Recommended: VS Code Live Server extension
# Open http://localhost:5500
```

### 5. First Admin Bootstrap

Create the first admin account directly in the Firebase console:
1. Open Firebase Console → Authentication → Add User
2. Then in Firestore, create a document at `users/{uid}` with `role: "admin"`

---

## API Endpoints

All inference and auxiliary APIs are served from the Node.js server at port 3001. The Python worker is an internal implementation detail; it is not exposed as a separate HTTP server.

| Method | Endpoint                | Auth   | Description                           |
|--------|-------------------------|--------|---------------------------------------|
| `GET`  | `/health`               | Public | Server + Python worker health check   |
| `GET`  | `/metadata`             | Public | Model class names from metadata.json  |
| `POST` | `/predict`              | Public | Upload MRI image → tumor prediction   |
| `POST` | `/api/sendWelcomeEmail` | Bearer | Send staff onboarding email via SMTP  |
| `POST` | `/api/aiChat`           | Bearer | AI medical assistant (Gemini 2.5)     |
| `GET`  | `/api/health`           | Public | Express health check                  |

See [docs/api-reference.md](docs/api-reference.md) for full request/response schemas.

---

## Authentication Flow

```
User visits protected page
        │
        ▼
  auth-guard.js
  guardPage(["doctor"], callback)
        │
        ├─ Not logged in? ──→ Redirect to login page
        │
        ├─ No user doc? ────→ Redirect to login page
        │
        ├─ Wrong role? ─────→ Redirect to correct portal
        │
        ├─ Patient without
        │  phone verified? ─→ Redirect to /auth/verify-phone/
        │
        └─ Authorized ──────→ Execute callback(user, userData)
```

---

## Theming

The entire UI is driven by CSS custom properties, configurable from the Admin Settings panel:

| Variable               | Default   | Purpose              |
|------------------------|-----------|-----------------------|
| `--color-primary`      | `#2563eb` | Primary brand color   |
| `--color-primary-dark` | `#1d4ed8` | Hover/active states   |
| `--color-secondary`    | `#0ea5e9` | Accent color          |
| `--color-bg`           | `#f8fafc` | Page background       |
| `--color-surface`      | `#ffffff` | Card/panel background |
| `--color-text`         | `#0f172a` | Primary text          |
| `--color-muted`        | `#64748b` | Secondary text        |
| `--color-border`       | `#e2e8f0` | Borders/dividers      |

Dark mode is toggled via `[data-theme="dark"]` on `<html>`, with all colors remapping automatically. Theme preference persists in `localStorage`.

---

## Available Routes

| Path                        | Role    | Description                        |
|-----------------------------|---------|-------------------------------------|
| `/`                         | Public  | Landing page with role selection    |
| `/setup.html`               | Public  | One-time admin bootstrap            |
| `/auth/patient-login/`      | Public  | Patient login/register              |
| `/auth/staff-login/`        | Public  | Staff login (doctor/lab/admin)      |
| `/auth/verify-phone/`       | Public  | Phone OTP verification              |
| `/patient/dashboard/`       | Patient | Dashboard with vitals               |
| `/patient/appointments/`    | Patient | Book & manage appointments          |
| `/patient/reports/`         | Patient | View lab reports                    |
| `/patient/profile/`         | Patient | Edit profile & medical info         |
| `/doctor/dashboard/`        | Doctor  | Doctor overview                     |
| `/doctor/appointments/`     | Doctor  | Manage appointments                 |
| `/doctor/patients/`         | Doctor  | Patient list + vitals recording     |
| `/doctor/reports/`          | Doctor  | Review lab reports                  |
| `/doctor/ai-tools/`         | Doctor  | AI medical assistant                |
| `/doctor/predict/`          | Doctor  | Brain tumor MRI prediction          |
| `/doctor/availability/`     | Doctor  | Set weekly schedule                 |
| `/doctor/profile/`          | Doctor  | Doctor profile                      |
| `/lab/dashboard/`           | Lab     | Lab overview                        |
| `/lab/upload/`              | Lab     | Upload report PDFs                  |
| `/lab/reports/`             | Lab     | Manage reports                      |
| `/lab/patients/`            | Lab     | Patient lookup                      |
| `/lab/profile/`             | Lab     | Lab tech profile                    |
| `/admin/dashboard/`         | Admin   | System analytics                    |
| `/admin/staff/`             | Admin   | Manage staff accounts               |
| `/admin/doctors/`           | Admin   | Manage doctors                      |
| `/admin/analytics/`         | Admin   | Activity logs                       |
| `/admin/settings/`          | Admin   | Hospital settings & branding        |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System design, data flows, IPC protocol |
| [docs/api-reference.md](docs/api-reference.md) | Full API endpoint schemas |
| [docs/deployment.md](docs/deployment.md) | Step-by-step deployment guide |
| [docs/ai-model.md](docs/ai-model.md) | Brain tumor model details, Python worker internals |
| [docs/firebase-setup.md](docs/firebase-setup.md) | Firebase project configuration guide |
| [docs/security.md](docs/security.md) | Security considerations and hardening checklist |

---

## License

This project is for educational and demonstration purposes.
