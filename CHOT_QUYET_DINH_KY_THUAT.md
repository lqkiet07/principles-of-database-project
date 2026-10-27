# TÀI LIỆU CHỐT QUYẾT ĐỊNH KỸ THUẬT & PHÂN CÔNG ĐỒ ÁN NHÓM
## Đề tài: Hệ thống Quản lý Ký túc xá Thông minh & Thanh toán Điện nước
### *(Smart Dormitory Management & Campus Utility Billing System)*

- **Học phần:** Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H) - Khoa CNTT&TT, ĐH Cần Thơ (CTU)
- **Văn bản đặc tả chi tiết:** `docs/specs/2026-10-20-smart-dormitory-system.md`
- **Phiên bản:** 2.0 (Đồng bộ Kiến trúc 10 bảng, Dual Stored Procedure & Khóa dòng ACID)
- **Mục đích tài liệu:** Lưu hành nội bộ nhóm, thống nhất các quyết định kỹ thuật cốt lõi (ADR), chuẩn hóa kiến trúc dữ liệu và phân chia ranh giới công việc chi tiết giữa các thành viên.

---

## 1. NHẬT KÝ QUYẾT ĐỊNH KỸ THUẬT (ARCHITECTURE DECISION RECORDS - ADR)

### 📌 ADR-01: Lựa chọn Đề tài KTX (Thay vì Thương mại điện tử)
- **Vấn đề xem xét:** Có nên làm sàn thương mại điện tử (E-commerce / Shopee mini) như đa số các nhóm khác không?
- **Quyết định chốt:** Làm **Quản lý Ký túc xá thông minh & Thanh toán điện nước**.
- **Lý do cho nhóm:**
  1. *Trọng tâm môn học:* Môn này chỉ chấm tầng CSDL (Stored Procedure, Transaction ACID, Trigger kiểm toán, Indexing, AI tích hợp). Làm E-commerce tốn 70% công sức cho giỏ hàng, voucher, đơn vị vận chuyển nhưng phần CSDL chỉ là CRUD cơ bản.
  2. *Nghiệp vụ tài chính vừa vặn:* Nghiệp vụ trừ tiền ví sinh viên $\leftrightarrow$ gạch nợ hóa đơn phòng là bài toán Transaction ACID đối soát tài chính kinh điển, dễ kiểm soát deadlock và cô lập giao dịch.
  3. *Tâm lý hội đồng:* 60-70% các nhóm khác chọn bán hàng; đề tài KTX sát thực tế Đại học Cần Thơ (CTU), tạo ấn tượng tốt và dễ bảo vệ hơn khi vấn đáp.

---

### 📌 ADR-02: Lựa chọn Hệ quản trị CSDL PostgreSQL 16 + Extension `pgvector`
- **Vấn đề xem xét:** Chọn PostgreSQL hay Microsoft SQL Server?
- **Quyết định chốt:** Sử dụng **PostgreSQL 16+** có bật extension **`pgvector`**.
- **Lý do cho nhóm:**
  1. *100% Miễn phí & Mã nguồn mở:* Không bị giới hạn 10GB dung lượng hay 1.4GB RAM như bản SQL Server Express.
  2. *Vũ khí độc quyền cho AI:* Cột `embedding vector(384)` nằm trực tiếp trong bảng `rooms`. Tìm kiếm phòng bằng ngữ nghĩa (Semantic Search) bằng chính câu lệnh SQL với toán tử khoảng cách Cosine `<=>`.
  3. *Audit Log dạng JSONB:* Trigger tự động chụp `to_jsonb(OLD)` và `to_jsonb(NEW)` lưu vào một cột duy nhất, sạch sẽ và đúng chuẩn công nghiệp.
  4. *Phân tích Execution Plan trực quan:* Câu lệnh `EXPLAIN (ANALYZE, BUFFERS)` cung cấp đầy đủ thông số I/O, Cache hit, Execution Time để chụp ảnh minh chứng cho báo cáo.

---

