# Smart Dormitory Frontend Client

Giao diện web quản trị KTX và Cổng sinh viên cho đề tài **Nguyên lý Hệ quản trị Cơ sở dữ liệu (CT221H)** — Đại học Cần Thơ (CTU), xây dựng bằng **Next.js 16**, **React 19**, **Tailwind CSS v4** và **Recharts**.

## 1. Yêu cầu môi trường
- Node.js 20+ & npm
- Backend FastAPI đang chạy tại `http://127.0.0.1:8000` (xem [`../backend/README.md`](../backend/README.md))

## 2. Biến môi trường
- `NEXT_PUBLIC_API_URL`: URL của FastAPI Backend (mặc định là `http://127.0.0.1:8000` trong `src/lib/api.ts`, không cần tạo `.env.local` nếu chạy local mặc định).

## 3. Cài đặt & Lệnh chạy
```powershell
cd frontend
npm install

npm run dev     # Chạy môi trường development tại http://localhost:3000
npm run build   # Kiểm tra TypeScript và biên dịch bản production
npm run start   # Chạy bản production sau khi build
npm run lint    # Kiểm tra ESLint
```

## 4. Các đường dẫn chính
| Route | Chức năng |
| :--- | :--- |
| `/` | Trang chủ chọn vai trò Admin hoặc Sinh viên |
| `/admin` | Dashboard tổng quan, biểu đồ AI Forecast (RandomForest) và phân cụm K-Means |
| `/admin/demo-checkpoints` | Trung tâm 6 kịch bản chấm điểm CT221H (có nút **Khởi Tạo Lại Dữ Liệu Demo (2026-11)**) |
| `/admin/rooms` | Danh mục phòng, sơ đồ giường, lọc Tòa/Tầng và tìm kiếm ngữ nghĩa AI (`pgvector`) |
| `/admin/bills` | Hóa đơn điện nước bậc thang 3 bậc, cập nhật công tơ và nhật ký JSONB `audit_logs` |
| `/admin/access-logs` | Tra cứu 1.000.000 log quẹt thẻ và đo kế hoạch thực thi `EXPLAIN (ANALYZE, BUFFERS)` |
| `/admin/students` | Danh sách sinh viên KTX, số dư ví nội bộ và trạng thái công nợ |
| `/admin/contracts` | Quản lý hợp đồng lưu trú và thanh lý trả phòng |
| `/student` | Cổng sinh viên (khung di động), chọn nhanh `B2100001`–`B2100009`, nạp ví và nộp tiền qua SP2 |
