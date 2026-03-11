"""
Flask API for Brain Tumor Prediction from MRI images.

Endpoints:
    POST /predict  — Upload an MRI image, get prediction result
    GET  /health   — Health check
    GET  /metadata — Model metadata (classes, accuracy, etc.)

Usage:
    python app.py
    (Runs on http://localhost:5000)
"""

import os
import io
import json
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import tensorflow as tf

app = Flask(__name__)
CORS(app)

# ── Config ──────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
MODEL_PATH = os.path.join(MODEL_DIR, "brain_tumor_model.keras")
META_PATH = os.path.join(MODEL_DIR, "metadata.json")
IMG_SIZE = 224
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ── Load model at startup ──────────────────────────────────────────
model = None
metadata = None
class_names = []


def load_model():
    global model, metadata, class_names
    if not os.path.exists(MODEL_PATH):
        print(f"WARNING: Model not found at {MODEL_PATH}")
        print("Run 'python train_model.py' first to train the model.")
        return False

    print("Loading brain tumor model...")
    model = tf.keras.models.load_model(MODEL_PATH)
    print("Model loaded successfully.")

    if os.path.exists(META_PATH):
        with open(META_PATH, "r") as f:
            metadata = json.load(f)
        class_names = metadata.get("classes", [])
    else:
        class_names = ["glioma", "meningioma", "notumor", "pituitary"]

    return True


# ── Prediction labels & descriptions ───────────────────────────────
CLASS_INFO = {
    "glioma": {
        "label": "Glioma Tumor",
        "severity": "high",
        "description": "Glioma is a type of tumor that occurs in the brain and spinal cord. "
                       "It originates from glial cells that surround and support neurons.",
        "recommendation": "Immediate consultation with a neuro-oncologist is recommended. "
                          "Further imaging and biopsy may be required."
    },
    "meningioma": {
        "label": "Meningioma Tumor",
        "severity": "moderate",
        "description": "Meningioma is a tumor that arises from the meninges — the membranes "
                       "surrounding the brain and spinal cord. Most are benign.",
        "recommendation": "Schedule a follow-up MRI. Consult a neurosurgeon for evaluation. "
                          "Many meningiomas can be monitored over time."
    },
    "pituitary": {
        "label": "Pituitary Tumor",
        "severity": "moderate",
        "description": "Pituitary tumors are abnormal growths in the pituitary gland. "
                       "Most are benign (pituitary adenomas) and treatable.",
        "recommendation": "Refer to an endocrinologist. Hormonal evaluation and further "
                          "imaging are advised."
    },
    "notumor": {
        "label": "No Tumor Detected",
        "severity": "low",
        "description": "No tumor was detected in the MRI scan. The brain appears normal "
                       "based on the model's analysis.",
        "recommendation": "No immediate action required. Continue routine health checkups."
    }
}


def preprocess_image(image_bytes):
    """Preprocess uploaded image for the model."""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array


# ── Routes ──────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None
    })


@app.route("/metadata", methods=["GET"])
def get_metadata():
    if metadata is None:
        return jsonify({"error": "Model metadata not available"}), 503
    return jsonify(metadata)


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded. Train the model first."}), 503

    # Validate file upload
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send an MRI image with key 'file'."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Invalid file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Read and validate size
    image_bytes = file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": "File too large. Maximum size is 10 MB."}), 400

    if len(image_bytes) == 0:
        return jsonify({"error": "Empty file."}), 400

    try:
        # Preprocess
        img_array = preprocess_image(image_bytes)

        # Predict
        predictions = model.predict(img_array, verbose=0)
        probabilities = predictions[0]

        predicted_idx = int(np.argmax(probabilities))
        predicted_class = class_names[predicted_idx]
        confidence = float(probabilities[predicted_idx])

        # Build per-class probabilities
        class_probs = {}
        for i, name in enumerate(class_names):
            class_probs[name] = round(float(probabilities[i]) * 100, 2)

        # Get info about the predicted class
        info = CLASS_INFO.get(predicted_class, {
            "label": predicted_class,
            "severity": "unknown",
            "description": "No description available.",
            "recommendation": "Consult a specialist."
        })

        return jsonify({
            "success": True,
            "prediction": {
                "class": predicted_class,
                "label": info["label"],
                "confidence": round(confidence * 100, 2),
                "severity": info["severity"],
                "description": info["description"],
                "recommendation": info["recommendation"],
            },
            "probabilities": class_probs,
        })

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


# ── Main ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    load_model()
    print("\nStarting Flask API on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
