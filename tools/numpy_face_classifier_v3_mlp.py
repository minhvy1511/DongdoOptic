"""Fixed NumPy-only 12-16-5 MLP for the offline V3 experiment."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from numpy_face_classifier_v2 import CLASS_ORDER, DECISION_SETTINGS, FEATURE_NAMES, SEED


TRAINING_SETTINGS = {
    "hidden_units": 16,
    "learning_rate": 0.001,
    "epochs": 500,
    "batch_size": 64,
    "l2": 0.001,
    "seed": SEED,
    "patience": 35,
    "min_delta": 0.00001,
    "optimizer": "adam",
    "beta1": 0.9,
    "beta2": 0.999,
    "epsilon": 1e-8,
}


class MLPClassifier:
    def __init__(self):
        self.settings = dict(TRAINING_SETTINGS)
        self.mean_ = self.scale_ = None
        self.W1 = self.b1 = self.W2 = self.b2 = None
        self.classes_ = np.asarray(CLASS_ORDER)
        self.best_epoch_ = None
        self.best_validation_loss_ = None

    @staticmethod
    def _softmax(logits):
        shifted = logits - np.max(logits, axis=1, keepdims=True)
        exponentials = np.exp(shifted)
        return exponentials / np.sum(exponentials, axis=1, keepdims=True)

    def _forward(self, features):
        hidden_linear = features @ self.W1 + self.b1
        hidden = np.maximum(hidden_linear, 0.0)
        probabilities = self._softmax(hidden @ self.W2 + self.b2)
        return hidden_linear, hidden, probabilities

    def _loss(self, features, targets):
        probabilities = self._forward(features)[2]
        cross_entropy = -np.sum(
            targets * np.log(np.clip(probabilities, 1e-15, 1.0))
        ) / len(features)
        penalty = 0.5 * self.settings["l2"] * (
            np.sum(self.W1**2) + np.sum(self.W2**2)
        )
        return float(cross_entropy + penalty)

    def fit(self, train_x, train_y, validation_x, validation_y):
        train_x = np.asarray(train_x, dtype=np.float64)
        validation_x = np.asarray(validation_x, dtype=np.float64)
        self.mean_ = train_x.mean(axis=0)
        deviation = train_x.std(axis=0)
        self.scale_ = np.where(deviation > 1e-12, deviation, 1.0)
        train_z = (train_x - self.mean_) / self.scale_
        validation_z = (validation_x - self.mean_) / self.scale_
        train_indices = np.searchsorted(self.classes_, train_y)
        validation_indices = np.searchsorted(self.classes_, validation_y)
        train_targets = np.eye(len(self.classes_))[train_indices]
        validation_targets = np.eye(len(self.classes_))[validation_indices]

        rng = np.random.default_rng(self.settings["seed"])
        self.W1 = rng.normal(0.0, np.sqrt(2.0 / train_z.shape[1]),
                             (train_z.shape[1], self.settings["hidden_units"]))
        self.b1 = np.zeros(self.settings["hidden_units"])
        self.W2 = rng.normal(0.0, np.sqrt(2.0 / self.settings["hidden_units"]),
                             (self.settings["hidden_units"], len(self.classes_)))
        self.b2 = np.zeros(len(self.classes_))
        parameters = [self.W1, self.b1, self.W2, self.b2]
        first_moments = [np.zeros_like(parameter) for parameter in parameters]
        second_moments = [np.zeros_like(parameter) for parameter in parameters]
        step = 0
        best_loss = np.inf
        best_parameters = [parameter.copy() for parameter in parameters]
        stale_epochs = 0

        for epoch in range(1, self.settings["epochs"] + 1):
            order = rng.permutation(len(train_z))
            for start in range(0, len(order), self.settings["batch_size"]):
                batch = order[start:start + self.settings["batch_size"]]
                x = train_z[batch]
                targets = train_targets[batch]
                hidden_linear, hidden, probabilities = self._forward(x)
                output_error = (probabilities - targets) / len(batch)
                dW2 = hidden.T @ output_error + self.settings["l2"] * self.W2
                db2 = output_error.sum(axis=0)
                hidden_error = (output_error @ self.W2.T) * (hidden_linear > 0)
                dW1 = x.T @ hidden_error + self.settings["l2"] * self.W1
                db1 = hidden_error.sum(axis=0)
                gradients = [dW1, db1, dW2, db2]
                step += 1
                for index, (parameter, gradient) in enumerate(zip(parameters, gradients, strict=True)):
                    first_moments[index] = (
                        self.settings["beta1"] * first_moments[index]
                        + (1 - self.settings["beta1"]) * gradient
                    )
                    second_moments[index] = (
                        self.settings["beta2"] * second_moments[index]
                        + (1 - self.settings["beta2"]) * gradient**2
                    )
                    corrected_first = first_moments[index] / (1 - self.settings["beta1"]**step)
                    corrected_second = second_moments[index] / (1 - self.settings["beta2"]**step)
                    parameter -= self.settings["learning_rate"] * corrected_first / (
                        np.sqrt(corrected_second) + self.settings["epsilon"]
                    )

            validation_loss = self._loss(validation_z, validation_targets)
            if validation_loss < best_loss - self.settings["min_delta"]:
                best_loss = validation_loss
                best_parameters = [parameter.copy() for parameter in parameters]
                self.best_epoch_ = epoch
                stale_epochs = 0
            else:
                stale_epochs += 1
                if stale_epochs >= self.settings["patience"]:
                    break

        self.W1, self.b1, self.W2, self.b2 = best_parameters
        self.best_validation_loss_ = best_loss
        return self

    def predict_proba(self, features):
        standardized = (np.asarray(features, dtype=np.float64) - self.mean_) / self.scale_
        return self._forward(standardized)[2]

    def to_artifact(self):
        return {
            "version": "face-shape-v3-numpy-mlp-1",
            "architecture": "12 -> 16 ReLU -> 5 softmax",
            "feature_names": list(FEATURE_NAMES),
            "class_order": list(self.classes_),
            "mean": self.mean_.tolist(),
            "std": self.scale_.tolist(),
            "W1": self.W1.tolist(),
            "b1": self.b1.tolist(),
            "W2": self.W2.tolist(),
            "b2": self.b2.tolist(),
            "activation": "ReLU",
            "training_settings": {
                **self.settings,
                "best_epoch": self.best_epoch_,
                "best_validation_loss": self.best_validation_loss_,
            },
            "decision_thresholds": dict(DECISION_SETTINGS),
        }


def save_artifact(model, path):
    Path(path).write_text(json.dumps(model.to_artifact(), indent=2) + "\n", encoding="utf-8")


def apply_decision_rule(probabilities):
    order = np.argsort(probabilities, axis=1)[:, ::-1]
    top = probabilities[np.arange(len(probabilities)), order[:, 0]]
    second = probabilities[np.arange(len(probabilities)), order[:, 1]]
    predictions = np.asarray([CLASS_ORDER[index] for index in order[:, 0]], dtype="<U8")
    predictions[
        (top < DECISION_SETTINGS["minimum_probability"])
        | ((top - second) < DECISION_SETTINGS["minimum_margin"])
    ] = "unknown"
    return predictions, order, top, second
