require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const nodemailer    = require("nodemailer");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");

// Firebase Admin — for verifying ID tokens & reading Firestore
// Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path,
// or place serviceAccountKey.json in this directory.
const fs = require("fs");
const path = require("path");

const saPath = path.join(__dirname, "serviceAccountKey.json");
if (fs.existsSync(saPath)) {
  const serviceAccount = require(saPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS env or ADC
  admin.initializeApp();
}
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;

// ── Auth middleware ─────────────────────────────────────────────────
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

// ── Mail transporter ────────────────────────────────────────────────
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
// POST /api/sendWelcomeEmail
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
    const roleLabel = roleLabels[role] || role;
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

// ═══════════════════════════════════════════════════════════════════
// POST /api/aiChat
// ═══════════════════════════════════════════════════════════════════
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

// ── Health check ────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── Start server ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`MediCore API server running on port ${PORT}`);
});
