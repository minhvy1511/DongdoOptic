export const PUBLIC_FACE_SHAPE_CALIBRATION = {
  version: "public-reference-20260722-kaggle5000-open-diamond",
  label: "Public reference v20260722 · Kaggle 5000 + Diamond rule",
  notes: [
    "Diem khoi dau duoc hieu chinh theo 5000 anh mau can bang tu Kaggle Face Shape Dataset.",
    "Bo cong khai nay co 5 lop: Heart, Oblong/Long, Oval, Round, Square; khong co lop Diamond.",
    "Diamond duoc mo lai bang rule rieng dua tren go ma vuot tran/ham va se tiep tuc hieu chinh bang feedback noi bo."
  ],
  calibrationDataset: {
    version: "public-face-shape-5000-v20260722",
    total: 5000,
    counts: {
      heart: 1000,
      long: 1000,
      oval: 1000,
      round: 1000,
      square: 1000
    },
    autoClassifiedShapes: ["heart", "long", "oval", "round", "square", "diamond"],
    ruleBasedShapesWithoutPublicLabel: ["diamond"]
  },
  sources: [
    {
      name: "Kaggle Face Shape Dataset",
      use: "Nguon chinh de lay 1000 anh can bang: heart, oblong/long, oval, round, square.",
      url: "https://www.kaggle.com/datasets/niten19/face-shape-dataset"
    },
    {
      name: "dsmlr/faceshape",
      use: "Nguon GitHub tham khao bo nhan 500 anh can bang theo 5 lop, dung de doi chieu taxonomy.",
      url: "https://github.com/dsmlr/faceshape"
    },
    {
      name: "Roboflow FaceShape",
      use: "Tham khao bo nhan 5 lop va moc baseline accuracy cong khai.",
      url: "https://universe.roboflow.com/faceshape-vxygg/faceshape-atkte"
    },
    {
      name: "Roboflow face shape datasets with Diamond labels",
      use: "Nguon ung vien de mo rong Diamond/Rectangle/Triangle khi co API export hoac file zip hop le.",
      url: "https://universe.roboflow.com/search?q=face%20shape%20diamond"
    },
    {
      name: "WFLW",
      use: "Tham khao chat luong landmark trong dieu kien pose, blur, occlusion va illumination.",
      url: "https://wywu.github.io/projects/LAB/WFLW.html"
    },
    {
      name: "Chicago Face Database",
      use: "Tham khao cach lam du lieu mat chuan hoa va rui ro giay phep; khong dung anh trong thuong mai.",
      url: "https://www.chicagofaces.org/"
    }
  ],
  scoreGates: {
    confidence: 0.6,
    margin: 0.06,
    claritySpan: 0.22
  },
  shapeTargets: {
    long: {
      prior: 0.98,
      targets: {
        lengthToWidth: [1.62, 0.2, 1.25],
        jawToCheek: [0.84, 0.16, 0.85],
        foreheadToCheek: [0.92, 0.13, 0.75]
      },
      evidence: {
        minLengthToWidth: 1.48
      }
    },
    round: {
      prior: 0.98,
      targets: {
        lengthToWidth: [1.12, 0.13, 1.2],
        jawToCheek: [0.84, 0.1, 0.9],
        foreheadToCheek: [0.86, 0.1, 0.8]
      },
      evidence: {
        maxLengthToWidth: 1.28,
        minJawToCheek: 0.74
      }
    },
    square: {
      prior: 1,
      targets: {
        lengthToWidth: [1.26, 0.16, 0.9],
        jawToCheek: [0.92, 0.1, 1.2],
        foreheadToCheek: [0.9, 0.1, 0.8]
      },
      evidence: {
        maxLengthToWidth: 1.46,
        minJawToCheek: 0.84
      }
    },
    heart: {
      prior: 1,
      targets: {
        lengthToWidth: [1.34, 0.16, 0.7],
        foreheadToCheek: [1.02, 0.09, 1.2],
        jawToForehead: [0.82, 0.09, 1.1],
        jawToCheek: [0.86, 0.1, 0.8]
      },
      evidence: {
        minForeheadToCheek: 0.96,
        maxJawToForehead: 0.92
      }
    },
    diamond: {
      prior: 0.98,
      targets: {
        lengthToWidth: [1.34, 0.16, 0.7],
        foreheadToCheek: [0.86, 0.08, 1.15],
        jawToCheek: [0.78, 0.08, 1.15],
        cheekToJaw: [1.24, 0.13, 1]
      },
      evidence: {
        maxForeheadToCheek: 0.92,
        maxJawToCheek: 0.86,
        minCheekToJaw: 1.12
      }
    },
    oval: {
      prior: 1.02,
      targets: {
        lengthToWidth: [1.4, 0.17, 1.15],
        foreheadToCheek: [0.94, 0.1, 0.9],
        jawToCheek: [0.86, 0.1, 0.9]
      },
      evidence: {
        minLengthToWidth: 1.24,
        maxLengthToWidth: 1.58
      }
    }
  }
};

export function getCalibrationSourceLabel() {
  return PUBLIC_FACE_SHAPE_CALIBRATION.label;
}
