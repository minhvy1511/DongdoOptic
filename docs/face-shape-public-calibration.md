# Face Shape Public Calibration

## Dataset Used

- Source: Kaggle Face Shape Dataset by Niten Lama
- URL: https://www.kaggle.com/datasets/niten19/face-shape-dataset
- Local cache path: `%USERPROFILE%\.cache\kagglehub\datasets\niten19\face-shape-dataset\versions\2`
- Local manifest: `data/processed/face_shape_public_5000_manifest.json`
- Images are local only and are not committed or deployed.

## Sample

The local manifest samples 5000 public-labelled images:

- Heart: 1000
- Oblong mapped to Long: 1000
- Oval: 1000
- Round: 1000
- Square: 1000

An additional 500-image `dsmlr/faceshape` dataset is also downloaded locally for taxonomy comparison, but it is not merged into the current production calibration manifest yet.

## Important Limitation

This public dataset does not contain a Diamond class. VisionID therefore treats Diamond as a rule-based branch: it can be suggested by AI, but it must be interpreted through the top-candidate confidence and confirmed by staff feedback over time.

Candidate public sources for expanding beyond 10,000 images:

- Roboflow `faceshape-vxygg/faceshape-atkte`: around 6.5k images.
- Roboflow `yes-ripdh/face-shape-d4mv0`: around 4.8k images.
- Roboflow projects with Diamond/Rectangle/Triangle labels.

These sources need a valid Roboflow export/API key or a downloaded dataset zip before they can be included in the local manifest. Do not count them as integrated until the files are downloaded and inspected locally.

See `docs/dataset-expansion-without-heavy-app.md` for the expansion workflow that keeps raw images out of the frontend.

## Regenerate Manifest

```powershell
python tools\build_public_face_shape_manifest.py `
  --kaggle-root $env:USERPROFILE\.cache\kagglehub\datasets\niten19\face-shape-dataset\versions\2 `
  --output data\processed\face_shape_public_5000_manifest.json `
  --per-label 1000
```
