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
FEEDBACK_FILE = INSTANCE_DIR / "feedback.json"
STORE_LOCK = Lock()
MAX_FEEDBACK_RECORDS = 5000


def list_feedback() -> list[dict]:
    return sorted(_read_feedback(), key=lambda item: item.get("created_at", ""), reverse=True)


def save_feedback(record: dict) -> dict:
    now = _utc_now_iso()
    normalized = {
        **record,
        "id": record.get("id") or _create_feedback_id(),
        "customer_code": record.get("customer_code") or "",
        "session_code": record.get("session_code") or "",
        "type": record.get("type") or "other",
        "notes": record.get("notes") or "",
        "faceShape_ai": record.get("faceShape_ai") or "",
        "faceShape_confirmed": record.get("faceShape_confirmed") or "",
        "confidence": record.get("confidence"),
        "confidence_level": record.get("confidence_level") or "",
        "top_candidates": record.get("top_candidates") or [],
        "capture_quality": record.get("capture_quality") or {},
        "diagnostics": record.get("diagnostics") or {},
        "preferences": record.get("preferences") or {},
        "customer_status": record.get("customer_status") or "waiting",
        "source": record.get("source") or "frontend",
        "created_at": record.get("created_at") or now,
        "stored_at": now,
    }

    with _storage_lock():
        records = _read_feedback()
        records.insert(0, normalized)
        _write_feedback(records[:MAX_FEEDBACK_RECORDS])

    return normalized


def _read_feedback() -> list[dict]:
    _ensure_storage()
    try:
        with FEEDBACK_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return []

    return data if isinstance(data, list) else []


def _write_feedback(records: list[dict]) -> None:
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = FEEDBACK_FILE.with_suffix(".json.tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False, indent=2)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temp_file, FEEDBACK_FILE)


def _ensure_storage() -> None:
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    if not FEEDBACK_FILE.exists():
        _write_feedback([])


@contextmanager
def _storage_lock():
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    lock_file_path = str(FEEDBACK_FILE) + ".lock"
    with STORE_LOCK:
        with open(lock_file_path, "a", encoding="utf-8") as lock_file:
            if fcntl:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                if fcntl:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _create_feedback_id() -> str:
    now = datetime.now()
    return f"FB-{now:%Y%m%d-%H%M%S-%f}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
