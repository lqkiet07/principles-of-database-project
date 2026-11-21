"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Droplets,
  FileText,
  History,
  Landmark,
  Loader2,
  Plus,
  QrCode,
  Trash2,
  UserCheck,
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
import { Modal } from "@/components/shared/modal";
import { SectionCard } from "@/components/shared/section-card";
import { BillStatusBadge } from "@/components/shared/status-badge";
import {
  LinkedBankAccount,
  QrPaymentModal,
  type QrSessionState,
} from "@/features/student/qr-payment-modal";
import {
  formatPaymentMethod,
  ReceiptDetail,
  ReceiptModal,
} from "@/features/student/receipt-modal";

const BANK_OPTIONS = [
  { name: "Vietcombank", bin: "970436" },
  { name: "BIDV", bin: "970418" },
  { name: "Agribank", bin: "970405" },
  { name: "MBBank", bin: "970422" },
  { name: "VietinBank", bin: "970415" },
  { name: "ACB", bin: "970416" },
  { name: "Ngân hàng TMCP Quốc Dân (NCB)", bin: "970419" },
];

export default function StudentBillsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingQr, setCreatingQr] = useState<number | null>(null);
  const [qrSession, setQrSession] = useState<QrSessionState | null>(null);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);

  // Modal liên kết ngân hàng
  const [linkOpen, setLinkOpen] = useState(false);
  const [bankIdx, setBankIdx] = useState(0);
  const [accountNo, setAccountNo] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [linking, setLinking] = useState(false);

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

  const openReceipt = async (maHoaDon: number) => {
    try {
      const res = await apiRequest<ReceiptDetail>(`/api/student/bills/${maHoaDon}/receipt`);
      setReceipt(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải biên lai điện tử.");
    }
  };

  const startPayment = async (maHoaDon: number) => {
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
      toast.error(err.message || "Không thể khởi tạo cổng thanh toán.");
    } finally {
      setCreatingQr(null);
    }
  };

  const handleLinkBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinking(true);
    try {
      const chosen = BANK_OPTIONS[bankIdx] || BANK_OPTIONS[0];
      const res = await apiRequest<any>("/api/student/bank-accounts", {
        method: "POST",
        body: {
          ngan_hang: chosen.name,
          ma_bin: chosen.bin,
          so_tai_khoan: accountNo.trim(),
          ten_chu_tk: accountHolder.trim().toUpperCase(),
          mac_dinh: isDefault,
        },
      });
      toast.success(res.thong_bao || "Đã liên kết tài khoản ngân hàng.");
      setLinkOpen(false);
      setAccountNo("");
      setAccountHolder("");
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Không thể liên kết tài khoản ngân hàng.");
    } finally {
      setLinking(false);
    }
  };

  const handleSetDefaultBank = async (maLk: number) => {
    try {
      const res = await apiRequest<any>(`/api/student/bank-accounts/${maLk}/default`, {
        method: "PATCH",
      });
      toast.success(res.thong_bao || "Đã đặt làm tài khoản mặc định.");
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật tài khoản mặc định.");
    }
  };

  const handleUnlinkBank = async (maLk: number) => {
    try {
      const res = await apiRequest<any>(`/api/student/bank-accounts/${maLk}`, {
        method: "DELETE",
      });
      toast.success(res.thong_bao || "Đã hủy liên kết tài khoản.");
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Không thể hủy liên kết tài khoản.");
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
  const bankAccounts: LinkedBankAccount[] = data?.tai_khoan_ngan_hang || [];
  const bankTxs: any[] = data?.giao_dich_ngan_hang || [];
  const hdKtx = data?.hoa_don_ktx;
  const hdDn = data?.hoa_don_dien_nuoc;
  const receipts = data?.bien_lai_list || [];

  return (
    <div className="space-y-5">
      {/* Khung 1: Tài khoản ngân hàng liên kết (Sandbox ACID) */}
      <SectionCard
        title="Tài khoản ngân hàng liên kết"
        subtitle={`${sv?.ho_ten || ""} (${sv?.mssv || ""})${sv?.ten_phong ? ` · Phòng ${sv.ten_phong}` : ""}`}
        icon={Landmark}
        right={
          <div className="flex items-center gap-2">
            {sv?.la_dai_dien && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-[#1F5CA9]">
                <UserCheck className="h-3.5 w-3.5" />
                Đại diện phòng
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setAccountHolder((sv?.ho_ten || "").toUpperCase());
                setLinkOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#194B8B]"
            >
              <Plus className="h-3.5 w-3.5" />
              Liên kết ngân hàng
            </button>
          </div>
        }
      >
        {bankAccounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có tài khoản ngân hàng liên kết. Hãy bấm &quot;Liên kết ngân hàng&quot; để thêm tài khoản thanh toán hóa đơn KTX.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bankAccounts.map((acc) => (
              <div
                key={acc.ma_lk}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-2 ${
                  acc.mac_dinh
                    ? "border-[#1F5CA9]/40 bg-blue-50/40"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{acc.ngan_hang}</span>
                      {acc.mac_dinh && (
                        <span className="rounded bg-[#1F5CA9] px-2 py-0.5 text-[10px] font-semibold text-white">
                          Mặc định
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {acc.so_tai_khoan_che} · {acc.ten_chu_tk}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Số dư Sandbox</p>
                    <p className="text-sm font-bold text-[#1F5CA9]">
                      {formatVND(acc.so_du_sandbox)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  {!acc.mac_dinh && (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultBank(acc.ma_lk)}
                      className="font-semibold text-[#1F5CA9] hover:underline"
                    >
                      Đặt mặc định
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleUnlinkBank(acc.ma_lk)}
                    className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hủy liên kết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {!sv?.ten_phong ? (
        <SectionCard title="Thông báo xếp phòng" icon={Building2}>
          <p className="text-sm text-slate-500">Chưa được xếp phòng trong kỳ hiện tại.</p>
        </SectionCard>
      ) : (
        <>
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

                {hdKtx.trang_thai === "CHUA_NOP" ? (
                  <div>
                    <button
                      type="button"
                      disabled={creatingQr === hdKtx.ma_hoa_don}
                      onClick={() => startPayment(hdKtx.ma_hoa_don)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
                    >
                      {creatingQr === hdKtx.ma_hoa_don ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      Thanh toán hóa đơn
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs">
                    <span className="text-emerald-800">
                      Mã GD: <strong className="font-mono">{hdKtx.ma_giao_dich || "Đã đối soát"}</strong>
                      {hdKtx.thoi_gian_thanh_toan ? ` · ${formatDateTime(hdKtx.thoi_gian_thanh_toan)}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => openReceipt(hdKtx.ma_hoa_don)}
                      className="inline-flex items-center gap-1 font-semibold text-[#1F5CA9] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Xem biên lai điện tử
                    </button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

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

                {hdDn.trang_thai === "CHUA_NOP" ? (
                  <div>
                    <button
                      type="button"
                      disabled={creatingQr === hdDn.ma_hoa_don}
                      onClick={() => startPayment(hdDn.ma_hoa_don)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
                    >
                      {creatingQr === hdDn.ma_hoa_don ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      Thanh toán hóa đơn
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs">
                    <span className="text-emerald-800">
                      Mã GD: <strong className="font-mono">{hdDn.ma_giao_dich || "Đã đối soát"}</strong>
                      {hdDn.thoi_gian_thanh_toan ? ` · ${formatDateTime(hdDn.thoi_gian_thanh_toan)}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => openReceipt(hdDn.ma_hoa_don)}
                      className="inline-flex items-center gap-1 font-semibold text-[#1F5CA9] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Xem biên lai điện tử
                    </button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {receipts.length > 0 && (
            <SectionCard
              title="Biên lai điện tử đã thanh toán"
              subtitle={`Lưu trữ đối soát thanh toán phòng ${sv.ten_phong}`}
              icon={FileText}
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Khoản thu</th>
                      <th className="px-5 py-3">Kênh thanh toán</th>
                      <th className="px-5 py-3 text-right">Số tiền</th>
                      <th className="px-5 py-3 text-right">Thời gian</th>
                      <th className="px-5 py-3 text-right">Biên lai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.map((r: any) => (
                      <tr key={r.ma_tt}>
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-slate-900">
                            {r.loai === "KTX"
                              ? `Tiền phòng KTX (${r.ma_ky})`
                              : `Tiền điện nước (${formatMonthLabel(r.thang)})`}
                          </p>
                          <p className="font-mono text-xs text-slate-500">{r.ma_giao_dich}</p>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-slate-700">
                          {formatPaymentMethod(r.phuong_thuc)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold text-slate-900">
                          {formatVND(r.so_tien)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                          {formatDateTime(r.thoi_gian)}
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReceipt(r.ma_hoa_don)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F5CA9] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Xem / In
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {bankTxs.length > 0 && (
        <SectionCard
          title="Lịch sử giao dịch tài khoản ngân hàng liên kết"
          subtitle="Biến động số dư ghi nhận từ các giao dịch ACID"
          icon={History}
          iconBg="bg-slate-100 text-slate-700"
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Tài khoản &amp; Nội dung</th>
                  <th className="px-5 py-3 text-right">Số tiền</th>
                  <th className="px-5 py-3 text-right">Số dư trước → sau</th>
                  <th className="px-5 py-3 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankTxs.map((tx: any) => (
                  <tr key={tx.ma_gd_nh}>
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-slate-900">
                        {tx.ngan_hang} ({tx.so_tai_khoan_che})
                      </p>
                      <p className="font-mono text-xs text-slate-500">{tx.noi_dung || tx.ma_giao_dich}</p>
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-red-700">
                      -{formatVND(tx.so_tien)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-700">
                      {formatVND(tx.so_du_truoc)} → {formatVND(tx.so_du_sau)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(tx.thoi_gian)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Modal liên kết tài khoản ngân hàng */}
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        size="sm"
        title="Liên kết tài khoản ngân hàng"
        description="Tài khoản liên kết dùng để trích tiền tự động khi thanh toán hóa đơn KTX"
      >
        <form onSubmit={handleLinkBank} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ngân hàng *
            </label>
            <select
              value={bankIdx}
              onChange={(e) => setBankIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            >
              {BANK_OPTIONS.map((b, idx) => (
                <option key={b.name} value={idx}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Số tài khoản / Số thẻ ngân hàng *
            </label>
            <input
              type="text"
              required
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              placeholder="VD: 102600001234"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tên chủ tài khoản (không dấu) *
            </label>
            <input
              type="text"
              required
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1F5CA9]"
            />
            Đặt làm tài khoản thanh toán mặc định
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setLinkOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={linking}
              className="rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
            >
              {linking ? "Đang liên kết..." : "Xác nhận liên kết"}
            </button>
          </div>
        </form>
      </Modal>

      <QrPaymentModal
        session={qrSession}
        onUpdateSession={setQrSession}
        onRetryCreate={startPayment}
        onPaid={loadBills}
        onViewReceipt={openReceipt}
      />

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
