# Session Handoff: Phân Hệ Backend & AI Hoàn Thiện — Sẵn Sàng Sang Frontend

- **Date:** 2026-10-27
- **Branch:** `main` (clean, 17 commits ahead of `origin/main`)
- **Author/Session ID:** Antigravity / Verification & Hardening Session

---

## 1. The Goal
Khép lại trọn vẹn 100% tầng CSDL (PostgreSQL 16 + pgvector) và Backend API (FastAPI + psycopg3 + 3 mô hình AI) cho đồ án môn Nguyên lý Hệ quản trị CSDL (CT221H - ĐH Cần Thơ). Đã thực hiện kiểm định lại toàn bộ hệ thống từ đầu trên DB sạch, khắc phục triệt để các lỗi test/script tiềm ẩn, đồng bộ hóa tài liệu và chuẩn bị bàn giao hoàn chỉnh cho **Thành viên 3** (Frontend SaaS & Báo cáo 20 trang).

---

## 2. Current Git State
- **Branch:** `main`
- **Working Tree:** Sạch hoàn toàn (`git status` clean sau khi commit `fcdd914`).
- **Ahead of Remote:** 17 commits ahead `origin/main` (`79b5234`).
  - *Lệnh nghiêm ngặt:* **KHÔNG PUSH LÊN GITHUB** khi người dùng chưa yêu cầu.
- **Recent Commits:**
  - `fcdd914`: `test(backend): isolate test database, fix SQL 05 false-positive, and sync documentation`
  - `600803f`: `docs: add session handoff for backend and AI completion`
  - `e27ccdb`: `docs: sync spec with implementation, fix SP rounding remainder, and finalize verification evidence`

---

## 3. What Was Accomplished
1. **Kiểm tra Bất biến CSDL Chính (Read-only):**
   - Đủ 10 bảng, 2 Stored Procedures, 2 Triggers, Composite B-Tree `(is_late, check_time)`.
   - Đủ 1.000.000 log quẹt thẻ, 3 tòa nhà, 6 phòng, 12 sinh viên, 12 ví, 144 hóa đơn lịch sử (24 tháng).
   - Đạt 0 chuỗi công tơ bị đứt gãy, 0 lệch nợ cha-con, tỷ lệ về muộn của sinh viên cú đêm cao gấp 4 lần sinh viên gương mẫu.
2. **Khắc phục Triệt để 2 Lỗi Kỹ thuật Mức HIGH:**
   - **Lỗi 1 (Test thiếu tính Hermetic):** `backend/tests/test_meters_audit.py:81` từng dùng `SELECT ... LIMIT 1` lấy ngẫu nhiên hóa đơn PAID, dẫn tới việc đọc trúng hóa đơn có số cũ cao hơn 999 $\to$ trigger bẫy số lùi bắt trước làm sai mã lỗi kỳ vọng. Đã sửa sang tạo hóa đơn riêng và patch giá trị luôn lớn hơn số cũ $\to$ test chạy độc lập, bất biến theo thứ tự vật lý.
   - **Lỗi 2 (Báo PASS giả trong SQL 05):** `database/05_test_cases.sql` Test 4.1 từng dùng `WHEN OTHERS` nuốt mất ngoại lệ `[FAIL]` khi lệnh UPDATE vô tình thành công. Đã tái cấu trúc: tạo hóa đơn phòng 3 có chỉ số cũ là 100, chỉ bắt duy nhất `check_violation`, loại bỏ `WHEN OTHERS` ở cả Test 4.1 và 4.2. Đồng thời bọc toàn bộ script 05 vào `BEGIN; ... ROLLBACK;` và thêm guard bảo vệ CSDL chính.
3. **Cô lập Tự động Môi trường Test:**
   - `backend/tests/conftest.py`: Luôn ép `settings.database_url = settings.test_database_url` và có guard từ chối chạy trên DB chính; kiểm tra tiền điều kiện phải đủ 1M log và 144 bill trước khi chạy.
   - `backend/scripts/run_tests.ps1`: Script PowerShell 1 lệnh tự tạo lại DB test, nạp 1M log, sinh 24 tháng lịch sử và chạy pytest.
4. **Xác minh Hoàn hảo (Fresh Verification Evidence):**
   - `run_tests.ps1`: Đạt **56/56 tests PASS trong 7.44s**, exit code 0.
   - `ruff check .`: `All checks passed!`, exit code 0.
   - `05_test_cases.sql`: Đạt **6/6 PASS thật**, Test 4.1 bắt đúng lỗi số điện lùi, rollback bảo toàn nguyên vẹn 100% CSDL.
   - API Live Smoke: `/health` (ok, 2 SP), `/docs` (200), OpenAPI (22 paths), Semantic search trả về phòng `B2-201` độ tương đồng 0.76.
5. **Đồng bộ hóa Tài liệu Hệ thống:**
   - Cập nhật số lượng test: 54/55 $\to$ **56 test** trên `README.md`, `backend/README.md`, `CHOT_QUYET_DINH_KY_THUAT.md`.
   - Làm rõ 2 nguồn đo lường Benchmark: API Evidence (`19.066 -> 4.655` buffers) và SQL 05 Clean-room (`9.346 -> 590` buffers).
   - Xuất bản báo cáo kiểm thử chi tiết tại `docs/verification/2026-10-27-backend-verification.md` và kế hoạch tại `docs/plans/2026-10-27-backend-test-hardening.md`.

