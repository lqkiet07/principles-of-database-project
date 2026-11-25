# Hệ thống Quản lý Ký túc xá Thông minh — Trường Đại học Cần Thơ (CTU)

Đồ án cuối kỳ học phần **Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H)** — Nhóm **M02**  
Trường Công nghệ Thông tin và Truyền thông — Đại học Cần Thơ.

- **Giảng viên hướng dẫn:** TS. Cù Vĩnh Lộc
- **Sinh viên thực hiện:**
  - Nguyễn Thị Ngọc Trân — `B2303907`
  - Huỳnh Tấn Phúc — `B2303893`
  - Lê Quốc Kiệt — `B2303878`

---

## 1. Kiến trúc & Các thành phần kỹ thuật chính

Hệ thống được xây dựng theo kiến trúc 3 tầng (**Next.js 16 Frontend** – **FastAPI Python Backend** – **PostgreSQL 16/18**), tập trung đóng gói logic toàn vẹn dữ liệu trực tiếp tại tầng Hệ quản trị CSDL:

1. **Mô hình dữ liệu chuẩn hóa:** Lược đồ CSDL `smart_dormitory_db` gồm các bảng quan hệ quản lý khu/phòng ở, hồ sơ sinh viên, kỳ học, lưu trú, hợp đồng, chỉ số điện nước, hóa đơn, tài khoản ngân hàng liên kết (Sandbox), giao dịch thanh toán, điểm danh ra vào và nhật ký kiểm toán.
2. **Stored Procedure & Giao dịch ACID:**
   - Thủ tục `pr_thanh_toan_ngan_hang` (có tham số `IN` / `OUT`) và hàm giao dịch `sp_thanh_toan_ngan_hang_sandbox` sử dụng khóa dòng bi quan (`SELECT ... FOR UPDATE`), đảm bảo tính nguyên tử giữa trừ số dư tài khoản sinh viên, cộng quỹ thu KTX, cập nhật trạng thái hóa đơn `DA_NOP` và tự động `ROLLBACK` khi phát sinh lỗi.
3. **Trigger ràng buộc nghiệp vụ & Kiểm toán dữ liệu (Audit Trail):**
   - `trg_chan_sua_xoa_hoa_don_da_nop`: Ngăn chặn sửa đổi hoặc xóa hóa đơn đã thanh toán.
   - `trg_chan_xoa_sinh_vien`: Ngăn chặn xóa trực tiếp hồ sơ sinh viên khỏi CSDL.
   - `trg_kiem_tra_luu_tru` & `trg_cap_nhat_trang_thai_phong`: Kiểm tra sức chứa, giới tính phòng và đồng bộ trạng thái phòng tự động.
   - `trg_audit_hoa_don`, `trg_audit_don_gia`, `trg_audit_tk_ngan_hang_sv`: Tự động ghi nhận giá trị cũ (`OLD`) và mới (`NEW`) dạng `JSONB` vào bảng `nhat_ky_du_lieu`.
4. **Tối ưu hóa truy vấn dữ liệu lớn (Indexing):**
   - Tập dữ liệu thử nghiệm quy mô lớn: **50.000+ sinh viên** và **2.000.000+ bản ghi điểm danh ra vào** (`luot_ra_vao`).
   - Kết hợp chỉ mục **B-Tree Composite** (`idx_luot_ra_vao_mssv_loai_tg`, `idx_luot_ra_vao_loai_thoi_gian`) và **GIN Trigram** (`pg_trgm`) để tăng tốc truy vấn và giảm tải đọc I/O bộ đệm.
5. **Phân quyền CSDL theo nguyên tắc đặc quyền tối thiểu (Least Privilege):**
   - Tách biệt `ktx_admin_role` và tài khoản ứng dụng `ktx_app_user` (chỉ có quyền DML cần thiết, cấm DDL `CREATE`/`DROP`/`ALTER`, cấm `UPDATE`/`DELETE` trên bảng nhật ký `nhat_ky_du_lieu`).