### 📌 ADR-03: Triển khai CSDL Đồng nhất qua Docker Compose
- **Vấn đề xem xét:** Extension `pgvector` cài đặt thủ công trên Windows rất phức tạp và dễ phát sinh lỗi khác biệt môi trường giữa máy các thành viên.
- **Quyết định chốt:** Sử dụng **Docker Compose** với image chính thức `pgvector/pgvector:pg16` kết hợp pgAdmin 4.
- **Lý do cho nhóm:** Mọi thành viên chỉ cần cài Docker Desktop và gõ đúng 1 lệnh:
  ```bash
  docker compose up -d
  ```
  Là có ngay CSDL kèm pgvector và công cụ quản trị web pgAdmin chạy trong 10 giây, máy ai cũng giống hệt máy ai.

---

### 📌 ADR-04: Tech Stack Web & UI Hiện đại (Chuẩn SaaS)
- **Vấn đề xem xét:** Giao diện cần đẹp, trực quan, phục vụ giảng viên tương tác demo nhanh mà không bị cũ kĩ.
- **Quyết định chốt:**
  - **Frontend:** React (Vite) + Tailwind CSS + shadcn/ui + Recharts (Hỗ trợ Dark/Light mode, Toast thông báo thanh toán, Data Tables).
  - **Backend:** Python FastAPI (Bất đồng bộ, tích hợp sẵn Swagger UI tại `/docs`, kết nối PostgreSQL qua `psycopg3` và chạy các model AI).
  - **Chuyển đổi vai trò:** Có nút Role Switcher (Sinh viên $\leftrightarrow$ Quản lý KTX) và khu vực Demo Checkpoints để demo ngay trên một trình duyệt.

---

### 📌 ADR-05: Kiến trúc Chia tiền Điện nước Tự động (Room Split Billing) & Khóa Bi quan (Pessimistic Locking `SELECT ... FOR UPDATE`) chống lỗi Double-spending
- **Vấn đề xem xét:** Trong ký túc xá, chỉ số điện nước đo theo phòng (1 phòng chỉ có 1 công tơ điện và 1 đồng hồ nước), nhưng trách nhiệm đóng tiền thuộc về từng cá nhân sinh viên trong phòng. Nếu gộp chung một bảng hóa đơn phòng, hệ thống sẽ gặp các vấn đề nghiêm trọng:
  1. *Dị thường cập nhật (Update Anomaly):* Khi một bạn đóng trước phần của mình, bảng hóa đơn phòng không có nơi lưu vết sinh viên nào đã nộp, sinh viên nào còn nợ.
  2. *Lỗi Double-spending (Trừ tiền ví trùng lặp):* Mạng lag hoặc sinh viên sốt ruột bấm nút "Thanh toán" liên tiếp 2 lần (Double-click) sẽ kích hoạt 2 giao dịch đồng thời, trừ tiền ví 2 lần cho cùng một khoản nợ hoặc làm âm số dư ví.
  3. *Lỗi Lost Update (Ghi đè mất tiền):* Khi nhiều bạn trong cùng phòng cùng lúc nộp tiền, việc cập nhật số tiền đã thu của phòng dễ bị ghi đè dữ liệu nếu không có cơ chế khóa hàng.
