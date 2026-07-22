# Dataset Expansion Without Making The App Heavy

## Principle

Do not ship public face images with the frontend.

VisionID should use public datasets only in the offline calibration pipeline, then ship small derived calibration parameters in `frontend/js/face-calibration.js` and the classifier logic in `frontend/js/face-analysis.js`.

## Storage Layers

- `data/raw/`: downloaded public image datasets, ignored by Git.
- `data/processed/`: local manifests/features, ignored by Git.
- `backend/instance/feedback.json`: internal staff feedback, ignored by Git.
- `frontend/js/face-calibration.js`: small deployable calibration metadata only.

This keeps the app fast because the browser never downloads thousands of face images.

## Current Local Dataset

- Kaggle Face Shape Dataset: 5000 downloaded images.
- dsmlr/faceshape: 500 downloaded images.

These are local-only data sources and are not deployed.

## Next Public Sources

Candidate Roboflow datasets:

- `faceshape-vxygg/faceshape-atkte`: 6.5k images, 5 classes, CC BY 4.0.
- `yes-ripdh/face-shape-d4mv0`: 4.8k images, 11 labels, CC BY 4.0.
- `plant-id/shape-face-oumca`: 2.9k images, includes Diamond face, Rectangle Face, Triangle Face, CC BY 4.0.

They require a Roboflow API key or manual zip export.

## Download Optional Roboflow Sources

```powershell
$env:ROBOFLOW_API_KEY="..."
python tools\download_roboflow_face_datasets.py
```

Or download one source:

```powershell
python tools\download_roboflow_face_datasets.py --dataset shape-face-oumca
```

## Rebuild A Combined Manifest

After downloading Roboflow exports into `data/raw/roboflow`, rebuild a manifest using extra roots:

```powershell
python tools\build_public_face_shape_manifest.py `
  --kaggle-root $env:USERPROFILE\.cache\kagglehub\datasets\niten19\face-shape-dataset\versions\2 `
  --extra-root data\raw\roboflow\shape-face-oumca `
  --extra-root data\raw\roboflow\faceshape-atkte `
  --output data\processed\face_shape_public_combined_manifest.json `
  --per-label 1000
```

## Safe Deployment Rule

Only commit:

- scripts
- documentation
- small calibration metadata
- classifier logic

Never commit:

- raw public face images
- local manifests with absolute paths
- generated model files unless they are small and license-safe
