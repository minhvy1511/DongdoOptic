# CODEX TASK BRIEF

Hãy đọc `AGENTS.md` và `docs/AR_GLASSES_PRODUCT_SPEC.md`, sau đó phân tích repository hiện tại.

## Nhiệm vụ đầu tiên

Chưa viết hoặc sửa code lớn. Trước tiên hãy cung cấp:

1. **Repository audit**
   - stack;
   - cấu trúc thư mục;
   - entry points;
   - camera pipeline;
   - face landmark/mesh pipeline;
   - frontend/backend boundary;
   - deployment assumptions.

2. **Current behavior**
   - hệ thống đang quét gì;
   - đường viền xanh được tạo từ landmark nào;
   - dữ liệu nào chỉ là 2D/normalized;
   - dữ liệu nào có scale vật lý;
   - ảnh/mesh có được gửi hoặc lưu trên server hay không.

3. **Gap analysis**
   - phần nào đã đáp ứng đặc tả;
   - phần nào thiếu;
   - lỗi hoặc rủi ro quan trọng;
   - điểm có thể gây kết luận sai về dáng mặt hoặc kích thước gọng.

4. **Recommended architecture**
   - bám sát stack hiện tại;
   - tách tracking, measurement, scoring và rendering;
   - có fallback cho thiết bị không hỗ trợ depth;
   - không tuyên bố mm khi chưa hiệu chuẩn.

5. **Milestone plan**
   - Milestone 1: ổn định face mesh và quality gate;
   - Milestone 2: thử gọng cơ bản;
   - Milestone 3: catalog và scoring;
   - Milestone 4: calibration/measurement;
   - Milestone 5: mobile/depth nếu phù hợp.

6. **Acceptance tests**
   - test hình học;
   - test nhiều frame;
   - test capability;
   - test unsupported device;
   - test quyền riêng tư;
   - test kết quả confidence.

7. **Open questions**
   Chỉ hỏi những gì không thể xác định bằng cách đọc code.

## Định dạng phản hồi

- Executive summary
- Repository map
- Current pipeline diagram
- Risks
- Gap table
- Proposed architecture diagram
- Milestones
- Test plan
- Questions requiring owner input

Sau khi hoàn tất phân tích, dừng lại và chờ phê duyệt trước khi triển khai thay đổi lớn.
