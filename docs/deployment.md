# MediCore — Deployment Guide

This guide covers setting up and deploying MediCore in full from scratch.

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | 18.x | `node --version` |
| npm | 9.x | Bundled with Node.js |
| Python | 3.9+ | Must have `tensorflow` installed |
| TensorFlow | 2.15+ | `pip install tensorflow` |
| Firebase CLI | latest | `npm install -g firebase-tools` |
| Firebase account | — | Free Spark plan is sufficient for development |

---

## Step 1 — Clone & Prepare the Repository

```bash
git clone <your-repo-url>
cd medicore
```

Ensure the following files are **not** present in your working copy (they are in `.gitignore` and must be created manually):

- `assets/js/firebase-config.js`
- `server/serviceAccountKey.json`
- `server/.env`

---

## Step 2 — Firebase Project Setup

See [firebase-setup.md](firebase-setup.md) for the full Firebase configuration guide. The summary:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password + Google), optionally Phone
3. Create a **Firestore** database in production mode
4. Enable **Cloud Storage**
5. Download the Firebase config and save as `assets/js/firebase-config.js`
6. Download a service account key and save as `server/serviceAccountKey.json`

---

## Step 3 — Python Environment

The Node.js server spawns a Python child process to run the brain tumor model. Python and TensorFlow must be installed on the same machine as the Node.js server.

```bash
# Install TensorFlow (CPU version is sufficient)
pip install tensorflow

# Verify
python -c "import tensorflow as tf; print(tf.__version__)"
```

On **Windows**, the server defaults to `c:/python312/python.exe`. If your Python is elsewhere, set the environment variable:

```
PYTHON_EXECUTABLE=C:\Users\you\AppData\Local\Programs\Python\Python312\python.exe
```

On **Linux/macOS**, the default is `python3`. Ensure `python3` resolves to Python 3.9+.

### Model file

The Keras model file must be present at:

```
server/model/best_phase2.keras
```

This file is excluded from version control (it is ~139 MB). Obtain it from your training pipeline or project source, then place it in `server/model/`.

On first server start, `python-worker.py` will automatically create a cleaned copy at `server/model/best_phase2.fixed.keras`. This cleaned copy is what the worker actually loads. If `best_phase2.fixed.keras` already exists, the cleaning step is skipped.

---

## Step 4 — Node.js Server

```bash
cd server
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `server/.env`:

```env
# Server port
PORT=3001

# Google Gemini AI — get key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key-here

# Email (Nodemailer) — Gmail with App Password recommended
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-16-char-app-password
MAIL_FROM="MediCore <your-email@gmail.com>"

# Optional: override Python executable path
# PYTHON_EXECUTABLE=python3
```

**Gmail App Password setup:**
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate a new app password for "Mail"
4. Use the 16-character code as `MAIL_PASS`

### Start the Server

```bash
node index.js
```

Or in development mode (auto-restarts on file changes):

```bash
node --watch index.js
```

Expected startup output:

```
Loading metadata...
Starting Python worker...
[py-worker] Loading Keras model from .../best_phase2.fixed.keras...
Python worker loaded the brain tumor model.
MediCore server running on port 3001
```

The server will **not** start listening until the Python worker emits its ready signal. If the model fails to load, the server logs the error and exits.

### Health Check

```bash
curl http://localhost:3001/health
# {"status":"ok","model_loaded":true,"worker_error":null,"time":"..."}
```

---

## Step 5 — Frontend

The frontend is a collection of static HTML files that can be served from any static server or Firebase Hosting.

### Local Development

Use VS Code's Live Server extension or any static file server:

```bash
# Using npx serve (no install required)
npx serve .

# Or Python's built-in server from project root
python -m http.server 8080
```

Open `http://localhost:8080` in your browser.

### Configure the API URL

The frontend pages that call the Node.js server use the URL `http://localhost:3001` by default. When deploying to production, update these references to your production server URL:

