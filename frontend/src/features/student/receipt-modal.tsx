"use client";

import React from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { formatDateTime, formatMonthLabel, formatVND } from "@/lib/format";

export interface ReceiptDetail {
  ma_tt: number;
  so_bien_lai: string;
  ma_hoa_don: number;
  ma_giao_dich: string;
  so_tien: number | string;
  thoi_gian: string;
  phuong_thuc: string;
  ngan_hang?: string | null;
  noi_dung_ck?: string | null;
  mssv_nguoi_nop: string;
  ten_nguoi_nop: string;
  loai: "KTX" | "DIEN_NUOC";
  ma_ky: string;
  thang: string;
  ten_phong: string;
  ma_khu: string;
  ten_khu?: string;
  don_vi_thu?: string;
  tai_khoan_thu?: string;
  ten_tk_thu?: string;
}

export function formatPaymentMethod(method?: string | null): string {
  switch ((method || "").toUpperCase()) {
    case "QR_NGAN_HANG":
      return "Quét mã QR Ngân hàng (Sandbox ACID)";
    case "NHAP_THONG_TIN":
      return "Tài khoản / Thẻ ngân hàng + OTP (Sandbox ACID)";
    case "VIETQR":
      return "Chuyển khoản VietQR 24/7 (EMVCo NAPAS)";
    case "VNPAY_ATM":
      return "Thẻ ATM nội địa (NAPAS / VNPay + OTP)";
    case "SANDBOX_QR":
      return "Thanh toán qua mã QR Sandbox";
    default:
      return "Chuyển khoản trực tuyến";
  }
}

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptDetail | null;
  onClose: () => void;
}) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <Modal
      open={Boolean(receipt)}
      onClose={onClose}
      size="md"
      title="Biên lai thu tiền điện tử"
      description={receipt ? `Số biên lai: ${receipt.so_bien_lai}` : ""}
    >
      {receipt && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 print:border-slate-400">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#1F5CA9]">
                  {receipt.don_vi_thu || "Ban Quản lý Ký túc xá - Trường ĐH Cần Thơ"}
                </p>
                <h3 className="mt-1 text-base font-bold text-slate-900">
                  BIÊN LAI THU TIỀN LỆ PHÍ / DỊCH VỤ NỘI TRÚ
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chứng từ điện tử đối soát trực tiếp trên CSDL KTX
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ĐÃ ĐỐI SOÁT
              </span>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Số biên lai</dt>
                <dd className="font-mono font-bold text-slate-900">{receipt.so_bien_lai}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Mã giao dịch</dt>
                <dd className="font-mono font-semibold text-slate-800 break-all">
                  {receipt.ma_giao_dich}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Họ tên người nộp</dt>
                <dd className="font-semibold text-slate-900">
                  {receipt.ten_nguoi_nop} ({receipt.mssv_nguoi_nop})
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phòng lưu trú</dt>
                <dd className="font-semibold text-slate-900">
                  Phòng {receipt.ten_phong} ({receipt.ten_khu || `Khu ${receipt.ma_khu}`})
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Khoản thu</dt>
                <dd className="font-medium text-slate-800">
                  {receipt.loai === "KTX"
                    ? `Tiền phòng KTX (${receipt.ma_ky})`
                    : `Tiền điện nước (${formatMonthLabel(receipt.thang)})`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Thời gian giao dịch</dt>
                <dd className="font-medium text-slate-800">{formatDateTime(receipt.thoi_gian)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Kênh &amp; Ngân hàng thanh toán</dt>
                <dd className="font-medium text-slate-800">
                  {formatPaymentMethod(receipt.phuong_thuc)}
                  {receipt.ngan_hang ? ` · ${receipt.ngan_hang}` : ""}
                </dd>
              </div>
              {receipt.noi_dung_ck && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Nội dung chuyển khoản / Tham chiếu</dt>
                  <dd className="font-mono text-xs text-slate-700 bg-slate-50 rounded px-2.5 py-1.5 mt-0.5 border border-slate-200">
                    {receipt.noi_dung_ck}
                  </dd>
                </div>
              )}
              {receipt.tai_khoan_thu && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Tài khoản thụ hưởng KTX</dt>
                  <dd className="text-xs text-slate-700 font-medium">
                    {receipt.ten_tk_thu} — STK: <span className="font-mono">{receipt.tai_khoan_thu}</span>
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Tổng số tiền đã thu</span>
              <span className="text-xl font-extrabold text-[#1F5CA9]">
                {formatVND(receipt.so_tien)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4 text-[#1F5CA9]" />
              In biên lai / Lưu PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
