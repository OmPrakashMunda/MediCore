import base64
import json
import os
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import tensorflow as tf


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model" / "best_phase2.keras"
LEGACY_FIXED_MODEL_PATH = ROOT / "model" / "best_phase2.keras.fixed"
CLEAN_MODEL_PATH = ROOT / "model" / "best_phase2.fixed.keras"
META_PATH = ROOT / "model" / "metadata.json"
IMG_SIZE = 260
DEFAULT_CLASSES = ["glioma", "meningioma", "notumor", "pituitary"]


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def emit(payload: dict) -> None:
    print(json.dumps(payload, separators=(",", ":")), flush=True)


def strip_unsupported_keys(obj) -> None:
    if isinstance(obj, dict):
        obj.pop("quantization_config", None)
        for value in obj.values():
            strip_unsupported_keys(value)
        return

    if isinstance(obj, list):
        for value in obj:
            strip_unsupported_keys(value)


def load_classes() -> list[str]:
    if META_PATH.exists():
        with META_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        classes = data.get("classes")
        if isinstance(classes, list) and classes:
            return classes
    return DEFAULT_CLASSES


def ensure_fixed_model_path() -> Path:
    if CLEAN_MODEL_PATH.exists():
        return CLEAN_MODEL_PATH

    if LEGACY_FIXED_MODEL_PATH.exists():
        shutil.copyfile(LEGACY_FIXED_MODEL_PATH, CLEAN_MODEL_PATH)
        return CLEAN_MODEL_PATH

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Keras model not found at {MODEL_PATH}")

    temp_dir = Path(tempfile.mkdtemp(prefix="medicore-model-"))
    try:
        with zipfile.ZipFile(MODEL_PATH, "r") as archive:
            archive.extractall(temp_dir)

        config_path = temp_dir / "config.json"
        with config_path.open("r", encoding="utf-8") as handle:
            config = json.load(handle)

        strip_unsupported_keys(config)

        with config_path.open("w", encoding="utf-8") as handle:
            json.dump(config, handle)

        with zipfile.ZipFile(CLEAN_MODEL_PATH, "w", zipfile.ZIP_DEFLATED) as archive:
            for file_path in temp_dir.rglob("*"):
                if file_path.is_file():
                    archive.write(file_path, file_path.relative_to(temp_dir))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return CLEAN_MODEL_PATH


def preprocess(image_bytes: bytes) -> tf.Tensor:
    tensor = tf.io.decode_image(image_bytes, channels=3, expand_animations=False)
    tensor = tf.cast(tensor, tf.float32)
    tensor = tf.image.resize(tensor, [IMG_SIZE, IMG_SIZE])
    return tf.expand_dims(tensor, axis=0)


def predict(model: tf.keras.Model, class_names: list[str], image_bytes: bytes) -> dict:
    batch = preprocess(image_bytes)
    predictions = model(batch, training=False).numpy()[0]

    probabilities = {}
    for index, class_name in enumerate(class_names):
        if index >= len(predictions):
            break
        probabilities[class_name] = float(predictions[index])

    if not probabilities:
        raise RuntimeError("Model returned no class probabilities.")

    predicted_class = max(probabilities, key=probabilities.get)
    return {
        "class": predicted_class,
        "confidence": probabilities[predicted_class],
        "probabilities": probabilities,
    }


def main() -> int:
    if not MODEL_PATH.exists() and not LEGACY_FIXED_MODEL_PATH.exists() and not CLEAN_MODEL_PATH.exists():
        emit({"type": "fatal", "error": f"Keras model not found at {MODEL_PATH}"})
        return 1

    model_path = ensure_fixed_model_path()
    log(f"Loading Keras model from {model_path}...")
    model = tf.keras.models.load_model(model_path, compile=False)
    class_names = load_classes()
    emit({"type": "ready", "classes": class_names})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")

            if request.get("type") != "predict":
                emit({
                    "id": request_id,
                    "success": False,
                    "error": "Unsupported worker request type.",
                })
                continue

            image_base64 = request.get("imageBase64")
            if not image_base64:
                emit({
                    "id": request_id,
                    "success": False,
                    "error": "Missing imageBase64 payload.",
                })
                continue

            image_bytes = base64.b64decode(image_base64)
            prediction = predict(model, class_names, image_bytes)
            emit({
                "id": request_id,
                "success": True,
                "prediction": {
                    "class": prediction["class"],
                    "confidence": prediction["confidence"],
                },
                "probabilities": prediction["probabilities"],
            })
        except Exception as error:
            log(f"Prediction error: {error}")
            emit({
                "id": request_id,
                "success": False,
                "error": str(error),
            })

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        log(f"Worker startup failed: {error}")
        emit({"type": "fatal", "error": str(error)})
        raise