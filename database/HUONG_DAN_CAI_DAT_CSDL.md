# Hướng dẫn cài đặt và nhập Cơ sở dữ liệu PostgreSQL — Hệ thống Quản lý KTX CTU

## 1. Yêu cầu môi trường
- **PostgreSQL 16 trở lên** (đã kiểm thử ổn định trên PostgreSQL 18, extension `pg_trgm`)
- **pgAdmin 4** (tùy chọn, nếu thao tác bằng giao diện đồ họa)
- **Python 3.11+** (nếu dùng **Cách 2** để sinh dữ liệu lớn `50.000` sinh viên & `2.000.000` lượt ra vào)

> Mặc định trong các script bên dưới dùng thông tin kết nối cục bộ:
> - Host / Port: `localhost:5432`
> - Superuser: `postgres` / mật khẩu `postgres123`
> - Tên CSDL: `smart_dormitory_db`
> - Tài khoản ứng dụng (Least Privilege): `ktx_app_user` / mật khẩu `KtxApp@2026`

---

## 2. Tạo Database trống trước khi nhập (áp dụng cho cả 2 cách)

Mở **PowerShell** hoặc **pgAdmin 4 Query Tool** (kết nối bằng user `postgres`) và chạy:

```sql
CREATE DATABASE smart_dormitory_db
    WITH ENCODING = 'UTF8';
```

Hoặc chạy nhanh bằng dòng lệnh (`psql`):

```powershell
& "D:\Application\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -c "CREATE DATABASE smart_dormitory_db WITH ENCODING 'UTF8';"
```

---

## 3. Cách 1 (Nhanh nhất): Phục hồi trực tiếp từ file Backup `.dump`

Cách này khôi phục toàn bộ bảng, `50.000+` sinh viên, `2.000.000+` lượt quét vân tay, View, Trigger, Procedure, Index và tài khoản liên kết ngân hàng chỉ trong một bước.

### 3.1. Bước 1 — Tạo trước Role phân quyền
Chạy file [`06_roles_security.sql`](06_roles_security.sql) (để tạo `ktx_admin_role` và `ktx_app_user` trước khi phục hồi quyền):

```powershell
& "D:\Application\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d smart_dormitory_db -v ON_ERROR_STOP=1 -f ".\database\06_roles_security.sql"
```

### 3.2. Bước 2 — Phục hồi file `.dump` mới nhất trong `database\backups\`

**Bằng PowerShell:**

```powershell
.\database\backup_restore.ps1 -Action restore -BackupFile ".\database\backups\<ten_file_backup_moi_nhat>.dump"
```

