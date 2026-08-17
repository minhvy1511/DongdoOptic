import json
import re
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


VISUAL_REFERENCE_SCHEMA_VERSION = 1

REQUIRED_FIELDS = frozenset({
    "schemaVersion", "id", "source", "sourceUrl", "imageUrl", "license",
    "licenseUrl", "attribution", "retrievedAt", "eligibility", "eligibilityReasons",
})
OPTIONAL_FIELDS = frozenset({
    "shape", "rimType", "material", "styleTags", "colorFamily", "notes",
    "author", "creditLine", "sourceRevisionId", "sourceFileHash", "modifications",
    "containsIdentifiablePerson", "trademarkRisk",
})
ALLOWED_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS
FORBIDDEN_PRODUCT_FIELDS = frozenset({
    "brand", "model", "sku", "price", "availability", "stock", "lensWidthMm",
    "lensHeightMm", "bridgeWidthMm", "frameWidthMm", "templeLengthMm",
    "lens_width_mm", "lens_height_mm", "bridge_width_mm", "frame_width_mm",
})
REUSABLE_LICENSES = frozenset({
    "CC0 1.0", "Public domain", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0",
    "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0",
})
ELIGIBILITY_VALUES = frozenset({"eligible", "ineligible"})
RISK_VALUES = frozenset({"low", "medium", "high", "unknown"})


class VisualReferenceError(ValueError):
    """Raised when visual-reference metadata violates the isolated V1 contract."""


def load_visual_reference_manifest(path: str | Path) -> dict[str, Any]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise VisualReferenceError(f"Malformed visual-reference JSON: {exc}") from exc
    return normalize_visual_reference_manifest(payload)


def normalize_visual_reference_manifest(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("references"), list):
        raise VisualReferenceError("Visual-reference manifest must contain a references list.")
    if payload.get("schemaVersion") != VISUAL_REFERENCE_SCHEMA_VERSION:
        raise VisualReferenceError("Manifest schemaVersion must be 1.")

    normalized = []
    seen_ids: set[str] = set()
    seen_hashes: dict[str, str] = {}
    for index, value in enumerate(payload["references"]):
        record = _normalize_record(value, index)
        if record["id"] in seen_ids:
            raise VisualReferenceError(f"Duplicate visual-reference id: {record['id']}")
        seen_ids.add(record["id"])
        file_hash = record.get("sourceFileHash")
        if file_hash:
            if file_hash in seen_hashes:
                record["eligibility"] = "ineligible"
                record["eligibilityReasons"] = sorted(set(
                    record["eligibilityReasons"] + ["DUPLICATE_SOURCE_FILE"]
                ))
            else:
                seen_hashes[file_hash] = record["id"]
        normalized.append(record)

    result = deepcopy(payload)
    result["references"] = normalized
    return result


def _normalize_record(value: Any, index: int) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise VisualReferenceError(f"reference[{index}] must be an object.")
    forbidden = sorted(set(value) & FORBIDDEN_PRODUCT_FIELDS)
    if forbidden:
        raise VisualReferenceError(f"reference[{index}] contains Product-only fields: {', '.join(forbidden)}")
    unknown = sorted(set(value) - ALLOWED_FIELDS)
    if unknown:
        raise VisualReferenceError(f"reference[{index}] has unsupported fields: {', '.join(unknown)}")

    record = deepcopy(value)
    for field in OPTIONAL_FIELDS:
        record.setdefault(field, None)
    missing = sorted(REQUIRED_FIELDS - set(record))
    if missing:
        raise VisualReferenceError(f"reference[{index}] missing required fields: {', '.join(missing)}")
    _validate_structure(record, index)

    expected_reasons = _eligibility_reasons(record)
    expected_state = "eligible" if not expected_reasons else "ineligible"
    if record["eligibility"] != expected_state:
        raise VisualReferenceError(f"reference[{index}].eligibility conflicts with rights metadata.")
    if sorted(set(record["eligibilityReasons"])) != expected_reasons:
        raise VisualReferenceError(f"reference[{index}].eligibilityReasons do not match rights metadata.")
    record["eligibilityReasons"] = expected_reasons
    return record


