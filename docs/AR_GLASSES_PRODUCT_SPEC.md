# ĐẶC TẢ SẢN PHẨM: HỆ THỐNG AR GỢI Ý GỌNG KÍNH

## 1. Mục tiêu

Xây dựng hệ thống giúp người dùng:

1. quét khuôn mặt bằng camera;
2. thử gọng kính theo thời gian thực;
3. nhận gợi ý kiểu gọng phù hợp về thẩm mỹ;
4. đánh giá gọng có phù hợp về kích thước hay không;
5. nhận kết quả kèm mức độ tin cậy và giới hạn kỹ thuật.

Hệ thống phải phân biệt rõ:

- **Virtual try-on:** đặt mô hình kính đúng vị trí và bám theo chuyển động đầu.
- **Fit measurement:** ước lượng hoặc đo các kích thước cần thiết để chọn size gọng.
- **Style recommendation:** đánh giá kiểu dáng gọng phù hợp với đặc điểm khuôn mặt và sở thích.

Không được coi ba chức năng này là một.

---

## 2. Nguyên tắc cốt lõi

### 2.1. Không suy ra milimét chỉ từ landmark 2D

Ảnh camera thường chỉ cung cấp pixel hoặc tọa độ chuẩn hóa. Không được đổi trực tiếp thành mm khi chưa có một nguồn tỷ lệ đáng tin cậy, ví dụ:

- dữ liệu chiều sâu đã được kiểm chứng;
- vật chuẩn có kích thước thật;
- thông số kính cũ đã biết và được đặt đúng mặt phẳng;
- quy trình hiệu chuẩn nhiều góc đã được kiểm thử.

### 2.2. Không ép khuôn mặt vào một nhãn duy nhất

Kết quả nên có thể là:

- tròn pha oval;
- oval pha dài;
- vuông pha oval;

hoặc xác suất theo nhiều nhóm. Phân loại dáng mặt chỉ là một tín hiệu thẩm mỹ, không phải cơ sở duy nhất để chọn kính.

### 2.3. Mỗi kết quả phải có mức độ tin cậy

Ví dụ:

- Cao: dữ liệu depth/calibration hợp lệ, nhiều khung hình ổn định.
- Trung bình: face mesh tốt nhưng chỉ có tỷ lệ tương đối.
- Thấp: ảnh mờ, tóc che thái dương, góc đầu sai hoặc camera quá gần.

### 2.4. Ưu tiên quyền riêng tư

Mặc định:

- xử lý trên thiết bị hoặc trong phiên;
- không lưu ảnh khuôn mặt;
- không lưu face mesh;
- không dùng dữ liệu cho nhận diện danh tính;
- chỉ gửi dữ liệu lên máy chủ khi có mục đích rõ ràng, thông báo và sự đồng ý.

---

## 3. Phân tầng thiết bị

### Tầng A — Web hoặc thiết bị phổ thông

Công nghệ gợi ý:

- MediaPipe Face Landmarker hoặc thư viện tương đương;
- Canvas/WebGL/Three.js để hiển thị;
- Web Worker nếu xử lý video làm nghẽn giao diện.

Khả năng:

- kiểm tra chất lượng ảnh;
- landmark/face mesh;
- ước lượng tư thế đầu;
- phân tích tỷ lệ;
- gợi ý kiểu gọng;
- thử kính cơ bản;
- đánh giá kích thước tương đối.

Giới hạn:

- không tuyên bố số đo tuyệt đối theo mm khi chưa hiệu chuẩn;
- không coi Z dự đoán của face mesh là chiều sâu vật lý chính xác.

### Tầng B — Ứng dụng di động không có chiều sâu tin cậy

Công nghệ tùy nền tảng:

- iOS face tracking phù hợp với thiết bị;
- Android MediaPipe hoặc AR face tracking phù hợp;
- quét nhiều góc;
- hiệu chuẩn bằng thẻ chuẩn, kích thước kính cũ hoặc dữ liệu tham chiếu khác.

Khả năng:

