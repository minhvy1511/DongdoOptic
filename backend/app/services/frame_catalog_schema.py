from copy import deepcopy
from datetime import datetime
from typing import Any
from urllib.parse import urlparse


FRAME_CATALOG_SCHEMA_VERSION = 1

IDENTITY_FIELDS = frozenset({
    "schemaVersion", "source", "sourceProductId", "sourceProductUrl",
    "sourceScopedSku", "brand", "name", "retrievedAt",
})
PROVENANCE_FIELDS = frozenset({
    "dataLicense", "imageLicense", "allowedUses", "attribution", "termsUrl",
})
RECOMMENDATION_FIELDS = frozenset({
    "shape", "lensWidthMm", "lensHeightMm", "bridgeWidthMm", "frameWidthMm", "imageUrl",
})
OPTIONAL_FIELDS = frozenset({
    "model", "material", "rimType", "templeLengthMm", "color", "colorFamily",
    "styleTags", "price", "currency", "availability", "stock", "lastAvailabilityCheck",
})
COMPUTED_FIELDS = frozenset({"recommendationEligible", "eligibilityReasons", "grouping"})
ALLOWED_FIELDS = IDENTITY_FIELDS | PROVENANCE_FIELDS | RECOMMENDATION_FIELDS | OPTIONAL_FIELDS | COMPUTED_FIELDS
DIMENSION_FIELDS = frozenset({
    "lensWidthMm", "lensHeightMm", "bridgeWidthMm", "frameWidthMm", "templeLengthMm",
})
NULLABLE_STRING_FIELDS = frozenset({
    "dataLicense", "imageLicense", "attribution", "model", "material", "rimType",
    "color", "colorFamily", "currency",
})


class CanonicalFrameCatalogError(ValueError):
    """Raised when a canonical frame record violates the V1 contract."""


def normalize_canonical_frame_records(
    records: list[dict[str, Any]], *, allow_unknown_retrieved_at: bool = False
) -> list[dict[str, Any]]:
    if not isinstance(records, list):
        raise CanonicalFrameCatalogError("Canonical frame catalog must be a list.")

    normalized: list[dict[str, Any]] = []
    seen_source_skus: set[tuple[str, str]] = set()
    seen_source_products: set[tuple[str, str]] = set()
    for index, value in enumerate(records):
        record = _normalize_record(value)
        _validate_record(record, index, allow_unknown_retrieved_at=allow_unknown_retrieved_at)
        source_key = _normalize_token(record["source"])
        sku_identity = (source_key, _normalize_token(record["sourceScopedSku"]))
        product_identity = (source_key, _normalize_token(record["sourceProductId"]))
        if sku_identity in seen_source_skus:
            raise CanonicalFrameCatalogError(
                f"record[{index}] duplicates sourceScopedSku within source: {record['sourceScopedSku']}"
            )
        if product_identity in seen_source_products:
            raise CanonicalFrameCatalogError(
                f"record[{index}] duplicates sourceProductId within source: {record['sourceProductId']}"
            )
        seen_source_skus.add(sku_identity)
        seen_source_products.add(product_identity)
        normalized.append(record)
    return normalized


