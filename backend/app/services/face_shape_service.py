from app.utils.geometry import distance

LANDMARKS = {
    "top_face": 10,
    "chin": 152,
    "left_cheek": 234,
    "right_cheek": 454,
    "left_temple": 127,
    "right_temple": 356,
    "left_jaw": 172,
    "right_jaw": 397,
}

FACE_SHAPE_LABELS = {
    "oval": "Trai xoan",
    "round": "Tron",
    "square": "Vuong",
    "long": "Dai",
    "heart": "Trai tim",
    "diamond": "Kim cuong",
    "unknown": "Chua ro",
}


def analyze_face_shape(landmarks: list[dict]) -> dict:
    if not landmarks:
        return _empty_analysis()

    face_height = _distance_by_key(landmarks, "top_face", "chin")
    cheek_width = _distance_by_key(landmarks, "left_cheek", "right_cheek")
    forehead_width = _distance_by_key(landmarks, "left_temple", "right_temple")
    jaw_width = _distance_by_key(landmarks, "left_jaw", "right_jaw")

    if not all([face_height, cheek_width, forehead_width, jaw_width]):
        return _empty_analysis()

    metrics = {
        "lengthToWidth": face_height / cheek_width,
        "foreheadToCheek": forehead_width / cheek_width,
        "jawToCheek": jaw_width / cheek_width,
        "jawToForehead": jaw_width / forehead_width,
        "cheekToJaw": cheek_width / max(jaw_width, 0.0001),
    }
    quality = _build_quality(landmarks)
    confidence = _calculate_confidence(quality)
    quality["confidence"] = confidence
    shape = _classify_shape(metrics)
    diagnostics = _build_diagnostics(metrics, quality, shape)

    return {
        "shape": shape,
        "label": FACE_SHAPE_LABELS[shape],
        "metrics": metrics,
        "quality": quality,
        "diagnostics": diagnostics,
        "warnings": diagnostics["warnings"],
    }


def _classify_shape(metrics: dict) -> str:
    length_to_width = metrics["lengthToWidth"]
    jaw_to_cheek = metrics["jawToCheek"]
    forehead_to_cheek = metrics["foreheadToCheek"]
    jaw_to_forehead = metrics["jawToForehead"]

    if length_to_width >= 1.52:
        return "long"
    if length_to_width <= 1.22 and jaw_to_cheek >= 0.82 and forehead_to_cheek >= 0.84:
        return "round"
    if jaw_to_cheek >= 0.9 and forehead_to_cheek >= 0.88 and length_to_width <= 1.42:
        return "square"
    if forehead_to_cheek >= 0.92 and jaw_to_forehead <= 0.82 and jaw_to_cheek <= 0.9:
        return "heart"
    if forehead_to_cheek <= 0.86 and jaw_to_cheek <= 0.8:
        return "diamond"

    return "oval"


def _build_quality(landmarks: list[dict]) -> dict:
    face_box = _get_face_box(landmarks)
    return {
        "centerOffsetX": abs(face_box["centerX"] - 0.5),
        "centerOffsetY": abs(face_box["centerY"] - 0.5),
        "coverage": face_box["width"] * face_box["height"],
        "symmetryScore": _calculate_symmetry_score(landmarks),
        "faceBox": face_box,
    }


def _calculate_confidence(quality: dict) -> float:
    coverage_score = _clamp((quality["coverage"] - 0.07) / 0.22, 0, 1)
    center_score = _clamp(1 - ((quality["centerOffsetX"] + quality["centerOffsetY"]) / 2) * 5.5, 0, 1)
    balance_score = _clamp(1 - abs(quality["centerOffsetX"] - quality["centerOffsetY"]) * 4, 0, 1)
    return _clamp(
        coverage_score * 0.34
        + center_score * 0.3
        + quality["symmetryScore"] * 0.22
        + balance_score * 0.14,
        0,
        1,
    )


def _build_diagnostics(metrics: dict, quality: dict, shape: str) -> dict:
    warnings = []
    center_label = _get_center_label(quality)
    distance_label = _get_distance_label(quality["coverage"])
    confidence = quality["confidence"]
    balance = quality["symmetryScore"]

    if quality["coverage"] < 0.08:
        warnings.append("Khuon mat con qua nho trong khung.")
    elif quality["coverage"] > 0.4:
        warnings.append("Khuon mat dang qua gan camera.")

    if quality["centerOffsetX"] > 0.16:
        warnings.append("Mat dang lech ngang khoi tam khung.")

    if quality["centerOffsetY"] > 0.16:
        warnings.append("Mat dang lech doc khoi tam khung.")

    if balance < 0.52:
        warnings.append("Do doi xung chua du tot de chot dang mat.")

    if confidence < 0.55:
        warnings.append("Tin hieu khuon mat con yeu, nen giu yen them.")

    readiness_score = _clamp(
        confidence * 0.48
        + balance * 0.24
        + _clamp(1 - abs(metrics["lengthToWidth"] - _ideal_length_ratio(shape)) / 0.55, 0, 1) * 0.16
        + _clamp(1 - abs(metrics["foreheadToCheek"] - _ideal_forehead_ratio(shape)) / 0.28, 0, 1) * 0.12,
        0,
        1,
    )

    return {
        "confidenceBand": _get_confidence_band(confidence),
        "distanceLabel": distance_label,
        "centerLabel": center_label,
        "ready": readiness_score >= 0.7 and confidence >= 0.52,
        "readinessScore": readiness_score,
        "warnings": warnings[:3],
        "summary": warnings[0] if warnings else ("Can them tin hieu khuon mat." if shape == "unknown" else "Khung do da san sang."),
    }


