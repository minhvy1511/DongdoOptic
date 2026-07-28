# VisionID Milestone 1 QA Checklist

Phạm vi: kiểm thử ổn định VisionID Core sau refactor. Không kiểm thử Recommendation Engine mới, catalog mới, virtual try-on hoặc đo kích thước mm.

Ghi chú debug QA: có thể mở `/frontend/?visionDebug=1` để xem faceCount, reason code, số frame, fallback, confidence và MediaPipe error. Chế độ này không lưu debug data, không hiển thị landmark thô và không gửi backend.

## Checklist

| Test ID | Thiết bị | Trình duyệt | Điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| D-01 | Desktop Windows | Chrome | Camera được cấp quyền | Mở `/frontend/?visionDebug=1`, bật camera, quét mặt chính diện | Camera mở, burst lấy đủ frame theo cấu hình, có kết quả tư vấn, không hiển thị mm vật lý |  |  |  |
| D-02 | Desktop Windows | Chrome | Camera denied | Từ chối quyền camera khi trình duyệt hỏi | App không crash, hiện lỗi quyền camera dễ hiểu, không gọi API upload ảnh |  |  |  |
| D-03 | Desktop Windows | Chrome | Không có camera | Tắt/rút camera rồi bật camera trong app | App không crash, báo không mở được camera |  |  |  |
| D-04 | Desktop Windows | Chrome | MediaPipe model load fail | Chặn hoặc đổi tạm path model `.task`, reload app | App không crash, báo không đủ dữ liệu hoặc model lỗi, debug có MediaPipe error/model error |  |  |  |
| D-05 | Desktop Windows | Chrome | Mặt chính diện tốt | Ngồi thẳng, đủ sáng, giữ 2-3 giây | Reason `OK`, accepted frames đạt tối thiểu, confidence không bị hạ do pose |  |  |  |
| D-06 | Desktop Windows | Chrome | Mặt lệch trái/phải | Quay mặt lệch trái rồi lệch phải khi quét ảnh thẳng | Frame pose lệch bị reject hoặc yêu cầu nhìn thẳng, không fallback nếu yaw hard reject |  |  |  |
| D-07 | Desktop Windows | Chrome | Mặt quá gần | Tiến sát camera, mặt chiếm gần hết khung | Reason `TOO_CLOSE` hoặc hướng dẫn lùi ra, không lấy frame hard reject làm kết quả chính |  |  |  |
| D-08 | Desktop Windows | Chrome | Mặt quá xa | Ngồi xa camera, mặt nhỏ | Reason `TOO_FAR` hoặc hướng dẫn gần hơn, không lấy frame hard reject làm kết quả chính |  |  |  |
| D-09 | Desktop Windows | Chrome | Không có mặt | Bật camera nhưng rời khỏi khung | Reason `NO_FACE`, không hiển thị kết quả chắc chắn, app không crash |  |  |  |
| D-10 | Desktop Windows | Chrome | Hai người trong khung | Đưa hai khuôn mặt vào camera | Reason `MULTIPLE_FACES`, không chốt kết quả từ frame đó |  |  |  |
| D-11 | Desktop Windows | Chrome | Quét liên tục | Quét 3 lượt liên tiếp, bấm quét lại mỗi lượt | State reset đúng, không kẹt loading, frame count không dồn từ lượt cũ |  |  |  |
| D-12 | Desktop Windows | Chrome | Reload sau khi quét | Quét xong, reload trang | App load lại bình thường; nếu chưa consent thì analysis không tự persist |  |  |  |
| D-13 | Desktop Windows | Chrome | Chuyển tab rồi quay lại | Đang bật camera, chuyển tab khác rồi quay lại | Camera/loop vẫn ổn hoặc báo cần bật lại, không crash |  |  |  |
| A-01 | Android phone/tablet | Chrome Android | Camera được cấp quyền | Mở `/frontend/?visionDebug=1`, bật camera trước | Camera trước hoạt động, nút đủ dễ bấm, debug reason code cập nhật |  |  |  |
| A-02 | Android phone/tablet | Chrome Android | Camera trước | Quét chính diện bằng camera trước | Burst chạy đủ, không dùng bundle cũ, kết quả có limitation chưa đo mm |  |  |  |
| A-03 | Android phone/tablet | Chrome Android | Đổi camera trước/sau | Bấm đổi camera, quét lại | Camera đổi đúng, state quét reset, không crash |  |  |  |
| A-04 | Android phone/tablet | Chrome Android | Xoay dọc/ngang | Xoay màn hình trong khi camera đang bật | Canvas/camera scale đúng, nút không che nội dung chính |  |  |  |
| A-05 | Android phone/tablet | Chrome Android | Khóa màn hình rồi mở lại | Bật camera, khóa màn hình, mở lại trình duyệt | App không crash; nếu camera bị dừng thì có thể bật lại |  |  |  |
| A-06 | Android phone/tablet | Chrome Android | Quét liên tục | Quét 3 lượt liên tiếp trên mobile | Không kẹt camera, không dùng frame cũ, debug sample count reset |  |  |  |
| A-07 | Android phone/tablet | Chrome Android | Từ chối quyền camera | Deny permission | App báo lỗi quyền camera, không crash |  |  |  |
| I-01 | iPhone | Safari | Camera được cấp quyền | Mở app, bật camera trước | Safari cho phép camera trên HTTPS, video/canvas hiển thị đúng |  |  |  |
| I-02 | iPhone | Safari | Camera trước | Quét chính diện | Burst chạy, không crash, limitation chưa đo mm hiển thị |  |  |  |
| I-03 | iPhone | Safari | Xoay dọc/ngang | Xoay màn hình khi camera bật | Layout không vỡ, canvas không lệch khỏi video |  |  |  |
| I-04 | iPhone | Safari | Chuyển tab | Chuyển sang tab/app khác rồi quay lại | Camera xử lý ổn hoặc cần bật lại có thông báo rõ |  |  |  |
| I-05 | iPhone | Safari | Reload | Quét xong rồi reload | Không persist analysis nếu chưa consent, app load đúng JS mới |  |  |  |
| I-06 | iPhone | Safari | Từ chối quyền camera | Deny permission | App không crash, báo lỗi quyền camera |  |  |  |
| P-01 | Desktop/Mobile | DevTools Network | Không gửi ảnh | Quét một lượt, lọc Network theo Fetch/XHR | Không có request chứa ảnh, blob hoặc file ảnh |  |  |  |
| P-02 | Desktop/Mobile | DevTools Network | Không gửi base64 | Quét một lượt, tìm payload chứa `data:image` hoặc chuỗi base64 dài | Không có payload base64 |  |  |  |
| P-03 | Desktop/Mobile | DevTools Network | Không gửi landmark | Quét một lượt, kiểm tra request payload | Không có mảng landmark/mesh trong request |  |  |  |
| P-04 | Desktop/Mobile | DevTools Network | Không gửi mesh | Quét một lượt, kiểm tra payload | Không có tessellation/face mesh/raw landmark |  |  |  |
| P-05 | Desktop/Mobile | DevTools Network | Chưa consent | Gửi feedback sau quét khi chưa consent | `POST /api/feedback` không có diagnostics/top_candidates/capture_quality/confidence |  |  |  |
| P-06 | Desktop/Mobile | DevTools Network | Có consent rõ ràng | Set consent test hợp lệ rồi gửi feedback | Chỉ gửi đúng field cho phép: confidence, confidence_level, top_candidates, capture_quality, diagnostics tóm tắt |  |  |  |
| P-07 | Desktop/Mobile | Local storage | Thu hồi consent | Từ trạng thái đã consent chuyển false rồi lưu hồ sơ | Hồ sơ không còn analysis/latestAnalysis/diagnostics/top_candidates/capture_quality/confidence; vẫn giữ thông tin khách và faceShape_confirmed |  |  |  |

## Endpoint Expected Trong Một Lượt Quét

- Static frontend: `/frontend/`, `/frontend/js/app.mobile.js?v=20260728-78`, `/frontend/js/app.js?v=20260728-78`, các module JS liên quan.
- MediaPipe/model local: `/frontend/js/assets/models/face_landmarker.task` hoặc path tương đương từ `face-landmarker.js`.
- Không gọi `/api/face-shape/analyze` trong luồng frontend hiện tại.
- Chỉ gọi `/api/feedback` khi nhân viên bấm lưu góp ý.
- `/api/lens/advice` chỉ liên quan tư vấn tròng, không chứa ảnh/landmark.

## Cache Notes

- `index.html` hiện trỏ `app.mobile.js?v=20260728-78`.
- `app.mobile.js` hiện import `app.js?v=20260728-78`.
- Backend FastAPI đặt `Cache-Control: no-store` cho `/api/*`; static `/frontend/*` không có no-store mặc định.
- Khi deploy PythonAnywhere, nên reload web app và hard refresh mobile lần đầu sau deploy. Nếu vẫn thấy bundle cũ, tăng query version tiếp theo hoặc cấu hình static cache thấp hơn cho giai đoạn QA.
