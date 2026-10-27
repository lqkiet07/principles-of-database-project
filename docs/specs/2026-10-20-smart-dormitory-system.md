# TÀI LIỆU ĐẶC TẢ KỸ THUẬT HỆ THỐNG (SYSTEM SPECIFICATION)
## Đề tài: Hệ thống Quản lý Ký túc xá Thông minh & Thanh toán Điện nước
### *(Smart Dormitory Management & Campus Utility Billing System)*

- **Môn học:** Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H)
- **Đơn vị:** Khoa Công nghệ Thông tin & Truyền thông - Đại học Cần Thơ (CTU)
- **Ngày lập:** 20/10/2026
- **Phiên bản:** 2.0 (Dual-SP Split-Debt Architecture & ACID Concurrency Specification)

---

## 1. MỤC TIÊU & TỔNG QUAN HỆ THỐNG

### 1.1. Bối cảnh thực tế (Problem Statement)
Công tác quản lý ký túc xá (KTX) sinh viên tại trường đại học gặp nhiều thách thức đặc thù về mặt quản trị cơ sở dữ liệu và toàn vẹn dữ liệu tài chính:
1. **Rủi ro toàn vẹn dữ liệu tài chính & Tranh chấp đồng thời (Concurrency & Double-Spending):** Sinh viên thanh toán tiền điện nước qua ví điện tử nội bộ. Trong thực tế, khi mạng chậm hoặc người dùng sốt ruột bấm nút "Thanh toán" liên tục nhiều lần (Double-click), nếu thiếu cơ chế khóa dòng bi quan (`SELECT ... FOR UPDATE`), hệ thống sẽ gặp lỗi trừ tiền ví nhiều lần cho cùng một khoản nợ hoặc xảy ra Lost Update. Ngoài ra, việc hóa đơn điện nước phát hành theo phòng nhưng sinh viên nộp tiền theo cá nhân đòi hỏi cơ chế phân bổ nợ minh bạch và cập nhật trạng thái cha-con đồng nhất.
2. **Gian lận và sai lệch chỉ số tiêu thụ:** Cán bộ quản lý nhập chỉ số điện nước thủ công dễ xảy ra sai sót (chỉ số tháng mới nhỏ hơn chỉ số tháng cũ) hoặc cố tình sửa chữa số liệu tiêu thụ mà không để lại vết kiểm toán phục vụ thanh tra kế toán.
3. **Thách thức hiệu năng trên tập dữ liệu lớn:** Lịch sử sinh viên quẹt thẻ ra vào cổng KTX tích lũy hàng triệu bản ghi sau nhiều học kỳ. Các câu truy vấn rà soát sinh viên vi phạm giờ giới nghiêm ban đêm bị suy giảm hiệu năng nghiêm trọng (Full Table Scan) nếu thiếu chiến lược lập chỉ mục (Indexing) tối ưu.
4. **Nhu cầu thông minh hóa:** Sinh viên cần tìm phòng theo nhu cầu ngữ nghĩa tự nhiên thay vì lọc mã khô khan; ban quản trị cần dự báo sản lượng điện tiêu thụ tháng tới và phân cụm sinh viên theo hành vi để kịp thời hỗ trợ.

### 1.2. Giải pháp kỹ thuật (Solution Overview)
Hệ thống kết hợp sức mạnh của Hệ quản trị CSDL quan hệ hiện đại cùng tầng ứng dụng đa năng:
- **Tầng CSDL (Core RDBMS):** Sử dụng **PostgreSQL 16** tích hợp extension **`pgvector`**, cấu trúc chuẩn hóa gồm **10 bảng**. Toàn bộ nghiệp vụ tính tiền điện nước lũy tiến, chia nợ cá nhân, trừ tiền ví sinh viên và gạch nợ hóa đơn phòng được đóng gói tuyệt đối vào **Bộ đôi Stored Procedure (`sp_generate_and_split_utility_bill` & `sp_pay_student_utility_bill`)**, Transaction ACID có khóa dòng `FOR UPDATE`, và các Trigger kiểm toán / chống gian lận viết bằng PL/pgSQL.
- **Tầng Xử lý AI & Backend API:** Xây dựng bằng **Python (FastAPI)**, thực thi 3 bài toán: Tìm kiếm ngữ nghĩa (Semantic Search qua khoảng cách vector Cosine `<=>`), Dự báo sản lượng điện tiêu thụ (Forecasting qua hồi quy) và Phân cụm sinh viên theo hành vi (K-Means Clustering).
- **Tầng Giao diện Người dùng (Frontend):** Ứng dụng Web theo phong cách SaaS hiện đại xây dựng bằng **React (Vite) + Tailwind CSS + shadcn/ui**, cung cấp 2 không gian làm việc chuyên biệt cho Sinh viên và Quản lý KTX.
- **Môi trường Triển khai:** Đóng gói bằng **Docker Compose** (`pgvector/pgvector:pg16` kết hợp pgAdmin 4), đảm bảo tính tái lập và kiểm thử tức thì chỉ với một lệnh.

---

## 2. PHÂN QUYỀN & TÁC NHÂN HỆ THỐNG (ACTORS & ROLES)

Hệ thống được thiết kế với 2 nhóm người dùng chính và 1 vai trò kiểm thử chuyên biệt:

1. **Sinh viên KTX (`STUDENT`):**
   - Tra cứu phòng trống bằng ngôn ngữ tự nhiên (AI Semantic Search).
   - Quản lý Ví sinh viên (Campus Wallet): xem số dư khả dụng, nạp tiền kiểm thử.
   - Tra cứu công nợ điện nước cá nhân (`student_utility_debts`) và tiến độ đóng tiền chung của phòng (`utility_bills`).
   - Nộp tiền điện nước cá nhân qua Stored Procedure `sp_pay_student_utility_bill` có bảo vệ ACID chống trừ tiền trùng lặp.
   - Xem biên lai giao dịch và lịch sử quẹt thẻ ra vào cổng cá nhân.

2. **Quản trị viên / Cán bộ KTX (`ADMIN`):**
   - Quản lý danh mục tòa nhà, phòng ở và phân bổ giường cho sinh viên.
   - Chốt chỉ số điện/nước hàng tháng và phát hành hóa đơn tự động thông qua Stored Procedure `sp_generate_and_split_utility_bill` (tự động tính bậc thang và chia đều nợ cho các sinh viên đang lưu trú).
   - Chỉnh sửa chỉ số công tơ điện nước (chịu sự giám sát nghiêm ngặt của Trigger Audit Log và Trigger bẫy số lùi).
   - Tra cứu nhật ký thanh tra (Audit Trail) lưu dưới dạng JSONB.
   - Quản trị an ninh cổng ra vào trên tập dữ liệu lớn (1.000.000 dòng log), thực nghiệm bật/tắt B-Tree Composite Index và phân tích Execution Plan.
   - Xem bảng điều khiển AI: Biểu đồ dự báo phụ tải điện và Bản đồ phân cụm rủi ro sinh viên.

