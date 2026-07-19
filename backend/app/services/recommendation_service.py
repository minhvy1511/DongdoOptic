import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "frames.json"


def get_frame_recommendations(face_shape: str) -> list[dict]:
    frames = _load_frames()
    matched_frames = [frame for frame in frames if face_shape in frame.get("face_shapes", [])]

    return matched_frames or frames[:3]


def _load_frames() -> list[dict]:
    with DATA_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)
