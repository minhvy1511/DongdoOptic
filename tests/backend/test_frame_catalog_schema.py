import sys
import unittest
from copy import deepcopy
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.frame_catalog_schema import (  # noqa: E402
    CanonicalFrameCatalogError,
    FRAME_CATALOG_SCHEMA_VERSION,
    normalize_canonical_frame_records,
)
from app.services.frame_product_service import load_canonical_frame_products, load_frame_products  # noqa: E402


def valid_record(**overrides):
    record = {
        "schemaVersion": FRAME_CATALOG_SCHEMA_VERSION,
        "source": "Demo Source",
        "sourceProductId": "P-1",
        "sourceProductUrl": "https://example.com/products/P-1",
        "sourceScopedSku": "SKU-1",
        "brand": "Demo",
        "name": "Demo frame",
        "retrievedAt": "2026-08-17T12:00:00Z",
        "dataLicense": "Licensed catalog feed",
        "imageLicense": "Licensed product image",
        "allowedUses": ["recommendation", "display"],
        "attribution": "Demo Source",
        "termsUrl": "https://example.com/terms",
        "shape": "oval",
        "lensWidthMm": 51,
        "lensHeightMm": 40,
        "bridgeWidthMm": 18,
        "frameWidthMm": 137,
        "imageUrl": "https://example.com/images/P-1.jpg",
        "model": "Model One",
        "material": "acetate",
        "rimType": "full-rim",
        "styleTags": ["daily"],
        "availability": True,
    }
    record.update(overrides)
    return record


class FrameCatalogSchemaTest(unittest.TestCase):
    def test_valid_canonical_record_passes(self):
        result = normalize_canonical_frame_records([valid_record()])
        self.assertTrue(result[0]["recommendationEligible"])
        self.assertEqual(result[0]["schemaVersion"], 1)

    def test_duplicate_source_scoped_sku_within_source_fails(self):
        duplicate = valid_record(sourceProductId="P-2")
        with self.assertRaisesRegex(CanonicalFrameCatalogError, "sourceScopedSku"):
            normalize_canonical_frame_records([valid_record(), duplicate])

    def test_missing_required_identity_fails(self):
        record = valid_record()
        del record["sourceProductId"]
        with self.assertRaisesRegex(CanonicalFrameCatalogError, "missing required identity"):
            normalize_canonical_frame_records([record])

    def test_same_sku_across_sources_is_allowed(self):
        second = valid_record(
            source="Other Source",
            sourceProductId="P-2",
            sourceProductUrl="https://other.example.com/products/P-2",
        )
        self.assertEqual(len(normalize_canonical_frame_records([valid_record(), second])), 2)

    def test_missing_provenance_becomes_ineligible(self):
        record = valid_record()
        for field in ("dataLicense", "imageLicense", "allowedUses", "attribution", "termsUrl"):
            record.pop(field)
        result = normalize_canonical_frame_records([record])[0]
        self.assertFalse(result["recommendationEligible"])
        self.assertIn("LICENSE_PROVENANCE_MISSING", result["eligibilityReasons"])

    def test_invalid_provenance_structure_fails(self):
        with self.assertRaisesRegex(CanonicalFrameCatalogError, "dataLicense"):
            normalize_canonical_frame_records([valid_record(dataLicense={"unknown": True})])

    def test_invalid_dimension_url_availability_and_style_tags_fail(self):
        cases = (
            (valid_record(lensWidthMm=0), "lensWidthMm"),
            (valid_record(sourceProductUrl="not-a-url"), "sourceProductUrl"),
            (valid_record(availability="yes"), "availability"),
            (valid_record(styleTags=["daily", ""]), "styleTags"),
        )
        for record, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(CanonicalFrameCatalogError, message):
                    normalize_canonical_frame_records([record])

    def test_optional_missing_geometry_is_not_invented(self):
        record = valid_record()
        record.pop("templeLengthMm", None)
        result = normalize_canonical_frame_records([record])[0]
        self.assertIsNone(result["templeLengthMm"])

    def test_color_variants_group_safely(self):
        red = valid_record(color="Red", colorFamily="red")
        blue = valid_record(
            sourceProductId="P-2", sourceScopedSku="SKU-2",
            sourceProductUrl="https://example.com/products/P-2", color="Blue", colorFamily="blue",
        )
        records = normalize_canonical_frame_records([red, blue])
        self.assertEqual(records[0]["grouping"]["familyKey"], records[1]["grouping"]["familyKey"])
        self.assertNotEqual(records[0]["grouping"]["variantKey"], records[1]["grouping"]["variantKey"])

    def test_size_material_and_rim_differences_remain_distinct(self):
        base = valid_record()
        variants = [
            valid_record(sourceProductId="P-2", sourceScopedSku="SKU-2", sourceProductUrl="https://example.com/P-2", frameWidthMm=142),
            valid_record(sourceProductId="P-3", sourceScopedSku="SKU-3", sourceProductUrl="https://example.com/P-3", material="titanium"),
            valid_record(sourceProductId="P-4", sourceScopedSku="SKU-4", sourceProductUrl="https://example.com/P-4", rimType="rimless"),
        ]
        records = normalize_canonical_frame_records([base, *variants])
        self.assertEqual(len({record["grouping"]["familyKey"] for record in records}), 4)

    def test_ambiguous_supplied_grouping_is_rejected(self):
        record = valid_record(grouping={"familyKey": "forced", "familyBasis": "model", "variantKey": "forced"})
        with self.assertRaisesRegex(CanonicalFrameCatalogError, "grouping"):
            normalize_canonical_frame_records([record])

    def test_existing_400_records_migrate_without_changing_legacy_projection(self):
        legacy_before = load_frame_products()
        canonical = load_canonical_frame_products()
        legacy_after = load_frame_products()
        self.assertEqual(len(canonical), 400)
        self.assertEqual(legacy_before, legacy_after)
        self.assertTrue(all(not record["recommendationEligible"] for record in canonical))
        self.assertTrue(all(record["retrievedAt"] is None for record in canonical))


if __name__ == "__main__":
    unittest.main()
