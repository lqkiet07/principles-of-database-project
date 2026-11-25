# Frontend Web — Hệ thống Quản lý Ký túc xá Thông minh CTU

Giao diện web dành cho **Ban quản lý KTX** và **Sinh viên nội trú**, xây dựng trên nền tảng **Next.js 16 (App Router)**, **React 19**, **TypeScript** và **Tailwind CSS**.

## 1. Cài đặt thư viện
```powershell
cd frontend
npm install
```

## 2. Chạy môi trường phát triển
Đảm bảo Backend đang chạy tại `http://127.0.0.1:8000`, sau đó khởi động Frontend:
```powershell
npm run dev
```
Mở trình duyệt tại **`http://localhost:3000`**.

## 3. Kiểm tra kiểu dữ liệu & Build Production
```powershell
npx tsc --noEmit
npm run build
```
