"""
Train a CNN model for Brain Tumor Classification from MRI images.

Classes:
  - glioma
  - meningioma
  - pituitary
  - notumor  (no tumor)

Usage:
    python train_model.py

Expects dataset in:
    dataset/
      Training/
        glioma/ meningioma/ pituitary/ notumor/
      Testing/
        glioma/ meningioma/ pituitary/ notumor/

Download from: https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset
"""

import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# ── Config ──────────────────────────────────────────────────────────
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 20
DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
TRAIN_DIR = os.path.join(DATASET_DIR, "Training")
TEST_DIR = os.path.join(DATASET_DIR, "Testing")


def build_model(num_classes):
    """Build a CNN using transfer learning with MobileNetV2."""
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet"
    )
    # Freeze the base model
    base_model.trainable = False

    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(num_classes, activation="softmax")
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
    return model


def main():
    # ── Validate dataset ────────────────────────────────────────────
    if not os.path.exists(TRAIN_DIR):
        print("ERROR: Training dataset not found!")
        print(f"Expected at: {TRAIN_DIR}")
        print("\nRun 'python download_dataset.py' first, or download from:")
        print("https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset")
        return

    # ── Data generators with augmentation ───────────────────────────
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=20,
        width_shift_range=0.1,
        height_shift_range=0.1,
        horizontal_flip=True,
        zoom_range=0.15,
        validation_split=0.15
    )

    test_datagen = ImageDataGenerator(rescale=1.0 / 255)

    print("Loading training data...")
    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="training",
        shuffle=True
    )

    val_gen = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="validation",
        shuffle=False
    )

    print("\nLoading test data...")
    test_gen = test_datagen.flow_from_directory(
        TEST_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        shuffle=False
    )

    class_names = list(train_gen.class_indices.keys())
    num_classes = len(class_names)
    print(f"\nClasses ({num_classes}): {class_names}")
    print(f"Training samples:   {train_gen.samples}")
    print(f"Validation samples: {val_gen.samples}")
    print(f"Test samples:       {test_gen.samples}")

    # ── Build & train ───────────────────────────────────────────────
    model = build_model(num_classes)
    model.summary()

    os.makedirs(MODEL_DIR, exist_ok=True)

    cb = [
        callbacks.EarlyStopping(
            monitor="val_accuracy", patience=5,
            restore_best_weights=True, verbose=1
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5,
            patience=3, verbose=1
        ),
    ]

    print("\n" + "=" * 60)
    print("  Training started")
    print("=" * 60 + "\n")

    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=cb,
        verbose=1
    )

    # ── Evaluate on test set ────────────────────────────────────────
    print("\nEvaluating on test set...")
    test_loss, test_acc = model.evaluate(test_gen, verbose=1)
    print(f"\nTest Accuracy: {test_acc:.4f}")
    print(f"Test Loss:     {test_loss:.4f}")

    # ── Save model ──────────────────────────────────────────────────
    model_path = os.path.join(MODEL_DIR, "brain_tumor_model.keras")
    model.save(model_path)
    print(f"\nModel saved to: {model_path}")

    # ── Save metadata ───────────────────────────────────────────────
    metadata = {
        "model_type": "MobileNetV2 (transfer learning)",
        "image_size": IMG_SIZE,
        "classes": class_names,
        "num_classes": num_classes,
        "test_accuracy": round(float(test_acc), 4),
        "test_loss": round(float(test_loss), 4),
        "epochs_trained": len(history.history["loss"]),
        "training_samples": train_gen.samples,
        "test_samples": test_gen.samples,
    }

    meta_path = os.path.join(MODEL_DIR, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to: {meta_path}")

    print("\n" + "=" * 60)
    print("  Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
