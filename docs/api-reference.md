# MediCore — API Reference

All endpoints are served by the Node.js Express server (`server/index.js`) on **port 3001**.

Base URL (local): `http://localhost:3001`

---

## Authentication

Protected endpoints require a Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

The token is obtained from the Firebase client SDK:

```javascript
const token = await firebase.auth().currentUser.getIdToken();
```

---

## Endpoints

### `GET /health`

Returns the server's health status, including whether the Python inference worker has loaded the model.

**Auth**: None

**Response**

```json
{
  "status": "ok",
  "model_loaded": true,
  "worker_error": null,
  "time": "2025-01-15T10:23:45.123Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `"ok"` if the server is running |
| `model_loaded` | `boolean` | `true` when the Python worker has finished loading the Keras model |
| `worker_error` | `string \| null` | Last error from the worker, or `null` |
| `time` | `string` | Server timestamp (ISO 8601) |

**Status codes**: `200`

---

### `GET /metadata`

Returns the model's class names and any other fields from `server/model/metadata.json`.

**Auth**: None

**Response** (example)

```json
{
  "classes": ["glioma", "meningioma", "notumor", "pituitary"],
  "accuracy": 0.9869,
  "model": "EfficientNetV2S"
}
```

**Status codes**: `200 OK`, `503 Service Unavailable` (metadata not loaded)

---

### `POST /predict`

Upload an MRI brain scan image and receive a tumor classification prediction.

**Auth**: None  
**Content-Type**: `multipart/form-data`

**Request fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | MRI image. Allowed types: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.webp`. Maximum size: 10 MB. |

**Example (curl)**

```bash
curl -X POST http://localhost:3001/predict \
  -F "file=@/path/to/mri-scan.jpg"
```

**Success Response** (`200 OK`)

```json
{
  "success": true,
  "prediction": {
    "class": "glioma",
    "label": "Glioma Tumor",
    "confidence": 98.21,
    "severity": "high",
    "description": "Glioma is a type of tumor that occurs in the brain and spinal cord. It originates from glial cells that surround and support neurons.",
    "recommendation": "Immediate consultation with a neuro-oncologist is recommended. Further imaging and biopsy may be required."
  },
  "probabilities": {
    "glioma": 98.21,
    "meningioma": 0.98,
    "notumor": 0.62,
    "pituitary": 0.19
  }
}
```

**Prediction fields**

| Field | Type | Description |
|-------|------|-------------|
| `class` | `string` | Raw class key: `glioma`, `meningioma`, `notumor`, `pituitary` |
| `label` | `string` | Human-readable class name |
| `confidence` | `number` | Softmax probability for the predicted class, as a percentage (0–100) |
| `severity` | `string` | `"high"`, `"moderate"`, or `"low"` |
| `description` | `string` | Medical description of the tumor type |
| `recommendation` | `string` | Suggested clinical next steps |

**`probabilities`**: object mapping each class name to its softmax percentage (all four classes, values sum to ~100).

**Error Responses**

| Status | Condition | Body |
|--------|-----------|------|
| `400` | No file uploaded | `{ "error": "No file uploaded. Send an MRI image with key 'file'." }` |
| `400` | Unsupported file type | `{ "error": "Invalid file type '.gif'. Allowed: .jpg, .jpeg, .png, .bmp, .webp" }` |
| `503` | Python worker not ready | `{ "error": "Model worker is not ready yet." }` |
| `500` | Inference error | `{ "error": "Prediction failed: <details>" }` |

---

### `POST /api/sendWelcomeEmail`

Sends a welcome email with login credentials to a newly created staff member.

**Auth**: Required (Firebase ID token, any authenticated user with admin role — caller's role is enforced by Firestore rules separately)

**Content-Type**: `application/json`

**Request body**

```json
{
  "name": "Dr. Jane Smith",
  "email": "jane.smith@hospital.com",
  "role": "doctor",
  "password": "TempPass123!",
  "loginUrl": "https://your-deployment.web.app/auth/staff-login/"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Staff member's full name |
| `email` | `string` | Yes | Email address to send credentials to |
| `role` | `string` | Yes | `"doctor"`, `"lab"`, or `"admin"` |
| `password` | `string` | Yes | Temporary password generated for the account |
| `loginUrl` | `string` | No | URL to include in the "Sign In" button (defaults to `#`) |

**Success Response** (`200 OK`)

```json
{ "success": true }
```

**Error Responses**

| Status | Condition | Body |
|--------|-----------|------|
| `400` | Missing required fields | `{ "error": "Missing required fields." }` |
| `401` | Missing or invalid token | `{ "error": "Unauthenticated" }` |
| `500` | SMTP error | `{ "error": "<nodemailer error message>" }` |

---

### `POST /api/aiChat`

Chat with the Gemini 2.5 Flash AI assistant, configured as a specialist medical AI for doctors.

**Auth**: Required (Firebase ID token)

**Content-Type**: `application/json`

**Request body**

```json
{
  "message": "What are the first-line treatments for stage 2 glioblastoma?",
  "history": [
    { "role": "user", "parts": [{ "text": "What is a glioma?" }] },
    { "role": "model", "parts": [{ "text": "A glioma is a type of tumor..." }] }
  ],
  "context": "Patient: John Doe, 54M. MRI shows 3.2cm left temporal mass, biopsy pending."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | The doctor's question or message |
| `history` | `array` | No | Previous conversation turns in Gemini format |
| `context` | `string` | No | Optional patient/clinical context injected into the system prompt |

**Success Response** (`200 OK`)

```json
{
  "success": true,
  "response": "First-line treatment for GBM typically involves the Stupp protocol: maximal safe surgical resection followed by..."
}
```

**Error Responses**

| Status | Condition | Body |
|--------|-----------|------|
| `400` | No message provided | `{ "error": "Message is required." }` |
| `401` | Invalid/missing token | `{ "error": "Unauthenticated" }` |
| `500` | Gemini API error | `{ "error": "<error message>" }` |

---

### `GET /api/health`

Simple health check for the Express server. Does not check the Python worker status (use `GET /health` for that).

**Auth**: None

**Response** (`200 OK`)

```json
{ "status": "ok" }
```

---

## Error Format

All API errors follow the same structure:

```json
{ "error": "Human-readable error message" }
```

Validation errors return `400`. Auth errors return `401`. Server-side failures return `500`. Service unavailability (model not loaded) returns `503`.

---

## CORS

The server currently allows all origins (`app.use(cors())`). Before deploying to production, restrict this to your Firebase Hosting domain:

```javascript
app.use(cors({ origin: "https://your-project.web.app" }));
```

See [security.md](security.md) for the full list of pre-production hardening steps.