def _validate_structure(record: dict[str, Any], index: int) -> None:
    label = f"reference[{index}]"
    if record["schemaVersion"] != VISUAL_REFERENCE_SCHEMA_VERSION:
        raise VisualReferenceError(f"{label}.schemaVersion must be 1.")
    stable_id = r"wikimedia-commons:(?:[1-9][0-9]*|file:[a-z0-9][a-z0-9._-]+)"
    if not isinstance(record["id"], str) or not re.fullmatch(stable_id, record["id"]):
        raise VisualReferenceError(f"{label}.id must be a stable Wikimedia page id or canonical file key.")
    for field in ("source",):
        if not isinstance(record[field], str) or not record[field].strip():
            raise VisualReferenceError(f"{label}.{field} must be a non-empty string.")
    for field in ("license", "attribution"):
        if record[field] is not None and (not isinstance(record[field], str) or not record[field].strip()):
            raise VisualReferenceError(f"{label}.{field} must be a non-empty string or null.")
    if record["source"] != "Wikimedia Commons":
        raise VisualReferenceError(f"{label}.source must be Wikimedia Commons.")
    if record["sourceUrl"] is not None:
        _validate_wikimedia_url(record["sourceUrl"], f"{label}.sourceUrl", file_page=True)
    if record["imageUrl"] is not None:
        _validate_wikimedia_url(record["imageUrl"], f"{label}.imageUrl", file_page=False)
    if record["licenseUrl"] is not None:
        _validate_http_url(record["licenseUrl"], f"{label}.licenseUrl")
    _validate_timestamp(record["retrievedAt"], f"{label}.retrievedAt")
    if record["eligibility"] not in ELIGIBILITY_VALUES:
        raise VisualReferenceError(f"{label}.eligibility is invalid.")
    reasons = record["eligibilityReasons"]
    if not isinstance(reasons, list) or any(not isinstance(reason, str) or not reason for reason in reasons):
        raise VisualReferenceError(f"{label}.eligibilityReasons must be a string list.")
    tags = record["styleTags"]
    if tags is not None and (not isinstance(tags, list) or any(not isinstance(tag, str) or not tag for tag in tags)):
        raise VisualReferenceError(f"{label}.styleTags must be null or a string list.")
    person = record["containsIdentifiablePerson"]
    if person is not None and not isinstance(person, bool):
        raise VisualReferenceError(f"{label}.containsIdentifiablePerson must be boolean or null.")
    if record["trademarkRisk"] is not None and record["trademarkRisk"] not in RISK_VALUES:
        raise VisualReferenceError(f"{label}.trademarkRisk is invalid.")
    for field in OPTIONAL_FIELDS - {"styleTags", "containsIdentifiablePerson", "trademarkRisk"}:
        if record[field] is not None and not isinstance(record[field], str):
            raise VisualReferenceError(f"{label}.{field} must be string or null.")


def _eligibility_reasons(record: dict[str, Any]) -> list[str]:
    reasons = []
    if record.get("license") not in REUSABLE_LICENSES or not record.get("licenseUrl"):
        reasons.append("LICENSE_UNCLEAR_OR_UNSUPPORTED")
    if not record.get("attribution") or not record.get("author"):
        reasons.append("ATTRIBUTION_INSUFFICIENT")
    if not record.get("sourceUrl"):
        reasons.append("SOURCE_PAGE_MISSING")
    if not record.get("imageUrl"):
        reasons.append("IMAGE_RIGHTS_UNCLEAR")
    if record.get("containsIdentifiablePerson") is True:
        reasons.append("IDENTIFIABLE_PERSON_REVIEW_REQUIRED")
    if record.get("trademarkRisk") in {"medium", "high", "unknown", None}:
        reasons.append("TRADEMARK_REVIEW_REQUIRED")
    return sorted(set(reasons))


def _validate_wikimedia_url(value: Any, label: str, *, file_page: bool) -> None:
    _validate_http_url(value, label)
    parsed = urlparse(value)
    if file_page:
        if parsed.netloc != "commons.wikimedia.org" or not parsed.path.startswith("/wiki/File:"):
            raise VisualReferenceError(f"{label} must be a Wikimedia Commons File page URL.")
    elif parsed.netloc not in {"upload.wikimedia.org", "commons.wikimedia.org"}:
        raise VisualReferenceError(f"{label} must be a Wikimedia-hosted image URL.")


def _validate_http_url(value: Any, label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise VisualReferenceError(f"{label} must be an absolute HTTP(S) URL.")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise VisualReferenceError(f"{label} must be an absolute HTTP(S) URL.")


def _validate_timestamp(value: Any, label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise VisualReferenceError(f"{label} must be an ISO-8601 timestamp.")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise VisualReferenceError(f"{label} must be an ISO-8601 timestamp.") from exc
