import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows local fallback.
    fcntl = None


BASE_DIR = Path(__file__).resolve().parents[2]
INSTANCE_DIR = BASE_DIR / "instance"
CUSTOMERS_FILE = INSTANCE_DIR / "customers.json"
STORE_LOCK = Lock()


def list_customers() -> list[dict]:
    return sorted(_read_customers(), key=lambda item: item.get("updated_at", ""), reverse=True)


def save_customer(record: dict) -> dict:
    now = _utc_now_iso()
    normalized = {
        **record,
        "customer_code": record.get("customer_code") or _create_customer_code(),
        "session_code": record.get("session_code") or _create_session_code(),
        "customer_name": record.get("customer_name") or "Chua nhap",
        "customer_phone": record.get("customer_phone") or "",
        "consult_date": record.get("consult_date") or datetime.now().date().isoformat(),
        "age_group": record.get("age_group") or "",
        "customer_notes": record.get("customer_notes") or "",
        "customer_status": record.get("customer_status") or "waiting",
        "frame_width_mm": record.get("frame_width_mm"),
        "has_prescription": bool(record.get("has_prescription")),
        "prescription": record.get("prescription") or {},
        "preferences": record.get("preferences") or {},
        "lens_recommendations": record.get("lens_recommendations") or [],
        "updated_at": now,
        "created_at": record.get("created_at") or now,
    }

    with _storage_lock():
        records = _read_customers()
        replaced = False
        for index, current in enumerate(records):
            if current.get("customer_code") == normalized["customer_code"]:
                records[index] = normalized
                replaced = True
                break
        if not replaced:
            records.append(normalized)
        _write_customers(records)

    return normalized


def delete_customer(customer_code: str) -> bool:
    with _storage_lock():
        records = _read_customers()
        kept = [record for record in records if record.get("customer_code") != customer_code]
        if len(kept) == len(records):
            return False
        _write_customers(kept)
        return True


def _read_customers() -> list[dict]:
    _ensure_storage()
    try:
        with CUSTOMERS_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return []

    return data if isinstance(data, list) else []


def _write_customers(records: list[dict]) -> None:
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = CUSTOMERS_FILE.with_suffix(".json.tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False, indent=2)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temp_file, CUSTOMERS_FILE)


def _ensure_storage() -> None:
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    if not CUSTOMERS_FILE.exists():
        _write_customers([])


@contextmanager
def _storage_lock():
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    lock_file_path = str(CUSTOMERS_FILE) + ".lock"
    with STORE_LOCK:
        with open(lock_file_path, "a", encoding="utf-8") as lock_file:
            if fcntl:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                if fcntl:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _create_customer_code() -> str:
    now = datetime.now()
    return f"KH-{now:%Y%m%d}-{now:%H%M%S}"


def _create_session_code() -> str:
    now = datetime.now()
    return f"PC-{now:%Y%m%d}-{now:%H%M%S}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
