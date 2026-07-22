import argparse
import json
import random
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
KAGGLE_LABELS = {
    "Heart": "heart",
    "Diamond": "diamond",
    "Oblong": "long",
    "Long": "long",
    "Rectangle": "long",
    "Oval": "oval",
    "Round": "round",
    "Square": "square",
}


def iter_kaggle_images(dataset_root: Path):
    face_root = dataset_root / "FaceShape Dataset"
    for split in ("training_set", "testing_set"):
        split_root = face_root / split
        if not split_root.exists():
            continue

        for source_label, normalized_label in KAGGLE_LABELS.items():
            label_root = split_root / source_label
            if not label_root.exists():
                continue

            for image_path in label_root.rglob("*"):
                if image_path.is_file() and image_path.suffix.lower() in IMAGE_EXTENSIONS:
                    yield {
                        "source": "kaggle/niten19/face-shape-dataset",
                        "split": split,
                        "label_source": source_label,
                        "label": normalized_label,
                        "path": str(image_path.resolve()),
                    }


def iter_directory_images(dataset_root: Path, source_name: str):
    for label_root in dataset_root.iterdir() if dataset_root.exists() else []:
        if not label_root.is_dir():
            continue

        normalized_label = KAGGLE_LABELS.get(label_root.name) or KAGGLE_LABELS.get(label_root.name.title())
        if not normalized_label:
            continue

        for image_path in label_root.rglob("*"):
            if image_path.is_file() and image_path.suffix.lower() in IMAGE_EXTENSIONS:
                yield {
                    "source": source_name,
                    "split": "external",
                    "label_source": label_root.name,
                    "label": normalized_label,
                    "path": str(image_path.resolve()),
                }


def balanced_sample(records: list[dict], per_label: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    by_label: dict[str, list[dict]] = {}
    for record in records:
        by_label.setdefault(record["label"], []).append(record)

    selected: list[dict] = []
    for label in sorted(by_label):
        candidates = by_label[label]
        rng.shuffle(candidates)
        selected.extend(candidates[:per_label])

    selected.sort(key=lambda item: (item["label"], item["path"]))
    return selected


def summarize(records: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for record in records:
        counts[record["label"]] = counts.get(record["label"], 0) + 1
    return dict(sorted(counts.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a local public face-shape calibration manifest.")
    parser.add_argument("--kaggle-root", required=True, type=Path)
    parser.add_argument("--output", default=Path("data/processed/face_shape_public_1000_manifest.json"), type=Path)
    parser.add_argument("--per-label", default=200, type=int)
    parser.add_argument("--seed", default=20260722, type=int)
    parser.add_argument("--extra-root", action="append", default=[], type=Path)
    args = parser.parse_args()

    records = list(iter_kaggle_images(args.kaggle_root))
    for extra_root in args.extra_root:
        records.extend(iter_directory_images(extra_root, f"extra/{extra_root.name}"))
    selected = balanced_sample(records, args.per_label, args.seed)
    total = len(selected)
    manifest = {
        "version": f"public-face-shape-{total}-v20260722",
        "source": "Kaggle Face Shape Dataset by Niten Lama",
        "source_url": "https://www.kaggle.com/datasets/niten19/face-shape-dataset",
        "note": "Local manifest only. Image files are not committed or deployed.",
        "label_mapping": KAGGLE_LABELS,
        "available_counts": summarize(records),
        "sample_counts": summarize(selected),
        "total": total,
        "records": selected,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: manifest[k] for k in ("version", "available_counts", "sample_counts", "total")}, indent=2))


if __name__ == "__main__":
    main()
