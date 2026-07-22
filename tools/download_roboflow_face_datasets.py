import argparse
import json
import os
from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile


DATASETS = {
    "faceshape-atkte": {
        "workspace": "faceshape-vxygg",
        "project": "faceshape-atkte",
        "version": 4,
        "format": "folder",
        "url": "https://universe.roboflow.com/faceshape-vxygg/faceshape-atkte",
    },
    "face-shape-d4mv0": {
        "workspace": "yes-ripdh",
        "project": "face-shape-d4mv0",
        "version": 1,
        "format": "folder",
        "url": "https://universe.roboflow.com/yes-ripdh/face-shape-d4mv0",
    },
    "shape-face-oumca": {
        "workspace": "plant-id",
        "project": "shape-face-oumca",
        "version": 9,
        "format": "folder",
        "url": "https://universe.roboflow.com/plant-id/shape-face-oumca",
    },
}


def build_download_url(dataset: dict, api_key: str) -> str:
    return (
        "https://universe.roboflow.com/"
        f"{dataset['workspace']}/{dataset['project']}/dataset/{dataset['version']}/download/"
        f"{dataset['format']}?api_key={api_key}"
    )


def download_dataset(name: str, dataset: dict, output_root: Path, api_key: str) -> dict:
    target_dir = output_root / name
    target_dir.mkdir(parents=True, exist_ok=True)
    archive_path = target_dir / f"{name}.zip"
    url = build_download_url(dataset, api_key)
    print(f"Downloading {name} -> {archive_path}")
    urlretrieve(url, archive_path)

    with ZipFile(archive_path) as archive:
        archive.extractall(target_dir)

    metadata = {
        "name": name,
        **dataset,
        "local_path": str(target_dir.resolve()),
        "archive_path": str(archive_path.resolve()),
    }
    (target_dir / "source.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Download optional Roboflow public face-shape datasets.")
    parser.add_argument("--output-root", default=Path("data/raw/roboflow"), type=Path)
    parser.add_argument("--dataset", choices=sorted(DATASETS), action="append")
    parser.add_argument("--api-key", default=os.environ.get("ROBOFLOW_API_KEY", ""))
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit("Missing Roboflow API key. Set ROBOFLOW_API_KEY or pass --api-key.")

    selected = args.dataset or sorted(DATASETS)
    args.output_root.mkdir(parents=True, exist_ok=True)
    metadata = [
        download_dataset(name, DATASETS[name], args.output_root, args.api_key)
        for name in selected
    ]
    manifest_path = args.output_root / "sources.json"
    manifest_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"downloaded": selected, "manifest": str(manifest_path.resolve())}, indent=2))


if __name__ == "__main__":
    main()
