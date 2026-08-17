import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScanDiagnosticsExport,
  createScanDiagnosticsFilename,
  downloadScanDiagnostics,
  isScanDiagnosticsExportEnabled
} from "../../frontend/js/vision/scan-diagnostics-export.js";

test("export is enabled only by the explicit debug query", () => {
  assert.equal(isScanDiagnosticsExportEnabled("?visionDebug=1"), true);
  assert.equal(isScanDiagnosticsExportEnabled("?visionDebug=0"), false);
  assert.equal(isScanDiagnosticsExportEnabled(""), false);
});

test("export contains current ranking data using a strict non-PII allowlist", () => {
  const payload = buildScanDiagnosticsExport({
    timestamp: "2026-08-17T12:00:00.000Z",
    visionProfile: { faceShape: "round", customerName: "PRIVATE" },
    faceConfidence: 0.81,
    faceMetrics: { lengthToWidth: 1.24, image: "PRIVATE_IMAGE" },
    v3Shadow: { v3Label: "oval", v3Probabilities: { oval: 0.6, round: 0.3 }, cameraImage: "PRIVATE" },
    rankingResult: {
      topProducts: [{
        frame: { sku: "FROZEN", model: "Frozen model" },
        totalScore: 79
      }],
      finalTopProducts: [{
        frame: { sku: "SKU-1", model: "Model 1", image: "PRIVATE_IMAGE" },
        totalScore: 78.4,
        components: { availability: 15, faceCompatibility: 18 },
        reasons: ["Face fit"],
        warnings: ["Try physically"]
      }]
    },
    legacyRecommendations: [{ name: "Legacy round", phone: "PRIVATE_PHONE" }],
    rankingRequestId: 7,
    recentScans: [{
      timestamp: "2026-08-17T11:59:00.000Z",
      legacyLabel: "round",
      v3Label: "oval",
      v3Probabilities: { oval: 0.6 },
      featureVector: [1.2, 0.8],
      customerName: "PRIVATE"
    }]
  });
  const serialized = JSON.stringify(payload);

  assert.equal(payload.currentScan.topRankedProducts[0].sku, "SKU-1");
  assert.equal(payload.currentScan.topRankedProducts[0].totalScore, 78.4);
  assert.equal(payload.currentScan.rankingRequestId, "7");
  assert.equal(payload.recentScans.length, 1);
  assert.doesNotMatch(serialized, /PRIVATE|customerName|phone|image/i);
});

test("recent export is capped to the last ten in-memory scans", () => {
  const recentScans = Array.from({ length: 12 }, (_, index) => ({
    timestamp: `scan-${index}`,
    v3Label: "oval",
    featureVector: [index]
  }));
  const payload = buildScanDiagnosticsExport({ recentScans });

  assert.equal(payload.recentScans.length, 10);
  assert.equal(payload.recentScans[0].timestamp, "scan-2");
  assert.match(createScanDiagnosticsFilename("2026-08-17T12:00:00.000Z"), /^visionid-scan-diagnostics-/);
});

test("debug export downloads JSON locally and revokes its object URL", () => {
  const link = { href: "", download: "", clicked: false, click() { this.clicked = true; } };
  const revoked = [];
  const filename = downloadScanDiagnostics({ currentScan: { timestamp: "2026-08-17T12:00:00.000Z" } }, {
    documentRef: { createElement: () => link },
    urlApi: {
      createObjectURL: () => "blob:scan-diagnostics",
      revokeObjectURL: (url) => revoked.push(url)
    },
    blobCtor: class FakeBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    }
  });

  assert.equal(link.clicked, true);
  assert.equal(link.href, "blob:scan-diagnostics");
  assert.equal(filename, link.download);
  assert.deepEqual(revoked, ["blob:scan-diagnostics"]);
});
