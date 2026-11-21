"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Fingerprint, Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { apiDownload, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatDateTime, todayIsoVN } from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";

export default function AdminFingerprintAttendancePage() {
  const { user } = useAuth();
  const scopeKhu = user?.ma_khu_phu_trach || null;

  const [ngay, setNgay] = useState(todayIsoVN());
  const [maKhu, setMaKhu] = useState(scopeKhu || "");
  const [trangThai, setTrangThai] = useState<"TAT_CA" | "DA_DIEM_DANH" | "CHUA_DIEM_DANH">("TAT_CA");
  const [loaiRaVao, setLoaiRaVao] = useState<"TAT_CA" | "VAO" | "RA">("TAT_CA");
  const [search, setSearch] = useState("");

  const [thongKe, setThongKe] = useState({
    tong_sv_noi_tru: 0,
    da_diem_danh: 0,
    chua_diem_danh: 0,
    dang_trong_ktx: 0,
    da_ra_ngoai: 0,
  });
  const [items, setItems] = useState<any[]>([]);
  const [gateAlerts, setGateAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [scanInput, setScanInput] = useState("");
  const [scanLoai, setScanLoai] = useState<"VAO" | "RA">("VAO");
  const [congQuet, setCongQuet] = useState(
    scopeKhu === "B" ? "Cổng vân tay Khu B" : "Cổng vân tay Khu A"
  );
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);

  const [actingMssv, setActingMssv] = useState<string | null>(null);
  const [exportingDaily, setExportingDaily] = useState(false);
  const [exportingStrangers, setExportingStrangers] = useState(false);

  const handleExportDaily = async () => {
    setExportingDaily(true);
    try {
      const qs = new URLSearchParams({ ngay });
      const effectiveKhu = scopeKhu || maKhu;
      if (effectiveKhu) qs.set("ma_khu", effectiveKhu);
      await apiDownload(
        `/api/admin/access-logs/export-daily?${qs.toString()}`,
        `danh_sach_ra_vao_${ngay}.xlsx`
      );
      toast.success("Đã xuất danh sách ra vào.");
    } catch (err: any) {
      toast.error(err.message || "Không thể xuất danh sách ra vào.");
    } finally {
      setExportingDaily(false);
    }
  };

  const handleExportStrangers = async () => {
    setExportingStrangers(true);
    try {
      await apiDownload(
        "/api/admin/access-logs/export-strangers",
        "danh_sach_nguoi_la_quet_cong.xlsx"
      );
      toast.success("Đã xuất danh sách người lạ quét cổng.");
    } catch (err: any) {
      toast.error(err.message || "Không thể xuất danh sách người lạ.");
    } finally {
      setExportingStrangers(false);
    }
  };

  useEffect(() => {
    if (scopeKhu) {
      setMaKhu(scopeKhu);
      setCongQuet(`Cổng vân tay Khu ${scopeKhu}`);
    }
  }, [scopeKhu]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ngay,
        trang_thai: trangThai,
        loai_ra_vao: loaiRaVao,
      });
      const effectiveKhu = scopeKhu || maKhu;
      if (effectiveKhu) qs.set("ma_khu", effectiveKhu);
      if (search.trim()) qs.set("search", search.trim());

      const res = await apiRequest<any>(
        `/api/admin/access-logs/daily-attendance?${qs.toString()}`
      );
      setThongKe(
        res.thong_ke || {
          tong_sv_noi_tru: 0,
          da_diem_danh: 0,
          chua_diem_danh: 0,
          dang_trong_ktx: 0,
          da_ra_ngoai: 0,
        }
      );
      setItems(res.items || []);
      setGateAlerts(res.nhat_ky_cong || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải bảng điểm danh vân tay.");
    } finally {
      setLoading(false);
    }
  }, [ngay, scopeKhu, maKhu, trangThai, loaiRaVao, search]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleGateScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) {
      toast.error("Vui lòng nhập mã vân tay (VD: VT-B2100001) hoặc MSSV.");
      return;
    }
    setScanning(true);
    try {
      const res = await apiRequest<any>("/api/admin/access-logs/scan-fingerprint", {
        method: "POST",
        body: {
          ma_quet: scanInput.trim(),
          loai: scanLoai,
          cong: scopeKhu ? `Cổng vân tay Khu ${scopeKhu}` : congQuet,
          ngay,
        },
      });
      setLastScanResult(res);
      if (res.cho_phep_vao) {
        toast.success(res.thong_bao);
      } else {
        toast.error(res.thong_bao);
      }
      setScanInput("");
      loadAttendance();
    } catch (err: any) {
      toast.error(err.message || "Không thể kiểm tra vân tay.");
    } finally {
      setScanning(false);
    }
  };

  const handleQuickScanStudent = async (sv: any, loai: "VAO" | "RA") => {
    setActingMssv(sv.mssv);
    try {
      const res = await apiRequest<any>("/api/admin/access-logs/scan-fingerprint", {
        method: "POST",
        body: {
          ma_quet: sv.ma_van_tay || sv.mssv,
          loai,
          cong: sv.ma_khu === "B" ? "Cổng vân tay Khu B" : "Cổng vân tay Khu A",
          ngay,
        },
      });
      setLastScanResult(res);
      if (res.cho_phep_vao) {
        toast.success(res.thong_bao);
      } else {
        toast.error(res.thong_bao);
      }
      loadAttendance();
    } catch (err: any) {
      toast.error(err.message || "Không thể quét vân tay.");
    } finally {
      setActingMssv(null);
    }
  };

  const handleRegisterFingerprint = async (mssv: string) => {
    setActingMssv(mssv);
    try {
      const res = await apiRequest<any>(
        `/api/admin/access-logs/register-fingerprint/${mssv}`,
        { method: "POST", body: {} }
      );
      toast.success(res.thong_bao);
      loadAttendance();
    } catch (err: any) {
      toast.error(err.message || "Không thể cấp mã vân tay.");
    } finally {
      setActingMssv(null);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Kiểm soát cổng KTX bằng vân tay (Chặn người lạ)"
        subtitle={
          scopeKhu
            ? `Phạm vi điểm danh & đăng ký vân tay: Khu ${scopeKhu}`
            : "Quản lý ra vào 2 cổng: Khu A & Khu B"
        }
      >
        <div className="space-y-4">
          <form onSubmit={handleGateScan} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mã vân tay / MSSV quét tại cổng
              </label>
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="VD: VT-B2100001 hoặc VT-LA-999"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trạng thái quét</label>
              <select
                value={scanLoai}
                onChange={(e) => setScanLoai(e.target.value as "VAO" | "RA")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="VAO">Vào KTX</option>
                <option value="RA">Ra ngoài</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cổng kiểm soát</label>
              <select
                value={congQuet}
                disabled={Boolean(scopeKhu)}
                onChange={(e) => setCongQuet(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9] disabled:bg-slate-100"
              >
                {(!scopeKhu || scopeKhu === "A") && (
                  <option value="Cổng vân tay Khu A">Cổng vân tay Khu A</option>
                )}
                {(!scopeKhu || scopeKhu === "B") && (
                  <option value="Cổng vân tay Khu B">Cổng vân tay Khu B</option>
                )}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={scanning}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
              >
                <Fingerprint className="h-4 w-4" />
                {scanning ? "Đang xác thực..." : "Quét vân tay"}
              </button>
            </div>
          </form>

          {lastScanResult && (
            <div
              className={`rounded-lg border p-3.5 text-sm flex items-start gap-2.5 ${
                lastScanResult.cho_phep_vao
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {lastScanResult.cho_phep_vao ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {lastScanResult.cho_phep_vao
                    ? `VÂN TAY HỢP LỆ — ĐÃ GHI NHẬN ${
                        lastScanResult.loai_luot === "RA" ? "RA NGOÀI" : "VÀO KTX"
                      }`
                    : "CHẶN CỔNG — TỪ CHỐI MỞ CỔNG (NGƯỜI LẠ HOẶC CHƯA CÓ VÂN TAY)"}
                </p>
                <p className="text-xs mt-0.5">{lastScanResult.thong_bao}</p>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={`Điểm danh sinh viên ra vào theo ngày (${formatDate(ngay)})`}
        right={
          <button
            type="button"
            disabled={exportingDaily}
            onClick={handleExportDaily}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#1F5CA9]" />
            {exportingDaily ? "Đang xuất..." : "Xuất DS ra vào"}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Tổng SV nội trú</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{thongKe.tong_sv_noi_tru}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-xs text-emerald-700">Đã điểm danh</p>
              <p className="mt-1 text-xl font-bold text-emerald-800">{thongKe.da_diem_danh}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-xs text-amber-800">Chưa điểm danh</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{thongKe.chua_diem_danh}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <p className="text-xs text-[#1F5CA9]">Trong KTX / Ra ngoài</p>
              <p className="mt-1 text-xl font-bold text-[#1F5CA9]">
                {thongKe.dang_trong_ktx} / {thongKe.da_ra_ngoai}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              type="date"
              value={ngay}
              onChange={(e) => setNgay(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            />

            <select
              value={scopeKhu || maKhu}
              disabled={Boolean(scopeKhu)}
              onChange={(e) => setMaKhu(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9] disabled:bg-slate-100"
            >
              {!scopeKhu && <option value="">Tất cả (Khu A &amp; B)</option>}
              {(!scopeKhu || scopeKhu === "A") && <option value="A">Khu A</option>}
              {(!scopeKhu || scopeKhu === "B") && <option value="B">Khu B</option>}
            </select>

            <select
              value={trangThai}
              onChange={(e) => setTrangThai(e.target.value as typeof trangThai)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            >
              <option value="TAT_CA">Điểm danh: Tất cả</option>
              <option value="DA_DIEM_DANH">Đã điểm danh</option>
              <option value="CHUA_DIEM_DANH">Chưa điểm danh</option>
            </select>

            <select
              value={loaiRaVao}
              onChange={(e) => setLoaiRaVao(e.target.value as typeof loaiRaVao)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            >
              <option value="TAT_CA">Ra vào: Tất cả</option>
              <option value="VAO">Vào KTX</option>
              <option value="RA">Ra ngoài</option>
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm phòng, MSSV, vân tay..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3">Sinh viên</th>
                  <th className="px-4 py-3 text-center">Mã vân tay</th>
                  <th className="px-4 py-3 text-center">Điểm danh</th>
                  <th className="px-4 py-3 text-center">Trạng thái ra vào</th>
                  <th className="px-4 py-3">Thời gian quét gần nhất</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Không có sinh viên phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.mssv} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        {r.ten_phong}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">
                          {r.ho_ten}
                          {r.la_truong_phong && (
                            <span className="ml-1.5 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[11px] font-semibold text-[#1F5CA9]">
                              Trưởng phòng
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-slate-500">{r.mssv}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        {r.ma_van_tay ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-800">
                            {r.ma_van_tay}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={actingMssv === r.mssv}
                            onClick={() => handleRegisterFingerprint(r.mssv)}
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            Đăng ký vân tay
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        {r.trang_thai_ngay === "DA_DIEM_DANH" ? (
                          <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Đã điểm danh
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Chưa điểm danh
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        {r.loai_cuoi === "VAO" ? (
                          <span className="inline-block rounded bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-[#1F5CA9]">
                            Vào KTX
                          </span>
                        ) : r.loai_cuoi === "RA" ? (
                          <span className="inline-block rounded bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            Ra ngoài
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {r.thoi_gian_quet ? (
                          <span>
                            {formatDateTime(r.thoi_gian_quet)} · {r.cong_quet}
                          </span>
                        ) : (
                          <span className="text-slate-400">Chưa có lượt quét</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={actingMssv === r.mssv}
                            onClick={() => handleQuickScanStudent(r, "VAO")}
                            className="rounded bg-[#1F5CA9] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#194B8B] disabled:opacity-50"
                          >
                            Quét Vào
                          </button>
                          <button
                            type="button"
                            disabled={actingMssv === r.mssv}
                            onClick={() => handleQuickScanStudent(r, "RA")}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Quét Ra
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Nhật ký quét cổng vân tay & Cảnh báo người lạ"
        right={
          <button
            type="button"
            disabled={exportingStrangers}
            onClick={handleExportStrangers}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-red-600" />
            {exportingStrangers ? "Đang xuất..." : "Xuất DS người lạ"}
          </button>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Cổng kiểm soát</th>
                <th className="px-4 py-3 text-center">Lượt</th>
                <th className="px-4 py-3">Mã vân tay quét</th>
                <th className="px-4 py-3 text-center">Kết quả</th>
                <th className="px-4 py-3">Chi tiết kiểm tra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gateAlerts.map((a) => (
                <tr
                  key={a.ma_cb}
                  className={!a.cho_phep_vao ? "bg-red-50/40" : "hover:bg-slate-50/70"}
                >
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTime(a.thoi_gian)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                    {a.cong}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {a.loai_luot === "RA" ? "Ra" : "Vào"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">
                    {a.ma_van_tay_quet}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {a.cho_phep_vao ? (
                      <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Cho phép
                      </span>
                    ) : a.ket_qua === "CHAN_NGUOI_LA" ? (
                      <span className="inline-block rounded bg-red-100 border border-red-300 px-2 py-0.5 text-xs font-bold text-red-800">
                        Chặn người lạ
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Từ chối
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">{a.ly_do}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