def _get_center_label(quality: dict) -> str:
    offset_x = float(quality.get("centerOffsetX") or 0)
    offset_y = float(quality.get("centerOffsetY") or 0)

    if offset_x <= 0.07 and offset_y <= 0.07:
        return "Rat giua"
    if offset_x <= 0.12 and offset_y <= 0.12:
        return "Kha giua"
    if offset_x > 0.18:
        return "Lech ngang"
    if offset_y > 0.18:
        return "Lech doc"
    return "Lech nhe"


def _get_distance_label(coverage: float) -> str:
    if not coverage:
        return "Chua co"
    if coverage < 0.08:
        return "Qua xa"
    if coverage < 0.11:
        return "Hoi xa"
    if coverage <= 0.34:
        return "Dung khoang"
    if coverage <= 0.4:
        return "Hoi gan"
    return "Qua gan"


def _get_confidence_band(confidence: float) -> str:
    if confidence >= 0.8:
        return "Rat tot"
    if confidence >= 0.65:
        return "Tot"
    if confidence >= 0.5:
        return "Trung binh"
    return "Yeu"


def _ideal_length_ratio(shape: str) -> float:
    targets = {
        "long": 1.7,
        "round": 1.12,
        "square": 1.28,
        "heart": 1.35,
        "diamond": 1.34,
        "oval": 1.42,
        "unknown": 1.32,
    }
    return targets.get(shape, targets["unknown"])


def _ideal_forehead_ratio(shape: str) -> float:
    targets = {
        "long": 0.92,
        "round": 0.96,
        "square": 0.98,
        "heart": 1.04,
        "diamond": 0.86,
        "oval": 0.94,
        "unknown": 0.94,
    }
    return targets.get(shape, targets["unknown"])


def _distance_by_key(landmarks: list[dict], first_key: str, second_key: str) -> float:
    try:
        return distance(landmarks[LANDMARKS[first_key]], landmarks[LANDMARKS[second_key]])
    except IndexError:
        return 0.0


def _calculate_symmetry_score(landmarks: list[dict]) -> float:
    cheek_balance = _pair_balance(landmarks[LANDMARKS["left_cheek"]], landmarks[LANDMARKS["right_cheek"]])
    temple_balance = _pair_balance(landmarks[LANDMARKS["left_temple"]], landmarks[LANDMARKS["right_temple"]])
    jaw_balance = _pair_balance(landmarks[LANDMARKS["left_jaw"]], landmarks[LANDMARKS["right_jaw"]])
    return _clamp(1 - ((cheek_balance + temple_balance + jaw_balance) / 3) * 1.9, 0, 1)


def _pair_balance(point_a: dict | None, point_b: dict | None) -> float:
    if not point_a or not point_b:
        return 1

    return min(1, distance(point_a, point_b))


def _get_face_box(landmarks: list[dict]) -> dict:
    xs = [point.get("x") for point in landmarks if isinstance(point.get("x"), (int, float))]
    ys = [point.get("y") for point in landmarks if isinstance(point.get("y"), (int, float))]

    if not xs or not ys:
        return {
            "minX": 0,
            "maxX": 0,
            "minY": 0,
            "maxY": 0,
            "width": 0,
            "height": 0,
            "centerX": 0.5,
            "centerY": 0.5,
        }

    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)
    width = max(0, max_x - min_x)
    height = max(0, max_y - min_y)

    return {
        "minX": min_x,
        "maxX": max_x,
        "minY": min_y,
        "maxY": max_y,
        "width": width,
        "height": height,
        "centerX": min_x + width / 2,
        "centerY": min_y + height / 2,
    }


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def _empty_analysis() -> dict:
    return {
        "shape": "unknown",
        "label": FACE_SHAPE_LABELS["unknown"],
        "metrics": {
            "lengthToWidth": 0,
            "foreheadToCheek": 0,
            "jawToCheek": 0,
            "jawToForehead": 0,
            "cheekToJaw": 0,
        },
        "quality": {
            "centerOffsetX": 0,
            "centerOffsetY": 0,
            "coverage": 0,
            "symmetryScore": 0,
            "confidence": 0,
            "faceBox": {
                "minX": 0,
                "maxX": 0,
                "minY": 0,
                "maxY": 0,
                "width": 0,
                "height": 0,
                "centerX": 0.5,
                "centerY": 0.5,
            },
        },
        "diagnostics": {
            "confidenceBand": "Yeu",
            "distanceLabel": "Chua thay",
            "centerLabel": "Chua thay",
            "ready": False,
            "readinessScore": 0,
            "warnings": [],
            "summary": "Can dua mat vao khung.",
        },
        "warnings": [],
    }