3. **Hội đồng Giảng viên chấm thi (`EVALUATOR`):**
   - Sử dụng công cụ **Role Switcher** trực tiếp trên thanh điều hướng để chuyển đổi qua lại giữa Sinh viên và Quản trị viên mà không cần đăng xuất.
   - Truy cập khu vực **Demo Checkpoints** để bấm chạy trực quan các kịch bản kiểm thử:
     - Gọi `sp_generate_and_split_utility_bill` chia nợ tự động theo đầu người.
     - Gọi `sp_pay_student_utility_bill` thanh toán thành công và cập nhật trạng thái cha-con.
     - Thao tác thanh toán đồng thời (Concurrent Race Condition / Double-Click) chứng minh `FOR UPDATE` khóa an toàn.
     - Kịch bản Rollback khi ví thiếu tiền (`INSUFFICIENT_FUNDS`).
     - Trigger chặn số điện lùi và bảo vệ hóa đơn đã `'PAID'`.
     - So sánh thời gian truy vấn Seq Scan vs Index Scan trên 1 triệu dòng log quẹt thẻ.

---

## 3. DANH MỤC PHÂN RÃ CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 3.1. Phân hệ Sinh viên (Student Portal)

| Mã chức năng | Tên chức năng | Mô tả nghiệp vụ | Tầng xử lý kỹ thuật |
| :--- | :--- | :--- | :--- |
| **ST-01** | **Tìm phòng thông minh bằng AI** | Sinh viên nhập văn bản mô tả tự nhiên nhu cầu (ví dụ: *"Phòng nam tầng 3 thoáng mát có ban công gần căng-tin"*). Hệ thống trả về danh sách phòng còn trống có độ tương đồng ngữ nghĩa cao nhất. | FastAPI nhúng model `all-MiniLM-L6-v2` $\rightarrow$ SQL trên PostgreSQL dùng toán tử `<=>` với cột `rooms.embedding`. |
| **ST-02** | **Xem thông tin lưu trú hiện tại** | Xem tòa nhà, số phòng, số giường, danh sách bạn cùng phòng và thời hạn hợp đồng lưu trú. | Truy vấn `room_assignments` JOIN `rooms`, `dorm_buildings`, `students`. |
| **ST-03** | **Tra cứu hóa đơn & công nợ cá nhân** | Xem chi tiết chỉ số điện nước của phòng, tổng tiền hóa đơn, phần công nợ được chia riêng cho cá nhân trong tháng (`student_utility_debts`), số tiền đã trả và trạng thái (`'UNPAID'` / `'PAID'`). | Truy vấn `student_utility_debts` JOIN `utility_bills` theo `student_id`. |
| **ST-04** | **Quản lý Ví sinh viên (Campus Wallet)** | Xem số dư ví hiện tại. Hỗ trợ nút nạp tiền ảo (500k, 1000k, 2000k) phục vụ kịch bản kiểm thử thanh toán. | Đọc và ghi nhận giao dịch nạp vào `student_wallets`. |
| **ST-05** | **Thanh toán nợ điện nước cá nhân (ACID)** | Nhập số tiền nộp cho khoản nợ cá nhân $\rightarrow$ Bấm thanh toán. Hệ thống kiểm tra số dư ví, trừ tiền ví, gạch nợ cá nhân, đồng bộ lên hóa đơn phòng và xuất mã biên lai duy nhất. | **Gọi Stored Procedure `sp_pay_student_utility_bill`**. Thực thi trong Transaction có khóa dòng bi quan `FOR UPDATE`. |
| **ST-06** | **Tra cứu lịch sử biên lai giao dịch** | Xem danh sách các biên lai nộp tiền thành công kèm mã tham chiếu duy nhất (`reference_code`) và mốc thời gian chi tiết. | Truy vấn bảng `payment_transactions` theo `student_id`. |
| **ST-07** | **Lịch sử ra vào cổng cá nhân** | Xem thống kê số lần ra/vào KTX và số lần bị ghi nhận vi phạm giờ giới nghiêm sau 23:00. | Truy vấn bảng `dorm_access_logs` theo `student_id`. |

### 3.2. Phân hệ Quản trị KTX (Admin Portal)

| Mã chức năng | Tên chức năng | Mô tả nghiệp vụ | Tầng xử lý kỹ thuật |
| :--- | :--- | :--- | :--- |
| **AD-01** | **Bảng điều khiển Tổng quan (Dashboard)** | Thống kê số lượng tòa nhà, tỷ lệ lấp đầy phòng (sức chứa vs thực tế), tổng công nợ điện nước chưa thu, tổng điện năng tiêu thụ toàn KTX. | Các truy vấn tổng hợp `COUNT`, `SUM`, `AVG` trên `rooms`, `utility_bills`, `student_utility_debts`. |
| **AD-02** | **Quản lý Phòng & Xếp chỗ ở** | Quản lý danh mục phòng theo tòa nhà, cập nhật đơn giá cơ bản, phân bổ giường cho sinh viên và tự động đồng bộ số người đang ở (`current_occupancy`). | Thao tác trên `rooms`, `room_assignments`. |
| **AD-03** | **Chốt chỉ số & Tự động chia nợ theo đầu người** | Cán bộ KTX nhập chỉ số điện nước cuối kỳ của phòng. Hệ thống tự động tính lũy tiến, lập hóa đơn phòng và chia đều công nợ cho toàn bộ sinh viên đang ở (`is_active = TRUE`). | **Gọi Stored Procedure `sp_generate_and_split_utility_bill`**. Sinh đồng thời bản ghi trong `utility_bills` và `student_utility_debts`. |
| **AD-04** | **Điều chỉnh chỉ số & Bẫy lỗi gian lận** | Quản lý có thể điều chỉnh lại chỉ số điện/nước khi có sai sót.<br>- **Bẫy 1:** Cố tình nhập số mới nhỏ hơn số cũ $\rightarrow$ Hệ thống chặn đứng giao dịch và ném thông báo lỗi.<br>- **Bẫy 2:** Cố tình sửa hóa đơn đã tất toán (`'PAID'`) $\rightarrow$ Bị chặn sửa đổi. | **Kích hoạt Trigger `trg_validate_utility_meter_fraud`** (`BEFORE UPDATE`). |
| **AD-05** | **Xem Nhật ký Thanh tra (Audit Trail)** | Màn hình dành riêng cho ban thanh tra: Hiển thị danh sách các lần can thiệp chỉ số công tơ, xem chi tiết giá trị cũ (`old_data`) và giá trị mới (`new_data`) được định dạng JSON đẹp mắt. | Truy vấn bảng `audit_logs` được sinh tự động từ **Trigger `trg_audit_utility_meter_update`**. |
| **AD-06** | **Thực nghiệm Index trên 1.000.000 log quẹt thẻ** | - Lọc danh sách sinh viên về muộn sau 23h trong quý.<br>- Cho phép gạt công tắc **"Bật / Tắt Index"** để trực tiếp so sánh thời gian thực thi (từ ~1.8s xuống < 10ms).<br>- Hiển thị kết quả `EXPLAIN (ANALYZE, BUFFERS)` trực quan. | Truy vấn bảng `dorm_access_logs` (1M dòng). So sánh `Seq Scan` vs `Index Scan`. |
| **AD-07** | **AI Dự báo Sản lượng Điện (Forecasting)** | Xem biểu đồ trực quan hóa dữ liệu tiêu thụ điện quá khứ kèm đường dự báo tổng kWh tiêu thụ của từng tòa nhà trong tháng tiếp theo. | FastAPI chạy mô hình hồi quy Scikit-learn từ dữ liệu chuỗi thời gian của `utility_bills`. |
| **AD-08** | **AI Phân cụm Hành vi Sinh viên (Clustering)** | Biểu đồ phân tán (Scatter Plot) hiển thị kết quả phân nhóm sinh viên thành 3 cụm hành vi (Gương mẫu, Nguy cơ nợ tiền, Vi phạm nội quy) để cán bộ KTX có biện pháp hỗ trợ/nhắc nhở. | FastAPI chạy thuật toán K-Means Clustering trên ma trận đặc trưng `[late_count, unpaid_ratio, avg_power]`. |

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU CỐT LÕI (SCHEMA CONTRACT)

