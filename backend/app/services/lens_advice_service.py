def recommend_lens_index(
    *,
    pd: float | None = None,
    sph: float | None = None,
    cyl: float | None = None,
    frame_width_mm: float | None = None,
) -> dict:
    """Return a rule-based lens index suggestion that can be mapped to catalog SKUs."""
    total_power = abs(_to_float(sph)) + abs(_to_float(cyl))
    warnings: list[str] = []

    if total_power <= 0:
        recommended_index = None
        message = "Can them SPH/CYL de goi y chiet suat trong kinh."
    elif total_power < 2:
        recommended_index = "1.56"
        message = "Do nhe, co the uu tien chiet suat 1.56 neu ngan sach can toi uu."
    elif total_power < 4:
        recommended_index = "1.60"
        message = "Do trung binh, nen uu tien chiet suat 1.60 de trong mong va nhe hon."
    elif total_power < 6:
        recommended_index = "1.67"
        message = "Do cao, nen uu tien chiet suat 1.67 tro len de giam do day ria."
    else:
        recommended_index = "1.74"
        message = "Do rat cao, nen tu van chiet suat 1.74 neu ngan sach phu hop."

    pd_value = _to_optional_float(pd)
    frame_width_value = _to_optional_float(frame_width_mm)
    if (
        pd_value is not None
        and frame_width_value is not None
        and total_power >= 2
        and frame_width_value - pd_value >= 18
    ):
        warnings.append(
            "Gong nay co the lam trong kinh day o ria; nen can nhac gong nho hon hoac chiet suat cao hon."
        )

    return {
        "total_power": round(total_power, 2),
        "recommended_index": recommended_index,
        "message": message,
        "warnings": warnings,
    }


def _to_float(value: float | None) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _to_optional_float(value: float | None) -> float | None:
    try:
        return None if value is None or value == "" else float(value)
    except (TypeError, ValueError):
        return None
