"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { formatDateTime, formatVND } from "@/lib/format";

interface CheckoutSession {
  ma_phien: string;
  ma_hoa_don: number;
  ten_phong: string;
  ma_khu: string;
  tieu_de: string;
  nguoi_nop: string;
  mssv: string;
  so_tien: number;
  noi_dung_ck: string;
  trang_thai: "CHO_THANH_TOAN" | "THANH_CONG" | "DA_HUY" | "HET_HAN";
  ma_giao_dich: string | null;
  hoan_tat_luc: string | null;
  con_lai_giay: number;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function QrCheckoutContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params?.sessionId || "";
  const sig = searchParams.get("sig") || "";

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId || !sig) {
      setError("Liên kết thanh toán QR không hợp lệ.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/payments/qr/${encodeURIComponent(sessionId)}?sig=${encodeURIComponent(sig)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Không tìm thấy phiên thanh toán.");
        setSession(null);
      } else {
        setSession(data);
        setCountdown(Number(data.con_lai_giay || 0));
      }
    } catch {
      setError("Không thể kết nối đến máy chủ thanh toán.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, sig]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Đếm ngược thời gian hiệu lực QR trên điện thoại
  useEffect(() => {
    if (!session || session.trang_thai !== "CHO_THANH_TOAN") return;
    if (countdown <= 0) {
      setSession((prev) => (prev ? { ...prev, trang_thai: "HET_HAN" } : prev));
      return;
    }
    const t = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [session, countdown]);

  const handleConfirm = async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/payments/qr/${encodeURIComponent(session.ma_phien)}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sig }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Thanh toán không thành công.");
        await loadSession();
      } else {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                trang_thai: "THANH_CONG",
                ma_giao_dich: data.ma_giao_dich,
                hoan_tat_luc: data.hoan_tat_luc,
              }
            : prev
        );
      }
    } catch {
      setError("Lỗi kết nối khi xác nhận thanh toán.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      await fetch(
        `/api/payments/qr/${encodeURIComponent(session.ma_phien)}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sig }),
        }
      );
      setSession((prev) => (prev ? { ...prev, trang_thai: "DA_HUY" } : prev));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1F5F9] gap-3 text-slate-600 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F5CA9]" />
        <p className="text-sm font-medium">Đang tải thông tin giao dịch...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center shadow-lg space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Không thể mở giao dịch</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        {/* Header ngân hàng Sandbox */}
        <div className="bg-gradient-to-br from-[#1F5CA9] to-[#16447E] px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-blue-100 font-medium">Thanh toán QR Sandbox</p>
                <p className="text-sm font-bold">KTX Đại học Cần Thơ</p>
              </div>
            </div>
            {session.trang_thai === "CHO_THANH_TOAN" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-mono font-semibold">
                <Clock className="h-3.5 w-3.5" />
                {formatCountdown(countdown)}
              </span>
            )}
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-blue-100 uppercase tracking-wider">Số tiền thanh toán</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">
              {formatVND(session.so_tien)}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Trạng thái hoàn tất */}
          {session.trang_thai === "THANH_CONG" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="text-lg font-bold text-emerald-900">Thanh toán thành công</h2>
              {session.ma_giao_dich && (
                <p className="text-xs font-mono text-emerald-800 bg-white/80 inline-block px-3 py-1 rounded-full border border-emerald-200">
                  Mã GD: {session.ma_giao_dich}
                </p>
              )}
              {session.hoan_tat_luc && (
                <p className="text-xs text-emerald-700">
                  Thời gian: {formatDateTime(session.hoan_tat_luc)}
                </p>
              )}
            </div>
          )}

          {session.trang_thai === "DA_HUY" && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center space-y-2">
              <XCircle className="mx-auto h-11 w-11 text-slate-400" />
              <h2 className="text-base font-bold text-slate-800">Giao dịch đã hủy</h2>
            </div>
          )}

          {session.trang_thai === "HET_HAN" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
              <Clock className="mx-auto h-11 w-11 text-amber-600" />
              <h2 className="text-base font-bold text-amber-900">Mã QR đã hết hạn</h2>
              <p className="text-xs text-amber-800">
                Vui lòng quay lại màn hình hóa đơn để tạo mã QR mới.
              </p>
            </div>
          )}

          {/* Chi tiết giao dịch */}
          <dl className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Đơn vị thụ hưởng</dt>
              <dd className="font-semibold text-slate-900 text-right">Ban Quản lý KTX CTU</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Khoản thu</dt>
              <dd className="font-semibold text-slate-900 text-right">{session.tieu_de}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Phòng</dt>
              <dd className="font-semibold text-slate-900 text-right">
                {session.ten_phong} (Khu {session.ma_khu})
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Người nộp</dt>
              <dd className="font-medium text-slate-800 text-right">
                {session.nguoi_nop} ({session.mssv})
              </dd>
            </div>
            <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-200">
              <dt className="text-slate-500">Nội dung CK</dt>
              <dd className="font-mono text-xs font-semibold text-slate-900 text-right">
                {session.noi_dung_ck}
              </dd>
            </div>
          </dl>

          {/* Nguồn tiền & Nút xác nhận */}
          {session.trang_thai === "CHO_THANH_TOAN" && (
            <>
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-5 w-5 text-[#1F5CA9]" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Tài khoản Sandbox</p>
                    <p className="text-[11px] font-mono text-slate-500">**** **** 6868</p>
                  </div>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirm}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 transition-all"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  Xác nhận thanh toán
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCancel}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Hủy giao dịch
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QrPayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
          <Loader2 className="h-7 w-7 animate-spin text-[#1F5CA9]" />
        </div>
      }
    >
      <QrCheckoutContent />
    </Suspense>
  );
}
