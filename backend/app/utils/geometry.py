from math import hypot


def distance(point_a: dict, point_b: dict) -> float:
    if not point_a or not point_b:
        return 0.0

    return hypot(point_a.get("x", 0.0) - point_b.get("x", 0.0), point_a.get("y", 0.0) - point_b.get("y", 0.0))