---

## 4. What We Tried & What FAILED (Do NOT Repeat)
- **Cạm bẫy Bắt ngoại lệ `WHEN OTHERS` trong Script Test CSDL:**
  - *Hậu quả:* Khi lệnh kiểm thử thất bại (ví dụ trigger không chạy, UPDATE thành công), khối `RAISE EXCEPTION '[FAIL]'` lại bị chính `WHEN OTHERS` tóm lấy và dán nhãn `[PASS]`.
  - *Quy tắc:* Trong các script kiểm thử CSDL, **chỉ bắt đúng mã lỗi cụ thể (ví dụ `check_violation`, `integrity_constraint_violation`)**, tuyệt đối không dùng `WHEN OTHERS` nếu không re-raise.
- **Cạm bẫy `LIMIT 1` không có `ORDER BY` trong Unit Test:**
  - *Hậu quả:* Câu lệnh `SELECT bill_id FROM utility_bills WHERE bill_status = 'PAID' LIMIT 1` phụ thuộc vào thứ tự quét vật lý (Physical Storage Order). Trên DB chính đọc trúng dòng A (pass), trên DB sạch đọc trúng dòng B (fail).
  - *Quy tắc:* Luôn tạo dữ liệu kiểm thử cô lập (Dedicated Fixture) hoặc sắp xếp tường minh `ORDER BY` kèm điều kiện chặn ngưỡng.
- **Cạm bẫy Chạy Uvicorn không có `--reload` trên Windows 11 / Python 3.12:**
  - *Hậu quả:* Uvicorn 0.54 mặc định chọn `ProactorEventLoop`, gây xung đột với thư viện `psycopg` async pool (`Psycopg cannot use the 'ProactorEventLoop'`).
  - *Quy tắc:* Khi khởi động backend trên Windows, luôn dùng cờ `--reload` để ép Uvicorn khởi chạy subprocess sử dụng `SelectorEventLoop`.

---

## 5. Key Decisions & Gotchas
- **Bảo toàn CSDL Demo (`smart_dormitory_db`):** CSDL chính hiện còn lưu 2 hóa đơn kỳ `2026-10` từ lần chạy thử ban đầu. Chúng ta cố tình **không xóa** để giữ nguyên hiện trạng demo sinh động cho hội đồng (có hóa đơn đang chờ nộp và hóa đơn đã nộp).
- **Ranh giới Bàn giao (Schema Contract):** Toàn bộ 21 RESTful API endpoints đã được đóng băng tại `docs/api/openapi.json`. Tầng Frontend chỉ việc gọi API theo schema này mà không cần bận tâm logic CSDL bên dưới.
- **Tập Báo cáo 20 trang:** Đã có đủ 11 file JSON minh chứng tại `docs/evidence/backend/` và các số liệu Execution Plan thật, sẵn sàng để chắp bút vào `docs/Bao_Cao_BTL_KT221H.md`.

---

## 6. Next Steps (Ordered Priority)

Dành cho **Thành viên 3 (Frontend SaaS & Lead Báo cáo)** trong phiên làm việc tiếp theo:

1. [ ] **Khởi tạo và Xây dựng Giao diện Web SaaS (`frontend/`):**
   - Khởi tạo React 18 + Vite + Tailwind CSS + shadcn/ui.
   - Xây dựng thanh điều hướng có **Role Switcher** (`Sinh viên` $\leftrightarrow$ `Quản lý KTX`) và **Demo Checkpoints** phục vụ giảng viên.
   - **Student Portal:** Màn hình tìm phòng AI (`pgvector` semantic search), xem hợp đồng phòng, xem nợ điện nước và thanh toán qua ví.
   - **Admin Portal:** Màn hình quản lý phòng, chốt số & chia nợ (SP1), bẫy gian lận số lùi (Trigger), thanh tra Audit Log JSONB, và công tắc Benchmark Index 1.000.000 dòng log quẹt thẻ.
   - Tích hợp biểu đồ Recharts cho Dự báo tiêu thụ điện (Forecasting) và Phân cụm sinh viên (KMeans PCA).
2. [ ] **Chắp bút Quyển Báo cáo Đồ án 20 trang:**
   - Biên soạn theo barem 5 chương của môn CT221H vào file `docs/Bao_Cao_BTL_KT221H.md` (hoặc xuất DOCX).
   - Nhúng sơ đồ 10 bảng, công thức tính tiền bậc thang, mã PL/pgSQL của 2 SP / 2 Trigger và 11 bảng dữ liệu JSON minh chứng thực tế.
3. [ ] **Thiết kế Slide thuyết trình:** Soạn 15–20 slides bám sát các checkpoint demo.

---

## 7. Suggested Skills for Next Session
- `frontend-design`: Hướng dẫn thiết kế giao diện SaaS sắc nét, hiện đại, mật độ thông tin cao và trực quan cho hội đồng chấm thi.
- `grill-with-docs`: Phỏng vấn nhanh cấu trúc component và state management trước khi viết code giao diện.
- `viva-defense-prep`: Luyện tập các câu hỏi phản biện sâu của giảng viên về khóa dòng ACID, bù lẻ cent và chỉ số B-Tree.

---

## 8. Resumption Command
```text
====================================================================
PASTE THIS INTO YOUR NEXT SESSION:
Read `.handoffs/HANDOFF_backend-verified-ready-for-frontend_2026-10-27.md` and continue from "Next Steps".
====================================================================
```
