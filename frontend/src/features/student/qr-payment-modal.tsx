"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { Modal } from "@/components/shared/modal";

export interface QrSessionState {
  ma_phien: string;
  sig: string;
  qr_url: string;
  local_pay_path: string;
  lan_ip: string;
  ma_hoa_don: number;
  ten_phong: string;
  loai: "KTX" | "DIEN_NUOC";
  tieu_de: string;
  so_tien: number;
  noi_dung_ck: string;
  trang_thai: "CHO_THANH_TOAN" | "THANH_CONG" | "DA_HUY" | "HET_HAN";
  con_lai_giay: number;
  ma_giao_dich?: string | null;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface QrPaymentModalProps {
  session: QrSessionState | null;
  onUpdateSession: React.Dispatch<React.SetStateAction<QrSessionState | null>>;
  onRetryCreate: (maHoaDon: number) => void;
  onPaid: () => void;
}

export function QrPaymentModal({
  session,
  onUpdateSession,
  onRetryCreate,
  onPaid,
}: QrPaymentModalProps) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (session) setCountdown(session.con_lai_giay || 300);
  }, [session?.ma_phien, session?.con_lai_giay]);

  useEffect(() => {
    if (!session || session.trang_thai !== "CHO_THANH_TOAN" || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [session, countdown]);

  // Polling trạng thái phiên QR mỗi 1,5 giây
  useEffect(() => {
    if (!session || session.trang_thai !== "CHO_THANH_TOAN") return;
    let active = true;

    const poll = async () => {
      try {
        const st = await apiRequest<any>(
          `/api/student/payments/qr/${encodeURIComponent(session.ma_phien)}/status`
        );
        if (!active) return;
        setCountdown(Number(st.con_lai_giay ?? 0));
        if (st.trang_thai !== "CHO_THANH_TOAN") {
          onUpdateSession((prev) =>
            prev
              ? { ...prev, trang_thai: st.trang_thai, ma_giao_dich: st.ma_giao_dich }
              : prev
          );
          if (st.trang_thai === "THANH_CONG") {
            toast.success(`Thanh toán thành công! Mã GD: ${st.ma_giao_dich || ""}`);
            onPaid();
          } else if (st.trang_thai === "DA_HUY") {
            toast.info("Giao dịch thanh toán đã bị hủy.");
          } else if (st.trang_thai === "HET_HAN") {
            toast.warning("Mã QR đã hết hạn.");
          }
        }
      } catch {
        // ignore transient network errors
      }
    };

    const interval = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session, onUpdateSession, onPaid]);

  const handleClose = () => {
    if (session?.trang_thai === "CHO_THANH_TOAN") {
      apiRequest(`/api/payments/qr/${encodeURIComponent(session.ma_phien)}/cancel`, {
        method: "POST",
        body: { sig: session.sig },
        skipAuthRedirect: true,
      }).catch(() => {});
    }
    onUpdateSession(null);
  };

  return (
    <Modal
      open={Boolean(session)}
      onClose={handleClose}
      size="sm"
      title="Thanh toán qua mã QR"
      description={session?.tieu_de}
    >
      {session && (
        <div className="space-y-4 text-center">
          {session.trang_thai === "THANH_CONG" ? (
            <div className="py-5 space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800">Thanh toán thành công</h3>
              <p className="text-2xl font-bold text-slate-900">{formatVND(session.so_tien)}</p>
              {session.ma_giao_dich && (
                <p className="text-xs font-mono text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-full">
                  Mã GD: {session.ma_giao_dich}
                </p>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onUpdateSession(null)}
                  className="w-full rounded-xl bg-[#1F5CA9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#194B8B]"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : session.trang_thai === "HET_HAN" || session.trang_thai === "DA_HUY" ? (
            <div className="py-5 space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                {session.trang_thai === "HET_HAN" ? (
                  <Clock className="h-8 w-8" />
                ) : (
                  <XCircle className="h-8 w-8" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {session.trang_thai === "HET_HAN" ? "Mã QR đã hết hạn" : "Giao dịch đã hủy"}
              </h3>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onUpdateSession(null)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => onRetryCreate(session.ma_hoa_don)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1F5CA9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#194B8B]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tạo mã mới
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-auto inline-flex flex-col items-center rounded-2xl border-2 border-[#1F5CA9]/20 bg-white p-4 shadow-xs">
                <QRCodeSVG value={session.qr_url} size={200} level="M" fgColor="#0F172A" />
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-[#1F5CA9]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F5CA9] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1F5CA9]" />
                  </span>
                  Chờ quét QR · {formatCountdown(countdown)}
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
                <Smartphone className="h-4 w-4 text-[#1F5CA9] shrink-0" />
                <span>Dùng camera điện thoại (cùng Wi-Fi) quét mã QR để xác nhận</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left text-sm space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Số tiền</span>
                  <span className="font-bold text-[#1F5CA9] text-base">
                    {formatVND(session.so_tien)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Nội dung CK</span>
                  <span className="font-mono font-semibold text-slate-900 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                    {session.noi_dung_ck}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={session.local_pay_path}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1F5CA9]/30 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-[#1F5CA9] hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Mở trang thanh toán trên thiết bị này
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
