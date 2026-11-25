# Backend API — Hệ thống Quản lý Ký túc xá Thông minh CTU

Backend REST API xây dựng bằng **FastAPI**, **psycopg 3 (Async Connection Pool)** và **scikit-learn** cho đồ án học phần **Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H)**.

## 1. Cài đặt môi trường
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env -ErrorAction SilentlyContinue
```

## 2. Chạy máy chủ Backend
```powershell
python run.py
```
- **API Endpoint:** `http://127.0.0.1:8000`
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`

## 3. Kiểm thử tự động
Đảm bảo CSDL `smart_dormitory_db` đang hoạt động trên cổng `5432`, sau đó chạy:
```powershell
# Chạy bộ kiểm thử tích hợp với Pytest
pytest -v

# Chạy kịch bản kiểm tra nhanh toàn bộ phân hệ (Auth, Hóa đơn, Tìm kiếm ngữ nghĩa, Dự báo, Phân cụm)
python -m scripts.smoke_check
```