- **Quyết định chốt:**
  1. **Chuẩn hóa kiến trúc 10 bảng:** Tách bạch rõ ràng giữa hóa đơn phòng tổng (`utility_bills`) và bảng công nợ phân bổ cá nhân (`student_utility_debts`).
  2. **Bộ đôi Stored Procedure nghiệp vụ (Dual SP Model):**
     - `sp_generate_and_split_utility_bill`: Cán bộ KTX chốt chỉ số công tơ $\rightarrow$ tính tiền điện lũy tiến 3 bậc thang $\rightarrow$ đếm số sinh viên đang ở (`is_active = TRUE`) $\rightarrow$ tự động chia đều nợ và chèn bản ghi vào `student_utility_debts`.
     - `sp_pay_student_utility_bill`: Sinh viên nộp tiền nợ cá nhân qua số dư ví $\rightarrow$ trừ tiền ví $\rightarrow$ gạch nợ cá nhân $\rightarrow$ dồn tiền cập nhật hóa đơn phòng cha (`PARTIALLY_PAID` / `PAID`) $\rightarrow$ xuất biên lai trong `payment_transactions`.
  3. **Khóa dòng bi quan (`SELECT ... FOR UPDATE`):**
     - Khóa độc quyền dòng ví (`student_wallets`) và dòng nợ cá nhân (`student_utility_debts`).
     - Yêu cầu thanh toán thứ hai phải chờ (Lock Wait). Khi giao dịch 1 commit xong, giao dịch 2 đọc lại trạng thái đã là `'PAID'` và thoát an toàn với mã `DEBT_ALREADY_PAID` (Code = 2).
     - Khóa dòng hóa đơn cha `utility_bills` bằng `FOR UPDATE` trước khi cộng dồn `paid_amount`, triệt tiêu hoàn toàn Lost Update giữa các bạn cùng phòng.
- **Lý do cho nhóm:**
  - *Đạt chuẩn 3NF tuyệt đối:* Tách bạch nghĩa vụ phòng và nghĩa vụ cá nhân.
  - *Bảo toàn toàn vẹn tài chính (ACID):* Ngăn chặn 100% rủi ro Double-spending và Lost Update mà không cần nâng mức cô lập lên `SERIALIZABLE` (vốn gây nghẽn hiệu năng).
  - *Lợi thế điểm số tối đa:* Cung cấp kịch bản thực nghiệm Transaction và Concurrency Control đắt giá, gây ấn tượng mạnh với hội đồng chấm thi và sẵn sàng đối đáp tự tin mọi câu hỏi vấn đáp (Viva).

---

## 2. TỔNG QUAN KIẾN TRÚC DỮ LIỆU & BỘ ĐÔI STORED PROCEDURE

### 2.1. Danh mục 10 Bảng Dữ liệu Chuẩn hóa
1. `dorm_buildings`: Danh mục tòa nhà KTX (mã tòa, tên tòa, phân khu nam/nữ, số tầng).
2. `rooms`: Danh mục phòng ở (số phòng, sức chứa, số người đang ở, đơn giá, vector embedding 384 chiều).
3. `students`: Hồ sơ sinh viên KTX (MSSV, họ tên, email, ngành học, trạng thái).
4. `student_wallets`: Ví sinh viên nội bộ (số dư balance $\ge 0$, liên kết 1-1 với sinh viên).
5. `room_assignments`: Hợp đồng lưu trú (phòng, giường, sinh viên, ngày ở, trạng thái `is_active`).
6. `utility_bills`: Hóa đơn điện nước tổng của phòng (chỉ số cũ/mới, tổng tiền, tiền đã thu, trạng thái `UNPAID` / `PARTIALLY_PAID` / `PAID`).
7. `student_utility_debts`: **[Bảng mới]** Công nợ điện nước chia nhỏ cho từng sinh viên (`assigned_amount`, `paid_amount`, trạng thái `UNPAID` / `PAID`).
8. `payment_transactions`: Biên lai giao dịch tài chính nộp tiền (mã giao dịch, sinh viên, hóa đơn, số tiền, mốc thời gian).
9. `audit_logs`: Nhật ký kiểm toán lưu vết can thiệp chỉ số công tơ qua Trigger dạng JSONB (`old_data`, `new_data`, `changed_by`).
10. `dorm_access_logs`: Lịch sử quẹt thẻ ra vào cổng KTX (1.000.000 bản ghi phục vụ benchmark Index B-Tree).

