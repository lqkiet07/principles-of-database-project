# Session Handoff: Hoàn Thành Toàn Bộ Phân Hệ Backend & AI Engine

- **Date:** 2026-10-27
- **Branch:** `main` (clean, 15 commits ahead of `origin/main`)
- **Author/Session ID:** Antigravity / Task Implementation & Verification Session

---

## 1. The Goal
Xây dựng trọn vẹn tầng Backend API (FastAPI) và AI Engine (Scikit-learn, Sentence-Transformers) cho đề tài Bài tập lớn môn Nguyên lý Hệ quản trị CSDL (CT221H - Đại học Cần Thơ), tích hợp CSDL PostgreSQL 16 `pgvector` đang chạy trên Docker. Hệ thống hỗ trợ đầy đủ 5 tiêu chí chấm điểm của giảng viên: Stored Procedures, ACID Concurrency Control, Triggers Audit Log JSONB, Index Performance Benchmark trên 1.000.000 log, và 3 mô hình AI.

---

## 2. Current Git State
- **Branch:** `main`
- **Working Tree:** Sạch hoàn toàn (`git status` clean).
- **Recent Commits:**
  - `e27ccdb` docs: sync spec with implementation, fix SP rounding remainder, and finalize verification evidence
  - `14c4920` docs(backend): export OpenAPI schema, evidence artifacts, and run guide
  - `d6dd6b7` feat(ai): student behavioral clustering with KMeans, PCA, and semantic labels
  - `1c93d28` feat(ai): electricity consumption forecasting with RandomForestRegressor
  - `323ee33` feat(ai): sentence-transformers embeddings and pgvector semantic room search
- **Blockers / In-Flight Status:** Không có blocker. Toàn bộ 56/56 automated tests đã pass 100% trên PostgreSQL thật.

---

## 3. What Was Accomplished
1. **Docker CSDL & Nạp Dữ liệu Thực nghiệm:**
   - Khởi chạy container `smart_dorm_postgres` và `smart_dorm_pgadmin`.
   - Nạp `01_schema.sql`, `02_procedures.sql`, `03_triggers.sql`, `04_seed_1m_logs.sql` (1.000.000 bản ghi), `05_test_cases.sql` (6 test cases PASS).
2. **FastAPI Backend Core (`backend/app/`):**
   - Cấu hình `psycopg[binary,pool]` async connection pool với `dict_row`.
   - Thiết kế Envelope chuẩn hóa: `{success, status_code, error_code, message, data}` cho cả Success và Failure.
   - Xây dựng 21 RESTful API endpoints phân chia theo:
     - `routers/students.py`: Thông tin sinh viên, phòng ở/bạn cùng phòng, công nợ, biên lai, access log, nạp ví.
     - `routers/admin.py`: Quản trị phòng, xếp chỗ/trả phòng (tự động đồng bộ `current_occupancy`), chốt chỉ số chia nợ (SP1), chỉnh sửa công tơ (bẫy trigger), tra cứu `audit_logs` JSONB, tìm kiếm access log, và benchmark Index.
     - `routers/payments.py`: Thanh toán công nợ cá nhân (SP2) khóa bi quan `FOR UPDATE`.
     - `routers/ai.py`: Semantic Search, Dự báo sản lượng điện, Phân cụm sinh viên.
3. **Bộ đôi Stored Procedure & Sửa Lỗi Làm Tròn Kế Toán:**
   - Sửa lỗi làm tròn cent lẻ trong `database/02_procedures.sql:143-150`: Sử dụng hàm cửa sổ `row_number() OVER (ORDER BY student_id) = p_student_count` để bù phần dư cho sinh viên cuối cùng. Đã có unit test chứng minh chia 200.000đ cho 3 người ra chính xác 66.666,67đ + 66.666,67đ + 66.666,66đ = 200.000,00đ.