def migrate_legacy_frame_record(record: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(record, dict):
        raise CanonicalFrameCatalogError("Legacy frame record must be an object.")
    canonical = {
        "schemaVersion": FRAME_CATALOG_SCHEMA_VERSION,
        "source": record.get("source_name") or record.get("brand"),
        "sourceProductId": record.get("source_product_id") or record.get("sku"),
        "sourceProductUrl": record.get("source_url"),
        "sourceScopedSku": record.get("sku"),
        "brand": record.get("brand"),
        "name": record.get("name"),
        "retrievedAt": record.get("retrieved_at"),
        "dataLicense": record.get("data_license"),
        "imageLicense": record.get("image_license"),
        "allowedUses": deepcopy(record.get("allowed_uses") or []),
        "attribution": record.get("attribution"),
        "termsUrl": record.get("terms_url"),
        "shape": record.get("shape"),
        "lensWidthMm": record.get("lens_width_mm"),
        "lensHeightMm": record.get("lens_height_mm"),
        "bridgeWidthMm": record.get("bridge_width_mm"),
        "frameWidthMm": record.get("frame_width_mm"),
        "imageUrl": record.get("image"),
        "model": record.get("model"),
        "material": record.get("material"),
        "rimType": record.get("rim_type"),
        "templeLengthMm": record.get("temple_length_mm"),
        "color": record.get("color"),
        "colorFamily": record.get("color_family"),
        "styleTags": deepcopy(record.get("style_tags")),
        "price": record.get("source_price") if record.get("price") is None else record.get("price"),
        "currency": record.get("source_currency"),
        "availability": record.get("available"),
        "stock": record.get("stock"),
        "lastAvailabilityCheck": record.get("last_availability_check"),
    }
    return canonical


def _normalize_record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CanonicalFrameCatalogError("Canonical frame record must be an object.")
    record = deepcopy(value)
    unknown = sorted(set(record) - ALLOWED_FIELDS)
    if unknown:
        raise CanonicalFrameCatalogError(f"Unsupported canonical fields: {', '.join(unknown)}")

    for field in PROVENANCE_FIELDS:
        record.setdefault(field, [] if field == "allowedUses" else None)
    for field in OPTIONAL_FIELDS:
        record.setdefault(field, None)

    expected_grouping = _build_grouping(record)
    supplied_grouping = record.get("grouping")
    if supplied_grouping is not None and supplied_grouping != expected_grouping:
        raise CanonicalFrameCatalogError("Destructive or ambiguous family grouping metadata.")
    record["grouping"] = expected_grouping

    reasons = _eligibility_reasons(record)
    expected_eligible = not reasons
    supplied_eligible = record.get("recommendationEligible")
    if supplied_eligible is not None and supplied_eligible is not expected_eligible:
        raise CanonicalFrameCatalogError("recommendationEligible conflicts with provenance or geometry.")
    record["recommendationEligible"] = expected_eligible
    record["eligibilityReasons"] = reasons
    return record


def _validate_record(record: dict[str, Any], index: int, *, allow_unknown_retrieved_at: bool) -> None:
    label = f"record[{index}]"
    missing_identity = sorted(field for field in IDENTITY_FIELDS if field not in record)
    missing_recommendation = sorted(field for field in RECOMMENDATION_FIELDS if field not in record)
    if missing_identity:
        raise CanonicalFrameCatalogError(f"{label} missing required identity: {', '.join(missing_identity)}")
    if missing_recommendation:
        raise CanonicalFrameCatalogError(
            f"{label} missing required recommendation fields: {', '.join(missing_recommendation)}"
        )
    if record["schemaVersion"] != FRAME_CATALOG_SCHEMA_VERSION:
        raise CanonicalFrameCatalogError(f"{label}.schemaVersion must be {FRAME_CATALOG_SCHEMA_VERSION}")

    for field in (IDENTITY_FIELDS - {"schemaVersion", "retrievedAt"}) | {"shape", "imageUrl"}:
        _required_string(record, field, label)
    for field in NULLABLE_STRING_FIELDS:
        _optional_string(record, field, label)
    _validate_url(record["sourceProductUrl"], f"{label}.sourceProductUrl", required=True)
    _validate_url(record["imageUrl"], f"{label}.imageUrl", required=True)
    _validate_url(record["termsUrl"], f"{label}.termsUrl", required=False)
    _validate_timestamp(
        record["retrievedAt"], f"{label}.retrievedAt", allow_null=allow_unknown_retrieved_at
    )
    _validate_timestamp(record["lastAvailabilityCheck"], f"{label}.lastAvailabilityCheck", allow_null=True)

    for field in DIMENSION_FIELDS:
        value = record.get(field)
        if field == "templeLengthMm" and value is None:
            continue
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
            raise CanonicalFrameCatalogError(f"{label}.{field} must be a positive number.")

    allowed_uses = record["allowedUses"]
    if not isinstance(allowed_uses, list) or any(not isinstance(item, str) or not item.strip() for item in allowed_uses):
        raise CanonicalFrameCatalogError(f"{label}.allowedUses must be a list of non-empty strings.")
    style_tags = record["styleTags"]
    if style_tags is not None and (
        not isinstance(style_tags, list)
        or any(not isinstance(tag, str) or not tag.strip() for tag in style_tags)
    ):
        raise CanonicalFrameCatalogError(f"{label}.styleTags must be null or a list of non-empty strings.")

    if record["availability"] is not None and not isinstance(record["availability"], bool):
        raise CanonicalFrameCatalogError(f"{label}.availability must be boolean or null.")
    if record["stock"] is not None and (
        not isinstance(record["stock"], int) or isinstance(record["stock"], bool) or record["stock"] < 0
    ):
        raise CanonicalFrameCatalogError(f"{label}.stock must be a non-negative integer or null.")
    if record["price"] is not None and (
        not isinstance(record["price"], (int, float))
        or isinstance(record["price"], bool)
        or record["price"] < 0
    ):
        raise CanonicalFrameCatalogError(f"{label}.price must be a non-negative number or null.")


def _build_grouping(record: dict[str, Any]) -> dict[str, str]:
    shape = _normalize_token(record.get("shape"))
    dimensions = "|".join(_dimension_key(record.get(field)) for field in (
        "lensWidthMm", "lensHeightMm", "bridgeWidthMm", "frameWidthMm"
    ))
    construction = "|".join((
        _normalize_token(record.get("material")),
        _normalize_token(record.get("rimType")),
    ))
    model = _normalize_token(record.get("model"))
    brand = _normalize_token(record.get("brand"))
    if _model_is_reliable(model, shape):
        basis = "brand-model-geometry"
        family_key = f"model:{brand}|{model}|{shape}|{dimensions}|{construction}"
    else:
        basis = "geometry"
        family_key = f"geometry:{shape}|{dimensions}|{construction}"
    variant_key = (
        f"source:{_normalize_token(record.get('source'))}|"
        f"{_normalize_token(record.get('sourceProductId'))}"
    )
    return {"familyKey": family_key, "familyBasis": basis, "variantKey": variant_key}


def _eligibility_reasons(record: dict[str, Any]) -> list[str]:
    reasons = []
    if not record.get("dataLicense") or not record.get("imageLicense"):
        reasons.append("LICENSE_PROVENANCE_MISSING")
    if not record.get("allowedUses"):
        reasons.append("ALLOWED_USES_MISSING")
    if not record.get("termsUrl"):
        reasons.append("TERMS_URL_MISSING")
    if any(record.get(field) in (None, "") for field in RECOMMENDATION_FIELDS):
        reasons.append("RECOMMENDATION_GEOMETRY_MISSING")
    return reasons


def _model_is_reliable(model: str, shape: str) -> bool:
    if not model:
        return False
    generic = {"glasses", "sunglasses", f"{shape} glasses", f"{shape} sunglasses"}
    return model not in generic


def _required_string(record: dict[str, Any], field: str, label: str) -> None:
    value = record.get(field)
    if not isinstance(value, str) or not value.strip():
        raise CanonicalFrameCatalogError(f"{label}.{field} must be a non-empty string.")


def _optional_string(record: dict[str, Any], field: str, label: str) -> None:
    value = record.get(field)
    if value is not None and not isinstance(value, str):
        raise CanonicalFrameCatalogError(f"{label}.{field} must be a string or null.")


def _validate_url(value: Any, label: str, *, required: bool) -> None:
    if value is None and not required:
        return
    if not isinstance(value, str) or not value.strip():
        raise CanonicalFrameCatalogError(f"{label} must be an absolute HTTP(S) URL.")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise CanonicalFrameCatalogError(f"{label} must be an absolute HTTP(S) URL.")


def _validate_timestamp(value: Any, label: str, *, allow_null: bool) -> None:
    if value is None and allow_null:
        return
    if not isinstance(value, str) or not value.strip():
        raise CanonicalFrameCatalogError(f"{label} must be an ISO-8601 timestamp.")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise CanonicalFrameCatalogError(f"{label} must be an ISO-8601 timestamp.") from exc


def _normalize_token(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").replace("-", " ").split())


def _dimension_key(value: Any) -> str:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return "missing"
    return f"{float(value):.2f}"
