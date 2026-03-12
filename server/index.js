require("dotenv").config();

const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const nodemailer    = require("nodemailer");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");
const fs   = require("fs");
const path = require("path");
const readline = require("readline");

// ── Firebase Admin ─────────────────────────────────────────────────
const saPath = path.join(__dirname, "serviceAccountKey.json");
if (fs.existsSync(saPath)) {
  const serviceAccount = require(saPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  admin.initializeApp();
}
const db = admin.firestore();

// ── Express setup ──────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Multer — in-memory file uploads (max 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Auth middleware ────────────────────────────────────────────────
async function verifyAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  try {
    const token = header.split("Bearer ")[1];
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ── Mail transporter ──────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || "587"),
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ═══════════════════════════════════════════════════════════════════
//  BRAIN TUMOR MODEL (Python worker)
// ═══════════════════════════════════════════════════════════════════
const META_PATH  = path.join(__dirname, "model", "metadata.json");
const KERAS_MODEL_PATH = path.join(__dirname, "model", "best_phase2.keras");
const PYTHON_WORKER_PATH = path.join(__dirname, "python-worker.py");
const PYTHON_COMMAND = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "c:/python312/python.exe" : "python3");

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp"]);

let metadata   = null;
let classNames = [];
let pythonWorker = null;
let pythonWorkerReady = false;
let pythonWorkerError = null;

const pendingPredictions = new Map();

const CLASS_INFO = {
  glioma: {
    label: "Glioma Tumor",
    severity: "high",
    description:
      "Glioma is a type of tumor that occurs in the brain and spinal cord. " +
      "It originates from glial cells that surround and support neurons.",
    recommendation:
      "Immediate consultation with a neuro-oncologist is recommended. " +
      "Further imaging and biopsy may be required.",
  },
  meningioma: {
    label: "Meningioma Tumor",
    severity: "moderate",
    description:
      "Meningioma is a tumor that arises from the meninges — the membranes " +
      "surrounding the brain and spinal cord. Most are benign.",
    recommendation:
      "Schedule a follow-up MRI. Consult a neurosurgeon for evaluation. " +
      "Many meningiomas can be monitored over time.",
  },
  pituitary: {
    label: "Pituitary Tumor",
    severity: "moderate",
    description:
      "Pituitary tumors are abnormal growths in the pituitary gland. " +
      "Most are benign (pituitary adenomas) and treatable.",
    recommendation:
      "Refer to an endocrinologist. Hormonal evaluation and further " +
      "imaging are advised.",
  },
  notumor: {
    label: "No Tumor Detected",
    severity: "low",
    description:
      "No tumor was detected in the MRI scan. The brain appears normal " +
      "based on the model's analysis.",
    recommendation: "No immediate action required. Continue routine health checkups.",
  },
};

function loadMetadata() {
  if (fs.existsSync(META_PATH)) {
    metadata = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
    classNames = metadata.classes || [];
  } else {
    metadata = null;
    classNames = ["glioma", "meningioma", "notumor", "pituitary"];
  }
}

function rejectPendingPredictions(message) {
  for (const { reject } of pendingPredictions.values()) {
    reject(new Error(message));
  }
  pendingPredictions.clear();
}

function stopPythonWorker() {
  if (!pythonWorker) return;
  pythonWorker.kill();
  pythonWorker = null;
  pythonWorkerReady = false;
}

function startPythonWorker() {
  if (!fs.existsSync(KERAS_MODEL_PATH)) {
    throw new Error(`Keras model not found at ${KERAS_MODEL_PATH}`);
  }
  if (!fs.existsSync(PYTHON_WORKER_PATH)) {
    throw new Error(`Python worker not found at ${PYTHON_WORKER_PATH}`);
  }

  return new Promise((resolve, reject) => {
    let startupSettled = false;

    pythonWorkerError = null;
    pythonWorkerReady = false;
    pythonWorker = spawn(PYTHON_COMMAND, [PYTHON_WORKER_PATH], {
      cwd: __dirname,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = readline.createInterface({ input: pythonWorker.stdout });

    const failStartup = (error) => {
      pythonWorkerError = error.message;
      pythonWorkerReady = false;
      if (!startupSettled) {
        startupSettled = true;
        reject(error);
      }
      rejectPendingPredictions(error.message);
    };

    stdout.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let message;
      try {
        message = JSON.parse(trimmed);
      } catch (_error) {
        console.log(`[py-worker] ${trimmed}`);
        return;
      }

      if (message.type === "ready") {
        pythonWorkerReady = true;
        pythonWorkerError = null;
        if (Array.isArray(message.classes) && message.classes.length > 0) {
          classNames = message.classes;
        }
        console.log("Python worker loaded the brain tumor model.");
        if (!startupSettled) {
          startupSettled = true;
          resolve();
        }
        return;
      }

      if (message.type === "fatal") {
        failStartup(new Error(message.error || "Python worker failed to start."));
        return;
      }

      if (!message.id) return;

      const pending = pendingPredictions.get(message.id);
      if (!pending) return;

      pendingPredictions.delete(message.id);

      if (message.success) {
        pending.resolve(message);
      } else {
        pending.reject(new Error(message.error || "Prediction failed in Python worker."));
      }
    });

    pythonWorker.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`[py-worker] ${text}`);
      }
    });

    pythonWorker.once("error", (error) => {
      failStartup(new Error(`Unable to start Python worker with '${PYTHON_COMMAND}': ${error.message}`));
    });

    pythonWorker.once("exit", (code, signal) => {
      const message = pythonWorkerError ||
        `Python worker exited unexpectedly (${signal ? `signal ${signal}` : `code ${code}`}).`;
      pythonWorker = null;
      pythonWorkerReady = false;
      if (!startupSettled) {
        startupSettled = true;
        reject(new Error(message));
      }
      rejectPendingPredictions(message);
    });
  });
}

