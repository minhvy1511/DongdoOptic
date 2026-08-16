"""Offline NumPy softmax experiment for MediaPipe face geometry."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np

from numpy_face_classifier_v2 import (
    CLASS_ORDER,
    DECISION_SETTINGS,
    FEATURE_NAMES,
    SEED,
    SoftmaxRegression,
    predictFaceShapeV2,
    save_model_artifact,
)

LABELS = np.asarray(CLASS_ORDER)


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_training_records(root):
    manifest = json.loads((root / "data/processed/face_shape_public_5000_manifest.json").read_text("utf-8"))
    # Filter first: testing_set paths are never opened or passed to extraction.
    records = [record for record in manifest["records"]
               if record["split"] == "training_set" and record["label"] in LABELS]
    records.sort(key=lambda record: (record["label"], record["path"].lower()))
    unique, hashes, duplicates = [], set(), 0
    for record in records:
        image_path = Path(record["path"])
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        digest = file_digest(image_path)
        if digest in hashes:
            duplicates += 1
        else:
            hashes.add(digest)
            unique.append(record)
    return unique, duplicates


def stratified_split(records):
    rng = np.random.default_rng(SEED)
    train, validation = [], []
    for label in LABELS:
        class_records = [record for record in records if record["label"] == label]
        validation_indices = set(
            rng.permutation(len(class_records))[:round(len(class_records) * 0.2)].tolist()
        )
        for index, record in enumerate(class_records):
            target = validation if index in validation_indices else train
            target.append({**record, "partition": "validation" if target is validation else "train"})
    return train, validation


EXTRACTOR_JS = r"""
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const {createReadStream,existsSync}=fs,{createRequire}=require('node:module');
(async()=>{const input=JSON.parse(fs.readFileSync(0,'utf8')),samples=input.samples,root=input.root;
const visionRoot=path.join(root,'node_modules','@mediapipe','tasks-vision');
const pw=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright');
const {chromium}=createRequire(path.join(root,'tools','train_numpy_face_classifier.py'))(pw);
const browserPath=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync);
const mime={'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.task':'application/octet-stream','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};
const stream=(res,file)=>{res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});createReadStream(file).pipe(res)};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');
if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html></html>');return}
if(url.pathname==='/vision_bundle.mjs')return stream(res,path.join(visionRoot,'vision_bundle.mjs'));
if(url.pathname.startsWith('/wasm/'))return stream(res,path.join(visionRoot,'wasm',path.basename(url.pathname)));
if(url.pathname==='/model.task')return stream(res,path.join(root,'frontend','assets','models','face_landmarker.task'));
if(url.pathname==='/js/face-shape-v3-features.js')return stream(res,path.join(root,'frontend','js','vision','face-shape-v3-features.js'));
const m=url.pathname.match(/^\/sample\/(\d+)$/);if(m&&samples[+m[1]])return stream(res,samples[+m[1]].path);res.writeHead(404);res.end()});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:browserPath});
try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
const rows=await page.evaluate(async samples=>{const {FaceLandmarker,FilesetResolver}=await import('/vision_bundle.mjs');const {extractFaceShapeV3Features}=await import('/js/face-shape-v3-features.js');
const vision=await FilesetResolver.forVisionTasks('/wasm');const lm=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'/model.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:1});const out=[];
for(let i=0;i<samples.length;i++){const image=new Image();image.src=`/sample/${i}`;await image.decode();const marks=lm.detect(image).faceLandmarks?.[0];
if(!marks){out.push({...samples[i],detected:false});continue}out.push({...samples[i],detected:true,features:extractFaceShapeV3Features(marks,{width:image.naturalWidth,height:image.naturalHeight})})}lm.close();return out},samples.map(({path,label,partition})=>({path,label,partition})));
process.stdout.write(JSON.stringify(rows))}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error(e.stack||e);process.exit(1)});
"""


def extract_features(root, records):
    node = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
    payload = json.dumps({"root": str(root), "samples": records})
    result = subprocess.run([str(node), "-e", EXTRACTOR_JS], input=payload,
                            text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(result.stdout)


def arrays(rows, partition):
    selected = [row for row in rows if row["detected"] and row["partition"] == partition]
    return (np.asarray([row["features"] for row in selected], dtype=np.float64),
            np.asarray([row["label"] for row in selected]))


def main():
    root = Path(__file__).resolve().parents[1]
    records, duplicate_count = load_training_records(root)
    train_records, validation_records = stratified_split(records)
    rows = extract_features(root, train_records + validation_records)
    train_x, train_y = arrays(rows, "train")
    validation_x, validation_y = arrays(rows, "validation")
    validation_rows = [row for row in rows if row["detected"] and row["partition"] == "validation"]
    model = SoftmaxRegression().fit(train_x, train_y, validation_x, validation_y)
    probabilities = model.predict_proba(validation_x)
    order = np.argsort(probabilities, axis=1)[:, ::-1]
    prediction = model.classes_[order[:, 0]].astype("<U8")
    top_probability = probabilities[np.arange(len(probabilities)), order[:, 0]]
    second_probability = probabilities[np.arange(len(probabilities)), order[:, 1]]
    margins = top_probability - second_probability
    low_probability = top_probability < DECISION_SETTINGS["minimum_probability"]
    low_margin = margins < DECISION_SETTINGS["minimum_margin"]
    prediction[low_probability | low_margin] = "unknown"
    columns = list(LABELS) + ["unknown"]
    matrix = np.zeros((5, 6), dtype=int)
    for actual, predicted in zip(validation_y, prediction, strict=True):
        matrix[list(LABELS).index(actual), columns.index(predicted)] += 1

    artifact_path = root / "data/processed/face_shape_v2_model.json"
    validation_path = root / "data/processed/face_shape_v2_validation_results.json"
    save_model_artifact(model, artifact_path)
    output_records = []
    for index, row in enumerate(validation_rows):
        best = order[index, 0]
        second = order[index, 1]
        unknown_reason = "LOW_PROBABILITY" if low_probability[index] else (
            "LOW_MARGIN" if low_margin[index] else None
        )
        output_records.append({
            "path": row["path"],
            "actual_label": row["label"],
            "predicted_label": str(prediction[index]),
            "top_label": str(model.classes_[best]),
            "top_probability": float(top_probability[index]),
            "second_label": str(model.classes_[second]),
            "second_probability": float(second_probability[index]),
            "margin": float(margins[index]),
            "unknown_reason": unknown_reason,
            "feature_vector": {
                name: float(value) for name, value in zip(FEATURE_NAMES, row["features"], strict=True)
            },
            "probabilities": {
                str(label): float(value)
                for label, value in zip(model.classes_, probabilities[index], strict=True)
            },
        })
    accuracy = float(np.mean(prediction == validation_y))
    unknown_rate = float(np.mean(prediction == "unknown"))
    per_class = {
        str(label): float(np.mean(prediction[validation_y == label] == label))
        for label in LABELS
    }
    validation_artifact = {
        "version": "face-shape-v2-validation-1",
        "model_artifact": str(artifact_path),
        "selection": "deduplicated training_set, fixed seeded stratified 80/20 split",
        "duplicates_removed": duplicate_count,
        "train_count": len(train_y),
        "validation_count": len(validation_y),
        "detection_failures": sum(not row["detected"] for row in rows),
        "best_epoch": model.best_epoch_,
        "accuracy": accuracy,
        "unknown_rate": unknown_rate,
        "per_class": per_class,
        "confusion_columns": columns,
        "confusion_matrix": matrix.tolist(),
        "records": output_records,
    }
    validation_path.write_text(json.dumps(validation_artifact, indent=2) + "\n", encoding="utf-8")

    api_check = predictFaceShapeV2(validation_rows[0]["features"], artifact_path)
    if api_check["label"] != prediction[0]:
        raise RuntimeError("predictFaceShapeV2 artifact round-trip mismatch")

    print(f"Train: {len(train_y)}")
    print(f"Validation: {len(validation_y)}")
    print(f"Duplicates removed: {duplicate_count}")
    print(f"Detection failures: {sum(not row['detected'] for row in rows)}")
    print(f"Best epoch: {model.best_epoch_}")
    print(f"Validation accuracy: {accuracy:.2%}")
    print(f"Validation unknown rate: {unknown_rate:.2%}")
    for label in LABELS:
        print(f"{label.title()}: {per_class[str(label)]:.2%}")
    print("Confusion columns: heart long oval round square unknown")
    for label, row in zip(LABELS, matrix, strict=True):
        print(f"{label}: {' '.join(map(str, row))}")
    print(f"Model artifact: {artifact_path}")
    print(f"Validation artifact: {validation_path}")


if __name__ == "__main__":
    main()
