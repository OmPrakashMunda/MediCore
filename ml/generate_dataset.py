"""
Download the Brain Tumor MRI Dataset for training.

This script downloads a publicly available brain tumor MRI dataset
and organizes it into the expected folder structure:

    dataset/
      Training/
        glioma/
        meningioma/
        pituitary/
        notumor/
      Testing/
        glioma/
        meningioma/
        pituitary/
        notumor/

Usage:
    python download_dataset.py

If you already have the dataset, place it in the 'dataset/' folder
following the directory structure above.
"""

import os
import zipfile
import urllib.request
import sys

DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset")

# Kaggle Brain Tumor MRI Dataset (public, educational use)
# You can also download manually from:
#   https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset
EXPECTED_CLASSES = ["glioma", "meningioma", "pituitary", "notumor"]


def check_dataset():
    """Check if dataset already exists with correct structure."""
    train_dir = os.path.join(DATASET_DIR, "Training")
    test_dir = os.path.join(DATASET_DIR, "Testing")

    if not os.path.exists(train_dir) or not os.path.exists(test_dir):
        return False

    for cls in EXPECTED_CLASSES:
        train_cls = os.path.join(train_dir, cls)
        test_cls = os.path.join(test_dir, cls)
        if not os.path.exists(train_cls) or not os.path.exists(test_cls):
            return False
        if len(os.listdir(train_cls)) < 10:
            return False

    return True


def print_dataset_info():
    """Print info about the dataset structure."""
    train_dir = os.path.join(DATASET_DIR, "Training")
    test_dir = os.path.join(DATASET_DIR, "Testing")

    print("\nDataset structure:")
    for split, sdir in [("Training", train_dir), ("Testing", test_dir)]:
        print(f"\n  {split}/")
        if os.path.exists(sdir):
            for cls in sorted(os.listdir(sdir)):
                cls_path = os.path.join(sdir, cls)
                if os.path.isdir(cls_path):
                    count = len([f for f in os.listdir(cls_path)
                                 if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
                    print(f"    {cls}/  ({count} images)")


if __name__ == "__main__":
    if check_dataset():
        print("Dataset already exists!")
        print_dataset_info()
    else:
        print("=" * 60)
        print("  Brain Tumor MRI Dataset Setup")
        print("=" * 60)
        print()
        print("Please download the dataset manually from Kaggle:")
        print()
        print("  https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset")
        print()
        print("Then extract it so the folder structure looks like:")
        print()
        print(f"  {DATASET_DIR}/")
        print("    Training/")
        for cls in EXPECTED_CLASSES:
            print(f"      {cls}/")
        print("    Testing/")
        for cls in EXPECTED_CLASSES:
            print(f"      {cls}/")
        print()
        print("After placing the files, run this script again to verify.")
        os.makedirs(DATASET_DIR, exist_ok=True)