### 2.2. Luồng Vận hành Bộ đôi Stored Procedure
```text
[Cán bộ KTX nhập chỉ số]
           │
           ▼
[sp_generate_and_split_utility_bill]
   ├── 1. Kiểm tra chỉ số mới >= cũ (tránh số lùi)
   ├── 2. Tính tiền điện lũy tiến (Bậc 1: 2.0k, Bậc 2: 2.5k, Bậc 3: 3.0k) + Tiền nước (10k/m3)
   ├── 3. Đếm số sinh viên đang cư trú (is_active = TRUE trong room_assignments)
   ├── 4. Chia đều tiền: p_split_amount = ROUND(Total / Student_Count, 2), bù phần dư cho sinh viên cuối
   ├── 5. INSERT vào utility_bills (Hóa đơn phòng tổng - UNPAID)
   └── 6. Vòng lặp INSERT vào student_utility_debts (Công nợ cho từng sinh viên - UNPAID)

                                 │
                 Sinh viên mở App bấm "Thanh toán"
                                 ▼
                    [sp_pay_student_utility_bill]
   ├── 1. SELECT balance FROM student_wallets FOR UPDATE (Khóa ví, chống Click đúp)
   ├── 2. SELECT ... FROM student_utility_debts FOR UPDATE (Khóa khoản nợ cá nhân)
   ├── 3. Kiểm tra: Nợ đã trả chưa? Ví đủ tiền không? (Rollback nếu thiếu tiền)
   ├── 4. UPDATE student_wallets: balance = balance - p_pay_amount
   ├── 5. UPDATE student_utility_debts: paid_amount += p_pay_amount, debt_status = 'PAID'
   ├── 6. SELECT paid_amount FROM utility_bills FOR UPDATE (Khóa hóa đơn phòng cha)
   ├── 7. UPDATE utility_bills: paid_amount += p_pay_amount, cập nhật PARTIALLY_PAID / PAID
   └── 8. INSERT payment_transactions: Xuất biên lai mã duy nhất (TX-YYYYMMDDHHMISS-XXXX)
```

---

## 3. PHÂN CÔNG CÔNG VIỆC NHÓM (TASK ASSIGNMENT)

Dựa trên cấu trúc chuẩn hóa 10 bảng và các trụ cột kỹ thuật của đề tài, nhóm gồm **3 thành viên** phân chia trách nhiệm cụ thể như sau:

