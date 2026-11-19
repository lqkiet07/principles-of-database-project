"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Receipt,
  Search,
  Send,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { apiDownload, apiRequest } from "@/lib/api";
import { formatDate, formatMonthLabel, formatNumber, formatVND } from "@/lib/format";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SectionCard } from "@/components/shared/section-card";
import { BillStatusBadge } from "@/components/shared/status-badge";
import { BillRow } from "@/features/admin/bills/types";
import { ManualMeterModal } from "@/features/admin/bills/manual-meter-modal";
import { SendBillsModal } from "@/features/admin/bills/send-bills-modal";
import { UtilityForecastTab } from "@/features/admin/bills/utility-forecast-tab";

export default function AdminBillsPage() {
  const [tab, setTab] = useState<"bills" | "forecast">("bills");

  const [thang, setThang] = useState("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [hanNop, setHanNop] = useState<string | null>(null);
  const [donGiaDien, setDonGiaDien] = useState(3500);
  const [donGiaNuoc, setDonGiaNuoc] = useState(15000);

  const [maKhu, setMaKhu] = useState("");
  const [trangThai, setTrangThai] = useState<"TAT_CA" | "DA_NOP" | "CHUA_NOP" | "CHUA_NHAP">("TAT_CA");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [manualRoom, setManualRoom] = useState<BillRow | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        trang_thai: trangThai,
      });
      if (thang) params.set("thang", thang);
      if (maKhu) params.set("ma_khu", maKhu);
      if (search.trim()) params.set("search", search.trim());

      const res = await apiRequest<{
        thang: string;
        available_months: string[];
        han_nop_dien_nuoc: string | null;
        don_gia_dien: number;
        don_gia_nuoc: number;
        items: BillRow[];
        total: number;
      }>(`/api/admin/bills?${params.toString()}`);

      setThang(res.thang);
      setAvailableMonths(res.available_months);
      setHanNop(res.han_nop_dien_nuoc);
      setDonGiaDien(res.don_gia_dien);
      setDonGiaNuoc(res.don_gia_nuoc);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tải danh sách hóa đơn.");
    } finally {
      setLoading(false);
    }
  }, [thang, maKhu, trangThai, search, page, pageSize]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleExport = async (format: "excel" | "pdf") => {
    if (!thang) return;
    try {
      const qs = new URLSearchParams({ thang, format });
      if (maKhu) qs.set("ma_khu", maKhu);
      await apiDownload(
        `/api/admin/bills/export?${qs.toString()}`,
        `bao_cao_dien_nuoc_${thang}.${format === "excel" ? "xlsx" : "pdf"}`
      );
      toast.success(`Đã xuất báo cáo ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể xuất báo cáo.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("bills")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
              tab === "bills" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="h-4 w-4" />
            Chỉ số & Hóa đơn
          </button>
          <button
            type="button"
            onClick={() => setTab("forecast")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
              tab === "forecast" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Dự báo tiêu thụ (AI)
          </button>
        </div>

        {tab === "bills" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSendOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              <Send className="h-3.5 w-3.5" />
              Gửi hóa đơn
            </button>
            <button
              type="button"
              onClick={() => handleExport("excel")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        )}
      </div>

      {tab === "forecast" ? (
        <UtilityForecastTab />
      ) : (
        <>
          <SectionCard
            title="Lọc hóa đơn & Đơn giá áp dụng"
            subtitle={`Điện: ${formatVND(donGiaDien)}/kWh · Nước: ${formatVND(donGiaNuoc)}/m³${
              hanNop ? ` · Hạn nộp: ${formatDate(hanNop)}` : ""
            }`}
            icon={Search}
          >
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={thang}
                onChange={(e) => {
                  setThang(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-[#1F5CA9]"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>

              <select
                value={maKhu}
                onChange={(e) => {
                  setMaKhu(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="">Tất cả khu</option>
                <option value="A">Khu A</option>
                <option value="B">Khu B</option>
                <option value="C">Khu C</option>
              </select>

              <select
                value={trangThai}
                onChange={(e) => {
                  setTrangThai(e.target.value as typeof trangThai);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="TAT_CA">Tất cả trạng thái</option>
                <option value="CHUA_NHAP">Chưa nhập chỉ số</option>
                <option value="CHUA_NOP">Chưa nộp</option>
                <option value="DA_NOP">Đã nộp</option>
              </select>

              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm phòng..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={`Bảng chỉ số & Hóa đơn ${thang ? formatMonthLabel(thang) : ""}`}
            subtitle={`Tổng ${total} phòng`}
            icon={Receipt}
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Phòng</th>
                    <th className="px-5 py-3 text-right">Điện (kWh)</th>
                    <th className="px-5 py-3 text-right">Nước (m³)</th>
                    <th className="px-5 py-3 text-right">Tổng tiền</th>
                    <th className="px-5 py-3 text-center">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
                        Đang tải...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        Không có dữ liệu phòng phù hợp.
                      </td>
                    </tr>
                  ) : (
                    items.map((r) => (
                      <tr key={r.ma_phong} className="hover:bg-slate-50/70">
                        <td className="px-5 py-2.5 font-medium text-slate-900">
                          {r.ten_phong}
                          <span className="ml-1.5 text-xs font-normal text-slate-400">
                            ({r.so_nguoi_o} SV)
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-700">
                          {r.luong_dien != null ? (
                            <span>
                              {r.chi_so_dien_dau} → {r.chi_so_dien_cuoi}{" "}
                              <strong className="text-slate-900">({formatNumber(r.luong_dien)})</strong>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-700">
                          {r.luong_nuoc != null ? (
                            <span>
                              {r.chi_so_nuoc_dau} → {r.chi_so_nuoc_cuoi}{" "}
                              <strong className="text-slate-900">({formatNumber(r.luong_nuoc)})</strong>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold text-slate-900">
                          {r.so_tien != null ? formatVND(r.so_tien) : <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <BillStatusBadge status={r.trang_thai} />
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap">
                          {r.trang_thai !== "DA_NOP" ? (
                            <button
                              type="button"
                              onClick={() => setManualRoom(r)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F5CA9] hover:underline"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Nhập chỉ số
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Đã thu</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </SectionCard>
        </>
      )}

      <ManualMeterModal
        room={manualRoom}
        thang={thang}
        onClose={() => setManualRoom(null)}
        onSuccess={fetchBills}
      />

      <SendBillsModal
        open={sendOpen}
        thang={thang}
        selectedRoomIds={[]}
        onClose={() => setSendOpen(false)}
        onSuccess={fetchBills}
      />
    </div>
  );
}
