"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { formatDateTime, formatVND } from "@/lib/format";

export interface LinkedAccount {
  ma_lk: number;
  ngan_hang: string;
  so_tai_khoan_che: string;
  so_du_sandbox: number;
  mac_dinh: boolean;
}

export interface CheckoutSession {
  ma_phien: string;
  ma_hoa_don: number;
  ten_phong: string;
  ma_khu: string;
  tieu_de: string;
  nguoi_nop: string;
  mssv: string;
  so_tien: number;
  noi_dung_ck: string;
  ngan_hang?: {
    bin: string;
    ten: string;
    stk: string;
    chu_tk: string;
  };
  tai_khoan_lien_ket?: LinkedAccount[];
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

export function QrCheckoutClient({
  sessionId,
  sig,
  initialSession,
  initialError,
}: {
  sessionId: string;
  sig: string;
  initialSession: CheckoutSession | null;
  initialError: string;
}) {
  const initialAccs = initialSession?.tai_khoan_lien_ket || [];
  const initialDefault = initialAccs.find((a) => a.mac_dinh) || initialAccs[0];

  const [session, setSession] = useState<CheckoutSession | null>(initialSession);
  const [countdown, setCountdown] = useState<number>(
    Number(initialSession?.con_lai_giay || 0)
  );
  const [error, setError] = useState<string>(initialError);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>(
    initialDefault ? String(initialDefault.ma_lk) : ""
  );
  const [balanceAfter, setBalanceAfter] = useState<{ before: number; after: number } | null>(
    null
  );

  const loadSession = useCallback(async () => {
    if (!sessionId || !sig) {
      setError("Liên kết thanh toán không hợp lệ.");
      return;
    }
    try {
      const res = await fetch(
        `/api/payments/qr/${encodeURIComponent(sessionId)}?sig=${encodeURIComponent(sig)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Không tìm thấy phiên thanh toán.");
        setSession(null);
      } else {
        setSession(data);
        setCountdown(Number(data.con_lai_giay || 0));
        const accs: LinkedAccount[] = data.tai_khoan_lien_ket || [];
        const def = accs.find((a) => a.mac_dinh) || accs[0];
        setSelectedBankId((prev) => prev || (def ? String(def.ma_lk) : ""));
      }
    } catch {
      setError("Không thể kết nối đến máy chủ thanh toán.");
    }
  }, [sessionId, sig]);

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
          body: JSON.stringify({
            sig,
            phuong_thuc: "QR_NGAN_HANG",
            ma_lk: selectedBankId ? Number(selectedBankId) : null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Thanh toán không thành công.");
        await loadSession();
      } else {
        if (data.so_du_sau !== undefined && data.so_du_sau !== null) {
          setBalanceAfter({ before: Number(data.so_du_truoc), after: Number(data.so_du_sau) });
        }
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
  const linkedList = session.tai_khoan_lien_ket || [];

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-br from-[#1F5CA9] to-[#16447E] px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-blue-100 font-medium">Cổng ngân hàng Sandbox ACID</p>
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

          {session.trang_thai === "THANH_CONG" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="text-lg font-bold text-emerald-900">Biên lai thanh toán thành công</h2>
              {session.ma_giao_dich && (
                <p className="text-xs font-mono text-emerald-800 bg-white/80 inline-block px-3 py-1 rounded-full border border-emerald-200">
                  Mã GD: {session.ma_giao_dich}
                </p>
              )}
              {balanceAfter && (
                <p className="text-xs text-emerald-800">
                  Số dư TK ngân hàng: {formatVND(balanceAfter.before)} →{" "}
                  <strong>{formatVND(balanceAfter.after)}</strong>
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
              <h2 className="text-base font-bold text-amber-900">Phiên thanh toán đã hết hạn</h2>
            </div>
          )}

          <dl className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Đơn vị thụ hưởng</dt>
              <dd className="font-semibold text-slate-900 text-right">
                {session.ngan_hang?.chu_tk || "Ban Quản lý KTX CTU"}
              </dd>
            </div>
            {session.ngan_hang && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Tài khoản</dt>
                <dd className="font-mono text-xs font-semibold text-slate-800 text-right">
                  {session.ngan_hang.stk} · {session.ngan_hang.ten}
                </dd>
              </div>
            )}
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

          {session.trang_thai === "CHO_THANH_TOAN" && (
            <>
              {linkedList.length > 0 ? (
                <div className="space-y-3">
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800"
                  >
                    {linkedList.map((a) => (
                      <option key={a.ma_lk} value={a.ma_lk}>
                        {a.ngan_hang} ({a.so_tai_khoan_che}) · {formatVND(a.so_du_sandbox)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  Bạn chưa có tài khoản ngân hàng liên kết. Vui lòng liên kết ngân hàng trên trang sinh viên trước khi thanh toán.
                </p>
              )}

              <button
                type="button"
                disabled={submitting || linkedList.length === 0}
                onClick={handleConfirm}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-base font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                Xác nhận chuyển khoản
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleCancel}
                className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Hủy giao dịch
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