### 4.1. Sơ đồ Quan hệ Thực thể (ERD Logical Diagram - 10 Bảng)

Hệ thống được chuẩn hóa chặt chẽ theo dạng chuẩn 3NF bao gồm **đúng 10 bảng**, thể hiện mối quan hệ giữa cơ sở vật chất, sinh viên, tài chính phân bổ nợ cá nhân, nhật ký an ninh và kiểm toán:

```text
[dorm_buildings] 1 ──< [rooms] 1 ──< [room_assignments] >── 1 [students]
                          │                                         │ │
                          │ 1                         ┌─────────────┘ │ 1
                          ▼ n                         ▼ n             ▼ 1
                   [utility_bills] 1 ──< [student_utility_debts]   [student_wallets]
                          │                           │               │
                          │ 1                         │ 1             │ 1
                          ▼ n                         ▼ n             ▼ n
                   [payment_transactions] <───────────┴───────────────┘
                          │
                   [dorm_access_logs] (1.000.000+ bản ghi để benchmark Index)
                   [audit_logs] (Nhật ký thanh tra lưu vết Trigger dạng JSONB)
```

**Mối quan hệ nghiệp vụ chính:**
- Mỗi **Tòa nhà (`dorm_buildings`)** có nhiều **Phòng (`rooms`)**.
- Mỗi **Phòng (`rooms`)** có nhiều **Hợp đồng lưu trú (`room_assignments`)** liên kết với từng **Sinh viên (`students`)**.
- Mỗi **Sinh viên (`students`)** sở hữu duy nhất một **Ví điện tử (`student_wallets`)**.
- Mỗi tháng, mỗi **Phòng (`rooms`)** được phát hành một **Hóa đơn điện nước tổng (`utility_bills`)**.
- Từ hóa đơn phòng, hệ thống tự động chẻ thành các **Khoản nợ cá nhân (`student_utility_debts`)** cho từng sinh viên đang ở trong phòng đó.
- Mỗi lần sinh viên trích tiền từ ví để trả nợ cá nhân sẽ sinh ra một **Biên lai giao dịch tài chính (`payment_transactions`)**.
- Bảng **`dorm_access_logs`** ghi nhận lịch sử ra vào cổng độc lập quy mô lớn phục vụ tối ưu hóa truy vấn Index.
- Bảng **`audit_logs`** lưu vết toàn bộ can thiệp thay đổi số liệu kế toán tự động qua Trigger.

---

### 4.2. Từ điển Dữ liệu Chi tiết 10 Bảng (Data Dictionary)

#### Bảng 1: `dorm_buildings` (Tòa nhà KTX)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `building_id` | `VARCHAR(10)` | PRIMARY KEY | Mã tòa nhà (VD: `'B1'`, `'B2'`) |
| `building_name` | `VARCHAR(100)` | NOT NULL | Tên tòa nhà (VD: `'Tòa B1 - Nam'`) |
| `gender_zone` | `VARCHAR(10)` | NOT NULL, CHECK (`gender_zone IN ('MALE', 'FEMALE', 'MIXED')`) | Khu vực nam/nữ |
| `total_floors` | `INT` | NOT NULL, CHECK (`total_floors > 0`) | Tổng số tầng của tòa nhà |

#### Bảng 2: `rooms` (Phòng ở)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `room_id` | `SERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `building_id` | `VARCHAR(10)` | NOT NULL, REFERENCES `dorm_buildings(building_id)` | Khóa ngoại tới tòa nhà |
| `room_number` | `VARCHAR(20)` | NOT NULL, UNIQUE | Số phòng định danh (VD: `'B1-304'`) |
| `capacity` | `INT` | NOT NULL DEFAULT 4, CHECK (`capacity > 0`) | Sức chứa tối đa (số giường) |
| `current_occupancy` | `INT` | NOT NULL DEFAULT 0, CHECK (`current_occupancy <= capacity`) | Số lượng sinh viên thực tế đang ở |
| `base_price` | `NUMERIC(12, 2)` | NOT NULL CHECK (`base_price >= 0`) | Đơn giá phòng cơ bản/tháng (VNĐ) |
| `description` | `TEXT` | NULL | Mô tả tiện ích bằng văn bản tự nhiên |
| `embedding` | `vector(384)` | NULL | Vector embedding 384 chiều phục vụ AI Search |
| `status` | `VARCHAR(20)` | NOT NULL DEFAULT `'AVAILABLE'`, CHECK (`status IN ('AVAILABLE', 'FULL', 'MAINTENANCE')`) | Trạng thái phòng |

#### Bảng 3: `students` (Sinh viên)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `student_id` | `VARCHAR(20)` | PRIMARY KEY | Mã số sinh viên (VD: `'B2100001'`) |
| `full_name` | `VARCHAR(100)` | NOT NULL | Họ và tên sinh viên |
| `email` | `VARCHAR(100)` | NOT NULL, UNIQUE | Địa chỉ email sinh viên |
| `phone` | `VARCHAR(15)` | NULL | Số điện thoại liên hệ |
| `major` | `VARCHAR(50)` | NULL | Ngành đào tạo (VD: `'Kỹ thuật Phần mềm'`) |
| `status` | `VARCHAR(20)` | NOT NULL DEFAULT `'ACTIVE'`, CHECK (`status IN ('ACTIVE', 'GRADUATED', 'SUSPENDED')`) | Trạng thái sinh viên |

#### Bảng 4: `student_wallets` (Ví sinh viên)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `wallet_id` | `SERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `student_id` | `VARCHAR(20)` | NOT NULL, UNIQUE, REFERENCES `students(student_id)` ON DELETE CASCADE | Khóa ngoại 1-1 với sinh viên |
| `balance` | `NUMERIC(12, 2)` | NOT NULL DEFAULT 0.00, CHECK (`balance >= 0`) | Số dư ví (Bảo vệ không bị âm số dư) |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm cập nhật số dư cuối cùng |

#### Bảng 5: `room_assignments` (Hợp đồng lưu trú)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `assignment_id` | `SERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `room_id` | `INT` | NOT NULL, REFERENCES `rooms(room_id)` | Khóa ngoại tới phòng |
| `student_id` | `VARCHAR(20)` | NOT NULL, REFERENCES `students(student_id)` | Khóa ngoại tới sinh viên |
| `bed_number` | `INT` | NOT NULL, CHECK (`bed_number > 0`) | Vị trí giường số mấy |
| `start_date` | `DATE` | NOT NULL | Ngày bắt đầu vào ở |
| `end_date` | `DATE` | NULL | Ngày kết thúc hợp đồng lưu trú |
| `is_active` | `BOOLEAN` | NOT NULL DEFAULT TRUE | Trạng thái còn đang cư trú hay đã chuyển đi |

*Ràng buộc duy nhất có điều kiện:* Mỗi giường trong phòng tại một thời điểm chỉ có 1 sinh viên cư trú (`UNIQUE (room_id, bed_number) WHERE is_active = TRUE`).

