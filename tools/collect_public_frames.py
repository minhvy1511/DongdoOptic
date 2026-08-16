"""Collect a bounded public reference frame catalog for development.

This importer intentionally uses public structured catalog data exposed by the
source storefront. It does not download images, bypass access controls, or
pretend public references are DongDo store inventory.
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "backend" / "app" / "data" / "frame_products.json"

SOURCE_NAME = "Zenni Optical"
SOURCE_TYPE = "PUBLIC_REFERENCE"
SOURCE_PRODUCT_URL = "https://eyewear.zenni.io/products/{sku}"
ALGOLIA_APP_ID = "SJHXMWVDZN"
ALGOLIA_API_KEY = "171b09c3390390209035b3ea1cbd16ab"
ALGOLIA_INDEX = "akeneo_b2b_prod_redemption_us_products"
MAX_PRODUCTS = 400
REQUIRED_NULLABLE_OUTPUT_FIELDS = frozenset({"price"})


SHAPE_MAP = {
    "aviator": "aviator",
    "browline": "browline",
    "cat_eye": "cat-eye",
    "cat__eye": "cat-eye",
    "geometric": "geometric",
    "oval": "oval",
    "rectangle": "rectangle",
    "round": "round",
    "round_square": "rounded-square",
    "rounded_square": "rounded-square",
    "square": "square",
    "wellington": "wellington",
}

RIM_TYPE_MAP = {
    "fullrim": "full-rim",
    "full_rim": "full-rim",
    "halfrim": "half-rim",
    "half_rim": "half-rim",
    "rimless": "rimless",
}

MATERIAL_MAP = {
    "acetate": "Acetate",
    "carbonfiber": "Mixed",
    "flextitanium": "Flex Titanium",
    "metal": "Metal",
    "mixed": "Mixed",
    "plastic": "Plastic",
    "stainlesssteel": "Stainless Steel",
    "titanium": "Titanium",
    "tr90": "TR90",
    "ultem": "Ultem",
}

GENDER_MAP = {
    "men_s": "men",
    "women_s": "women",
    "unisex": "unisex",
    "kids": "kids",
}


def main() -> int:
    products = collect_products(MAX_PRODUCTS)
    if len(products) < MAX_PRODUCTS:
        raise RuntimeError(f"Only collected {len(products)} valid public reference frames.")

    catalog = {
        "catalog_purpose": "public reference pilot catalog - development/research data, not DongDo inventory",
        "source_note": (
            "PUBLIC INTERNET REFERENCES ONLY. Prices are source USD references when present; "
            "price is null to avoid treating USD as DongDo/VND store price."
        ),
        "products": products,
    }
    OUTPUT_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(products)} public reference frames to {OUTPUT_PATH}")
    return 0


def collect_products(limit: int) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen_parent_codes: set[str] = set()
    seen_geometry_keys: set[tuple[Any, ...]] = set()

    page = 0
    while page < 20:
        hits = fetch_algolia_page(page=page, hits_per_page=100)
        if not hits:
            break

        for hit in hits:
            record = normalize_hit(hit)
            if not record:
                continue

            parent_code = str(hit.get("code") or record["source_product_id"])
            geometry_key = (
                record["shape"],
                record["material"],
                record["rim_type"],
                record["lens_width_mm"],
                record["bridge_width_mm"],
                record.get("lens_height_mm"),
                record.get("frame_width_mm"),
            )
            if parent_code in seen_parent_codes or geometry_key in seen_geometry_keys:
                continue

            seen_parent_codes.add(parent_code)
            seen_geometry_keys.add(geometry_key)
            candidates.append(record)

        page += 1

    return select_diverse_products(candidates, limit)


def select_diverse_products(candidates: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for product in candidates:
        grouped.setdefault(product["shape"], []).append(product)

    selected: list[dict[str, Any]] = []
    shape_order = sorted(grouped, key=lambda shape: (-len(grouped[shape]), shape))

    while len(selected) < limit and any(grouped.values()):
        for shape in shape_order:
            if grouped.get(shape):
                selected.append(grouped[shape].pop(0))
                if len(selected) >= limit:
                    break

    return selected


def fetch_algolia_page(page: int, hits_per_page: int) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode({
        "query": "",
        "hitsPerPage": str(hits_per_page),
        "page": str(page),
        "filters": 'objectType:"product-variant" AND enabled:true',
    })
    payload = json.dumps({
        "requests": [{
            "indexName": ALGOLIA_INDEX,
            "params": params,
        }]
    }).encode("utf-8")
    request = urllib.request.Request(
        f"https://{ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries",
        data=payload,
        headers={
            "content-type": "application/json",
            "x-algolia-application-id": ALGOLIA_APP_ID,
            "x-algolia-api-key": ALGOLIA_API_KEY,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = json.load(response)
    return data.get("results", [{}])[0].get("hits", [])


def normalize_hit(hit: dict[str, Any]) -> dict[str, Any] | None:
    product = first_enabled_product(hit.get("products"))
    if not product:
        return None

    source_product_id = as_text(product.get("sku") or product.get("identifier"))
    shape = normalize_shape(product.get("Frame___Shape"))
    rim_type = normalize_rim_type(product.get("Frame___Rim_type"))
    material = normalize_material(product.get("Frame___Material"))
    lens_width = positive_number(product.get("FrameLensWidth"))
    bridge = positive_number(product.get("FrameBridgeLength"))
    image = as_text(product.get("Product_Eyeglass_Front_image_url"))
    name = as_text(product.get("Name") or product.get("Parent_Name"))

    if not all([source_product_id, shape, rim_type, material, lens_width, bridge, image, name]):
        return None

    source_price = non_negative_number(product.get("Price"))
    source_currency = get_nested(product, "Price_data", "currency")
    tags = build_style_tags(product)

    record: dict[str, Any] = {
        "sku": f"PUB-ZENNI-{source_product_id}",
        "brand": SOURCE_NAME,
        "model": as_text(product.get("Parent_Name") or hit.get("code")),
        "name": name,
        "shape": shape,
        "source_shape": as_text(product.get("Frame___Shape")),
        "material": material,
        "rim_type": rim_type,
        "lens_width_mm": lens_width,
        "bridge_width_mm": bridge,
        "price": None,
        "source_price": source_price,
        "source_currency": as_text(source_currency) if source_currency else None,
        "image": image,
        "available": True,
        "source_type": SOURCE_TYPE,
        "source_name": SOURCE_NAME,
        "source_url": SOURCE_PRODUCT_URL.format(sku=source_product_id),
        "source_product_id": source_product_id,
        "style_tags": tags,
    }

    optional_numbers = {
        "lens_height_mm": positive_number(product.get("FrameLensHeight")),
        "temple_length_mm": positive_number(product.get("FrameTemplelength")),
        "frame_width_mm": positive_number(product.get("FrameWidth")),
    }
    for field, value in optional_numbers.items():
        if value is not None:
            record[field] = value

    color = label_from_option(product.get("Main_Color_data")) or as_text(product.get("Main_Color"))
    if color:
        record["color"] = color
        record["color_family"] = normalize_token(product.get("Main_Color"))

    gender = normalize_gender(product.get("Frame___Gender"))
    if gender:
        record["gender"] = gender

    return {
        key: value
        for key, value in record.items()
        if value is not None or key in REQUIRED_NULLABLE_OUTPUT_FIELDS
    }


def first_enabled_product(products: Any) -> dict[str, Any] | None:
    if not isinstance(products, dict):
        return None
    for product in products.values():
        if isinstance(product, dict) and product.get("enabled") is True:
            return product
    return None


def build_style_tags(product: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for field in (
        "Frame___Features",
        "Frame___Shape",
        "Frame___Rim_type",
        "Frame___Material",
        "Frame___Size",
        "Frame___Gender",
        "Main_Color",
    ):
        raw_value = product.get(field)
        if isinstance(raw_value, list):
            values.extend(raw_value)
        elif raw_value:
            values.append(raw_value)
    tags = [normalize_token(value) for value in values]
    return sorted({tag for tag in tags if tag and tag != "empty"})


def normalize_shape(value: Any) -> str | None:
    return SHAPE_MAP.get(normalize_token(value))


def normalize_rim_type(value: Any) -> str | None:
    return RIM_TYPE_MAP.get(normalize_token(value))


def normalize_material(value: Any) -> str | None:
    token = normalize_token(value)
    return MATERIAL_MAP.get(token) or labelish(value)


def normalize_gender(value: Any) -> str | None:
    token = normalize_token(value)
    return GENDER_MAP.get(token) or token


def normalize_token(value: Any) -> str:
    text = as_text(value).lower()
    return text.replace("-", "_").replace(" ", "_").strip("_")


def labelish(value: Any) -> str | None:
    text = as_text(value)
    return text.replace("_", " ").replace("-", " ").title() if text else None


def as_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def positive_number(value: Any) -> int | float | None:
    number = to_number(value)
    if number is None or number <= 0:
        return None
    return int(number) if float(number).is_integer() else number


def non_negative_number(value: Any) -> int | float | None:
    number = to_number(value)
    if number is None or number < 0:
        return None
    return int(number) if float(number).is_integer() else number


def to_number(value: Any) -> float | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def get_nested(source: dict[str, Any], *keys: str) -> Any:
    value: Any = source
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def label_from_option(value: Any) -> str:
    label = get_nested(value, "values", "label", "data")
    return as_text(label)


if __name__ == "__main__":
    raise SystemExit(main())
