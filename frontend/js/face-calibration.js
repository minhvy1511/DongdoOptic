export const PUBLIC_FACE_SHAPE_CALIBRATION = {
  version: "public-reference-20260721",
  label: "Public reference v20260721",
  notes: [
    "Diem khoi dau duoc hieu chinh tu cac nhom nhan cong khai; khong nhung anh nguoi that vao app.",
    "Anh nhin thang la nguon chinh. Khung nghieng chi dung de tang/giam do tin cay."
  ],
  sources: [
    {
      name: "Kaggle Face Shape Dataset",
      use: "Tham khao nhan oval, round, square, heart/oblong va phan bo hinh anh cong khai CC0.",
      url: "https://www.kaggle.com/datasets/niten19/face-shape-dataset"
    },
    {
      name: "Roboflow FaceShape",
      use: "Tham khao bo nhan 5 lop va moc baseline accuracy cong khai.",
      url: "https://universe.roboflow.com/faceshape-vxygg/faceshape-atkte"
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
