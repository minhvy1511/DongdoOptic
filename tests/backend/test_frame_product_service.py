import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.frame_product_service import (  # noqa: E402
    FrameProductCatalogError,
    get_frame_product_by_sku,
    load_frame_products,
)


def valid_product(**overrides):
    product = {
        "sku": "DEMO-TEST-001",
        "brand": "Demo",
        "name": "Demo test frame",
        "shape": "rounded-square",
        "material": "TR90",
        "rim_type": "full-rim",
        "lens_width_mm": 51,
        "bridge_width_mm": 20,
        "price": 650000,
        "image": "/frontend/assets/frames/demo-test.jpg",
        "available": True,
        "style_tags": ["daily", "office"],
    }
    product.update(overrides)
    return product


class FrameProductServiceTest(unittest.TestCase):
    def write_catalog(self, payload):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        path = Path(temp_dir.name) / "frame_products.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def test_valid_catalog_loads(self):
        path = self.write_catalog({
            "catalog_purpose": "development/sample data",
            "products": [valid_product()]
        })

        products = load_frame_products(path)

        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["sku"], "DEMO-TEST-001")
        self.assertEqual(get_frame_product_by_sku("DEMO-TEST-001", path)["brand"], "Demo")

    def test_duplicate_sku_rejected(self):
        path = self.write_catalog([
            valid_product(),
            valid_product(name="Duplicate demo frame"),
        ])

        with self.assertRaisesRegex(FrameProductCatalogError, "Duplicate"):
            load_frame_products(path)

    def test_missing_required_field_rejected(self):
        product = valid_product()
        del product["shape"]
        path = self.write_catalog([product])

        with self.assertRaisesRegex(FrameProductCatalogError, "missing required fields"):
            load_frame_products(path)

    def test_invalid_dimension_rejected(self):
        path = self.write_catalog([valid_product(lens_width_mm=0)])

        with self.assertRaisesRegex(FrameProductCatalogError, "lens_width_mm"):
            load_frame_products(path)

    def test_negative_price_rejected(self):
        path = self.write_catalog([valid_product(price=-1)])

        with self.assertRaisesRegex(FrameProductCatalogError, "price"):
            load_frame_products(path)

    def test_public_reference_allows_null_price_with_source_price(self):
        path = self.write_catalog([valid_product(
            sku="PUB-ZENNI-TEST",
            price=None,
            source_price=35.95,
            source_currency="USD",
            source_type="PUBLIC_REFERENCE",
            source_name="Zenni Optical",
            source_url="https://eyewear.zenni.io/products/TEST",
            source_product_id="TEST",
        )])

        products = load_frame_products(path)

        self.assertIsNone(products[0]["price"])
        self.assertEqual(products[0]["source_price"], 35.95)

    def test_public_reference_requires_source_metadata(self):
        path = self.write_catalog([valid_product(
            sku="PUB-ZENNI-TEST",
            price=None,
            source_price=35.95,
            source_currency="USD",
            source_type="PUBLIC_REFERENCE",
        )])

        with self.assertRaisesRegex(FrameProductCatalogError, "missing source fields"):
            load_frame_products(path)


if __name__ == "__main__":
    unittest.main()
