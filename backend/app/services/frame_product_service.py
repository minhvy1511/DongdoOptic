import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.services.frame_catalog_schema import (
    migrate_legacy_frame_record,
    normalize_canonical_frame_records,
)


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "frame_products.json"

REQUIRED_FIELDS = frozenset({
    "sku",
    "brand",
    "name",
    "shape",
    "material",
    "rim_type",
    "lens_width_mm",
    "bridge_width_mm",
    "price",
    "image",
    "available",
})

OPTIONAL_FIELDS = frozenset({
    "model",
    "lens_height_mm",
    "temple_length_mm",
    "frame_width_mm",
    "color",
    "color_family",
    "style_tags",
    "gender",
    "stock",
})

SOURCE_FIELDS = frozenset({
    "source_type",
    "source_name",
    "source_url",
    "source_product_id",
    "source_price",
    "source_currency",
    "source_shape",
})

ALLOWED_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS | SOURCE_FIELDS
REQUIRED_PUBLIC_REFERENCE_FIELDS = frozenset({
    "source_type",
    "source_name",
    "source_url",
    "source_product_id",
})
DIMENSION_FIELDS = frozenset({
    "lens_width_mm",
    "lens_height_mm",
    "bridge_width_mm",
    "temple_length_mm",
    "frame_width_mm",
})
STRING_FIELDS = frozenset({
    "sku",
    "brand",
    "name",
    "shape",
    "material",
    "rim_type",
    "image",
    "model",
    "color",
    "color_family",
    "gender",
    "source_type",
    "source_name",
    "source_url",
    "source_product_id",
    "source_currency",
    "source_shape",
})


class FrameProductCatalogError(ValueError):
    """Raised when the frame product catalog contract is invalid."""


def load_frame_products(path: str | Path = DATA_PATH) -> list[dict[str, Any]]:
    catalog_path = Path(path)
    if not catalog_path.exists():
        raise FrameProductCatalogError(f"Frame product catalog not found: {catalog_path}")

    try:
        raw_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise FrameProductCatalogError(f"Malformed frame product catalog JSON: {exc}") from exc

    products = _extract_products(raw_catalog)
    validate_frame_products(products)
    return deepcopy(products)


def load_canonical_frame_products(path: str | Path = DATA_PATH) -> list[dict[str, Any]]:
    catalog_path = Path(path)
    if not catalog_path.exists():
        raise FrameProductCatalogError(f"Frame product catalog not found: {catalog_path}")
    try:
        raw_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise FrameProductCatalogError(f"Malformed frame product catalog JSON: {exc}") from exc

    products = _extract_products(raw_catalog)
    try:
        if products and all(product.get("schemaVersion") == 1 for product in products if isinstance(product, dict)):
            return normalize_canonical_frame_records(products)
        validate_frame_products(products)
        migrated = [migrate_legacy_frame_record(product) for product in products]
        return normalize_canonical_frame_records(migrated, allow_unknown_retrieved_at=True)
    except ValueError as exc:
        raise FrameProductCatalogError(str(exc)) from exc


def get_frame_product_by_sku(sku: str, path: str | Path = DATA_PATH) -> dict[str, Any] | None:
    normalized_sku = str(sku or "").strip()
    if not normalized_sku:
        return None

    for product in load_frame_products(path):
        if product.get("sku") == normalized_sku:
            return product
    return None


def validate_frame_products(products: Any) -> None:
    if not isinstance(products, list):
        raise FrameProductCatalogError("Frame product catalog must contain a product list.")

    seen_skus: set[str] = set()
    for index, product in enumerate(products):
        _validate_product(product, index, seen_skus)


def _extract_products(raw_catalog: Any) -> list[dict[str, Any]]:
    if isinstance(raw_catalog, list):
        return raw_catalog

    if isinstance(raw_catalog, dict):
        products = raw_catalog.get("products")
        if isinstance(products, list):
            return products

    raise FrameProductCatalogError("Frame product catalog must be a list or an object with a products list.")