```bash
# Find all hardcoded localhost:3001 references
grep -r "localhost:3001" . --include="*.html" --include="*.js"
```

Replace with your production server URL (e.g. `https://api.your-domain.com`).

---

## Step 6 — Deploy Frontend to Firebase Hosting

```bash
# Login to Firebase
firebase login

# Initialize hosting (first time only)
firebase init hosting
# Select your Firebase project
# Set public directory to: . (project root)
# Configure as SPA: No

# Deploy
firebase deploy --only hosting
```

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## Step 7 — Production Server Hosting

The Node.js server (port 3001) must run on a server that also has Python and TensorFlow installed. Recommended options:

### Option A — Dedicated VM (e.g. Google Cloud Compute Engine, AWS EC2)

1. Provision a VM with at least **4 GB RAM** (TensorFlow + EfficientNetV2S requires ~2–3 GB)
2. Install Node.js 18+ and Python 3.9+
3. Copy `server/` directory to the VM (excluding `node_modules/`)
4. Install dependencies: `npm install && pip install tensorflow`
5. Run with a process manager:

```bash
npm install -g pm2
pm2 start index.js --name medicore-server
pm2 save
pm2 startup
```

### Option B — Docker

Create a `Dockerfile` in `server/`:

```dockerfile
FROM python:3.12-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

WORKDIR /app

# Python deps
RUN pip install --no-cache-dir tensorflow

# Node deps
COPY package*.json ./
RUN npm install --omit=dev

# App code + model
COPY . .

ENV PORT=3001
ENV PYTHON_EXECUTABLE=python3

EXPOSE 3001
CMD ["node", "index.js"]
```

```bash
docker build -t medicore-server ./server
docker run -p 3001:3001 \
  --env-file server/.env \
  -v $(pwd)/server/serviceAccountKey.json:/app/serviceAccountKey.json \
  medicore-server
```

---

## Environment Variable Reference (server/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Port the Express server listens on |
| `GEMINI_API_KEY` | Yes | — | Google AI Studio API key for Gemini |
| `MAIL_HOST` | Yes | — | SMTP hostname (e.g. `smtp.gmail.com`) |
| `MAIL_PORT` | No | `587` | SMTP port |
| `MAIL_SECURE` | No | `false` | `true` for port 465 (TLS), `false` for STARTTLS |
| `MAIL_USER` | Yes | — | SMTP username / email address |
| `MAIL_PASS` | Yes | — | SMTP password or Gmail App Password |
| `MAIL_FROM` | No | Same as `MAIL_USER` | Display name and address in From header |
| `PYTHON_EXECUTABLE` | No | Platform default | Path to Python executable with TensorFlow |

---

## Troubleshooting

### Python worker fails to start

**Symptom**: `Unable to start Python worker with 'c:/python312/python.exe': ...`

**Fix**: Ensure the Python executable at the configured path exists and has TensorFlow installed:
```bash
c:/python312/python.exe -c "import tensorflow"
```
If Python is elsewhere, set `PYTHON_EXECUTABLE` in `server/.env`.

---

### Model file not found

**Symptom**: `Keras model not found at .../server/model/best_phase2.keras`

**Fix**: Place the `best_phase2.keras` file in `server/model/`. This file is not in version control.

---

### Port already in use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3001`

**Fix**: Change `PORT` in `server/.env`, or kill the process using port 3001:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# Linux/macOS
lsof -ti :3001 | xargs kill
```

---

### Firestore permission denied

**Symptom**: Frontend gets permission errors when reading/writing Firestore.

**Fix**: Deploy the latest Firestore rules:
```bash
firebase deploy --only firestore:rules
```

---

### CORS errors in browser

**Symptom**: Browser blocks requests to `http://localhost:3001` from `http://localhost:5500`.

**Fix**: The server uses `app.use(cors())` which allows all origins in development. If you see CORS errors in production, verify the server is running and reachable, and that your production server has the correct CORS config (see [security.md](security.md)).
