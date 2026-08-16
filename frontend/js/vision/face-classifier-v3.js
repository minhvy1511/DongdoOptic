import { FACE_CLASSIFIER_V3_MODEL } from "./face-classifier-v3-model.generated.js";
import { FACE_SHAPE_V3_FEATURE_NAMES } from "./face-shape-v3-features.js";

const MAX_SHADOW_SCANS = 10;
const shadowScans = [];

export function standardizeFaceShapeV3Features(featureVector) {
  validateFeatureVector(featureVector);
  return featureVector.map((value, index) => (
    (Number(value) - FACE_CLASSIFIER_V3_MODEL.mean[index]) / FACE_CLASSIFIER_V3_MODEL.std[index]
  ));
}

export function predictFaceShapeV3(featureVector) {
  const standardized = standardizeFaceShapeV3Features(featureVector);
  const hidden = FACE_CLASSIFIER_V3_MODEL.b1.map((bias, hiddenIndex) => Math.max(0,
    bias + standardized.reduce(
      (sum, value, featureIndex) => sum + value * FACE_CLASSIFIER_V3_MODEL.W1[featureIndex][hiddenIndex],
      0
    )
  ));
  const logits = FACE_CLASSIFIER_V3_MODEL.b2.map((bias, classIndex) => (
    bias + hidden.reduce(
      (sum, value, hiddenIndex) => sum + value * FACE_CLASSIFIER_V3_MODEL.W2[hiddenIndex][classIndex],
      0
    )
  ));
  const maxLogit = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maxLogit));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  const probabilityValues = exponentials.map((value) => value / total);
  const ranked = probabilityValues
    .map((probability, index) => ({ label: FACE_CLASSIFIER_V3_MODEL.class_order[index], probability }))
    .sort((left, right) => right.probability - left.probability);
  const top = ranked[0];
  const second = ranked[1];
  const margin = top.probability - second.probability;
  const thresholds = FACE_CLASSIFIER_V3_MODEL.decision_thresholds;
  const unknownReason = top.probability < thresholds.minimum_probability
    ? "LOW_PROBABILITY"
    : margin < thresholds.minimum_margin
      ? "LOW_MARGIN"
      : null;

  return {
    predictedLabel: unknownReason ? "unknown" : top.label,
    probabilities: Object.fromEntries(ranked.map(({ label, probability }) => [label, probability])),
    topLabel: top.label,
    topProbability: top.probability,
    secondLabel: second.label,
    secondProbability: second.probability,
    margin,
    unknownReason,
    standardizedFeatures: standardized
  };
}

export function recordFaceShapeV3ShadowScan(record) {
  const stored = cloneRecord({ ...record, timestamp: record?.timestamp || new Date().toISOString() });
  shadowScans.push(stored);
  if (shadowScans.length > MAX_SHADOW_SCANS) {
    shadowScans.splice(0, shadowScans.length - MAX_SHADOW_SCANS);
  }
  return cloneRecord(stored);
}

export function getFaceShapeV3ShadowScans() {
  return cloneRecord(shadowScans);
}

export function resetFaceShapeV3ShadowScans() {
  shadowScans.length = 0;
}

export function summarizeFaceShapeV3ShadowScans() {
  const scans = getFaceShapeV3ShadowScans();
  if (!scans.length) {
    return {
      scanCount: 0,
      v3LabelAgreementRate: 0,
      legacyLabelAgreementRate: 0,
      mostFrequentV3Label: null,
      meanV3TopProbability: 0,
      featureCoefficientOfVariation: Object.fromEntries(FACE_SHAPE_V3_FEATURE_NAMES.map((name) => [name, 0]))
    };
  }

  return {
    scanCount: scans.length,
    v3LabelAgreementRate: agreementRate(scans.map((scan) => scan.v3Label)),
    legacyLabelAgreementRate: agreementRate(scans.map((scan) => scan.legacyLabel)),
    mostFrequentV3Label: mostFrequent(scans.map((scan) => scan.v3Label)),
    meanV3TopProbability: mean(scans.map((scan) => scan.v3TopProbability)),
    featureCoefficientOfVariation: Object.fromEntries(FACE_SHAPE_V3_FEATURE_NAMES.map((name, index) => {
      const values = scans.map((scan) => Number(scan.featureVector?.[index])).filter(Number.isFinite);
      const average = mean(values);
      const deviation = Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
      return [name, Math.abs(average) > 1e-12 ? deviation / Math.abs(average) : deviation];
    }))
  };
}

export { FACE_CLASSIFIER_V3_MODEL, FACE_SHAPE_V3_FEATURE_NAMES };

function validateFeatureVector(featureVector) {
  if (!Array.isArray(featureVector) || featureVector.length !== FACE_SHAPE_V3_FEATURE_NAMES.length) {
    throw new TypeError(`V3 requires ${FACE_SHAPE_V3_FEATURE_NAMES.length} ordered features.`);
  }
  if (featureVector.some((value) => !Number.isFinite(Number(value)))) {
    throw new TypeError("V3 features must all be finite numbers.");
  }
}

function agreementRate(labels) {
  return labels.length ? Math.max(...Object.values(counts(labels))) / labels.length : 0;
}

function mostFrequent(labels) {
  return Object.entries(counts(labels)).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function counts(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function cloneRecord(value) {
  return JSON.parse(JSON.stringify(value));
}