| Thành viên / Vai trò | Nhiệm vụ kỹ thuật chi tiết | Sản phẩm bàn giao cụ thể | Trách nhiệm Báo cáo |
| :--- | :--- | :--- | :--- |
| **Thành viên 1:**<br>**Database Architect & Indexing Lead** | - Viết script DDL chuẩn hóa **10 bảng quan hệ** (chuẩn 3NF, bổ sung `student_utility_debts`, ràng buộc toàn vẹn, kiểu `vector(384)`).<br>- Cài đặt **Bộ đôi Stored Procedure (Dual SP)** trong PostgreSQL:<br>  + `sp_generate_and_split_utility_bill`: Chốt số, tính tiền bậc thang, tự động chia đều nợ theo đầu người (bù phần dư cho người cuối).<br>  + `sp_pay_student_utility_bill`: Thanh toán nợ cá nhân qua ví sinh viên, đồng bộ dồn tiền cha-con.<br>- Thiết lập cơ chế **Khóa dòng bi quan (`SELECT ... FOR UPDATE`)** kiểm soát tranh chấp đồng thời (Concurrency Control).<br>- Cài đặt **2 Triggers:** Bẫy số lùi/hóa đơn PAID (`trg_validate_utility_meter_fraud`) và Audit Log lưu vết JSONB (`trg_audit_utility_meter_update`).<br>- Viết script `generate_series` nạp **1.000.000 dòng log** quẹt thẻ vào `dorm_access_logs`, tạo Composite B-Tree Index `(is_late, check_time)`. | - File `database/01_schema.sql`<br>- File `database/02_procedures.sql`<br>- File `database/03_triggers.sql`<br>- File `database/04_seed_1m_logs.sql`<br>- File `database/05_test_cases.sql` | **Chương 2, 3 & 4:**<br>Bộ đôi Stored Procedure & ACID (4 trang), Bẫy lỗi Trigger JSONB (3 trang), Thực nghiệm Index 1M dòng (4 trang) |
| **Thành viên 2:**<br>**Backend & AI Engine Lead** | - Cấu hình môi trường Python FastAPI, kết nối CSDL PostgreSQL 16 qua `psycopg3` Async Connection Pool.<br>- Xây dựng trọn bộ RESTful API (21 endpoints) bao quát toàn bộ nghiệp vụ Sinh viên, Quản trị viên và Demo Checkpoints.<br>- Cài đặt **Module AI 1 (Semantic Search):** Mô hình `paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, tối ưu tiếng Việt), truy vấn khoảng cách Cosine `<=>` trên `rooms.embedding`.<br>- Cài đặt **Module AI 2 (Forecasting):** Mô hình RandomForest hồi quy dự báo sản lượng điện tiêu thụ 3 tháng tới từ chuỗi thời gian 24 tháng của `utility_bills`.<br>- Cài đặt **Module AI 3 (Clustering):** Thuật toán K-Means phân cụm sinh viên thành 3 nhóm hành vi (Gương mẫu, Nguy cơ tài chính, Cảnh báo an ninh) kết hợp tọa độ PCA 2D.<br>- Xây dựng bộ kiểm thử tự động (56 test cases) và script tự động xuất 11 bộ JSON minh chứng cho báo cáo. | - Thư mục `backend/` hoàn chỉnh (FastAPI, 3 module AI, script seed 24 tháng, script capture evidence)<br>- File `backend/requirements.txt`<br>- File `docs/api/openapi.json`<br>- Thư mục `docs/evidence/backend/` chứa 11 file JSON minh chứng thực nghiệm | **Chương 5 & Phụ lục API:**<br>Ứng dụng Trí tuệ Nhân tạo trong Quản trị CSDL (4 trang) và Bảng đặc tả API |
| **Thành viên 3:**<br>**Frontend SaaS & Report Lead** | - Phát triển giao diện Web chuẩn SaaS (React + Vite + Tailwind CSS + shadcn/ui) với đầy đủ 2 phân hệ: **Sinh viên** (`Student Portal`) và **Quản lý KTX** (`Admin Portal`).<br>- Thiết kế thanh công cụ **Role Switcher** và khu vực **Demo Checkpoints** phục vụ giảng viên kiểm thử trực quan các kịch bản chấm thi.<br>- Tích hợp các biểu đồ Recharts hiển thị Dashboard, Forecast tiêu thụ điện và Scatter Plot phân cụm sinh viên.<br>- Chủ trì chắp bút, tổng hợp và định dạng toàn bộ báo cáo đồ án 20 trang theo chuẩn barem CT221H từ các dữ liệu và minh chứng do Thành viên 1 & 2 cung cấp; thiết kế Slide thuyết trình chuyên nghiệp. | - Thư mục `frontend/` hoàn chỉnh (chạy mượt mà, responsive, dark/light mode)<br>- File Báo cáo đồ án 20 trang chuẩn mẫu (Word/PDF tại `docs/Bao_Cao_BTL_KT221H.md`)<br>- Slide thuyết trình bảo vệ đồ án (15-20 slides) | **Tổng quan, Chương 1, Kết luận & Trình bày Báo cáo:**<br>Tổng quan đề tài (1 trang), Khảo sát & Thiết kế CSDL 10 bảng (3 trang), Kết luận & Đóng tập báo cáo (1 trang) |

---

## 4. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
principles of database/project/
├── docker-compose.yml              # Khởi chạy PostgreSQL 16 pgvector + pgAdmin 4
├── CHOT_QUYET_DINH_KY_THUAT.md     # Tài liệu lưu hành nội bộ nhóm (ADR & Phân công nhiệm vụ)
├── Dac_Ta_Yeu_Cau_De_Tai_KTX.md    # Bản nháp yêu cầu đề tài
├── docs/
│   ├── specs/
│   │   └── 2026-10-20-smart-dormitory-system.md  # Tài liệu đặc tả kỹ thuật chi tiết hệ thống
│   └── Bao_Cao_BTL_KT221H.md       # Bản thảo báo cáo đồ án 20 trang (Barem CT221H)
├── database/                       # TẦNG SQL THUẦN (TRỌNG TÂM CHẤM THI CỦA HỘI ĐỒNG)
│   ├── 01_schema.sql               # DDL tạo 10 bảng, ràng buộc toàn vẹn, kiểu vector(384)
│   ├── 02_procedures.sql           # Bộ đôi SP (sp_generate_and_split_utility_bill & sp_pay_student_utility_bill)
│   ├── 03_triggers.sql             # 2 Triggers (Audit Log JSONB & Bẫy số lùi/hóa đơn PAID)
│   ├── 04_seed_1m_logs.sql         # Script generate_series nạp 1.000.000 dòng log quẹt thẻ
│   └── 05_test_cases.sql           # Kịch bản kiểm thử Dual-SP, Click đúp, Rollback, Index Benchmark
├── backend/                        # API FASTAPI & 3 MÔ HÌNH AI (PYTHON)
│   ├── app/
│   │   ├── main.py                 # FastAPI Application & Router Setup
│   │   ├── database.py             # Kết nối PostgreSQL qua psycopg3 pool
│   │   └── ai/
│   │       ├── semantic_search.py  # AI tìm phòng ngữ nghĩa với pgvector
│   │       ├── forecasting.py      # AI dự báo sản lượng điện tiêu thụ
│   │       └── clustering.py       # AI phân cụm hành vi sinh viên K-Means
│   └── requirements.txt            # Danh mục thư viện Python cần cài đặt
└── frontend/                       # WEB UI CHUẨN SAAS (REACT + TAILWIND + SHADCN/UI)
    ├── src/
    │   ├── components/             # Reusable UI components (Buttons, Cards, Dialogs, Tables)
    │   ├── pages/
    │   │   ├── StudentPortal.tsx   # Phân hệ sinh viên (Tìm phòng AI, Xem nợ, Nộp tiền ví)
    │   │   ├── AdminPortal.tsx     # Phân hệ quản lý (Chốt số chia nợ, Audit Log, Benchmark Index)
    │   │   └── DemoCheckpoints.tsx # Bảng điều khiển dành riêng cho giảng viên chấm thi
    │   └── App.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 5. NGUYÊN TẮC PHỐI HỢP & TIẾN ĐỘ THI CÔNG

1. **Tuân thủ hợp đồng giao tiếp (Schema Contract First):**
   - Mọi thay đổi về tên cột, kiểu dữ liệu trong 10 bảng hoặc chữ ký của Bộ đôi Stored Procedure BẮT BUỘC phải được thảo luận và cập nhật đồng bộ vào `docs/specs/2026-10-20-smart-dormitory-system.md` trước khi sửa mã nguồn.
2. **Quy tắc Kiểm thử độc lập (Zero False Claims):**
   - Thành viên 1 & 2 chỉ bàn giao script SQL khi đã nạp thử thành công trên Docker PostgreSQL sạch (không lỗi cú pháp, exit code 0).
   - Mọi kết quả đo đạc (thời gian thực thi Index, ảnh chụp Rollback) phải là số liệu thực nghiệm trên máy, không ước lượng cảm tính.
3. **Quy tắc Tối giản & Tập trung (Anti-Over-Engineering / YAGNI):**
   - Tuyệt đối không bổ sung các phân hệ ngoài phạm vi như: Sửa chữa cơ sở vật chất, Đơn từ hành chính đa cấp hay tích hợp VNPay thật. Tập trung 100% tài nguyên làm thật sâu và xuất sắc 5 trụ cột kỹ thuật của môn học.
4. **Chuẩn bị Vấn đáp (Viva Defense):**
   - Cả 4 thành viên cùng nắm vững cơ chế `SELECT ... FOR UPDATE`, lý do chuẩn hóa 10 bảng và cấu trúc `JSONB` trong Audit Log để bảo vệ đồng đều trước câu hỏi xoáy của Hội đồng.

---
*(Tài liệu lưu hành nội bộ nhóm CT221H - Cập nhật ngày 20/10/2026).*