def _validate_product(product: Any, index: int, seen_skus: set[str]) -> None:
    label = f"product[{index}]"
    if not isinstance(product, dict):
        raise FrameProductCatalogError(f"{label} must be an object.")

    unknown_fields = sorted(set(product) - ALLOWED_FIELDS)
    if unknown_fields:
        raise FrameProductCatalogError(f"{label} has unsupported fields: {', '.join(unknown_fields)}")

    missing_fields = sorted(field for field in REQUIRED_FIELDS if field not in product)
    if missing_fields:
        raise FrameProductCatalogError(f"{label} missing required fields: {', '.join(missing_fields)}")

    sku = _validate_required_string(product, "sku", label)
    if sku in seen_skus:
        raise FrameProductCatalogError(f"Duplicate frame product SKU: {sku}")
    seen_skus.add(sku)

    for field in STRING_FIELDS - {"sku"}:
        if field in REQUIRED_FIELDS:
            _validate_required_string(product, field, label)
        elif field in product:
            _validate_optional_string(product, field, label)

    for field in DIMENSION_FIELDS:
        if field in product:
            _validate_positive_number(product, field, label)

    _validate_price(product, label)
    _validate_available(product, label)

    if "source_type" in product and product.get("source_type") != "PUBLIC_REFERENCE":
        raise FrameProductCatalogError(f"{label}.source_type must be PUBLIC_REFERENCE when provided.")

    if product.get("source_type") == "PUBLIC_REFERENCE":
        _validate_public_reference(product, label)

    if "source_price" in product:
        _validate_non_negative_number(product, "source_price", label)

    if "stock" in product:
        _validate_stock(product, label)

    if "style_tags" in product:
        _validate_style_tags(product, label)


def _validate_required_string(product: dict[str, Any], field: str, label: str) -> str:
    value = product.get(field)
    if not isinstance(value, str) or not value.strip():
        raise FrameProductCatalogError(f"{label}.{field} must be a non-empty string.")
    return value.strip()


def _validate_optional_string(product: dict[str, Any], field: str, label: str) -> None:
    value = product.get(field)
    if value is not None and not isinstance(value, str):
        raise FrameProductCatalogError(f"{label}.{field} must be a string when provided.")


def _validate_positive_number(product: dict[str, Any], field: str, label: str) -> None:
    value = product.get(field)
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
        raise FrameProductCatalogError(f"{label}.{field} must be a positive number.")


def _validate_non_negative_number(product: dict[str, Any], field: str, label: str) -> None:
    value = product.get(field)
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
        raise FrameProductCatalogError(f"{label}.{field} must be a non-negative number.")


def _validate_price(product: dict[str, Any], label: str) -> None:
    if product.get("price") is None and product.get("source_type") == "PUBLIC_REFERENCE":
        return

    _validate_non_negative_number(product, "price", label)


def _validate_public_reference(product: dict[str, Any], label: str) -> None:
    missing_fields = sorted(field for field in REQUIRED_PUBLIC_REFERENCE_FIELDS if field not in product)
    if missing_fields:
        raise FrameProductCatalogError(
            f"{label} PUBLIC_REFERENCE missing source fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_PUBLIC_REFERENCE_FIELDS:
        _validate_required_string(product, field, label)

def _validate_available(product: dict[str, Any], label: str) -> None:
    if not isinstance(product.get("available"), bool):
        raise FrameProductCatalogError(f"{label}.available must be a boolean.")


def _validate_stock(product: dict[str, Any], label: str) -> None:
    value = product.get("stock")
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise FrameProductCatalogError(f"{label}.stock must be a non-negative integer when provided.")


def _validate_style_tags(product: dict[str, Any], label: str) -> None:
    value = product.get("style_tags")
    if not isinstance(value, list) or any(not isinstance(tag, str) or not tag.strip() for tag in value):
        raise FrameProductCatalogError(f"{label}.style_tags must be a list of non-empty strings when provided.")