6. **Mô đun học máy hỗ trợ quản trị:**
   - Tìm kiếm phòng theo ngữ nghĩa tiếng Việt (Cosine Similarity trên Vector Embeddings).
   - Dự báo sản lượng tiêu thụ điện nước 3 tháng tới (`RandomForestRegressor` - `scikit-learn`).
   - Phân nhóm hành vi sinh viên nội trú (`K-Means` kết hợp luật quản trị).

---

## 2. Cấu trúc thư mục nộp bài

```text
principles-of-database-project/
├── database/                                   # Toàn bộ mã nguồn SQL, dữ liệu mẫu & Backup CSDL
│   ├── 01_schema.sql                           # Định nghĩa bảng, PK, FK, CHECK, UNIQUE & pg_trgm
│   ├── 02_views.sql                            # Các View tổng hợp thống kê KTX
│   ├── 03_triggers.sql                         # Trigger nghiệp vụ & Trigger ghi nhật ký JSONB
│   ├── 04_procedures.sql                       # Các Stored Procedure & Function nghiệp vụ
│   ├── 05_indexes.sql                          # Chỉ mục B-Tree Composite & GIN Trigram
│   ├── 06_roles_security.sql                   # Phân quyền ktx_admin_role & ktx_app_user
│   ├── 07_seed_data.py                         # Script sinh 50.000 SV & 2.000.000 lượt ra vào
│   ├── 08_test_db.sql                          # Script kiểm thử tự động ràng buộc, Trigger, ACID
│   ├── 09_kich_ban_demo_giang_vien.sql         # Kịch bản 5 phần demo trực tiếp trên PostgreSQL
│   ├── 10_nang_cap_phan_quyen_canh_cao_thanh_toan.sql
│   ├── 11_lien_ket_ngan_hang_acid.sql          # Liên kết ngân hàng Sandbox & pr_thanh_toan_ngan_hang
│   ├── 12_don_sach_bang_cu_va_phan_quyen.sql   # Khóa phân quyền cuối cùng
│   ├── init_db.ps1                             # Script PowerShell khởi tạo tự động toàn bộ CSDL
│   ├── backup_restore.ps1                      # Script sao lưu / phục hồi CSDL
│   ├── HUONG_DAN_CAI_DAT_CSDL.md               # Hướng dẫn chi tiết khôi phục CSDL cho Giảng viên
│   └── backups/                                # Chứa bản backup nén (.dump) đầy đủ 2M bản ghi
├── backend/                                    # Backend REST API (FastAPI + psycopg3 + scikit-learn)
│   ├── app/                                    # Routers, kết nối CSDL bất đồng bộ, xác thực JWT & AI
│   ├── scripts/smoke_check.py                  # Kiểm tra nhanh toàn bộ API và kết nối CSDL
│   ├── tests/test_system_e2e.py                # Bộ kiểm thử tích hợp tự động (Pytest)
│   ├── requirements.txt                        # Thư viện Python cần cài đặt
│   └── run.py                                  # Điểm chạy máy chủ Backend (cổng 8000)
├── frontend/                                   # Ứng dụng Web (Next.js 16 + React 19 + Tailwind CSS)
│   ├── src/app/admin/                          # Phân hệ Quản trị KTX (Tổng quan, Phòng, Hóa đơn, Điểm danh...)
│   ├── src/app/student/                        # Cổng thông tin Sinh viên nội trú & Thanh toán VietQR
│   └── package.json                            # Khai báo thư viện Frontend
├── docs/
│   ├── api/openapi.json                        # Đặc tả OpenAPI 3.1.0 của toàn bộ REST API
│   └── diagrams/                               # File gốc sơ đồ Draw.io (ERD & Sequence Diagram)
└── docker-compose.yml                          # Cấu hình khởi chạy nhanh PostgreSQL & pgAdmin 4
```

---

## 3. Hướng dẫn cài đặt và chạy chương trình

