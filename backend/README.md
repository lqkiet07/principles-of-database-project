# Smart Dormitory Backend API & AI Engine

Backend API cho Đề tài Bài tập lớn môn **Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H)** — Khoa CNTT&TT, Đại học Cần Thơ (CTU).

## 1. Yêu cầu môi trường
- Python 3.11+ (khuyến nghị 3.12)
- Docker Desktop (đang chạy container `smart_dorm_postgres` trên port 5432)

## 2. Khởi tạo môi trường ảo & cài đặt
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 3. Chạy Server Development
```powershell
uvicorn app.main:app --reload --port 8000
```
- **Swagger UI Interactive Docs:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/health`

## 4. Chạy Automated Tests (Pytest)
```powershell
# Chạy toàn bộ 54 test cases
pytest -v

# Chạy riêng từng module kiểm thử
pytest tests/test_billing.py -v       # SP1 test cases
pytest tests/test_payments.py -v      # SP2 & Concurrency lock tests
pytest tests/test_meters_audit.py -v  # Triggers & Audit log tests
pytest tests/test_benchmark.py -v     # Index Performance Benchmark
pytest tests/test_ai_search.py -v     # pgvector Semantic Search
pytest tests/test_ai_forecast.py -v   # Scikit-learn Forecasting
pytest tests/test_ai_clusters.py -v   # KMeans Clustering
```

## 5. Xuất Minh chứng Báo cáo (Evidence Artifacts)
Chạy script tự động thu thập và xuất 11 bộ dữ liệu kiểm chứng sang thư mục `docs/evidence/backend/`:
```powershell
python -m scripts.capture_evidence
```
Bộ minh chứng bao gồm:
1. `01_sp1_generate_bill.json`: Tính tiền điện lũy tiến 3 bậc và chia đều công nợ cho sinh viên.
2. `02_sp2_payment_success.json`: Trừ ví, gạch nợ cá nhân và đồng bộ hóa đơn phòng lên `PAID`.
3. `03_sp2_concurrency_race.json`: Chứng minh khóa `FOR UPDATE` chống trừ tiền 2 lần (Double-Spending).
4. `04_sp2_insufficient_funds_rollback.json`: Bẫy thiếu tiền ví (Code 4), bảo toàn số dư (Rollback).
5. `05_trigger_fraud_reversal.json`: Bẫy chỉ số lùi của trigger `trg_validate_utility_meter_fraud`.
6. `06_trigger_audit_log_jsonb.json`: Nhật ký kiểm toán lưu vết JSONB của `trg_audit_utility_meter_update`.
7. `07_benchmark_seq_scan.json`: Kế hoạch thực thi Parallel Seq Scan (9.346 buffers).
8. `08_benchmark_index_scan.json`: Kế hoạch thực thi Bitmap Index Scan (3.839 buffers).
9. `09_ai_semantic_search.json`: Tìm kiếm phòng bằng ngôn ngữ tự nhiên qua khoảng cách Cosine `<=>`.
10. `10_ai_forecasting_kwh.json`: Dự báo phụ tải điện 3 tháng tới bằng RandomForest.
11. `11_ai_student_clusters.json`: Phân cụm 3 nhóm hành vi sinh viên kết hợp tọa độ PCA 2D.