- virtual try-on tốt hơn web;
- theo dõi đầu khi quay trái/phải;
- ước lượng độ rộng và fit sau hiệu chuẩn;
- cung cấp khoảng size thay vì một số tuyệt đối.

### Tầng C — Thiết bị có cảm biến chiều sâu phù hợp

Ví dụ định hướng:

- iOS: ARKit/TrueDepth trên thiết bị hỗ trợ;
- nền tảng khác: chỉ dùng depth API sau khi xác minh camera, khoảng hoạt động và độ chính xác phù hợp cho mặt.

Khả năng:

- thu face geometry 3D;
- dùng hệ tọa độ có tỷ lệ vật lý nếu API thực sự bảo đảm;
- hỗ trợ đánh giá sống mũi, độ nhô gò má, khoảng cách mắt–gọng;
- đề xuất khoảng kích thước gọng có độ tin cậy cao hơn.

Codex phải kiểm tra SDK hiện hành và capability của từng thiết bị trước khi triển khai.

---

## 4. Quy trình người dùng

### Bước 1 — Kiểm tra thiết bị

Ứng dụng xác định:

- có camera trước hay không;
- có face tracking hay không;
- có depth phù hợp hay không;
- có WebGL/GPU phù hợp hay không;
- trình duyệt hoặc hệ điều hành có được hỗ trợ hay không.

Kết quả capability phải quyết định chế độ quét và thông điệp giới hạn.

### Bước 2 — Hướng dẫn quét

Yêu cầu người dùng:

1. tháo kính;
2. vén tóc khỏi thái dương;
3. giữ biểu cảm trung tính;
4. đặt camera ngang tầm mắt;
5. không đặt camera quá gần;
6. nhìn thẳng;
7. quay đầu chậm sang trái;
8. quay đầu chậm sang phải;
9. cúi/ngẩng nhẹ nếu quy trình cần.

### Bước 3 — Quality gate

Không chấp nhận kết quả nếu:

- mặt quá nhỏ hoặc quá lớn trong khung;
- đầu nghiêng/quay quá ngưỡng;
- ảnh mờ;
- thiếu sáng hoặc ngược sáng;
- một phần mặt bị che;
- tóc che vùng cần đo;
- landmark dao động lớn;
- chỉ có quá ít khung hình hợp lệ.

### Bước 4 — Thu nhiều khung hình

Không dùng duy nhất một frame. Hệ thống cần:

- thu chuỗi frame hợp lệ;
- loại outlier;
- dùng median hoặc robust averaging;
- làm mượt theo thời gian;
- tính độ ổn định;
- trả về confidence.

### Bước 5 — Phân tích và gợi ý

Trả về ít nhất:

- nhóm dáng mặt hoặc phân bố xác suất;
- đặc điểm chính ảnh hưởng đến chọn kính;
- 3–5 kiểu gọng gợi ý;
- kết quả fit cho từng gọng;
- lý do;
- cảnh báo;
- mức độ tin cậy.

---

## 5. Các đặc trưng khuôn mặt cần dùng

### 5.1. Cho thẩm mỹ

- tỷ lệ chiều dài/chiều rộng khuôn mặt;
- độ rộng trán;
- độ rộng gò má;
- độ rộng hàm;
- độ tròn cằm;
- mức độ góc cạnh quai hàm;
- vị trí chân mày;
- khoảng mắt–gò má;
- độ đầy hai má.

### 5.2. Cho fit vật lý

- chiều rộng thái dương;
- khoảng cách tâm mắt;
- chiều rộng và hình dạng sống mũi;
- độ nhô và độ dốc sống mũi;
- độ nhô gò má;
- vị trí tai nếu thu được;
- độ cong ngang của mặt;
- khoảng cách mắt tới mặt phẳng gọng;
- nguy cơ gọng chạm má;
- vị trí bản lề so với hai bên đầu.

Không cần dùng mọi landmark. Cần tạo một lớp mapping landmark có tên rõ ràng và được kiểm thử.

---

## 6. Dữ liệu sản phẩm gọng kính

Mỗi mẫu gọng phải có metadata chuẩn hóa:

