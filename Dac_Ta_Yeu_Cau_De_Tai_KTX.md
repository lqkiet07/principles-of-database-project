# TÀI LIỆU ĐẶC TẢ BÀI TẬP LỚN MÔN HỌC
## MÔN: NGUYÊN LÝ HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU (NLHQTCSDL)

---

# PHẦN A: BẢNG YÊU CẦU BÀI THỰC HÀNH NHÓM (YÊU CẦU TỪ GIẢNG VIÊN)

Dưới đây là các yêu cầu bắt buộc và tiêu chí đánh giá điểm số do giảng viên bộ môn đề ra cho bài tập lớn:

### 1. Thủ tục lưu (Stored Procedure)
- **Yêu cầu kỹ thuật:** Không làm các thao tác CRUD cơ bản đơn thuần ở tầng code ứng dụng (Application Layer). Toàn bộ nghiệp vụ tính toán, xử lý logic phải được "cắm" (nhúng) trực tiếp vào Hệ quản trị cơ sở dữ liệu (DBMS).
- **Tham số:** Phải có đầy đủ **Tham số đầu vào (IN)** và **Tham số đầu ra (OUT)**.
- **Minh chứng:** Phải chứng minh được sau khi thủ tục thực thi thì dữ liệu đã được lưu như thế nào, lưu được những gì vào các bảng liên quan.

### 2. Quản trị Giao dịch (Transaction & ACID)
- **Yêu cầu kỹ thuật:** Chỉ ra ít nhất một số giao dịch mang tính chất đồng thời hoặc liên quan đến tài chính/tiền tệ (ví dụ: cộng trừ tiền ví, chuyển khoản, xuất nhập kho).
- **Tính toàn vẹn:** Phải được bao bọc trong Transaction (`BEGIN TRAN ... COMMIT / ROLLBACK`).
- **Mục tiêu:** Đảm bảo không xảy ra hiện tượng "một bên bị trừ tiền nhưng bên kia không thay đổi" khi gặp lỗi; nếu có sự cố phải hoàn tác (Rollback) về trạng thái ban đầu.

### 3. Bẫy lỗi & Ghi nhật ký (Trigger & Audit Log)
- **Yêu cầu kỹ thuật:** Bẫy các hành động `INSERT`, `UPDATE`, `DELETE` trên bảng dữ liệu nhạy cảm (ví dụ: giá cả, điểm số, chỉ số tiêu thụ).
- **Ghi vết (Audit Log):** Tự động bắt được giá trị cũ (`Old Value`) và giá trị mới (`New Value`) để ghi vào một bảng nhật ký (`Audit_Log`) phục vụ thanh tra.
- **Bẫy nghiệp vụ:** Tự động phát hiện hành vi bất thường/sai quy tắc nghiệp vụ để bẫy hủy thao tác và thông báo cho người dùng biết có được phép hay không.

### 4. Lập chỉ mục trên tập dữ liệu lớn (Indexing - Tiêu chí điểm cộng)
- **Yêu cầu kỹ thuật:** Phải tạo lập một tập dữ liệu giả lập đủ lớn (**từ 500.000 đến 1.000.000+ bản ghi**) thì mới demo thấy rõ sự khác biệt của chỉ mục.
- **Minh chứng:** Dùng **Execution Plan (Kế hoạch thực thi)** để so sánh hiệu năng trước khi đánh Index (`Table Scan` / `Clustered Index Scan`) và sau khi đánh Index (`Index Seek`), chứng minh thời gian và chi phí I/O giảm rõ rệt.

