"""Evaluate the frozen face-shape V2 artifact on the untouched testing_set."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from numpy_face_classifier_v2 import CLASS_ORDER, FEATURE_NAMES, predictFaceShapeV2
from train_numpy_face_classifier import extract_features


def main():
    root = Path(__file__).resolve().parents[1]
    model_path = root / "data/processed/face_shape_v2_model.json"
    output_path = root / "data/processed/face_shape_v2_test_results.json"
    manifest = json.loads(
        (root / "data/processed/face_shape_public_5000_manifest.json").read_text("utf-8")
    )
    records = [
        {**record, "partition": "test"}
        for record in manifest["records"]
        if record["split"] == "testing_set" and record["label"] in CLASS_ORDER
    ]
    records.sort(key=lambda record: (record["label"], record["path"].lower()))
    expected = {label: 200 for label in CLASS_ORDER}
    counts = {label: sum(record["label"] == label for record in records) for label in CLASS_ORDER}
    if len(records) != 1000 or counts != expected:
        raise RuntimeError(f"Expected deterministic 200/class testing_set, got {counts}")

    extracted = extract_features(root, records)
    output_records = []
    for row in extracted:
        if not row["detected"]:
            output_records.append({
                "path": row["path"],
                "actual_label": row["label"],
                "detection_success": False,
                "predicted_label": "unknown",
                "unknown_reason": "NO_FACE_DETECTED",
            })
            continue
        feature_vector = {
            name: float(value)
            for name, value in zip(FEATURE_NAMES, row["features"], strict=True)
        }
        prediction = predictFaceShapeV2(feature_vector, model_path)
        output_records.append({
            "path": row["path"],
            "actual_label": row["label"],
            "detection_success": True,
            "feature_vector": feature_vector,
            "predicted_label": prediction["label"],
            "top_label": prediction["top_label"],
            "top_probability": prediction["top_probability"],
            "second_label": prediction["second_label"],
            "second_probability": prediction["second_probability"],
            "margin": prediction["margin"],
            "unknown_reason": prediction["unknown_reason"],
            "probabilities": prediction["probabilities"],
        })

    detected = [row for row in output_records if row["detection_success"]]
    evaluable_count = len(output_records)
    correct = sum(row["predicted_label"] == row["actual_label"] for row in output_records)
    unknown = sum(row["predicted_label"] == "unknown" for row in output_records)
    columns = [*CLASS_ORDER, "unknown"]
    matrix = np.zeros((len(CLASS_ORDER), len(columns)), dtype=int)
    for row in output_records:
        matrix[CLASS_ORDER.index(row["actual_label"]), columns.index(row["predicted_label"])] += 1
    per_class = {
        label: sum(
            row["actual_label"] == label and row["predicted_label"] == label
            for row in output_records
        ) / counts[label]
        for label in CLASS_ORDER
    }
    result = {
        "version": "face-shape-v2-frozen-test-1",
        "model_artifact": str(model_path),
        "selection": "all testing_set records, sorted by label then case-insensitive path",
        "images": evaluable_count,
        "detected": len(detected),
        "coverage": len(detected) / evaluable_count,
        "correct": correct,
        "accuracy": correct / evaluable_count,
        "unknown": unknown,
        "unknown_rate": unknown / evaluable_count,
        "per_class": per_class,
        "confusion_columns": columns,
        "confusion_matrix": matrix.tolist(),
        "records": output_records,
    }
    output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "records"}, indent=2))
    print(f"Results: {output_path}")


if __name__ == "__main__":
    main()
