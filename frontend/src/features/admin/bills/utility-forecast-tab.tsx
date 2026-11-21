"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMonthLabel, formatNumber, formatVND } from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";

export function UtilityForecastTab() {
  const { user } = useAuth();
  const scopeKhu = user?.ma_khu_phu_trach || null;

  const [maKhu, setMaKhu] = useState(scopeKhu || "");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (scopeKhu) setMaKhu(scopeKhu);
  }, [scopeKhu]);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    try {
      const effectiveKhu = scopeKhu || maKhu;
      const qs = effectiveKhu ? `?ma_khu=${effectiveKhu}` : "";
      const res = await apiRequest<any>(`/api/admin/bills/forecast${qs}`);
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải dự báo tiêu thụ.");
    } finally {
      setLoading(false);
    }
  }, [scopeKhu, maKhu]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const handleSendSavingAdvice = async () => {
    setNotifying(true);
    try {
      const res = await apiRequest<any>("/api/admin/bills/forecast/notify-saving", {
        method: "POST",
        body: { ma_khu: scopeKhu || maKhu || null },
      });
      toast.success(res.thong_bao || "Đã gửi khuyến cáo tiết kiệm điện nước.");
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi khuyến cáo.");
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Dự báo sản lượng tiêu thụ điện nước 3 tháng tới"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scopeKhu || maKhu}
              disabled={Boolean(scopeKhu)}
              onChange={(e) => setMaKhu(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1F5CA9] disabled:bg-slate-100"
            >
              {!scopeKhu && <option value="">Toàn KTX (Khu A &amp; B)</option>}
              {(!scopeKhu || scopeKhu === "A") && <option value="A">Khu A</option>}
              {(!scopeKhu || scopeKhu === "B") && <option value="B">Khu B</option>}
            </select>
            <button
              type="button"
              disabled={loading || notifying}
              onClick={handleSendSavingAdvice}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
            >
              <BellRing className="h-3.5 w-3.5" />
              {notifying ? "Đang gửi..." : "Gửi khuyến cáo tiết kiệm"}
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
            Đang huấn luyện RandomForestRegressor...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chỉ số đánh giá mô hình */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Số mẫu huấn luyện</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {data?.metrics?.so_mau_huan_luyen || 0} phòng-tháng
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Độ phù hợp R² (Điện)</p>
                <p className="mt-1 text-lg font-bold text-[#1F5CA9]">
                  {data?.metrics?.r2_dien ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Sai số MAE (Điện)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  ±{data?.metrics?.mae_dien ?? 0} kWh
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Sai số MAE (Nước)</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  ±{data?.metrics?.mae_nuoc ?? 0} m³
                </p>
              </div>
            </div>

            {/* Bảng dự báo 3 tháng tới */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">
                Kết quả dự báo 3 tháng kế tiếp
              </div>
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Tháng dự báo</th>
                    <th className="px-4 py-2.5 text-right">Số phòng</th>
                    <th className="px-4 py-2.5 text-right">Điện dự báo (kWh)</th>
                    <th className="px-4 py-2.5 text-right">Nước dự báo (m³)</th>
                    <th className="px-4 py-2.5 text-right">Ước tính hóa đơn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.du_bao || []).map((row: any) => (
                    <tr key={row.thang}>
                      <td className="px-4 py-2.5 font-semibold text-[#1F5CA9]">
                        {formatMonthLabel(row.thang)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{row.so_phong}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatNumber(row.dien_kwh_du_bao)} kWh
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatNumber(row.nuoc_m3_du_bao)} m³
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {formatVND(row.uoc_tinh_tien)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bảng lịch sử tiêu thụ */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">
                Dữ liệu tiêu thụ thực tế các tháng trước
              </div>
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Tháng</th>
                    <th className="px-4 py-2.5 text-right">Số phòng</th>
                    <th className="px-4 py-2.5 text-right">Điện (kWh)</th>
                    <th className="px-4 py-2.5 text-right">Nước (m³)</th>
                    <th className="px-4 py-2.5 text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.lich_su || []).map((row: any) => (
                    <tr key={row.thang}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {formatMonthLabel(row.thang)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{row.so_phong}</td>
                      <td className="px-4 py-2.5 text-right">{formatNumber(row.dien_kwh)} kWh</td>
                      <td className="px-4 py-2.5 text-right">{formatNumber(row.nuoc_m3)} m³</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                        {formatVND(row.uoc_tinh_tien)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