### 5. Tích hợp Trí tuệ Nhân tạo (AI Integration)
Hệ thống phải tích hợp các giải pháp AI vào bài toán quản trị CSDL, bao gồm đủ 3 dạng:
1. **Tìm kiếm ngữ nghĩa (Semantic Search):** Tìm kiếm thông tin dựa trên ý nghĩa câu chữ tự nhiên bằng Vector Embeddings thay vì tìm từ khóa chính xác đơn thuần.
2. **Dự báo (Forecasting):** Dự báo nhu cầu, sản lượng, doanh thu hoặc nguy cơ dựa trên dữ liệu chuỗi thời gian/mô hình học máy.
3. **Phân loại / Phân cụm (Classification / Clustering):** Phân nhóm khách hàng, sinh viên hoặc đối tượng người dùng dựa trên hành vi.

### 6. Hình thức Báo cáo & Demo
- Trình bày ngắn gọn, súc tích, độ dài báo cáo khoảng **20 trang**.
- Có mô hình, sơ đồ kiến trúc, minh chứng các bước demo trực tiếp những gì hệ thống làm được.

---

# PHẦN B: HIỆN THỰC HÓA CHI TIẾT THEO CHỦ ĐỀ ĐƯỢC CHỌN

### 🎯 TÊN ĐỀ TÀI:
## **HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ THÔNG MINH & THANH TOÁN ĐIỆN NƯỚC**
*(Smart Dormitory Management & Campus Utility Billing System)*

---

## 1. TỔNG QUAN HỆ THỐNG VÀ BÀI TOÁN THỰC TẾ
Hệ thống giải quyết bài toán vận hành ký túc xá (KTX) sinh viên trong trường đại học:
- Phân bổ sinh viên vào phòng, quản lý sức chứa giường.
- Chốt chỉ số điện/nước từng phòng mỗi tháng, tự động tính tiền theo định mức bậc thang.
- Sinh viên thanh toán tiền phòng và hóa đơn điện nước qua **Ví sinh viên (Campus Wallet)**.
- Ghi vết mọi hành vi can thiệp, chỉnh sửa chỉ số công tơ điện nước.
- Xử lý tra cứu hàng triệu lượt sinh viên quẹt thẻ ra vào KTX trong nhiều năm.
- Ứng dụng AI tìm phòng KTX phù hợp theo nhu cầu, dự báo mức tiêu thụ điện và phân loại sinh viên.

---

## 2. THIẾT KẾ CƠ SỞ DỮ LIỆU CỐT LÕI (SCHEMA)

```
[Dorm_Buildings] 1 --- n [Rooms] 1 --- n [Room_Assignments] n --- 1 [Students]
                               |                                        |
                               | 1                                      | 1
                               v n                                      v 1
                      [Utility_Bills]                            [Student_Wallets]
                               | 1                                      | 1
                               v n                                      v n
                      [Payment_Transactions] <--------------------------+
                               |
                      [Dorm_Access_Logs] (1.000.000+ bản ghi để test Index)
                      [Audit_Logs] (Ghi vết Trigger)
```

### Các bảng dữ liệu chính:
1. **`Dorm_Buildings`**: Thông tin các tòa nhà (BuildingID, BuildingName, GenderZone, NumberOfFloors).
2. **`Rooms`**: Danh sách phòng (RoomID, BuildingID, RoomNumber, Capacity, CurrentOccupancy, BasePrice, Status).
3. **`Students`**: Thông tin sinh viên (StudentID, FullName, Email, Phone, Major, Status).
4. **`Student_Wallets`**: Ví tiền sinh viên (WalletID, StudentID, Balance, Status, LastUpdated).
5. **`Room_Assignments`**: Phân bổ phòng ở (AssignmentID, RoomID, StudentID, StartDate, EndDate, BedNumber, IsActive).
6. **`Utility_Bills`**: Hóa đơn điện nước (BillID, RoomID, MonthYear, PrevElectric, CurrElectric, PrevWater, CurrWater, TotalAmount, PaidAmount, BillStatus).
7. **`Payment_Transactions`**: Giao dịch thanh toán (TxID, BillID, StudentID, Amount, TxTime, Status, ReferenceCode).
8. **`Audit_Logs`**: Nhật ký ghi vết (LogID, TableName, ActionType, RecordID, OldValues, NewValues, ModifiedBy, ModifiedAt, Description).
9. **`Dorm_Access_Logs`**: Lịch sử quẹt thẻ ra vào cổng KTX (**Bảng Big Data > 1 triệu dòng**).

