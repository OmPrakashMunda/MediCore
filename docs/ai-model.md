# MediCore — AI Model Documentation

## Overview

MediCore uses a deep learning model for automated brain tumor classification from MRI scans. The model is served by a persistent Python child process that is spawned by the Node.js server at startup, keeping the model in memory for fast inference on subsequent requests.

---

## Model Specification

| Property | Value |
|----------|-------|
| **Base architecture** | EfficientNetV2S |
| **Input size** | 260 × 260 × 3 (RGB) |
| **Input range** | Raw pixel values, float32 — no normalization (model has preprocessing built-in) |
| **Output** | 4-class softmax probability vector |
| **Validation accuracy** | 98.69% |
| **Model format** | Keras 3 (`.keras` zip archive) |
| **File** | `server/model/best_phase2.keras` (~139 MB) |
| **Operational file** | `server/model/best_phase2.fixed.keras` (auto-generated cleaned copy) |

---

## Classes

| Class | Label | Severity | Clinical Notes |
|-------|-------|----------|----------------|
| `glioma` | Glioma Tumor | High | Aggressive tumor arising from glial cells in the brain or spinal cord. Requires immediate neuro-oncology consultation. |
| `meningioma` | Meningioma Tumor | Moderate | Usually benign tumor arising from the meninges (brain/spinal cord membranes). Many are slow-growing and can be monitored. |
| `pituitary` | Pituitary Tumor | Moderate | Abnormal growth in the pituitary gland. Most are benign adenomas. Requires endocrinological evaluation. |
| `notumor` | No Tumor Detected | Low | No tumor pattern detected in the scan. Routine follow-up is advisable. |

---

## Training

The model was trained using a 3-phase progressive fine-tuning strategy on the [Brain Tumor MRI Dataset](https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset) from Kaggle:

- **Phase 1** — Train new classification head with EfficientNetV2S backbone frozen
- **Phase 2** — Fine-tune top layers of EfficientNetV2S at a low learning rate
- **Phase 3** — Full network fine-tuning at an even lower learning rate with early stopping

Data augmentation (horizontal flip, rotation, zoom, brightness adjustments) was applied during training to improve generalization.

---

## Python Worker Architecture (`server/python-worker.py`)

The Python worker is a long-running process that:

1. Loads the Keras model into memory once at startup
2. Reads prediction requests from stdin (one JSON object per line)
3. Runs inference and writes the result to stdout (one JSON object per line)
4. Stays alive until the Node.js server shuts down

This approach avoids the overhead of spawning a new Python process per request (which would require reloading 139 MB of model weights each time).

### Startup Sequence

```
Node.js spawns: python python-worker.py
  │
  ▼ python-worker.py
  1. ensure_fixed_model_path()
     ├─ If best_phase2.fixed.keras exists → use it
     ├─ If best_phase2.keras.fixed exists (legacy) → copy and rename
     └─ Otherwise: open best_phase2.keras as zip, strip quantization_config
        from config.json, repack as best_phase2.fixed.keras
  2. tf.keras.models.load_model(fixed_path, compile=False)
  3. emit {"type": "ready", "classes": [...]}  → stdout
  │
  ▼ Node.js (readline listener on python stdout)
  Receives {"type": "ready"} → sets pythonWorkerReady = true
  → resolves startPythonWorker() Promise
  → server begins listening on port 3001
```

### Why `best_phase2.fixed.keras`?

The original model was trained with Keras 3 which includes a `quantization_config: null` field in its config archive. TensorFlow's `load_model` rejects this key with:

```
Unrecognized keyword arguments: {'quantization_config': None}
```

The worker automatically strips this key by extracting the `.keras` zip archive, removing `quantization_config` from `config.json`, and repacking as a new `.keras` archive. This only happens once — subsequent starts reuse the cleaned file.

### Inference Pipeline