4. **Ba Module Trí Tuệ Nhân Tạo (`backend/app/ai/`):**
   - `embeddings.py` & `semantic_search.py`: Dùng mô hình `paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, tối ưu tiếng Việt), re-embed 6 phòng vào `rooms.embedding`, truy vấn vector bằng toán tử Cosine `<=>`.
   - `forecasting.py`: RandomForestRegressor dự báo 3 tháng tiếp theo từ chuỗi thời gian 24 tháng, tính MAE trên tập kiểm thử.
   - `clustering.py`: KMeans(n_clusters=3) kết hợp PCA 2D và gán nhãn ngữ nghĩa (`STANDARD`, `FINANCIAL_RISK`, `SECURITY_RISK`).
5. **Dữ liệu Lịch sử & Minh chứng Thực nghiệm:**
   - `scripts/seed_history.py`: Sinh chuỗi 24 tháng hóa đơn nối chuỗi công tơ liên tục (2024-10 đến 2026-09) kèm mùa vụ và độ lệch hành vi.
   - `scripts/capture_evidence.py`: Tự động thu thập và xuất 11 file JSON minh chứng cho báo cáo tại `docs/evidence/backend/`.
   - `docs/api/openapi.json`: Xuất đặc tả OpenAPI 3.1 đầy đủ (64.4 KB).
   - `README.md` & `backend/README.md`: Hướng dẫn khởi chạy và vận hành chi tiết.

---

## 4. What We Tried & What FAILED (Do NOT Repeat)
- **Cạm bẫy Windows Event Loop với Psycopg Async:**
  - *Đã thử:* Chạy `pytest-asyncio` mặc định trên Windows với Python 3.12 (dùng `ProactorEventLoop`).
  - *Hậu quả:* Psycopg async pool ném lỗi `Psycopg cannot use the 'ProactorEventLoop' to run in async mode` hoặc treo vĩnh viễn (`PoolTimeout` sau 30 giây).
  - *Giải pháp đã chốt:* Trong `backend/tests/conftest.py`, bắt buộc cài đặt hook `pytest_asyncio_loop_factories` trả về `asyncio.SelectorEventLoop(selectors.SelectSelector())`. Đồng thời trong `app/config.py`, `app/db.py`, `app/main.py` đều áp dụng `asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())` khi chạy trên `win32`.
- **Cạm bẫy Gọi Stored Procedure có Tham số OUT trong Psycopg:**
  - *Đã thử:* Gọi `CALL sp_pay_student_utility_bill(%s, %s, %s, NULL, ...)` truyền tham số amount kiểu float/double.
  - *Hậu quả:* PostgreSQL báo lỗi `UndefinedFunction: procedure sp_pay_student_utility_bill(unknown, integer, double precision, ...) does not exist` vì PostgreSQL PL/pgSQL phân biệt nghiêm ngặt giữa `NUMERIC(12, 2)` và `double precision`.
  - *Giải pháp đã chốt:* Luôn ép kiểu tường minh trong SQL: `%s::numeric` tại `backend/app/services/billing.py:90`.
- **Cạm bẫy Lệnh `RAISE NOTICE` ngoài khối PL/pgSQL:**
  - *Đã thử:* Chạy `RAISE NOTICE` trực tiếp ở tầng file SQL `05_test_cases.sql`.
  - *Hậu quả:* Psql báo lỗi cú pháp `ERROR: syntax error at or near "RAISE"`.
  - *Giải pháp đã chốt:* Dùng lệnh psql `\echo` để in tiêu đề test case ra màn hình ngoài khối lệnh.

---

## 5. Key Decisions & Gotchas
- **Phân công Nhóm 3 Người:** Nhóm chính thức có 3 người (không phải 4):
  - TV1: Database Architect & PL/pgSQL Lead.
  - TV2: Backend API & AI Engine Lead (Đã hoàn thành 100%).
  - TV3: Frontend SaaS & Full Report Lead.
- **Nguồn Chuẩn (Single Source of Truth):** Đã đồng bộ `docs/specs/` và `CHOT_QUYET_DINH_KY_THUAT.md` khớp hoàn toàn với CSDL:
  - Giá điện lũy tiến 3 bậc: `2.000 / 2.500 / 3.000` VNĐ/kWh (các mốc 100/200 kWh).
  - Bảng mã SP1: `0 = SUCCESS`, `1 = NO_STUDENTS`, `2 = BILL_EXISTS`, `3 = INVALID_METERS`, `99 = SYSTEM_ERROR`.
  - Bảng `payment_transactions`: có cả `debt_id` và `bill_id`.
- **Benchmark Index:**
  - Bảng 1 triệu dòng log (~75 MB) nằm trọn trong RAM cache sau lần truy vấn đầu (`shared hit = 9346`).
  - Trong điều kiện RAM cache, `Parallel Seq Scan` chạy mất ~60ms; `Bitmap Index Scan` chạy mất ~3ms và giảm số khối đọc từ 9.346 xuống 3.839 buffers (tiết kiệm gần 60% I/O bộ nhớ). Báo cáo sử dụng trực tiếp số liệu đo thật này từ file `07_benchmark_seq_scan.json` và `08_benchmark_index_scan.json`.

---

## 6. Next Steps (Ordered Priority)
1. [ ] **Đẩy commit lên remote repo:**
   ```powershell
   git push origin main
   ```
2. [ ] **Bàn giao cho Thành viên 3 (Frontend & Báo cáo):**
   - Frontend React có thể gọi API trực tiếp theo đặc tả `docs/api/openapi.json` hoặc xem Swagger tại `http://localhost:8000/docs`.
   - Sử dụng 11 file JSON trong `docs/evidence/backend/` để chèn vào báo cáo đồ án 20 trang (`docs/Bao_Cao_BTL_KT221H.md` hoặc file Word của nhóm).
3. [ ] **Khởi động Backend khi cần demo:**
   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --port 8000
   ```

---

## 7. Suggested Skills for Next Session
- `frontend-design`: Khi Thành viên 3 bắt đầu làm giao diện React (Vite + Tailwind + shadcn/ui) cho Student Portal và Admin Portal.
- `viva-defense-prep`: Khi nhóm chuẩn bị tập dượt vấn đáp phản biện đồ án trước Hội đồng chấm thi CTU.
