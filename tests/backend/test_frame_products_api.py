import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.api import routes  # noqa: E402
from app.main import app  # noqa: E402
from app.services.frame_product_service import FrameProductCatalogError, load_frame_products  # noqa: E402
from fastapi import HTTPException  # noqa: E402


class FrameProductsApiTest(unittest.TestCase):
    def test_frame_products_route_is_registered(self):
        route_paths = set(app.openapi()["paths"].keys())

        self.assertIn("/api/frame-products", route_paths)

    def test_frame_products_endpoint_returns_catalog(self):
        payload = routes.frame_products()

        self.assertIn("items", payload)
        self.assertEqual(payload["count"], len(payload["items"]))
        self.assertEqual(payload["count"], len(load_frame_products()))
        self.assertGreaterEqual(payload["count"], 50)

    def test_frame_products_have_basic_required_fields(self):
        products = routes.frame_products()["items"]

        for product in products:
            self.assertTrue(product["sku"])
            self.assertTrue(product["name"])
            if product.get("source_type") == "PUBLIC_REFERENCE":
                self.assertIsNone(product["price"])
                self.assertTrue(product["source_name"])
                self.assertTrue(product["source_url"])
                self.assertTrue(product["source_product_id"])
            else:
                self.assertIsInstance(product["price"], (int, float))
            self.assertIsInstance(product["available"], bool)

    def test_catalog_service_error_returns_http_error(self):
        original_loader = routes.load_frame_products
        routes.load_frame_products = lambda: (_ for _ in ()).throw(FrameProductCatalogError("broken catalog"))
        try:
            with self.assertRaises(HTTPException) as context:
                routes.frame_products()
        finally:
            routes.load_frame_products = original_loader

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("Frame product catalog unavailable", context.exception.detail)
        self.assertNotIn("Traceback", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