---

## 3. CÁCH ĐÁP ỨNG TỪNG YÊU CẦU CỦA GIẢNG VIÊN

### 3.1. Thủ tục lưu: `sp_PayMonthlyRoomBill` (Đúng yêu cầu 1)
- **Mục đích:** Đóng gói toàn bộ nghiệp vụ kiểm tra, trừ tiền ví sinh viên và gạch nợ hóa đơn phòng vào trong CSDL SQL.
- **Tham số đầu vào (IN):**
  - `@PayerStudentID` (VARCHAR): Mã sinh viên thanh toán.
  - `@BillID` (INT): Mã hóa đơn cần nộp tiền.
  - `@PayAmount` (DECIMAL): Số tiền nộp.
- **Tham số đầu ra (OUT):**
  - `@StatusCode` (INT): 0 (Thành công), 1 (Không tìm thấy hóa đơn), 2 (Hóa đơn đã trả xong), 3 (Ví không đủ tiền).
  - `@TransactionCode` (VARCHAR): Mã giao dịch thanh toán duy nhất được tạo ra.
  - `@RemainingBalance` (DECIMAL): Số dư còn lại trong ví sinh viên sau khi thanh toán.
  - `@RemainingDebt` (DECIMAL): Số nợ còn lại của hóa đơn phòng.
- **Chứng minh đã lưu:** Sau khi chạy SP, số dư của `Student_Wallets` giảm đi, `Utility_Bills.PaidAmount` tăng lên, nếu trả hết thì `BillStatus` đổi sang `'PAID'`, và có 1 dòng mới trong `Payment_Transactions`.

---

### 3.2. Quản trị Giao dịch: Trừ tiền ví & Gạch nợ hóa đơn (Đúng yêu cầu 2)
- **Mục đích:** Đảm bảo tính toàn vẹn tài chính, chống mất cân đối tiền tệ.
- **Cơ chế:**
  ```sql
  BEGIN TRANSACTION
      -- 1. Khóa dòng kiểm tra số dư ví sinh viên (Pessimistic Lock)
      -- 2. Trừ tiền ví sinh viên: UPDATE Student_Wallets SET Balance = Balance - @PayAmount
      -- 3. Cộng tiền vào tài khoản nhà trường (Campus_Revenue)
      -- 4. Cập nhật hóa đơn phòng: UPDATE Utility_Bills SET PaidAmount = PaidAmount + @PayAmount
      -- 5. Ghi nhật ký giao dịch: INSERT INTO Payment_Transactions
      -- NẾU XẢY RA LỖI HOẶC VÍ THIẾU TIỀN:
      --     ROLLBACK TRANSACTION (Hoàn lại toàn bộ dữ liệu như lúc ban đầu)
      -- NẾU THÀNH CÔNG:
      --     COMMIT TRANSACTION
  ```
- **Chứng minh:** 
  - Kịch bản 1: Đủ tiền $\rightarrow$ Giao dịch thành công, hai bên cùng đổi trạng thái (`COMMIT`).
  - Kịch bản 2: Cố tình chỉnh ví thiếu tiền hoặc mất kết nối mạng giữa chừng $\rightarrow$ Giao dịch `ROLLBACK`, chứng minh tiền không bị mất một bên.

---

### 3.3. Trigger & Bẫy lỗi: Audit Log & Chặn gian lận số liệu (Đúng yêu cầu 3)

#### Trigger 1: `trg_Audit_Utility_Meter_Update` (Tương đương bài toán "sửa điểm")
- Bắt sự kiện `UPDATE` trên bảng `Utility_Bills` khi quản lý KTX sửa chỉ số điện hoặc nước.
- Tự động lấy giá trị cũ từ bảng ảo `deleted` và giá trị mới từ bảng ảo `inserted`.
- Lưu vào bảng `Audit_Logs`: `OldValues` (chỉ số cũ), `NewValues` (chỉ số mới), `ModifiedBy` (ai sửa), `ModifiedAt` (sửa lúc nào).

