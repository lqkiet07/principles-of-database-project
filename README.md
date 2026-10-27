# Hệ thống Quản lý Ký túc xá Thông minh & Thanh toán Điện nước
### *(Smart Dormitory Management & Campus Utility Billing System)*

- **Môn học:** Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H)
- **Đơn vị:** Khoa Công nghệ Thông tin & Truyền thông - Đại học Cần Thơ (CTU)
- **Học kỳ / Năm học:** Học kỳ I, Năm học 2026 - 2027

---

## 1. Thành viên Nhóm & Phân công Trách nhiệm (3 Thành viên)

| STT | Thành viên / Vai trò | Nhiệm vụ chính phụ trách |
|:---:|:---|:---|
| 1 | **Thành viên 1**<br>*(Database Architect & Indexing Lead)* | - Thiết kế DDL 10 bảng chuẩn hóa 3NF, tích hợp extension `pgvector(384)`.<br>- Cài đặt Bộ đôi Stored Procedure (`sp_generate_and_split_utility_bill` & `sp_pay_student_utility_bill`).<br>- Cài đặt 2 Triggers (bẫy gian lận số lùi và Audit Log lưu vết JSONB).<br>- Sinh 1.000.000 dòng log và đánh Composite B-Tree Index `(is_late, check_time)`. |
| 2 | **Thành viên 2**<br>*(Backend & AI Engine Lead)* | - Xây dựng Backend API FastAPI với `psycopg3` Async Connection Pool (21 endpoints).<br>- Tích hợp 3 mô hình AI: Semantic Search (Sentence-Transformers), Dự báo sản lượng điện (RandomForest), Phân cụm sinh viên (KMeans).<br>- Viết trọn bộ 55 automated test cases đạt 100% test coverage trên PostgreSQL thật.<br>- Phát triển công cụ tự động xuất 11 bộ JSON minh chứng thực nghiệm cho báo cáo. |
| 3 | **Thành viên 3**<br>*(Frontend SaaS & Report Lead)* | - Phát triển giao diện Web chuẩn SaaS (React + Vite + Tailwind CSS + shadcn/ui).<br>- Xây dựng 2 không gian làm việc: **Sinh viên** và **Quản lý KTX** kèm công cụ **Role Switcher** và **Demo Checkpoints** cho hội đồng chấm thi.<br>- Tích hợp biểu đồ trực quan hóa dữ liệu (Recharts).<br>- Tổng hợp và chắp bút toàn bộ báo cáo đồ án 20 trang theo chuẩn barem CT221H và thiết kế slide thuyết trình. |

---

## 2. Công nghệ Cốt lõi & Kiến trúc

```text
Frontend (React 18 + Vite + Tailwind CSS + shadcn/ui)
           │ HTTP RESTful API (JSON Envelope)
           ▼
Backend (Python 3.12 + FastAPI + psycopg3 Async Pool + Scikit-learn + Sentence-Transformers)
           │ TCP 5432 (pgvector <=> Cosine, Stored Procedures, JSONB)
           ▼
Database (PostgreSQL 16 with pgvector extension) in Docker Compose
```

---

## 3. Hướng dẫn Khởi chạy Nhanh

### Bước 1: Khởi động CSDL PostgreSQL (Docker)
```powershell
docker compose up -d
docker compose ps
```
PostgreSQL sẽ tự động khởi tạo 10 bảng, 2 Stored Procedures và 2 Triggers.

### Bước 2: Khởi động Backend API
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- **Tài liệu API Swagger UI:** `http://localhost:8000/docs`
- **Kiểm tra trạng thái:** `http://localhost:8000/health`

### Bước 3: Chạy Kiểm thử Tự động (55 Test Cases)
```powershell
cd backend
pytest -v
```

### Bước 4: Xuất Minh chứng Thực nghiệm
```powershell
cd backend
python -m scripts.capture_evidence
```
Toàn bộ 11 file JSON minh chứng cho 5 tiêu chí chấm thi sẽ được xuất vào `docs/evidence/backend/`.

---

## 4. Cấu trúc Thư mục Dự án

```text
project/
├── docker-compose.yml              # Khởi chạy PostgreSQL 16 pgvector + pgAdmin 4
├── CHOT_QUYET_DINH_KY_THUAT.md     # Tài liệu quyết định kiến trúc & phân công 3 thành viên
├── database/                       # TẦNG CSDL (10 BẢNG + PL/PGSQL)
│   ├── 01_schema.sql               # DDL 10 bảng, ràng buộc 3NF, pgvector
│   ├── 02_procedures.sql           # Bộ đôi Stored Procedures (ACID, FOR UPDATE, bù dư)
│   ├── 03_triggers.sql             # Triggers bẫy gian lận & Audit log JSONB
│   ├── 04_seed_1m_logs.sql         # Nạp 1.000.000 log quẹt thẻ + Composite Index
│   └── 05_test_cases.sql           # 6 test cases chuẩn chấm thi
├── backend/                        # TẦNG BACKEND & AI ENGINE (PYTHON FASTAPI)
│   ├── app/                        # Routers, Services, Schemas, AI Models
│   ├── scripts/                    # Script nạp 24 tháng lịch sử & capture evidence
│   ├── tests/                      # 55 automated tests (pytest)
│   ├── requirements.txt            # Thư viện Python
│   └── README.md                   # Hướng dẫn chi tiết phân hệ Backend
├── docs/                           # TÀI LIỆU & MINH CHỨNG
│   ├── api/openapi.json            # Đặc tả OpenAPI chuẩn của toàn bộ hệ thống
│   ├── evidence/backend/           # 11 bộ JSON minh chứng thực nghiệm
│   ├── plans/                      # Kế hoạch thi công chi tiết
│   └── specs/                      # Đặc tả kỹ thuật hệ thống chính thức
└── frontend/                       # WEB UI SAAS (REACT + VITE + SHADCN/UI)
```