#### Bảng 6: `utility_bills` (Hóa đơn tiền phòng & Điện nước tổng)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `bill_id` | `SERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `room_id` | `INT` | NOT NULL, REFERENCES `rooms(room_id)` | Khóa ngoại tới phòng |
| `month_year` | `VARCHAR(7)` | NOT NULL | Tháng phát hành (Định dạng `'YYYY-MM'`) |
| `prev_electric` | `INT` | NOT NULL, CHECK (`prev_electric >= 0`) | Chỉ số điện đầu kỳ (kWh) |
| `curr_electric` | `INT` | NOT NULL, CHECK (`curr_electric >= 0`) | Chỉ số điện cuối kỳ (kWh) |
| `prev_water` | `INT` | NOT NULL, CHECK (`prev_water >= 0`) | Chỉ số nước đầu kỳ ($m^3$) |
| `curr_water` | `INT` | NOT NULL, CHECK (`curr_water >= 0`) | Chỉ số nước cuối kỳ ($m^3$) |
| `total_amount` | `NUMERIC(12, 2)` | NOT NULL, CHECK (`total_amount >= 0`) | Tổng số tiền điện nước của cả phòng (VNĐ) |
| `paid_amount` | `NUMERIC(12, 2)` | NOT NULL DEFAULT 0.00, CHECK (`paid_amount >= 0`) | Tổng số tiền phòng đã thanh toán (VNĐ) |
| `bill_status` | `VARCHAR(20)` | NOT NULL DEFAULT `'UNPAID'`, CHECK (`bill_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')`) | Trạng thái thanh toán của hóa đơn |

*Ràng buộc duy nhất:* Mỗi phòng chỉ có duy nhất 1 hóa đơn trong 1 kỳ tháng (`UNIQUE (room_id, month_year)`).

#### Bảng 7: `student_utility_debts` (Công nợ điện nước chia nhỏ cho từng sinh viên)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `debt_id` | `SERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `bill_id` | `INT` | NOT NULL, REFERENCES `utility_bills(bill_id)` ON DELETE CASCADE | Khóa ngoại tới hóa đơn phòng |
| `student_id` | `VARCHAR(20)` | NOT NULL, REFERENCES `students(student_id)` | Khóa ngoại tới sinh viên chịu trách nhiệm nợ |
| `assigned_amount` | `NUMERIC(12, 2)` | NOT NULL, CHECK (`assigned_amount >= 0`) | Số tiền cá nhân được chia đều phải nộp (VNĐ) |
| `paid_amount` | `NUMERIC(12, 2)` | NOT NULL DEFAULT 0.00, CHECK (`paid_amount >= 0`) | Số tiền cá nhân này đã nộp thực tế (VNĐ) |
| `debt_status` | `VARCHAR(20)` | NOT NULL DEFAULT `'UNPAID'`, CHECK (`debt_status IN ('UNPAID', 'PAID')`) | Trạng thái công nợ cá nhân |

*Ràng buộc toàn vẹn:* `CONSTRAINT unique_student_bill UNIQUE (bill_id, student_id)` — Đảm bảo mỗi sinh viên chỉ nhận đúng 1 định mức công nợ cho mỗi kỳ hóa đơn phòng.

#### Bảng 8: `payment_transactions` (Lịch sử thanh toán tài chính)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `tx_id` | `SERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `bill_id` | `INT` | NOT NULL, REFERENCES `utility_bills(bill_id)` | Hóa đơn phòng được gạch nợ |
| `student_id` | `VARCHAR(20)` | NOT NULL, REFERENCES `students(student_id)` | Sinh viên thực hiện giao dịch nộp tiền |
| `amount` | `NUMERIC(12, 2)` | NOT NULL, CHECK (`amount > 0`) | Số tiền nộp trong giao dịch này (VNĐ) |
| `tx_time` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm giao dịch phát sinh |
| `reference_code` | `VARCHAR(50)` | NOT NULL, UNIQUE | Mã biên lai giao dịch duy nhất |
| `status` | `VARCHAR(20)` | NOT NULL DEFAULT `'SUCCESS'`, CHECK (`status IN ('SUCCESS', 'FAILED')`) | Trạng thái giao dịch |