**Hoặc bằng pgAdmin 4 (giao diện):**
1. Chuột phải vào database **`smart_dormitory_db`** → chọn **`Restore...`**.
2. Ở mục **Format**, chọn **`Custom or tar`**.
3. Ở mục **Filename**, trỏ tới file `.dump` trong thư mục `database\backups\`.
4. Sang tab **Data/Objects** hoặc **Options** (nếu cần), bật **Pre-data / Data / Post-data** mặc định, bật **Clean before restore** và **No owner**, rồi bấm **Restore**.

> Sau khi Restore xong, chạy lại `06_roles_security.sql` một lần nữa để chắc chắn `ktx_app_user` có đủ quyền trên mọi bảng và hàm mới khôi phục.

---

## 4. Cách 2: Khởi tạo sạch hoàn toàn từ bộ script SQL (`01` → `12`)

### 4.1. Chạy tự động toàn bộ bằng `init_db.ps1` (khuyến nghị)

```powershell
.\database\init_db.ps1
```

Script [`init_db.ps1`](init_db.ps1) sẽ tự động chạy đúng thứ tự từ tạo lược đồ → View → Trigger → Stored Procedure → Index → Phân quyền → Sinh dữ liệu mẫu lớn (`07_seed_data.py`) → Nâng cấp thanh toán ngân hàng ACID → Dọn sạch bảng cũ → Chạy bộ kiểm thử CSDL (`08_test_db.sql`).

### 4.2. Chạy thủ công từng bước (qua `psql` hoặc pgAdmin 4 Query Tool)

Nếu muốn chạy tay từng file để quan sát kết quả từng phần, thực hiện đúng thứ tự sau trên database `smart_dormitory_db`:

| Thứ tự | File | Nội dung |
|---|---|---|
| 1 | [`01_schema.sql`](01_schema.sql) | Tạo bảng, khóa chính, khóa ngoại, `CHECK`, `UNIQUE`, kích hoạt `pg_trgm` |
| 2 | [`02_views.sql`](02_views.sql) | Tạo 5 View thống kê & báo cáo |
| 3 | [`03_triggers.sql`](03_triggers.sql) | Tạo các Trigger nghiệp vụ & Audit Log (`nhat_ky_du_lieu`) |
| 4 | [`04_procedures.sql`](04_procedures.sql) | Tạo Stored Procedure (`pr_*`) & Function (`sp_*`, `fn_*`) |
| 5 | [`05_indexes.sql`](05_indexes.sql) | Tạo chỉ mục B-Tree, Composite & GIN Trigram |
| 6 | [`06_roles_security.sql`](06_roles_security.sql) | Tạo `ktx_admin_role` & `ktx_app_user` (đặc quyền tối thiểu) |
| 7 | [`07_seed_data.py`](07_seed_data.py) | Sinh dữ liệu CTU: 48 phòng Khu A/B, 50.000 SV, 2.000.000 lượt ra vào |
| 8 | [`10_nang_cap_phan_quyen_canh_cao_thanh_toan.sql`](10_nang_cap_phan_quyen_canh_cao_thanh_toan.sql) | Bổ sung phân quyền Khu A/B, cảnh cáo/thu hồi phòng, cổng vân tay, phiên QR |
| 9 | [`11_lien_ket_ngan_hang_acid.sql`](11_lien_ket_ngan_hang_acid.sql) | Bảng `tai_khoan_ngan_hang_sv`, `giao_dich_ngan_hang` & thủ tục ACID `sp_thanh_toan_ngan_hang_sandbox` / `pr_thanh_toan_ngan_hang` |
| 10 | [`12_don_sach_bang_cu_va_phan_quyen.sql`](12_don_sach_bang_cu_va_phan_quyen.sql) | Dọn bỏ các bảng thử nghiệm cũ và khóa lại quyền cho `ktx_app_user` |
| 11 | [`06_roles_security.sql`](06_roles_security.sql) | Cấp quyền chuẩn cuối cùng trên mọi bảng/sequence/routine |
| 12 | [`08_test_db.sql`](08_test_db.sql) | Kiểm thử tự động toàn bộ ràng buộc, trigger, procedure |

---

## 5. Cấu hình kết nối cho Backend FastAPI

Kiểm tra file `backend\.env` dùng đúng chuỗi kết nối của tài khoản ứng dụng (không dùng tài khoản superuser `postgres`):

```env
DATABASE_URL=postgresql://ktx_app_user:KtxApp%402026@localhost:5432/smart_dormitory_db
```

---

## 6. Chạy kịch bản Demo chấm điểm trước Giảng viên

Kịch bản [`09_kich_ban_demo_giang_vien.sql`](09_kich_ban_demo_giang_vien.sql) gói gọn 5 phần chứng minh thực tế trên PostgreSQL:
1. Stored Procedure có tham số `IN` / `OUT` (`CALL pr_thanh_toan_ngan_hang`)
2. Giao dịch ACID 2 chiều & tự động `ROLLBACK` khi gặp lỗi (`sp_thanh_toan_ngan_hang_sandbox`)
3. Trigger ghi Audit Log giá trị `OLD`/`NEW` & bẫy chặn sửa/xóa hóa đơn đã nộp, cấm xóa sinh viên
4. So sánh tốc độ `EXPLAIN ANALYZE` bật/tắt chỉ mục trên `50.000` sinh viên và `2.000.000` lượt ra vào
5. Chứng minh phân quyền tối thiểu `ktx_app_user` bị chặn khi thử `CREATE TABLE` / `DROP TABLE`

```powershell
& "D:\Application\PostgreSQL\18\bin\psql.exe" "postgresql://ktx_app_user:KtxApp%402026@localhost:5432/smart_dormitory_db" -v ON_ERROR_STOP=1 -f ".\database\09_kich_ban_demo_giang_vien.sql"
```

---

## 7. Tạo bản Backup mới nhất bất cứ lúc nào

```powershell
.\database\backup_restore.ps1 -Action backup
```
File `.dump` (Custom nén) và `.sql` (Plain SQL) sẽ được xuất vào thư mục `database\backups\`.
