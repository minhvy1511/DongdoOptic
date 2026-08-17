import json
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
MANIFEST_PATH = REPO_ROOT / "data" / "processed" / "visual_reference_wikimedia_pilot_v1.json"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.frame_product_service import FrameProductCatalogError, load_frame_products  # noqa: E402
from app.services.visual_reference_schema import (  # noqa: E402
    VISUAL_REFERENCE_SCHEMA_VERSION,
    VisualReferenceError,
    load_visual_reference_manifest,
    normalize_visual_reference_manifest,
)


def valid_reference(**overrides):
    record = {
        "schemaVersion": VISUAL_REFERENCE_SCHEMA_VERSION,
        "id": "wikimedia-commons:100",
        "source": "Wikimedia Commons",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Demo_glasses.jpg",
        "imageUrl": "https://upload.wikimedia.org/demo-glasses.jpg",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "Demo by Example Author, CC BY 4.0",
        "retrievedAt": "2026-08-17T00:00:00Z",
        "eligibility": "eligible",
        "eligibilityReasons": [],
        "author": "Example Author",
        "containsIdentifiablePerson": False,
        "trademarkRisk": "low",
    }
    record.update(overrides)
    return record


def manifest(*records):
    return {"schemaVersion": 1, "source": "Wikimedia Commons", "references": list(records)}


class VisualReferenceSchemaTest(unittest.TestCase):
    def test_valid_reference_passes(self):
        result = normalize_visual_reference_manifest(manifest(valid_reference()))
        self.assertEqual(result["references"][0]["eligibility"], "eligible")

    def test_missing_rights_fields_fail_eligibility(self):
        cases = (
            ("license", "LICENSE_UNCLEAR_OR_UNSUPPORTED"),
            ("attribution", "ATTRIBUTION_INSUFFICIENT"),
            ("sourceUrl", "SOURCE_PAGE_MISSING"),
        )
        for field, reason in cases:
            with self.subTest(field=field):
                record = valid_reference(**{field: None, "eligibility": "ineligible", "eligibilityReasons": [reason]})
                normalized = normalize_visual_reference_manifest(manifest(record))["references"][0]
                self.assertIn(reason, normalized["eligibilityReasons"])

    def test_unknown_optional_attributes_remain_null(self):
        record = normalize_visual_reference_manifest(manifest(valid_reference()))["references"][0]
        self.assertIsNone(record["shape"])
        self.assertIsNone(record["material"])
        self.assertIsNone(record["sourceFileHash"])

    def test_product_fields_are_rejected(self):
        for field in ("sku", "brand", "lensWidthMm", "price", "availability"):
            with self.subTest(field=field):
                with self.assertRaisesRegex(VisualReferenceError, "Product-only"):
                    normalize_visual_reference_manifest(manifest(valid_reference(**{field: "invented"})))

    def test_duplicate_id_is_detected(self):
        with self.assertRaisesRegex(VisualReferenceError, "Duplicate"):
            normalize_visual_reference_manifest(manifest(valid_reference(), valid_reference()))

    def test_product_catalog_loader_cannot_consume_visual_references(self):
        payload = load_visual_reference_manifest(MANIFEST_PATH)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "not-products.json"
            path.write_text(json.dumps(payload["references"]), encoding="utf-8")
            with self.assertRaises(FrameProductCatalogError):
                load_frame_products(path)

    def test_manifest_validation_is_deterministic(self):
        first = load_visual_reference_manifest(MANIFEST_PATH)
        second = normalize_visual_reference_manifest(deepcopy(first))
        self.assertEqual(first, second)
        self.assertEqual(len(first["references"]), 10)
        self.assertEqual(sum(item["eligibility"] == "eligible" for item in first["references"]), 1)


if __name__ == "__main__":
    unittest.main()
