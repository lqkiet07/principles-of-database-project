"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { Modal } from "@/components/shared/modal";

export interface BankInfo {
  bin: string;
  ten: string;
  stk: string;
  chu_tk: string;
}

export interface LinkedBankAccount {
  ma_lk: number;
  ngan_hang: string;
  ma_bin: string;
  so_tai_khoan: string;
  so_tai_khoan_che: string;
  ten_chu_tk: string;
  so_du_sandbox: number;
  mac_dinh: boolean;
}

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
  ngan_hang?: BankInfo;
  tai_khoan_lien_ket?: LinkedBankAccount[];
  trang_thai: "CHO_THANH_TOAN" | "THANH_CONG" | "DA_HUY" | "HET_HAN";
  con_lai_giay: number;
  ma_giao_dich?: string | null;
  phuong_thuc?: string | null;
  ngan_hang_nguon?: string | null;
  so_du_truoc?: number | null;
  so_du_sau?: number | null;
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
  onViewReceipt?: (maHoaDon: number) => void;
}

export function QrPaymentModal({
  session,
  onUpdateSession,
  onRetryCreate,
  onPaid,
  onViewReceipt,
}: QrPaymentModalProps) {
  const [countdown, setCountdown] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const [selectedBankId, setSelectedBankId] = useState<string>("");

  useEffect(() => {
    if (session) {
      setCountdown(session.con_lai_giay || 900);
      const list = session.tai_khoan_lien_ket || [];
      const def = list.find((a) => a.mac_dinh) || list[0];
      setSelectedBankId(def ? String(def.ma_lk) : "");
    }
  }, [session?.ma_phien, session?.con_lai_giay]);

  useEffect(() => {
    if (!session || session.trang_thai !== "CHO_THANH_TOAN" || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [session, countdown]);

  // Polling trạng thái phiên thanh toán mỗi 1,5 giây
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
              ? {
                  ...prev,
                  trang_thai: st.trang_thai,
                  ma_giao_dich: st.ma_giao_dich,
                  phuong_thuc: st.phuong_thuc,
                }
              : prev
          );
          if (st.trang_thai === "THANH_CONG") {
            toast.success(`Thanh toán thành công! Mã GD: ${st.ma_giao_dich || ""}`);
            onPaid();
          } else if (st.trang_thai === "DA_HUY") {
            toast.info("Giao dịch thanh toán đã bị hủy.");
          } else if (st.trang_thai === "HET_HAN") {
            toast.warning("Phiên thanh toán đã hết hạn.");
          }
        }
      } catch {
        // ignore transient polling error
      }
    };

    const interval = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session, onUpdateSession, onPaid]);

  const copyText = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast.success(`Đã sao chép ${label}.`));
    }
  };

  const handleConfirmLinkedBankQr = async () => {
    if (!session) return;
    setConfirming(true);
    try {
      const res = await apiRequest<any>(
        `/api/payments/qr/${encodeURIComponent(session.ma_phien)}/confirm`,
        {
          method: "POST",
          body: {
            sig: session.sig,
            phuong_thuc: "QR_NGAN_HANG",
            ma_lk: selectedBankId ? Number(selectedBankId) : null,
          },
        }
      );
      onUpdateSession((prev) =>
        prev
          ? {
              ...prev,
              trang_thai: "THANH_CONG",
              ma_giao_dich: res.ma_giao_dich,
              phuong_thuc: res.phuong_thuc,
              ngan_hang_nguon: res.ngan_hang,
              so_du_truoc: res.so_du_truoc,
              so_du_sau: res.so_du_sau,
            }
          : prev
      );
      toast.success(`Thanh toán thành công! Mã GD: ${res.ma_giao_dich}`);
      onPaid();
    } catch (err: any) {
      toast.error(err.message || "Không thể thanh toán qua ngân hàng liên kết.");
    } finally {
      setConfirming(false);
    }
  };

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

  const bank = session?.ngan_hang || {
    bin: "970436",
    ten: "Vietcombank - CN Cần Thơ",
    stk: "1026889966",
    chu_tk: "TRUONG DAI HOC CAN THO - KTX",
  };
  const linkedList = session?.tai_khoan_lien_ket || [];

  return (
    <Modal
      open={Boolean(session)}
      onClose={handleClose}
      size="md"
      title="Thanh toán hóa đơn KTX (Sandbox Ngân hàng ACID)"
      description={
        session
          ? `${session.tieu_de} · Phòng ${session.ten_phong} · Hiệu lực ${formatCountdown(countdown)}`
          : ""
      }
    >
      {session && (
        <div className="space-y-4">
          {session.trang_thai === "THANH_CONG" ? (
            <div className="py-4 space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">Thanh toán thành công</h3>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">
                  {formatVND(session.so_tien)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Mã giao dịch</span>
                  <span className="font-mono font-bold text-slate-900">
                    {session.ma_giao_dich}
                  </span>
                </div>
                {session.ngan_hang_nguon && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Tài khoản thanh toán</span>
                    <span className="font-medium text-slate-800">{session.ngan_hang_nguon}</span>
                  </div>
                )}
                {session.so_du_sau !== undefined && session.so_du_sau !== null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Biến động số dư (Sandbox)</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatVND(session.so_du_truoc)} → {formatVND(session.so_du_sau)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {onViewReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      const billId = session.ma_hoa_don;
                      onUpdateSession(null);
                      onViewReceipt(billId);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1F5CA9] bg-blue-50 px-4 py-2.5 text-sm font-semibold text-[#1F5CA9] hover:bg-blue-100"
                  >
                    <FileText className="h-4 w-4" />
                    Xem &amp; In biên lai
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onUpdateSession(null)}
                  className="flex-1 rounded-xl bg-[#1F5CA9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#194B8B]"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : session.trang_thai === "HET_HAN" || session.trang_thai === "DA_HUY" ? (
            <div className="py-5 space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                {session.trang_thai === "HET_HAN" ? (
                  <Clock className="h-8 w-8" />
                ) : (
                  <XCircle className="h-8 w-8" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {session.trang_thai === "HET_HAN" ? "Phiên thanh toán đã hết hạn" : "Giao dịch đã hủy"}
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
                  Tạo phiên mới
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col items-center rounded-2xl border-2 border-[#1F5CA9]/20 bg-white p-3.5 text-center">
                    <QRCodeSVG
                      value={session.qr_url}
                      size={172}
                      level="M"
                      fgColor="#0F172A"
                    />
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F5CA9]">
                      <Landmark className="h-3.5 w-3.5" />
                      Quét bằng điện thoại cùng Wi-Fi
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2.5">
                    <div>
                      <p className="text-slate-400">Ngân hàng thụ hưởng</p>
                      <p className="font-semibold text-slate-900">{bank.ten}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-slate-400">Số tài khoản</p>
                        <p className="font-mono font-bold text-slate-900">{bank.stk}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(bank.stk, "số tài khoản")}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Chép
                      </button>
                    </div>
                    <div>
                      <p className="text-slate-400">Chủ tài khoản</p>
                      <p className="font-semibold text-slate-800">{bank.chu_tk}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Số tiền thanh toán</p>
                      <p className="font-bold text-base text-[#1F5CA9]">
                        {formatVND(session.so_tien)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                      <div className="min-w-0">
                        <p className="text-slate-400">Nội dung chuyển khoản</p>
                        <p className="font-mono font-bold text-slate-900 break-all">
                          {session.noi_dung_ck}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(session.noi_dung_ck, "nội dung CK")}
                        className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Chép
                      </button>
                    </div>
                  </div>
                </div>

                {linkedList.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tài khoản ngân hàng liên kết trích tiền (Sandbox ACID)
                    </label>
                    <select
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-[#1F5CA9]"
                    >
                      {linkedList.map((acc) => (
                        <option key={acc.ma_lk} value={acc.ma_lk}>
                          {acc.ngan_hang} ({acc.so_tai_khoan_che}) · Số dư:{" "}
                          {formatVND(acc.so_du_sandbox)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Bạn chưa có tài khoản ngân hàng liên kết. Hãy đóng cửa sổ và bấm &quot;Liên kết ngân hàng&quot; ở màn hình chính trước khi thanh toán.
                  </p>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={confirming || linkedList.length === 0}
                    onClick={handleConfirmLinkedBankQr}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {confirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Xác nhận thanh toán qua ngân hàng liên kết
                  </button>
                  <a
                    href={session.local_pay_path}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1F5CA9]/30 bg-blue-50 px-4 py-2 text-xs font-semibold text-[#1F5CA9] hover:bg-blue-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mở cổng thanh toán Sandbox ở tab mới
                  </a>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy giao dịch
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
