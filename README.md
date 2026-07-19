# DongDo Optic

Prototype web offline tu van chon gong kinh cho nguoi Viet.

## Chay frontend

```powershell
cd E:\DongDo_Optic
python -m http.server 5173
```

Mo: http://localhost:5173/frontend/

## Ghi chu

- MediaPipe chay tren client.
- Model nam tai `frontend/assets/models/face_landmarker.task`.
- Package `@mediapipe/tasks-vision` nam trong `node_modules`.
- Frontend hien da co classifier rule-based va goi y gong kinh mau.

## API backend du kien

```powershell
cd E:\DongDo_Optic\backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- `GET /api/health`
- `POST /api/face-shape/analyze`
- `GET /api/customers`
- `POST /api/customers`
- `DELETE /api/customers/{customer_code}`

## Cach luu ho so khach hang

Ban offline hien tai luu ngay trong trinh duyet bang `localStorage`, moi ho so co ma dang `KH-YYYYMMDD-XXXX`.

Khi chay backend, API du kien luu vao `backend/app/instance/customers.json` theo phong cach cua `App_Tinh_Toan_2`: doc/ghi JSON, co lock, ghi file tam roi thay the file chinh.
