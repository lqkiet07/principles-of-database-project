"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Droplets,
  History,
  Loader2,
  Plus,
  QrCode,
  UserCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatMonthLabel,
  formatNumber,
  formatVND,
} from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";
import { BillStatusBadge } from "@/components/shared/status-badge";
import { QrPaymentModal, type QrSessionState } from "@/features/student/qr-payment-modal";

export default function StudentBillsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingQr, setCreatingQr] = useState<number | null>(null);
  const [payingWallet, setPayingWallet] = useState<number | null>(null);
  const [qrSession, setQrSession] = useState<QrSessionState | null>(null);

  const [topupAmount, setTopupAmount] = useState("1000000");
  const [toppingUp, setToppingUp] = useState(false);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/student/bills");
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải thông tin hóa đơn.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const startQrPayment = async (maHoaDon: number) => {
    setCreatingQr(maHoaDon);
    try {
      const session = await apiRequest<QrSessionState>(
        `/api/student/bills/${maHoaDon}/qr-session`,
        {
          method: "POST",
          body: {
            frontend_origin:
              typeof window !== "undefined" ? window.location.origin : null,
          },
        }
      );
      setQrSession(session);
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo mã QR thanh toán.");
    } finally {
      setCreatingQr(null);
    }
  };

  const payByWallet = async (maHoaDon: number) => {
    setPayingWallet(maHoaDon);
    try {
      const res = await apiRequest<any>(`/api/student/bills/${maHoaDon}/pay-wallet`, {
        method: "POST",
        body: { gia_lap_loi: false },
      });
      toast.success(
        `Đã thanh toán bằng số dư ví (Mã GD: ${res.ma_giao_dich}). Số dư mới: ${formatVND(res.so_du_sau)}`
      );
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Không thể thanh toán bằng số dư ví.");
    } finally {
      setPayingWallet(null);
    }
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topupAmount);
    if (!amount || amount < 10000) {
      toast.error("Số tiền nạp tối thiểu 10.000 đ.");
      return;
    }
    setToppingUp(true);
    try {
      const res = await apiRequest<any>("/api/student/wallet/topup", {
        method: "POST",
        body: { so_tien: amount },
      });
      toast.success(`Đã nạp ${formatVND(amount)}. Số dư mới: ${formatVND(res.so_du_sau)}`);
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Không thể nạp tiền.");
    } finally {
      setToppingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
        Đang tải dữ liệu...
      </div>
    );
  }

  const sv = data?.sinh_vien;
  const hdKtx = data?.hoa_don_ktx;
  const hdDn = data?.hoa_don_dien_nuoc;
  const walletLogs = data?.giao_dich_vi || [];

  return (
    <div className="space-y-5">
      {/* Khung bao 1: Thông tin sinh viên & Số dư tài khoản nội trú */}
      <SectionCard
        title={sv?.ho_ten || "Thông tin nội trú"}
        subtitle={`${sv?.mssv || ""}${sv?.ten_ky ? ` · ${sv.ten_ky}` : ""}`}
        icon={Wallet}
        right={
          <div className="flex items-center gap-2">
            {sv?.ten_phong && (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
                Phòng {sv.ten_phong}
              </span>
            )}
            {sv?.la_dai_dien && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-[#1F5CA9]">
                <UserCheck className="h-3.5 w-3.5" />
                Đại diện phòng
              </span>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Số dư tài khoản nội trú</p>
            <p className="mt-1 text-2xl font-bold text-[#1F5CA9]">
              {formatVND(sv?.so_du || 0)}
            </p>
            {!sv?.la_dai_dien && sv?.ten_dai_dien && (
              <p className="mt-1.5 text-xs text-slate-500">
                Đại diện thanh toán phòng: <strong className="text-slate-700">{sv.ten_dai_dien}</strong> ({sv.mssv_dai_dien})
              </p>
            )}
          </div>

          <form onSubmit={handleTopup} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">Nạp tiền vào tài khoản nội trú</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="flex-1 min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="500000">500.000 đ</option>
                <option value="1000000">1.000.000 đ</option>
                <option value="2000000">2.000.000 đ</option>
                <option value="3000000">3.000.000 đ</option>
              </select>
              <button
                type="submit"
                disabled={toppingUp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {toppingUp ? "Đang nạp..." : "Nạp tiền"}
              </button>
            </div>
          </form>
        </div>
      </SectionCard>

      {!sv?.ten_phong ? (
        <SectionCard title="Thông báo xếp phòng" icon={Building2}>
          <p className="text-sm text-slate-500">Chưa được xếp phòng trong kỳ hiện tại.</p>
        </SectionCard>
      ) : (
        <>
          {/* Khung bao 2: Hóa đơn tiền phòng KTX */}
          <SectionCard
            title="Tiền phòng KTX kỳ này"
            subtitle={`${sv.ten_ky} · Phòng ${sv.ten_phong}`}
            icon={Building2}
            right={hdKtx ? <BillStatusBadge status={hdKtx.trang_thai} /> : null}
          >
            {!hdKtx ? (
              <p className="text-sm text-slate-500">Chưa có hóa đơn tiền phòng KTX.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Tổng tiền phòng cả kỳ</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">
                      {formatVND(hdKtx.so_tien)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Hạn đóng</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {formatDate(hdKtx.han_nop)}
                    </p>
                  </div>
                </div>

                {hdKtx.trang_thai === "CHUA_NOP" && sv.la_dai_dien && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={payingWallet === hdKtx.ma_hoa_don}
                      onClick={() => payByWallet(hdKtx.ma_hoa_don)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5CA9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
                    >
                      {payingWallet === hdKtx.ma_hoa_don ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      Thanh toán bằng số dư
                    </button>
                    <button
                      type="button"
                      disabled={creatingQr === hdKtx.ma_hoa_don}
                      onClick={() => startQrPayment(hdKtx.ma_hoa_don)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {creatingQr === hdKtx.ma_hoa_don ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 text-[#1F5CA9]" />
                      )}
                      Thanh toán qua mã QR
                    </button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Khung bao 3: Hóa đơn tiền điện nước */}
          <SectionCard
            title="Tiền điện nước cả phòng"
            subtitle={`${hdDn ? formatMonthLabel(hdDn.thang) : "Kỳ hiện tại"} · Phòng ${sv.ten_phong}`}
            icon={Zap}
            iconBg="bg-amber-50 text-amber-600"
            right={hdDn ? <BillStatusBadge status={hdDn.trang_thai} /> : null}
          >
            {!hdDn ? (
              <p className="text-sm text-slate-500">Chưa có hóa đơn điện nước kỳ này.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <Zap className="h-4 w-4" />
                      Điện tiêu thụ
                    </div>
                    <p className="mt-1.5 text-lg font-bold text-slate-900">
                      {formatVND(hdDn.tien_dien)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatNumber(hdDn.chi_so_dien_dau)} → {formatNumber(hdDn.chi_so_dien_cuoi)} (
                      <strong>{formatNumber(hdDn.luong_dien)} kWh</strong>)
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                      <Droplets className="h-4 w-4" />
                      Nước tiêu thụ
                    </div>
                    <p className="mt-1.5 text-lg font-bold text-slate-900">
                      {formatVND(hdDn.tien_nuoc)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatNumber(hdDn.chi_so_nuoc_dau)} → {formatNumber(hdDn.chi_so_nuoc_cuoi)} (
                      <strong>{formatNumber(hdDn.luong_nuoc)} m³</strong>)
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Tổng tiền điện nước cả phòng</p>
                    <p className="text-2xl font-bold text-[#1F5CA9] mt-0.5">
                      {formatVND(hdDn.so_tien)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Hạn đóng</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {formatDate(hdDn.han_nop)}
                    </p>
                  </div>
                </div>

                {hdDn.trang_thai === "CHUA_NOP" && sv.la_dai_dien && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={payingWallet === hdDn.ma_hoa_don}
                      onClick={() => payByWallet(hdDn.ma_hoa_don)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F5CA9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
                    >
                      {payingWallet === hdDn.ma_hoa_don ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      Thanh toán bằng số dư
                    </button>
                    <button
                      type="button"
                      disabled={creatingQr === hdDn.ma_hoa_don}
                      onClick={() => startQrPayment(hdDn.ma_hoa_don)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {creatingQr === hdDn.ma_hoa_don ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 text-[#1F5CA9]" />
                      )}
                      Thanh toán qua mã QR
                    </button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* Khung bao 4: Lịch sử giao dịch ví */}
      {walletLogs.length > 0 && (
        <SectionCard
          title="Lịch sử giao dịch tài khoản"
          subtitle="Biến động số dư ghi nhận từ các giao dịch ACID"
          icon={History}
          iconBg="bg-slate-100 text-slate-700"
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Nội dung</th>
                  <th className="px-5 py-3 text-right">Số tiền</th>
                  <th className="px-5 py-3 text-right">Số dư sau</th>
                  <th className="px-5 py-3 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {walletLogs.map((g: any) => (
                  <tr key={g.ma_gd}>
                    <td className="px-5 py-2.5 text-slate-800">{g.mo_ta}</td>
                    <td
                      className={`px-5 py-2.5 text-right font-semibold ${
                        g.loai === "NAP_TIEN" ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {g.loai === "NAP_TIEN" ? "+" : "-"}
                      {formatVND(g.so_tien)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-700">
                      {formatVND(g.so_du_sau)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(g.thoi_gian)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <QrPaymentModal
        session={qrSession}
        onUpdateSession={setQrSession}
        onRetryCreate={startQrPayment}
        onPaid={loadBills}
      />
    </div>
  );
}
