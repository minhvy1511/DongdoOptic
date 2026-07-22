# Face Shape Public Calibration

## Dataset Used

- Source: Kaggle Face Shape Dataset by Niten Lama
- URL: https://www.kaggle.com/datasets/niten19/face-shape-dataset
- Local cache path: `%USERPROFILE%\.cache\kagglehub\datasets\niten19\face-shape-dataset\versions\2`
- Local manifest: `data/processed/face_shape_public_1000_manifest.json`
- Images are local only and are not committed or deployed.

## Sample

The local manifest samples 1000 public-labelled images:

- Heart: 200
- Oblong mapped to Long: 200
- Oval: 200
- Round: 200
- Square: 200

## Important Limitation

This public dataset does not contain a Diamond class. For that reason, VisionID does not auto-classify Diamond from this calibration set. Diamond remains available as a manual staff confirmation and should be calibrated later from internal feedback records where `faceShape_ai` and `faceShape_confirmed` differ.

## Regenerate Manifest

```powershell
python tools\build_public_face_shape_manifest.py `
  --kaggle-root $env:USERPROFILE\.cache\kagglehub\datasets\niten19\face-shape-dataset\versions\2 `
  --output data\processed\face_shape_public_1000_manifest.json `
  --per-label 200
```