```text
frame_id
name
brand
style_tags
shape
material
rim_type
lens_width_mm
lens_height_mm
bridge_width_mm
total_frame_width_mm
temple_length_mm
frame_wrap_angle
pantoscopic_tilt
bridge_type
nose_pad_type
model_asset_path
model_real_world_scale
bridge_anchor
left_lens_center
right_lens_center
left_hinge
right_hinge
occlusion_mesh
collision_mesh
```

Yêu cầu:

- mô hình 3D đúng tỷ lệ;
- không kéo dãn gọng tùy ý để “vừa” mặt;
- anchor của các mẫu phải thống nhất;
- thông số phải lấy từ nguồn sản phẩm đáng tin cậy;
- dữ liệu thiếu phải được đánh dấu, không tự bịa.

---

## 7. Logic gợi ý gọng

Tách thành hai điểm:

### 7.1. Style score

Ví dụ thành phần:

- cân bằng với dáng mặt;
- phù hợp với chân mày;
- độ cao tròng so với mặt;
- độ góc cạnh;
- độ dày viền;
- phong cách người dùng.

### 7.2. Fit score

Ví dụ thành phần:

- tổng chiều rộng gọng;
- bridge fit;
- tâm mắt trong tròng;
- khoảng cách tròng–mắt;
- nguy cơ chạm má;
- vị trí bản lề;
- độ cong gọng.

Điểm tổng có thể bắt đầu bằng:

```text
overall_score =
  0.40 * fit_score
+ 0.35 * style_score
+ 0.15 * user_preference_score
+ 0.10 * confidence_adjustment
```

Đây chỉ là cấu hình ban đầu, phải cho phép thay đổi và hiệu chỉnh bằng dữ liệu thực tế.

### 7.3. Quy tắc an toàn

- Nếu calibration không hợp lệ: không chấm fit tuyệt đối.
- Nếu confidence thấp: chỉ hiển thị gợi ý kiểu dáng.
- Nếu metadata gọng thiếu: hạ confidence hoặc loại khỏi kết quả.
- Không nói “vừa hoàn hảo”; dùng “phù hợp”, “có khả năng phù hợp”, “cần thử thực tế”.

---

## 8. Kết quả hiển thị mẫu

```text
Độ phù hợp tổng thể: 88/100
Mức độ tin cậy: Trung bình

Kiểu dáng: Rất phù hợp
Chiều rộng: Có vẻ phù hợp
Cầu mũi: Có nguy cơ hơi rộng
Vị trí tâm tròng: Phù hợp
Nguy cơ chạm má: Thấp

Lưu ý:
Kích thước được ước lượng từ face mesh và chưa được hiệu chuẩn bằng depth hoặc vật chuẩn.
```

Khi có đo tốt hơn:

```text
Tổng chiều rộng gọng đề xuất: 138–143 mm
Cầu kính tham khảo: 17–19 mm
Mức độ tin cậy: Cao
```

Phải ưu tiên khoảng giá trị, không tạo cảm giác chính xác giả bằng số lẻ không cần thiết.

---

## 9. Kiến trúc logic

Tách module:

```text
Camera / Sensor Adapter
        ↓
Capability Detector
        ↓
Face Tracking Adapter
        ↓
Quality Gate
        ↓
Landmark Normalizer
        ↓
Measurement Engine
        ↓
Face Feature Classifier
        ↓
Frame Catalog
        ↓
Fit Scoring Engine
        ↓
Style Recommendation Engine
        ↓
AR Renderer
        ↓
Result + Confidence + Limitations
```

Yêu cầu thiết kế:

- adapter riêng theo nền tảng;
- measurement engine độc lập renderer;
- scoring độc lập UI;
- dữ liệu gọng tách khỏi thuật toán;
- có chế độ mock để test không cần camera;
- ghi log kỹ thuật nhưng không log dữ liệu sinh trắc học thô.

---

## 10. MVP đề xuất

MVP web trước:

1. mở camera;
2. kiểm tra một khuôn mặt;
3. hiển thị face mesh;
4. quality gate;
5. tính tỷ lệ tương đối;
6. phân loại tròn/oval/vuông/dài/trái tim theo xác suất;
7. tải catalog 5–10 gọng mẫu;
8. overlay một gọng theo mắt và sống mũi;
9. chấm style;
10. chấm fit tương đối;
11. hiển thị confidence và giới hạn;
12. không trả về mm nếu chưa calibration.