#### Bảng 9: `audit_logs` (Nhật ký kiểm toán hệ thống - Bẫy Trigger)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `log_id` | `BIGSERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `table_name` | `VARCHAR(50)` | NOT NULL | Tên bảng bị can thiệp (`utility_bills`) |
| `action_type` | `VARCHAR(10)` | NOT NULL | Loại hành vi (`'INSERT'`, `'UPDATE'`, `'DELETE'`) |
| `record_id` | `VARCHAR(50)` | NOT NULL | Định danh khóa chính của dòng bị can thiệp |
| `old_data` | `JSONB` | NULL | Toàn bộ dữ liệu trước khi sửa định dạng JSON |
| `new_data` | `JSONB` | NULL | Toàn bộ dữ liệu sau khi sửa định dạng JSON |
| `changed_by` | `VARCHAR(100)` | NOT NULL DEFAULT SESSION_USER | Tài khoản CSDL thực hiện thao tác |
| `changed_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL DEFAULT CURRENT_TIMESTAMP | Thời điểm can thiệp |
| `reason` | `TEXT` | NULL | Ghi chú giải trình lý do can thiệp |

#### Bảng 10: `dorm_access_logs` (Lịch sử quẹt thẻ cổng KTX - 1.000.000 dòng)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `log_id` | `BIGSERIAL` | PRIMARY KEY | Khóa chính tự tăng |
| `student_id` | `VARCHAR(20)` | NOT NULL, REFERENCES `students(student_id)` | Mã số sinh viên quẹt thẻ |
| `gate_name` | `VARCHAR(50)` | NOT NULL | Tên cổng quẹt thẻ (`'Cổng Chính'`, `'Cổng Phụ B'`) |
| `check_time` | `TIMESTAMP WITHOUT TIME ZONE` | NOT NULL | Thời điểm quẹt thẻ ghi nhận từ đầu đọc |
| `is_late` | `BOOLEAN` | NOT NULL DEFAULT FALSE | Cờ đánh dấu về muộn sau 23:00 |

---

## 5. ĐẶC TẢ HỢP ĐỒNG 5 TIÊU CHÍ KỸ THUẬT (EVALUATION CONTRACTS)

### 5.1. Tiêu chí 1: Bộ Đôi Stored Procedure Nghiệp vụ Điện nước (Dual Stored Procedures)

Thay vì chỉ có một thủ tục đơn lẻ, kiến trúc hệ thống triển khai bộ đôi Stored Procedure chuẩn hóa để giải quyết trọn vẹn chu trình phát hành - phân bổ - thu hồi công nợ trong CSDL:

#### Stored Procedure 1: `sp_generate_and_split_utility_bill`
- **Mục tiêu:** Tự động hóa hoàn toàn nghiệp vụ chốt số điện nước cuối kỳ của cán bộ quản lý: tính tiền điện lũy tiến bậc thang, tính tiền nước, đếm số sinh viên đang ở trong phòng (`is_active = TRUE`), chia đều số tiền phải nộp và khởi tạo công nợ cá nhân tương ứng.
- **Đặc tả tham số:**
  ```text
  IN  p_room_id        INT            : Mã định danh phòng ở
  IN  p_month_year     VARCHAR(7)     : Kỳ hóa đơn dạng chuỗi 'YYYY-MM'
  IN  p_prev_elec      INT            : Chỉ số công tơ điện đầu kỳ (kWh)
  IN  p_curr_elec      INT            : Chỉ số công tơ điện cuối kỳ (kWh)
  IN  p_prev_water     INT            : Chỉ số đồng hồ nước đầu kỳ (m3)
  IN  p_curr_water     INT            : Chỉ số đồng hồ nước cuối kỳ (m3)
  OUT p_total_amount   NUMERIC(12, 2) : Tổng tiền điện nước của cả phòng
  OUT p_split_amount   NUMERIC(12, 2) : Số tiền phân bổ cho từng sinh viên
  OUT p_student_count  INT            : Số sinh viên đang ở nhận định mức nợ
  OUT p_status_code    INT            : Mã trạng thái thực thi (0, 1, 2, 3, 4, 99)
  OUT p_message        VARCHAR(255)   : Thông điệp phản hồi bằng tiếng Việt
  ```
- **Bảng mã trạng thái đầu ra (Status Codes):**
  - `0`: Thành công (`SUCCESS`). Lập hóa đơn và chia nợ thành công.
  - `1`: Chỉ số đo không hợp lệ (`INVALID_METERS` - chỉ số mới nhỏ hơn chỉ số cũ).
  - `2`: Hóa đơn tháng của phòng này đã được phát hành trước đó (`BILL_ALREADY_EXISTS`).
  - `3`: Phòng không tồn tại trong hệ thống (`ROOM_NOT_FOUND`).
  - `4`: Phòng hiện không có sinh viên nào lưu trú hợp lệ (`NO_ACTIVE_STUDENTS`).
  - `99`: Lỗi hệ thống bất ngờ (`SYSTEM_ERROR`).
- **Quy trình xử lý nghiệp vụ (Execution Logic):**
  1. Kiểm tra tham số đầu vào: nếu `p_curr_elec < p_prev_elec` hoặc `p_curr_water < p_prev_water` $\rightarrow$ gán `p_status_code = 1`, trả về thông báo lỗi chỉ số.
  2. Kiểm tra trùng lặp: nếu đã tồn tại bản ghi trong `utility_bills` với `room_id = p_room_id` và `month_year = p_month_year` $\rightarrow$ gán `p_status_code = 2`, dừng thủ tục.
  3. Tính toán sản lượng tiêu thụ:
     $$\Delta E = p\_curr\_elec - p\_prev\_elec \quad (\text{kWh})$$
     $$\Delta W = p\_curr\_water - p\_prev\_water \quad (\text{m}^3)$$
  4. Tính tiền điện theo biểu giá bậc thang 3 mức:
     - Mức 1 (0 – 50 kWh): 1.800 VNĐ/kWh.
     - Mức 2 (51 – 100 kWh): 2.100 VNĐ/kWh.
     - Mức 3 (trên 100 kWh): 2.600 VNĐ/kWh.
  5. Tính tiền nước: Đơn giá cố định 10.000 VNĐ/$\text{m}^3$.
  6. Tổng tiền toàn phòng: $Total = Cost_{Electric} + Cost_{Water}$.
  7. Xác định số lượng sinh viên đang lưu trú hợp lệ trong phòng:
     ```sql
     SELECT COUNT(*) INTO v_student_count 
     FROM room_assignments 
     WHERE room_id = p_room_id AND is_active = TRUE;
     ```
     Nếu $v\_student\_count = 0 \rightarrow$ gán `p_status_code = 4`, dừng thủ tục.
  8. Tính tiền phân bổ đều cho mỗi sinh viên:
     $$p\_split\_amount = \text{ROUND}(Total / v\_student\_count, 2)$$
  9. Thao tác ghi CSDL trong Transaction:
     - Thêm bản ghi mới vào `utility_bills` với trạng thái `'UNPAID'` và `paid_amount = 0.00`, lấy về `bill_id`.
     - Chạy vòng lặp duyệt qua danh sách sinh viên đang lưu trú (`is_active = TRUE`), thêm bản ghi tương ứng vào bảng `student_utility_debts` với `assigned_amount = p_split_amount`, `paid_amount = 0.00`, `debt_status = 'UNPAID'`.
  10. Trả về `p_status_code = 0`, gán các giá trị `p_total_amount`, `p_split_amount`, `p_student_count` và kết thúc.

---

#### Stored Procedure 2: `sp_pay_student_utility_bill`
- **Mục tiêu:** Sinh viên thanh toán khoản nợ cá nhân của mình bằng số dư ví. Đảm bảo tính toán trừ tiền, gạch nợ cá nhân, đồng bộ dồn tiền lên hóa đơn phòng và kiểm tra trạng thái tất toán toàn phòng diễn ra hoàn toàn nguyên tử (Atomic).
- **Đặc tả tham số:**
  ```text
  IN  p_student_id        VARCHAR(20)    : Mã sinh viên thực hiện nộp tiền
  IN  p_debt_id           INT            : Mã khoản nợ cá nhân cần thanh toán
  IN  p_pay_amount        NUMERIC(12, 2) : Số tiền nộp trong lượt này
  OUT p_status_code       INT            : Mã trạng thái (0 -> 4, 99)
  OUT p_tx_code           VARCHAR(50)    : Mã biên lai thanh toán tự sinh
  OUT p_remaining_balance NUMERIC(12, 2) : Số dư ví còn lại sau khi trừ
  OUT p_remaining_debt    NUMERIC(12, 2) : Số nợ cá nhân còn lại sau thanh toán
  OUT p_message           VARCHAR(255)   : Thông báo chi tiết bằng tiếng Việt
  ```
- **Bảng mã trạng thái đầu ra (Status Codes):**
  - `0`: Nộp tiền thành công (`SUCCESS`).
  - `1`: Khoản nợ không tồn tại hoặc không thuộc sinh viên này (`DEBT_NOT_FOUND`).
  - `2`: Khoản nợ này đã được thanh toán hoàn tất trước đó (`DEBT_ALREADY_PAID`).
  - `3`: Số tiền nộp không hợp lệ hoặc vượt quá số nợ còn lại (`AMOUNT_EXCEEDS_DEBT`).
  - `4`: Số dư ví sinh viên không đủ để thanh toán (`INSUFFICIENT_FUNDS`).
  - `99`: Lỗi hệ thống bất ngờ (`ERROR`).
- **Quy trình xử lý nghiệp vụ & Khóa đồng thời (Execution Logic):**
  1. **Khóa dòng ví sinh viên (Pessimistic Lock):**
     ```sql
     SELECT balance INTO v_wallet_balance 
     FROM student_wallets 
     WHERE student_id = p_student_id 
     FOR UPDATE;
     ```
     Nếu không tìm thấy ví $\rightarrow$ gán `p_status_code = 99`, báo lỗi ví không tồn tại.
  2. **Khóa dòng công nợ cá nhân:**
     ```sql
     SELECT bill_id, assigned_amount, paid_amount, debt_status 
     INTO v_bill_id, v_assigned_amt, v_paid_amt, v_debt_status
     FROM student_utility_debts 
     WHERE debt_id = p_debt_id AND student_id = p_student_id 
     FOR UPDATE;
     ```
     Nếu không tìm thấy $\rightarrow$ gán `p_status_code = 1` (`DEBT_NOT_FOUND`), dừng.
  3. **Kiểm tra trạng thái nợ:** Nếu `v_debt_status = 'PAID'` hoặc `v_paid_amt >= v_assigned_amt` $\rightarrow$ gán `p_status_code = 2` (`DEBT_ALREADY_PAID`), dừng.
  4. **Kiểm tra định mức thanh toán:** Tính $v\_remaining = v\_assigned\_amt - v\_paid\_amt$. Nếu `p_pay_amount <= 0` hoặc `p_pay_amount > v_remaining` $\rightarrow$ gán `p_status_code = 3` (`AMOUNT_EXCEEDS_DEBT`), dừng.
  5. **Kiểm tra số dư khả dụng:** Nếu `v_wallet_balance < p_pay_amount` $\rightarrow$ gán `p_status_code = 4` (`INSUFFICIENT_FUNDS`), dừng.
  6. **Cập nhật số dư ví:**
     ```sql
     UPDATE student_wallets 
     SET balance = balance - p_pay_amount, 
         updated_at = CURRENT_TIMESTAMP 
     WHERE student_id = p_student_id;
     ```
  7. **Cập nhật công nợ cá nhân:**
     ```sql
     UPDATE student_utility_debts 
     SET paid_amount = paid_amount + p_pay_amount,
         debt_status = CASE WHEN paid_amount + p_pay_amount >= assigned_amount 
                            THEN 'PAID' ELSE 'UNPAID' END
     WHERE debt_id = p_debt_id;
     ```
  8. **Khóa và cập nhật hóa đơn phòng cha (`utility_bills`):**
     ```sql
     SELECT paid_amount, total_amount INTO v_bill_paid, v_bill_total
     FROM utility_bills 
     WHERE bill_id = v_bill_id 
     FOR UPDATE;

     UPDATE utility_bills 
     SET paid_amount = paid_amount + p_pay_amount 
     WHERE bill_id = v_bill_id;
     ```
  9. **Đồng bộ trạng thái hóa đơn phòng:**
     ```sql
     IF NOT EXISTS (
         SELECT 1 FROM student_utility_debts 
         WHERE bill_id = v_bill_id AND debt_status <> 'PAID'
     ) THEN
         UPDATE utility_bills SET bill_status = 'PAID' WHERE bill_id = v_bill_id;
     ELSE
         UPDATE utility_bills SET bill_status = 'PARTIALLY_PAID' WHERE bill_id = v_bill_id;
     END IF;
     ```
  10. **Ghi vết lịch sử thanh toán:** Tự sinh mã biên lai định dạng `'TX-YYYYMMDDHH24MISS-XXXX'` và chèn vào bảng `payment_transactions` với trạng thái `'SUCCESS'`.
  11. **Gán giá trị đầu ra:** Trả về `p_status_code = 0`, mã giao dịch, số dư ví mới và nợ còn lại.

---

### 5.2. Tiêu chí 2: Quản trị Giao dịch & Chống Tranh chấp Đồng thời (Transaction & ACID)

#### Cơ chế Khóa dòng bi quan (`SELECT ... FOR UPDATE`)
Mức cô lập mặc định của PostgreSQL là `READ COMMITTED`. Trong môi trường mạng, các rủi ro race condition cực kỳ phổ biến:

1. **Ngăn chặn Double-Spending (Click đúp / Mạng lag):**
   - **Tình huống:** Sinh viên có số dư ví 200.000 VNĐ, nợ cá nhân là 150.000 VNĐ. Sinh viên bấm nút "Thanh toán" 2 lần liên tiếp nhanh chóng, phát sinh 2 Transaction đồng thời ($T_1$ và $T_2$) gửi về CSDL.
   - **Hậu quả nếu KHÔNG có `FOR UPDATE`:**
     - Cả $T_1$ và $T_2$ cùng đọc `balance = 200.000` và `debt = 150.000`.
     - Cả 2 đều kiểm tra thấy $200.000 \ge 150.000$ (hợp lệ).
     - Cả 2 cùng thực hiện trừ $150.000$ VNĐ. Số dư ví bị trừ thành $-100.000$ VNĐ (vi phạm ràng buộc `CHECK (balance >= 0)` làm sập app), hoặc khoản nợ 150.000 VNĐ bị trừ 2 lần gây thất thoát tài chính nghiêm trọng cho sinh viên.
   - **Giải pháp xử lý với `SELECT ... FOR UPDATE`:**
     - $T_1$ thực thi `SELECT balance FROM student_wallets WHERE student_id = ... FOR UPDATE` $\rightarrow$ DBMS cấp Exclusive Row-Level Lock trên dòng ví của sinh viên cho $T_1$. Đồng thời, $T_1$ lấy khóa trên bản ghi `student_utility_debts`.
     - $T_2$ tới sau yêu cầu khóa cùng dòng ví/khoản nợ $\rightarrow$ DBMS tự động đưa $T_2$ vào trạng thái **Chờ khóa (Lock Wait)**.
     - $T_1$ thực hiện trừ tiền ví (còn 50.000 VNĐ), gạch nợ thành `'PAID'`, thực hiện `COMMIT` và giải phóng khóa.
     - $T_2$ được đánh thức, đọc dữ liệu mới nhất đã được commit:
       - $T_2$ đọc `debt_status = 'PAID'` (hoặc số nợ còn lại $= 0$).
       - Nhánh kiểm tra logic trong SP lập tức phát hiện khoản nợ đã trả xong $\rightarrow$ gán `p_status_code = 2` (`DEBT_ALREADY_PAID`), không trừ tiền ví lần 2.
       - Giao dịch kết thúc an toàn, số dư ví bảo toàn chính xác 50.000 VNĐ.

2. **Chống Lost Update khi nhiều bạn cùng phòng nộp tiền đồng thời:**
   - Khi 4 sinh viên trong cùng một phòng cùng bấm nộp nợ cá nhân tại cùng một thời điểm:
     - Các dòng `student_wallets` và `student_utility_debts` của 4 người là độc lập $\rightarrow$ thực thi song song không bị nghẽn.
     - Tuy nhiên, tại bước dồn tiền vào dòng cha `utility_bills`, câu lệnh `SELECT ... FROM utility_bills WHERE bill_id = ... FOR UPDATE` buộc 4 transaction phải xếp hàng tuần tự để cập nhật `paid_amount`.
     - Đảm bảo `paid_amount` tổng của phòng bằng đúng tổng các khoản nộp cá nhân cộng lại, loại bỏ 100% hiện tượng ghi đè làm mất tiền (Lost Update).

#### Kịch bản kiểm thử Rollback (Minh chứng Atomicity)
- Giả lập trường hợp sinh viên có số dư ví 50.000 VNĐ nhưng gọi SP thanh toán khoản nợ 150.000 VNĐ.
- Sau bước khóa dòng, điều kiện `v_wallet_balance < p_pay_amount` trả về `TRUE`.
- Thủ tục gán `p_status_code = 4` (`INSUFFICIENT_FUNDS`), hủy bỏ mọi thao tác ghi dở dang và thoát an toàn.
- **Minh chứng kiểm tra:** Số dư ví giữ nguyên 50.000 VNĐ, công nợ giữ nguyên 150.000 VNĐ, không có bản ghi rác nào trong `payment_transactions`.

---

### 5.3. Tiêu chí 3: Trigger Bẫy lỗi & Nhật ký Kiểm toán (Audit Log)

1. **Trigger 1 (Ghi vết kiểm toán tự động): `trg_audit_utility_meter_update`**
   - *Thời điểm kích hoạt:* `AFTER UPDATE ON utility_bills`.
   - *Điều kiện kích hoạt:* Khi chỉ số điện mới khác chỉ số điện cũ (`OLD.curr_electric <> NEW.curr_electric`) HOẶC chỉ số nước mới khác chỉ số nước cũ (`OLD.curr_water <> NEW.curr_water`).
   - *Cơ chế xử lý:* Sử dụng hàm `to_jsonb(OLD)` và `to_jsonb(NEW)` để đóng gói toàn vẹn trạng thái trước và sau khi sửa đổi, lưu vào bảng `audit_logs` kèm định danh `SESSION_USER` và mốc thời gian thực tế `CURRENT_TIMESTAMP`.
   - *Giá trị kỹ thuật:* Cung cấp bằng chứng thanh tra bất biến, phục vụ đối soát khi có khiếu nại về tiền điện nước.

2. **Trigger 2 (Bẫy gian lận & Toàn vẹn kế toán): `trg_validate_utility_meter_fraud`**
   - *Thời điểm kích hoạt:* `BEFORE INSERT OR UPDATE ON utility_bills`.
   - *Quy tắc 1 (Chống số lùi):* Nếu `NEW.curr_electric < NEW.prev_electric` $\rightarrow$ Thực hiện `RAISE EXCEPTION` chặn đứng thao tác ghi với thông điệp: *"Lỗi gian lận: Chỉ số điện mới không được nhỏ hơn chỉ số cũ!"*.
   - *Quy tắc 2 (Chống số nước lùi):* Tương tự đối với chỉ số nước (`NEW.curr_water < NEW.prev_water`).
   - *Quy tắc 3 (Bảo vệ hóa đơn đã tất toán):* Nếu hóa đơn đang ở trạng thái `'PAID'` mà có hành động sửa đổi chỉ số công tơ $\rightarrow$ Thực hiện `RAISE EXCEPTION` ngăn chặn, bảo vệ nguyên tắc bất biến của chứng từ kế toán đã quyết toán.

---

### 5.4. Tiêu chí 4: Thực nghiệm Chỉ mục trên 1.000.000 bản ghi (Indexing)

- **Bảng dữ liệu thực nghiệm:** `dorm_access_logs`.
- **Phương pháp sinh dữ liệu mẫu:** Sử dụng hàm `generate_series(1, 1000000)` giả lập lịch sử quẹt thẻ trong 2 năm của sinh viên (sinh ngẫu nhiên thời gian, cổng, và tỉ lệ về muộn sau 23:00 chiếm khoảng 8-10%).
- **Câu truy vấn đo kiểm hiệu năng (Benchmark Query):**
  ```sql
  SELECT student_id, check_time, gate_name
  FROM dorm_access_logs
  WHERE is_late = TRUE 
    AND check_time >= '2026-09-01' AND check_time <= '2026-10-01';
  ```
- **Kế hoạch thực thi (Execution Plan) kỳ vọng:**
  - *Khi chưa có Index:* PostgreSQL buộc phải thực hiện `Seq Scan on dorm_access_logs`. Toàn bộ 1 triệu bản ghi trên hàng chục nghìn trang đĩa bộ nhớ phải được quét qua. Thời gian chạy thực tế: ~**1.5s - 2.5s**.
  - *Tạo Composite B-Tree Index:*
    ```sql
    CREATE INDEX idx_access_late_time ON dorm_access_logs (is_late, check_time);
    ```
  - *Sau khi có Index:* PostgreSQL chuyển đổi kế hoạch sang `Bitmap Index Scan` hoặc `Index Scan on idx_access_late_time`. Thời gian chạy thực tế giảm ngoạn mục xuống: **< 10 mili-giây** (Tốc độ tăng trưởng hơn 150 lần, chi phí đọc bộ nhớ đệm Buffers giảm > 98%).
  - Báo cáo kết quả trực tiếp bằng ảnh chụp `EXPLAIN (ANALYZE, BUFFERS)` đưa vào Chương 4 của báo cáo đồ án.

---

### 5.5. Tiêu chí 5: Tích hợp 3 Dạng Mô hình Trí tuệ Nhân tạo (AI Integration)

1. **Dạng 1: Semantic Search (Tìm kiếm phòng theo ngôn ngữ tự nhiên):**
   - *Mô hình nhúng:* `sentence-transformers/all-MiniLM-L6-v2` (Output: vector 384 chiều).
   - *Cơ chế lưu trữ:* Kiểu dữ liệu `vector(384)` của extension `pgvector` trên cột `rooms.embedding`.
   - *Cơ chế truy vấn:* Tính khoảng cách Cosine bằng toán tử `<=>` trực tiếp trong câu lệnh SQL:
     ```sql
     SELECT room_id, room_number, description, 
            (embedding <=> :query_vector) AS cosine_distance
     FROM rooms
     WHERE status = 'AVAILABLE'
     ORDER BY cosine_distance ASC
     LIMIT 5;
     ```
2. **Dạng 2: Forecasting (Dự báo sản lượng điện tiêu thụ tháng tiếp theo):**
   - *Dữ liệu đầu vào:* Chuỗi thời gian tổng sản lượng điện (kWh) tiêu thụ của từng tòa nhà trong 24 tháng gần nhất trích xuất từ bảng `utility_bills`.
   - *Thuật toán:* Mô hình hồi quy `LinearRegression` / `RandomForestRegressor` (Scikit-learn).
   - *Đầu ra:* Đường biểu đồ dự báo tổng kWh tiêu thụ cho tháng tiếp theo giúp Ban quản trị ký túc xá chủ động ngân sách vận hành.
3. **Dạng 3: Clustering (Phân cụm hành vi sinh viên):**
   - *Thuật toán:* `KMeans(n_clusters=3)` kết hợp chuẩn hóa dữ liệu `StandardScaler`.
   - *Không gian đặc trưng 3 chiều:*
     1. Tần suất vi phạm giờ giới nghiêm sau 23:00 (`late_count` từ `dorm_access_logs`).
     2. Tỷ lệ số tháng trễ hạn nộp tiền điện nước (`unpaid_ratio` từ `student_utility_debts`).
     3. Mức tiêu thụ điện bình quân của phòng sinh viên cư trú (`avg_power_kwh`).
   - *Phân loại hành vi trực quan:*
     - *Cụm 0 - Gương mẫu (Standard):* Không về muộn, thanh toán đúng hạn.
     - *Cụm 1 - Rủi ro tài chính (Financial Risk):* Thường xuyên nợ tiền điện nước kéo dài.
     - *Cụm 2 - Cảnh báo an ninh (Security Risk):* Tần suất về muộn giờ giới nghiêm cao.

---

## 6. KHUNG BÁO CÁO 20 TRANG & KỊCH BẢN VẤN ĐÁP (VIVA DEFENSE)

### 6.1. Bố cục Báo cáo 20 trang (Chuẩn Barem CT221H)
1. **Phần Mở đầu & Tổng quan Đề tài** (1 trang): Tính cấp thiết, mục tiêu giải quyết bài toán quản trị CSDL KTX thông minh.
2. **Chương 1: Khảo sát Bài toán & Thiết kế CSDL Quan hệ** (3 trang): Phân tích chuẩn hóa 3NF, Sơ đồ ERD 10 bảng, Từ điển dữ liệu chi tiết.
3. **Chương 2: Bộ Đôi Stored Procedure & Quản trị Giao dịch ACID** (4 trang): Cài đặt `sp_generate_and_split_utility_bill` và `sp_pay_student_utility_bill`, phân tích kỹ thuật khóa hàng `FOR UPDATE`, chứng minh ngăn chặn Double-Spending và Lost Update, kịch bản Rollback.
4. **Chương 3: Bẫy lỗi Toàn vẹn Dữ liệu & Kiểm toán bằng Trigger** (3 trang): Cài đặt Trigger bẫy số lùi, Trigger ghi vết JSONB vào `audit_logs`, ảnh chụp test case kiểm toán kế toán.
5. **Chương 4: Thực nghiệm Chỉ mục trên 1 Triệu Bản ghi** (4 trang): Kỹ thuật sinh 1M dữ liệu, truy vấn benchmark, ảnh chụp so sánh Execution Plan trước và sau khi đánh B-Tree Index.
6. **Chương 5: Ứng dụng Trí tuệ Nhân tạo trong Quản trị CSDL** (4 trang): Kiến trúc `pgvector` trong Semantic Search, kết quả dự báo sản lượng điện và biểu đồ phân cụm sinh viên K-Means.
7. **Kết luận & Hướng phát triển** (1 trang).

### 6.2. Dự phòng Câu hỏi Vấn đáp của Giảng viên (Viva Defense Prep)
- *Câu hỏi 1:* "Tại sao phải dùng `FOR UPDATE` trong Stored Procedure thanh toán? Nếu sinh viên click chuột 2 lần liên tiếp thì CSDL xử lý thế nào?"
  - *Đáp:* Khi sinh viên click đúp, 2 transaction đồng thời phát sinh. Nếu không có `FOR UPDATE`, cả 2 cùng đọc số dư và nợ cũ, cùng trừ tiền ví dẫn đến sinh viên bị trừ tiền 2 lần (Double-Spending) hoặc số dư ví bị âm. Khi có `FOR UPDATE`, transaction thứ nhất khóa độc quyền dòng ví và khoản nợ. Transaction thứ hai phải chờ (Lock Wait). Khi transaction 1 commit thành công, transaction 2 đọc lại dữ liệu đã commit, thấy trạng thái nợ đã là `'PAID'` nên lập tức trả về mã lỗi `DEBT_ALREADY_PAID` mà không trừ tiền ví lần thứ hai.
- *Câu hỏi 2:* "Tại sao hệ thống tách riêng bảng `utility_bills` và `student_utility_debts` mà không gộp chung?"
  - *Đáp:* Đây là thiết kế chuẩn hóa 3NF giải quyết bài toán: Chỉ số công tơ điện nước đo theo phòng (1 phòng chỉ có 1 công tơ), nhưng trách nhiệm nộp tiền thuộc về từng cá nhân sinh viên trong phòng đó. Nếu gộp chung, khi một sinh viên nộp tiền sẽ gây dị thường cập nhật (Update Anomaly) hoặc không theo dõi được sinh viên nào đã nộp, sinh viên nào còn nợ.
- *Câu hỏi 3:* "Tại sao bảng `audit_logs` lại dùng kiểu `JSONB` mà không tạo từng cột `old_electric`, `new_electric`?"
  - *Đáp:* `JSONB` là kiểu dữ liệu bán cấu trúc linh hoạt của PostgreSQL giúp 1 bảng Audit duy nhất có thể theo dõi được nhiều bảng khác nhau mà không cần sửa đổi schema mỗi khi thêm cột mới. Đồng thời, `JSONB` được lưu trữ dưới dạng nhị phân, hỗ trợ lập chỉ mục GIN và truy vấn thuộc tính bên trong với tốc độ tương đương cột quan hệ thông thường.
- *Câu hỏi 4:* "Tại sao đánh Composite Index lại chọn thứ tự `(is_late, check_time)` mà không phải ngược lại?"
  - *Đáp:* Vì điều kiện lọc `is_late = TRUE` là điều kiện so khớp chính xác (Equality), trong khi `check_time BETWEEN ...` là điều kiện khoảng (Range). Đặt cột Equality lên trước giúp cây B-Tree thu hẹp không gian tìm kiếm ngay lập tức ở mức nhánh đầu tiên, sau đó chỉ cần quét dải nhị phân của cột Range.

---

## 7. RANH GIỚI DỰ ÁN (OUT OF SCOPE)

Nhằm tối ưu hóa nguồn lực triển khai, tuân thủ nguyên lý thiết kế **YAGNI (You Aren't Gonna Need It)** và tránh sa đà vào các chức năng CRUD dư thừa không được đánh giá trong barem chấm điểm của môn học Hệ quản trị CSDL (CT221H), nhóm thống nhất xác định ranh giới phạm vi dự án như sau:

1. **Loại bỏ phân hệ Quản lý Sự cố Cơ sở vật chất & Sửa chữa thiết bị (Facility Maintenance & Repair Requests):**
   - *Lý do kỹ thuật & Học thuật:* Nghiệp vụ báo hỏng bóng đèn, sửa vòi nước chỉ thuần túy là các bảng dữ liệu đơn giản với các thao tác Thêm - Sửa - Xóa - Đổi trạng thái ("Chờ duyệt", "Đang sửa", "Hoàn thành"). Phân hệ này hoàn toàn là **CRUD Bloat**, không chứa đựng các thách thức kỹ thuật cốt lõi của môn học như Tranh chấp đồng thời (Concurrency Control), Giao dịch khóa bi quan (Pessimistic Locking), Tối ưu hóa truy vấn Index lớn hay Đại số quan hệ nâng cao. Việc đưa vào chỉ làm tăng chi phí bảo trì mã nguồn mà không đem lại giá trị học thuật hay điểm số cho đề tài.
2. **Loại bỏ quy trình Phê duyệt Hành chính Đa cấp (Administrative Approval Workflows):**
   - Các quy trình phức tạp như nộp đơn xin chuyển phòng, đơn xin hoãn đóng tiền KTX, đơn miễn giảm diện chính sách có sự tham gia phê duyệt nhiều cấp lãnh đạo được lược bỏ. Hệ thống tập trung giải quyết xuất sắc 5 trụ cột kỹ thuật: Bộ đôi Stored Procedure phân bổ & thanh toán nợ, Quản trị Giao dịch ACID chống Double-Spending, Trigger kiểm toán JSONB, Tối ưu hóa Index trên 1.000.000 bản ghi và Tích hợp 3 mô hình AI (pgvector & Scikit-learn).
3. **Không tích hợp Cổng thanh toán Trực tuyến bên thứ ba (VNPay / MoMo / ZaloPay API thật):**
   - Việc tích hợp Webhook/API ngân hàng thật đòi hỏi xác thực IP tĩnh, chứng thư bảo mật ngân hàng và sinh ra mã ngoài CSDL. Đề tài thay thế bằng giải pháp kiến trúc **Campus Wallet (Ví sinh viên nội bộ)** mô phỏng, cho phép tập trung 100% vào việc kiểm thử cơ chế Transaction, mức cô lập `READ COMMITTED`, và bẫy lỗi Rollback trong PostgreSQL.
4. **Không kết nối phần cứng công tơ IoT trực tiếp:**
   - Hệ thống không xử lý giao thức phần cứng MQTT/Modbus mà tập trung vào tầng lưu trữ dữ liệu chỉ số công tơ định kỳ do cán bộ KTX nhập hoặc import qua batch file.

---
*(Tài liệu này là căn cứ kỹ thuật chính thức và ràng buộc cao nhất để triển khai toàn bộ mã nguồn CSDL, API backend, Frontend và viết báo cáo đồ án).*