### Bước 1: Khởi tạo Cơ sở dữ liệu PostgreSQL (`smart_dormitory_db`)
Xem hướng dẫn chi tiết tại [`database/HUONG_DAN_CAI_DAT_CSDL.md`](database/HUONG_DAN_CAI_DAT_CSDL.md). Tóm tắt cách nhanh nhất từ bản sao lưu `.dump` (đã có sẵn 50.000 SV & 2.000.000 lượt ra vào):

```powershell
# 1. Tạo database trống (nếu chưa có)
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE smart_dormitory_db WITH ENCODING 'UTF8';"

# 2. Tạo role phân quyền ktx_admin_role và ktx_app_user
psql -h localhost -p 5432 -U postgres -d smart_dormitory_db -v ON_ERROR_STOP=1 -f .\database\06_roles_security.sql

# 3. Phục hồi dữ liệu từ file .dump trong thư mục database\backups\
.\database\backup_restore.ps1 -Action restore -BackupFile ".\database\backups\smart_dormitory_db_20261123_213222.dump"

# 4. Chạy lại phân quyền để đảm bảo ktx_app_user áp dụng chuẩn quyền tối thiểu
psql -h localhost -p 5432 -U postgres -d smart_dormitory_db -v ON_ERROR_STOP=1 -f .\database\06_roles_security.sql
```
*(Hoặc chạy `.\database\init_db.ps1` nếu muốn tạo mới từ đầu bằng các file SQL `01` → `12`).*

### Bước 2: Cài đặt và chạy Backend FastAPI (Cổng `8000`)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Tạo file cấu hình .env từ mẫu (mặc định kết nối bằng ktx_app_user)
Copy-Item .env.example .env -ErrorAction SilentlyContinue

# Khởi chạy Backend
python run.py
```
- Tài liệu API trực quan (Swagger UI): `http://127.0.0.1:8000/docs`
- Kiểm tra kết nối CSDL & thủ tục: `http://127.0.0.1:8000/health`

### Bước 3: Cài đặt và chạy Frontend Next.js (Cổng `3000`)
Mở một cửa sổ PowerShell mới:
```powershell
cd frontend
npm install
npm run dev
```
Truy cập ứng dụng tại: **`http://localhost:3000`**

---

## 4. Danh sách tài khoản đăng nhập thử nghiệm

| Vai trò | Tên đăng nhập | Mật khẩu | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Quản trị hệ thống (Toàn KTX)** | `admin` | `Admin@123` | Toàn quyền Khu A & Khu B, cấu hình hệ thống |
| **Quản lý Khu A** | `ql_khu_a` | `KhuA@123` | Lê Văn Hùng — Chỉ quản lý dữ liệu thuộc Khu A |
| **Quản lý Khu B** | `ql_khu_b` | `KhuB@123` | Nguyễn Thị Mai — Chỉ quản lý dữ liệu thuộc Khu B |
| **Sinh viên nội trú (Đã nộp phí)** | `B2100001` | `Ktx@123` | Nguyễn Văn An — Phòng A101 |
| **Sinh viên nội trú (Còn hóa đơn chưa nộp)** | `B2100017` | `Ktx@123` | Hồ Hoàng Toàn — Phòng A103 (dùng demo thanh toán ACID) |
| **Tài khoản CSDL ứng dụng (pgAdmin/psql)** | `ktx_app_user` | `KtxApp@2026` | Kiểm thử phân quyền Least Privilege |

---

## 5. Chạy kịch bản kiểm thử & Demo cho Giảng viên

- **Chạy kịch bản SQL 5 phần trực tiếp trên PostgreSQL:**
  ```powershell
  psql "postgresql://ktx_app_user:KtxApp%402026@localhost:5432/smart_dormitory_db" -v ON_ERROR_STOP=1 -f .\database\09_kich_ban_demo_giang_vien.sql
  ```
- **Chạy kiểm thử tự động Backend (Pytest & Smoke Check):**
  ```powershell
  cd backend
  pytest -v
  python -m scripts.smoke_check
  ```
