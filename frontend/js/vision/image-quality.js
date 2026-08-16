import {
  DEFAULT_SCAN_QUALITY_CONFIG,
  evaluateImageQualityFromImageData
} from "./quality-gate.js?v=20260729-85";

export function attachFrameImageQuality(analysis, sourceElement, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const imageQuality = measureFrameImageQuality(sourceElement, analysis?.quality?.faceBox, config);
  if (!imageQuality?.available) {
    return analysis;
  }

  return {
    ...analysis,
    quality: {
      ...(analysis?.quality || {}),
      imageQuality
    }
  };
}

export function measureFrameImageQuality(sourceElement, faceBox = null, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  try {
    if (!sourceElement || typeof document === "undefined") {
      return null;
    }

    const sourceWidth = sourceElement.videoWidth || sourceElement.naturalWidth || sourceElement.width || 0;
    const sourceHeight = sourceElement.videoHeight || sourceElement.naturalHeight || sourceElement.height || 0;
    if (!sourceWidth || !sourceHeight) {
      return null;
    }

    const cropBox = getImageQualityCropBox(faceBox, sourceWidth, sourceHeight);
    const sampleCanvas = document.createElement("canvas");
    const sampleSize = 80;
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) {
      return null;
    }

    sampleContext.drawImage(
      sourceElement,
      cropBox.x,
      cropBox.y,
      cropBox.width,
      cropBox.height,
      0,
      0,
      sampleSize,
      sampleSize
    );

    return evaluateImageQualityFromImageData(sampleContext.getImageData(0, 0, sampleSize, sampleSize), config);
  } catch (error) {
    return null;
  }
}

export function getImageQualityCropBox(faceBox, sourceWidth, sourceHeight) {
  if (!faceBox?.width || !faceBox?.height) {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  }

  const padding = 0.12;
  const minX = clamp01(Number(faceBox.minX || 0) - padding);
  const minY = clamp01(Number(faceBox.minY || 0) - padding);
  const maxX = clamp01(Number(faceBox.maxX || 0) + padding);
  const maxY = clamp01(Number(faceBox.maxY || 0) + padding);
  const x = Math.round(minX * sourceWidth);
  const y = Math.round(minY * sourceHeight);
  const width = Math.max(1, Math.round((maxX - minX) * sourceWidth));
  const height = Math.max(1, Math.round((maxY - minY) * sourceHeight));

  return {
    x,
    y,
    width: Math.min(width, sourceWidth - x),
    height: Math.min(height, sourceHeight - y)
  };
}

export function averageImageQuality(imageQualityList) {
  const available = imageQualityList.filter((item) => item?.available);
  if (!available.length) {
    return null;
  }

  const brightness = average(available.map((item) => item.brightness));
  const contrast = average(available.map((item) => item.contrast));
  const sharpness = average(available.map((item) => item.sharpness));
  return {
    available: true,
    brightness,
    contrast,
    sharpness,
    passed: available.every((item) => item.passed),
    reasonCode: available.find((item) => item.reasonCode)?.reasonCode || ""
  };
}

function average(values) {
  const numericValues = values.map(Number).filter(Number.isFinite);
  if (!numericValues.length) {
    return 0;
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
