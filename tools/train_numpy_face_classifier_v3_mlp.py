"""Run the single fixed V3 MLP development experiment."""

import json
from pathlib import Path

import numpy as np

from numpy_face_classifier_v2 import FEATURE_NAMES
from numpy_face_classifier_v3_mlp import MLPClassifier, apply_decision_rule, save_artifact
from train_numpy_face_classifier import arrays, extract_features, load_training_records, stratified_split


def main():
    root = Path(__file__).resolve().parents[1]
    records, duplicates = load_training_records(root)
    train_records, validation_records = stratified_split(records)
    rows = extract_features(root, train_records + validation_records)
    train_x, train_y = arrays(rows, "train")
    validation_x, validation_y = arrays(rows, "validation")
    validation_rows = [row for row in rows if row["detected"] and row["partition"] == "validation"]

    model = MLPClassifier().fit(train_x, train_y, validation_x, validation_y)
    frozen_v2 = json.loads((root / "data/processed/face_shape_v2_model.json").read_text("utf-8"))
    if not np.allclose(model.mean_, frozen_v2["mean"], rtol=0, atol=1e-12):
        raise RuntimeError("MLP train mean does not match the V2 split")
    if not np.allclose(model.scale_, frozen_v2["std"], rtol=0, atol=1e-12):
        raise RuntimeError("MLP train standard deviation does not match the V2 split")

    train_probabilities = model.predict_proba(train_x)
    train_predictions = apply_decision_rule(train_probabilities)[0]
    probabilities = model.predict_proba(validation_x)
    predictions, order, top, second = apply_decision_rule(probabilities)
    accuracy = float(np.mean(predictions == validation_y))
    unknown_rate = float(np.mean(predictions == "unknown"))
    per_class = {
        label: float(np.mean(predictions[validation_y == label] == label))
        for label in model.classes_
    }
    columns = [*model.classes_, "unknown"]
    matrix = np.zeros((5, 6), dtype=int)
    for actual, predicted in zip(validation_y, predictions, strict=True):
        matrix[list(model.classes_).index(actual), list(columns).index(predicted)] += 1

    model_path = root / "data/processed/face_shape_v3_mlp_model.json"
    results_path = root / "data/processed/face_shape_v3_mlp_validation_results.json"
    save_artifact(model, model_path)
    result_rows = []
    for index, row in enumerate(validation_rows):
        best, runner_up = order[index, 0], order[index, 1]
        result_rows.append({
            "path": row["path"],
            "actual_label": row["label"],
            "predicted_label": str(predictions[index]),
            "top_label": str(model.classes_[best]),
            "top_probability": float(top[index]),
            "second_label": str(model.classes_[runner_up]),
            "second_probability": float(second[index]),
            "margin": float(top[index] - second[index]),
            "feature_vector": {
                name: float(value) for name, value in zip(FEATURE_NAMES, row["features"], strict=True)
            },
            "probabilities": {
                str(label): float(value)
                for label, value in zip(model.classes_, probabilities[index], strict=True)
            },
        })
    result = {
        "version": "face-shape-v3-mlp-validation-1",
        "model_artifact": str(model_path),
        "selection": "exact V6.0 deduplicated training_set seeded 80/20 split",
        "duplicates_removed": duplicates,
        "train_count": len(train_y),
        "validation_count": len(validation_y),
        "detection_failures": sum(not row["detected"] for row in rows),
        "best_epoch": model.best_epoch_,
        "train_accuracy": float(np.mean(train_predictions == train_y)),
        "train_unknown_rate": float(np.mean(train_predictions == "unknown")),
        "accuracy": accuracy,
        "unknown_rate": unknown_rate,
        "per_class": per_class,
        "confusion_columns": [str(value) for value in columns],
        "confusion_matrix": matrix.tolist(),
        "records": result_rows,
    }
    results_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "records"}, indent=2))
    print(f"Model: {model_path}")
    print(f"Validation: {results_path}")


if __name__ == "__main__":
    main()