```
imageBase64 (from Node stdin)
  │
  ▼ base64.b64decode
  raw image bytes (JPEG/PNG/etc.)
  │
  ▼ tf.io.decode_image(channels=3, expand_animations=False)
  3D tensor [H, W, 3], dtype=uint8
  │
  ▼ tf.cast(tensor, tf.float32)
  Float32, values in [0, 255]  — NOT normalized to [0,1]
  │
  ▼ tf.image.resize([260, 260])
  Shape: [260, 260, 3]
  │
  ▼ tf.expand_dims(axis=0)
  Shape: [1, 260, 260, 3]  — batch of 1
  │
  ▼ model(batch, training=False)
  Shape: [1, 4]  — softmax probabilities
  │
  ▼ .numpy()[0]
  Array of 4 floats, each in [0, 1], summing to ~1.0
  │
  ▼ argmax → predicted class + confidence
  {"class": "glioma", "confidence": 0.9821, "probabilities": {...}}
```

**Important**: The input is raw pixel values (0–255) — do **not** normalize to [0, 1] before passing to this model. EfficientNetV2's preprocessing layer handles normalization internally.

### IPC Protocol Detail

Node.js sends to Python stdin (one line per request):

```json
{"type":"predict","id":"<uuid4>","imageBase64":"<base64-string>"}
```

Python sends to Node stdout (one line per response):

```json
{"id":"<uuid4>","success":true,"prediction":{"class":"glioma","confidence":0.9821},"probabilities":{"glioma":0.9821,"meningioma":0.0098,"notumor":0.0062,"pituitary":0.0019}}
```

The UUID allows Node.js to match responses to pending requests even if multiple requests are in-flight concurrently (though Python processes them serially, Node can pipeline them while Python catches up).

---

## Concurrency

The Python worker processes requests one at a time (serial execution in the `for raw_line in sys.stdin` loop). However:

- Node.js `pendingPredictions` Map can hold multiple in-flight requests
- Requests are serialized by the Python worker's reading loop
- Each response is matched back by UUID, so ordering on the Python side is not required to match ordering on the Node side

For production workloads requiring parallel inference, consider running multiple Python worker processes with a round-robin dispatcher, or using a GPU-accelerated deployment.

---

## Resource Requirements

| Resource | Requirement |
|----------|-------------|
| RAM | ~2–3 GB (EfficientNetV2S + TensorFlow runtime) |
| CPU | Any modern x86-64 or ARM64 |
| GPU | Optional — CPU inference is functional but slower |
| Disk | ~270 MB for both `.keras` files + model metadata |
| Python | 3.9 or later |
| TensorFlow | 2.15 or later |

---

## Performance

Inference time on CPU (approximate):

| Hardware | First request (model warm) | Subsequent requests |
|----------|---------------------------|---------------------|
| Modern laptop CPU (i7/Ryzen 7) | ~2–4 seconds | ~1–2 seconds |
| Server CPU (Xeon / EPYC) | ~1–2 seconds | ~0.5–1 second |
| NVIDIA GPU (RTX 3060+) | ~0.2 seconds | ~0.1–0.2 seconds |

The "first request" may be slower due to TensorFlow's internal JIT compilation on first inference.

---

## Supported Image Formats

The server validates file extensions before sending to the Python worker:

- `.jpg` / `.jpeg`
- `.png`
- `.bmp`
- `.webp`

TensorFlow's `tf.io.decode_image` handles decoding, so any format that TF supports is theoretically usable; the extension check is a server-side safeguard.

Maximum file size: **10 MB** (enforced by Multer).

---

## Updating the Model

To replace the model with a new version:

1. Place the new `.keras` file at `server/model/best_phase2.keras`
2. Delete `server/model/best_phase2.fixed.keras` if it exists (the worker will regenerate it)
3. Update `server/model/metadata.json` if the class list changed
4. Restart the server (`node index.js`)

If the class list changes, also update `CLASS_INFO` in `server/index.js` to add descriptions and severity ratings for any new classes.