#### Trigger 2: `trg_Validate_Utility_Meter_Fraud` (Bẫy nghiệp vụ)
- Nếu người nhập cố tình nhập chỉ số điện mới nhỏ hơn chỉ số cũ (`CurrElectric < PrevElectric`) $\rightarrow$ Trigger lập tức `ROLLBACK TRANSACTION`, báo lỗi: *"Chỉ số điện mới không thể nhỏ hơn chỉ số cũ!"*.
- Nếu chỉ số điện tăng đột biến gấp > 5 lần tháng trước $\rightarrow$ Bẫy gắn cờ cảnh báo rò rỉ điện.

---

### 3.4. Lập chỉ mục trên Big Data (Đúng yêu cầu 4 - Điểm cộng)
- **Bảng thực nghiệm:** `Dorm_Access_Logs` (Lịch sử quẹt thẻ ra vào cổng KTX).
- **Quy mô:** Dùng script SQL phát sinh ngẫu nhiên **1.000.000 dòng dữ liệu**.
- **Truy vấn kiểm tra:** Lọc danh sách sinh viên về muộn sau 23h trong quý gần nhất.
- **Chứng minh trên Execution Plan:**
  - *Chưa có Index:* Thực hiện `Table Scan` duyệt qua 1.000.000 dòng, thời gian chạy ~ **1.8 giây - 2.5 giây**.
  - *Sau khi tạo Composite Non-Clustered Index `(IsLate, CheckTime)`:* Chuyển sang `Index Seek`, thời gian giảm còn **< 10 mili-giây**.

---

### 3.5. Tích hợp Trí tuệ Nhân tạo (Đúng yêu cầu 5)
1. **Tìm kiếm ngữ nghĩa (Semantic Search):**
   - Sinh viên gõ câu tìm kiếm tự nhiên: *"Cần phòng nam yên tĩnh ở tầng 3 hoặc 4 gần nhà xe, có ban công thoáng mát"*.
   - Hệ thống dùng Vector Embeddings tính độ tương đồng ngữ nghĩa để trả về danh sách phòng phù hợp nhất mà không cần nhập đúng mã phòng hay từ khóa chính xác.
2. **Dự báo sản lượng tiêu thụ (Forecasting):**
   - Dùng mô hình Machine Learning dự báo tổng sản lượng điện và nước của từng tòa KTX trong tháng tiếp theo, phục vụ kế hoạch dự trù kinh phí của nhà trường.
3. **Phân cụm sinh viên (Customer/Student Segmentation):**
   - Thuật toán **K-Means** phân loại sinh viên KTX thành các nhóm hành vi:
     - Nhóm 1: Sinh viên mẫu mực (không về muộn, thanh toán đúng hạn, tiết kiệm điện).
     - Nhóm 2: Sinh viên hay nộp tiền trễ hạn.
     - Nhóm 3: Sinh viên nguy cơ cao (thường xuyên vi phạm giờ giới nghiêm sau 23h).

---

## 4. DÀN Ý BÁO CÁO 20 TRANG
1. **Chương 1:** Khảo sát bài toán & Mô hình dữ liệu ERD (~3-4 trang).
2. **Chương 2:** Cài đặt Thủ tục lưu & Quản trị Giao dịch ACID (~4 trang).
3. **Chương 3:** Bẫy lỗi và Ghi vết nhật ký bằng Trigger (~3 trang).
4. **Chương 4:** Thực nghiệm hiệu năng Chỉ mục trên 1 triệu dòng dữ liệu (~4 trang).
5. **Chương 5:** Xây dựng và Demo 3 mô hình AI (~4 trang).
6. **Kết luận & Đánh giá** (~1 trang).
