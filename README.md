# MediCore — Healthcare Management Platform

A full-stack, multi-role healthcare web application built with Firebase, Node.js, Python/Flask, and TensorFlow. MediCore provides separate portals for **Patients**, **Doctors**, **Lab Technicians**, and **Admins** — covering appointment scheduling, lab report management, AI-powered medical assistance, brain tumor detection from MRI scans, and patient vitals tracking.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Patient  │  │  Doctor  │  │   Lab    │  │  Admin   │            │
│  │  Portal  │  │  Portal  │  │  Portal  │  │  Portal  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │              │              │                  │
│       └──────────────┴──────────────┴──────────────┘                  │
│                          │                                           │
│        Tailwind CSS · Font Awesome · Inter Font                      │
│        Firebase JS SDK v11.4.0 (Auth, Firestore, Storage)            │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │  Firebase   │  │  Node.js    │  │  Python     │
  │  Backend    │  │  Express    │  │  Flask      │
  │             │  │  (Port 3001)│  │  (Port 5000)│
  │ • Auth      │  │             │  │             │
  │ • Firestore │  │ • AI Chat   │  │ • Brain     │
  │ • Storage   │  │   (Gemini)  │  │   Tumor     │
  │             │  │ • Email     │  │   Predict   │
  │             │  │   (SMTP)    │  │   (CNN)     │
  └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Tech Stack

| Layer          | Technology                                                        |
|----------------|-------------------------------------------------------------------|
| **Frontend**   | HTML5, Tailwind CSS (CDN), Font Awesome 6.5, Inter font           |
| **Auth**       | Firebase Authentication (Email/Password + Google OAuth)           |
| **Database**   | Cloud Firestore (NoSQL, real-time)                                |
| **Storage**    | Firebase Cloud Storage (logos, report PDFs)                       |
| **Node API**   | Express.js — AI chat (Google Gemini 2.5 Flash), email (Nodemailer)|
| **ML API**     | Flask — Brain tumor classification (TensorFlow/Keras, MobileNetV2)|
| **ML Model**   | MobileNetV2 transfer learning, 4-class MRI classification        |
| **Hosting**    | Firebase Hosting / any static server + Node + Python backends     |

---

## Project Structure

```
medicore/
├── index.html                    # Landing page (role selection)
├── setup.html                    # First-time admin bootstrap
├── firebase.json                 # Firebase project config
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
├── functions/
│   ├── index.js                  # Express API (AI chat, email)
│   ├── package.json              # Node.js dependencies
│   └── .env                      # API keys (Gemini, SMTP)
│
└── ml/
    ├── app.py                    # Flask prediction API
    ├── train_model.py            # CNN training script (MobileNetV2)
    ├── download_dataset.py       # Kaggle dataset setup helper
    └── requirements.txt          # Python dependencies
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

### 2. Node.js Backend
```bash
cd functions
npm install

# Create .env file with:
#   GEMINI_API_KEY=your_gemini_api_key
#   MAIL_HOST=smtp.gmail.com
#   MAIL_PORT=587
#   MAIL_USER=your_email
#   MAIL_PASS=your_app_password
#   PORT=3001

# Download serviceAccountKey.json from Firebase Console:
#   Project Settings → Service Accounts → Generate New Private Key
#   Save as functions/serviceAccountKey.json

node index.js
```

### 3. ML Backend
```bash
cd ml
pip install -r requirements.txt

# Download dataset from Kaggle (Brain Tumor MRI Dataset)
# Place in ml/dataset/Training/ and ml/dataset/Testing/

# Train the model
python train_model.py

# Start the Flask API
python app.py
```

### 4. Frontend
```bash
# Serve from project root using any static server
# Recommended: VS Code Live Server extension
# Open http://localhost:5500
```

### 5. First Admin Bootstrap
1. Open `/setup.html`
2. Create the first admin account
3. Delete or restrict `setup.html` after bootstrap

---

## API Endpoints

### Node.js Express (Port 3001)

| Method | Endpoint               | Auth     | Description                      |
|--------|------------------------|----------|----------------------------------|
| POST   | `/api/aiChat`          | Bearer   | AI medical assistant (Gemini)    |
| POST   | `/api/sendWelcomeEmail`| Bearer   | Send staff onboarding email      |
| GET    | `/api/health`          | Public   | Server health check              |

### Python Flask (Port 5000)

| Method | Endpoint     | Auth   | Description                           |
|--------|-------------|--------|---------------------------------------|
| POST   | `/predict`  | Public | Upload MRI image → tumor prediction   |
| GET    | `/health`   | Public | Model status check                    |
| GET    | `/metadata` | Public | Model classes & accuracy info         |

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

## License

This project is for educational and demonstration purposes.