MVP không bắt buộc:

- nhận diện danh tính;
- lưu ảnh;
- backend AI nặng;
- đo đơn kính thuốc;
- chẩn đoán y khoa;
- mô phỏng quang học của tròng cận.

---

## 11. Giai đoạn tiếp theo

### Giai đoạn 2 — Mobile try-on

- iOS/Android app;
- theo dõi đầu ổn định;
- occlusion;
- quét nhiều góc;
- catalog 3D chuẩn.

### Giai đoạn 3 — Measurement

- TrueDepth hoặc nguồn depth phù hợp;
- hiệu chuẩn bằng vật chuẩn trên thiết bị khác;
- benchmark với thước/máy đo thực;
- xác định sai số theo thiết bị;
- xây confidence model.

### Giai đoạn 4 — Hệ thống gợi ý học từ phản hồi

Thu phản hồi không nhạy cảm:

- gọng vừa/chật/rộng;
- chạm má;
- trượt mũi;
- người dùng chọn/mua/đổi;
- đánh giá thẩm mỹ.

Dùng phản hồi để hiệu chỉnh scoring, không dùng để nhận diện người.

---

## 12. Tiêu chí nghiệm thu

### Face tracking

- gọng không trượt rõ rệt khi quay đầu trong góc hoạt động quy định;
- bridge anchor bám đúng sống mũi;
- tâm tròng gần tâm mắt;
- occlusion hợp lý.

### Quality gate

- phát hiện camera quá gần;
- phát hiện mặt quay/nghiêng;
- phát hiện landmark không ổn định;
- từ chối khi dữ liệu không đủ.

### Measurement

- kết quả lặp lại nằm trong ngưỡng sai lệch đã định;
- có benchmark với số đo thật;
- không đổi pixel sang mm khi thiếu scale;
- hiển thị confidence.

### Recommendation

- trả về nhiều lựa chọn;
- giải thích lý do;
- tách style và fit;
- không ép nhãn mặt duy nhất;
- xử lý gọng thiếu metadata.

### Privacy

- không lưu ảnh mặc định;
- có thông báo quyền camera;
- có chính sách xóa dữ liệu;
- không dùng face geometry làm định danh.

---

## 13. Những câu hỏi Codex phải trả lời sau khi đọc repository

1. Stack hiện tại là gì?
2. Module camera và face mesh đang nằm ở đâu?
3. Đường xanh hiện tại lấy từ thư viện/API nào?
4. Landmark nào đang dùng để vẽ viền mặt?
5. Vì sao viền má có thể ôm vào trong?
6. Hệ thống hiện dùng một frame hay nhiều frame?
7. Có quality gate không?
8. Có lưu ảnh hoặc mesh lên server không?
9. Catalog gọng hiện có thông số thật hay chỉ có ảnh?
10. Mô hình gọng 3D có tỷ lệ chuẩn không?
11. Có thể triển khai MVP web bằng stack hiện tại không?
12. Cần refactor tối thiểu những phần nào?
13. Test nào phải có trước khi thêm đo mm?
14. Nền tảng triển khai hiện tại có giới hạn camera/WebGL/worker gì?

---

## 14. Yêu cầu đối với Codex

Trước khi sửa code, Codex phải:

1. đọc toàn bộ tài liệu này;
2. kiểm tra repository;
3. lập bản đồ file/module;
4. mô tả hành vi hiện tại;
5. chỉ ra khoảng cách so với đặc tả;
6. đưa ra kiến trúc phù hợp với stack thật;
7. đề xuất kế hoạch theo milestone;
8. ghi rõ rủi ro;
9. hỏi chỉ những câu không thể suy ra từ code;
10. chờ phê duyệt trước thay đổi lớn.

Không được tự giả định rằng ứng dụng phải dùng Swift, Kotlin, Unity, React, Python hoặc bất kỳ stack nào khi chưa kiểm tra repository.