function requestPrediction(imageBuffer) {
  if (!pythonWorker || !pythonWorkerReady) {
    throw new Error(pythonWorkerError || "Python worker is not ready.");
  }

  const requestId = randomUUID();
  const payload = JSON.stringify({
    type: "predict",
    id: requestId,
    imageBase64: imageBuffer.toString("base64"),
  });

  return new Promise((resolve, reject) => {
    pendingPredictions.set(requestId, { resolve, reject });
    pythonWorker.stdin.write(`${payload}\n`, (error) => {
      if (!error) return;
      pendingPredictions.delete(requestId);
      reject(error);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  ROUTES — Brain Tumor Prediction
// ═══════════════════════════════════════════════════════════════════

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    model_loaded: pythonWorkerReady,
    worker_error: pythonWorkerError,
    time: new Date().toISOString(),
  });
});

app.get("/metadata", (_req, res) => {
  if (!metadata) return res.status(503).json({ error: "Model metadata not available" });
  res.json(metadata);
});

app.post("/predict", upload.single("file"), async (req, res) => {
  if (!pythonWorkerReady) {
    return res.status(503).json({ error: pythonWorkerError || "Model worker is not ready yet." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Send an MRI image with key 'file'." });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return res.status(400).json({
      error: `Invalid file type '${ext}'. Allowed: ${[...ALLOWED_EXT].join(", ")}`,
    });
  }

  try {
    const workerResult = await requestPrediction(req.file.buffer);
    const predictedClass = workerResult.prediction.class;
    const confidence = workerResult.prediction.confidence;
    const classProbs = {};

    for (const [name, probability] of Object.entries(workerResult.probabilities || {})) {
      classProbs[name] = Math.round(probability * 10000) / 100;
    }

    const info = CLASS_INFO[predictedClass] || {
      label: predictedClass,
      severity: "unknown",
      description: "No description available.",
      recommendation: "Consult a specialist.",
    };

    res.json({
      success: true,
      prediction: {
        class: predictedClass,
        label: info.label,
        confidence: Math.round(confidence * 10000) / 100,
        severity: info.severity,
        description: info.description,
        recommendation: info.recommendation,
      },
      probabilities: classProbs,
    });
  } catch (err) {
    console.error("Prediction error:", err);
    res.status(500).json({ error: `Prediction failed: ${err.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  ROUTES — Email & AI Chat (existing functionality)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sendWelcomeEmail", verifyAuth, async (req, res) => {
  try {
    const { name, email, role, password, loginUrl } = req.body;

    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const snap = await db.doc("settings/hospital").get();
    const hospitalName = snap.exists
      ? snap.data().hospitalName || "MediCore"
      : "MediCore";

    const roleLabels = { doctor: "Doctor", lab: "Lab Engineer", admin: "Admin" };
    const roleLabel  = roleLabels[role] || role;
    const staffLoginUrl = loginUrl || "#";

    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#0ea5e9;margin:0;font-size:24px;">${hospitalName}</h1>
          <p style="color:#64748b;margin:4px 0 0;">Staff Portal</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:8px;border:1px solid #e2e8f0;">
          <h2 style="color:#1e293b;margin:0 0 12px;font-size:18px;">Welcome, ${name}!</h2>
          <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
            Your <strong>${roleLabel}</strong> account has been created at <strong>${hospitalName}</strong>. 
            Use the credentials below to sign in:
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="padding:10px 12px;background:#f1f5f9;border-radius:6px 6px 0 0;color:#64748b;font-size:13px;">Email</td>
              <td style="padding:10px 12px;background:#f1f5f9;border-radius:6px 6px 0 0;color:#0f172a;font-weight:600;">${email}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;background:#f8fafc;border-radius:0 0 6px 6px;color:#64748b;font-size:13px;">Password</td>
              <td style="padding:10px 12px;background:#f8fafc;border-radius:0 0 6px 6px;color:#0f172a;font-weight:600;">${password}</td>
            </tr>
          </table>
          <div style="text-align:center;margin-bottom:16px;">
            <a href="${staffLoginUrl}" 
               style="display:inline-block;padding:12px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Sign In to Portal
            </a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
            Please change your password after first login for security.
          </p>
        </div>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin:16px 0 0;">
          This is an automated message from ${hospitalName}. Do not reply.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: `Welcome to ${hospitalName} — Your Staff Credentials`,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("sendWelcomeEmail error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/aiChat", verifyAuth, async (req, res) => {
  try {
    const { message, history, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are MediCore AI, an expert medical assistant for doctors in a hospital management system.

Your role:
- Suggest treatments, medications, and care plans based on the doctor's queries
- Provide evidence-based medical information
- Help with differential diagnosis discussions
- Suggest relevant lab tests or imaging studies
- Provide drug interaction warnings when relevant

Guidelines:
- Always remind that your suggestions should be verified by the treating physician
- Be concise but thorough
- Use bullet points for clarity
- Include dosage ranges when suggesting medications
- Mention contraindications and side effects when relevant
- Format responses in clean markdown

${context ? "Patient Context: " + context : ""}`;

    const contents = [];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      systemInstruction,
      contents,
    });

    res.json({ success: true, reply: response.text });
  } catch (err) {
    console.error("aiChat error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Start server ──────────────────────────────────────────────────
(async () => {
  loadMetadata();
  await startPythonWorker();
  app.listen(PORT, () => {
    console.log(`MediCore API server running on http://localhost:${PORT}`);
  });
})();

process.once("SIGINT", () => {
  stopPythonWorker();
  process.exit(0);
});

process.once("SIGTERM", () => {
  stopPythonWorker();
  process.exit(0);
});
