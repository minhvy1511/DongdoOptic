"""Reusable NumPy-only face-shape classifier V2 for offline and shadow use."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


SEED = 20260816
CLASS_ORDER = ("heart", "long", "oval", "round", "square")
FEATURE_NAMES = (
    "faceLengthToCheek",
    "lowerJawToCheek",
    "jawSideSlope",
    "jawTaper",
    "cheekProminence",
    "foreheadToCheek",
    "jawToForehead",
    "chinWidthToCheek",
    "upperFaceToCheek",
    "jawSlopeAsymmetry",
    "jawContourCurvature",
    "chinJawAngularity",
)
TRAINING_SETTINGS = {
    "learning_rate": 0.05,
    "epochs": 2000,
    "l2": 0.001,
    "seed": SEED,
    "patience": 100,
    "min_delta": 0.000001,
}
DECISION_SETTINGS = {
    "minimum_probability": 0.40,
    "minimum_margin": 0.08,
}
DEFAULT_MODEL_ARTIFACT = Path(__file__).resolve().parents[1] / "data/processed/face_shape_v2_model.json"


class SoftmaxRegression:
    def __init__(self, **settings):
        config = {**TRAINING_SETTINGS, **settings}
        self.learning_rate = config["learning_rate"]
        self.epochs = config["epochs"]
        self.l2 = config["l2"]
        self.seed = config["seed"]
        self.patience = config["patience"]
        self.min_delta = config["min_delta"]
        self.mean_ = self.scale_ = self.weights_ = self.bias_ = self.classes_ = None
        self.loss_history_: list[float] = []
        self.validation_loss_history_: list[float] = []
        self.best_epoch_: int | None = None

    @staticmethod
    def _softmax(logits):
        shifted = logits - np.max(logits, axis=1, keepdims=True)
        exponentials = np.exp(shifted)
        return exponentials / np.sum(exponentials, axis=1, keepdims=True)

    def _standardize(self, features):
        if self.mean_ is None or self.scale_ is None:
            raise RuntimeError("Model has not been fitted")
        return (features - self.mean_) / self.scale_

    def _loss(self, features, targets):
        probabilities = self._softmax(features @ self.weights_ + self.bias_)
        cross_entropy = -np.sum(
            targets * np.log(np.clip(probabilities, 1e-15, 1.0))
        ) / len(features)
        return float(cross_entropy + 0.5 * self.l2 * np.sum(self.weights_**2))

    def fit(self, features, labels, validation_features, validation_labels):
        features = np.asarray(features, dtype=np.float64)
        labels = np.asarray(labels)
        self.mean_ = features.mean(axis=0)
        deviation = features.std(axis=0)
        self.scale_ = np.where(deviation > 1e-12, deviation, 1.0)
        standardized = self._standardize(features)
        validation_standardized = self._standardize(
            np.asarray(validation_features, dtype=np.float64)
        )
        self.classes_, encoded = np.unique(labels, return_inverse=True)
        if tuple(self.classes_) != CLASS_ORDER:
            raise ValueError(f"Expected class order {CLASS_ORDER}, got {tuple(self.classes_)}")
        validation_encoded = np.searchsorted(self.classes_, validation_labels)
        targets = np.eye(len(self.classes_))[encoded]
        validation_targets = np.eye(len(self.classes_))[validation_encoded]

        rng = np.random.default_rng(self.seed)
        self.weights_ = rng.normal(0.0, 0.01, (features.shape[1], len(self.classes_)))
        self.bias_ = np.zeros(len(self.classes_))
        best_loss = np.inf
        best_weights = self.weights_.copy()
        best_bias = self.bias_.copy()
        stale_epochs = 0

        for epoch in range(self.epochs):
            probabilities = self._softmax(standardized @ self.weights_ + self.bias_)
            error = probabilities - targets
            self.weights_ -= self.learning_rate * (
                standardized.T @ error / len(features) + self.l2 * self.weights_
            )
            self.bias_ -= self.learning_rate * error.mean(axis=0)
            self.loss_history_.append(self._loss(standardized, targets))
            validation_loss = self._loss(validation_standardized, validation_targets)
            self.validation_loss_history_.append(validation_loss)
            if validation_loss < best_loss - self.min_delta:
                best_loss = validation_loss
                best_weights = self.weights_.copy()
                best_bias = self.bias_.copy()
                self.best_epoch_ = epoch + 1
                stale_epochs = 0
            else:
                stale_epochs += 1
                if stale_epochs >= self.patience:
                    break

        self.weights_, self.bias_ = best_weights, best_bias
        return self

    def predict_proba(self, features):
        standardized = self._standardize(np.asarray(features, dtype=np.float64))
        return self._softmax(standardized @ self.weights_ + self.bias_)

    def to_artifact(self):
        return {
            "version": "face-shape-v2-numpy-softmax-1",
            "feature_names": list(FEATURE_NAMES),
            "class_order": list(self.classes_),
            "mean": self.mean_.tolist(),
            "std": self.scale_.tolist(),
            "weights": self.weights_.tolist(),
            "bias": self.bias_.tolist(),
            "training_settings": {**TRAINING_SETTINGS, "best_epoch": self.best_epoch_},
            "decision_settings": dict(DECISION_SETTINGS),
        }

    @classmethod
    def from_artifact(cls, artifact):
        model = cls(**artifact["training_settings"])
        model.classes_ = np.asarray(artifact["class_order"])
        model.mean_ = np.asarray(artifact["mean"], dtype=np.float64)
        model.scale_ = np.asarray(artifact["std"], dtype=np.float64)
        model.weights_ = np.asarray(artifact["weights"], dtype=np.float64)
        model.bias_ = np.asarray(artifact["bias"], dtype=np.float64)
        model.best_epoch_ = artifact["training_settings"].get("best_epoch")
        return model


def save_model_artifact(model, path):
    Path(path).write_text(json.dumps(model.to_artifact(), indent=2) + "\n", encoding="utf-8")


def load_model_artifact(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _ordered_vector(feature_vector, feature_names):
    if isinstance(feature_vector, dict):
        return [feature_vector[name] for name in feature_names]
    if len(feature_vector) != len(feature_names):
        raise ValueError(f"Expected {len(feature_names)} features")
    return feature_vector


def predictFaceShapeV2(featureVector, modelArtifact=DEFAULT_MODEL_ARTIFACT):
    """Predict one feature vector without affecting the production classifier."""
    artifact = load_model_artifact(modelArtifact) if isinstance(modelArtifact, (str, Path)) else modelArtifact
    model = SoftmaxRegression.from_artifact(artifact)
    vector = _ordered_vector(featureVector, artifact["feature_names"])
    probabilities = model.predict_proba(np.asarray([vector], dtype=np.float64))[0]
    order = np.argsort(probabilities)[::-1]
    best, second = int(order[0]), int(order[1])
    top_probability = float(probabilities[best])
    margin = float(probabilities[best] - probabilities[second])
    decision = artifact["decision_settings"]
    unknown_reason = None
    if top_probability < decision["minimum_probability"]:
        unknown_reason = "LOW_PROBABILITY"
    elif margin < decision["minimum_margin"]:
        unknown_reason = "LOW_MARGIN"
    return {
        "label": "unknown" if unknown_reason else str(model.classes_[best]),
        "top_label": str(model.classes_[best]),
        "top_probability": top_probability,
        "second_label": str(model.classes_[second]),
        "second_probability": float(probabilities[second]),
        "margin": margin,
        "unknown_reason": unknown_reason,
        "probabilities": {
            str(label): float(probability)
            for label, probability in zip(model.classes_, probabilities, strict=True)
        },
    }


def compareShadowPredictions(
    legacyPrediction, featureVector, modelArtifact=DEFAULT_MODEL_ARTIFACT
):
    return {
        "legacyPrediction": legacyPrediction,
        "v2Prediction": predictFaceShapeV2(featureVector, modelArtifact),
    }
