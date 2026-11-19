"use client";

import React, { useEffect, useState } from "react";
import { Save, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatVND } from "@/lib/format";

interface GeneralSettingsTabProps {
  settingsData: any;
  onReload: () => void;
}

export function GeneralSettingsTab({
  settingsData,
  onReload,
}: GeneralSettingsTabProps) {
  const { refreshUser } = useAuth();
  const [donGiaDien, setDonGiaDien] = useState("3500");
  const [donGiaNuoc, setDonGiaNuoc] = useState("15000");
  const [hanNopKtx, setHanNopKtx] = useState("");
  const [hanNopDienNuoc, setHanNopDienNuoc] = useState("");
  const [mocGioChuaVe, setMocGioChuaVe] = useState("24:00");
  const [cheDoBaoTri, setCheDoBaoTri] = useState(false);
  const [kyHocHienTai, setKyHocHienTai] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settingsData) return;
    setDonGiaDien(String(settingsData.don_gia_dien ?? 3500));
    setDonGiaNuoc(String(settingsData.don_gia_nuoc ?? 15000));
    setHanNopKtx(settingsData.cau_hinh?.han_nop_ktx || "");
    setHanNopDienNuoc(settingsData.cau_hinh?.han_nop_dien_nuoc || "");
    setMocGioChuaVe(settingsData.cau_hinh?.moc_gio_chua_ve || "24:00");
    setCheDoBaoTri(Boolean(settingsData.cau_hinh?.che_do_bao_tri));
    setKyHocHienTai(settingsData.cau_hinh?.ky_hoc_hien_tai || "");
  }, [settingsData]);

  const priceHistory = settingsData?.lich_su_don_gia || [];
  const semesters = settingsData?.ky_hoc_list || [];

  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/api/admin/settings/prices", {
        method: "PUT",
        body: { don_gia_dien: Number(donGiaDien), don_gia_nuoc: Number(donGiaNuoc) },
      });
      toast.success("Đã lưu đơn giá điện nước.");
      onReload();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu đơn giá.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/api/admin/settings/config", {
        method: "PUT",
        body: {
          han_nop_ktx: hanNopKtx || null,
          han_nop_dien_nuoc: hanNopDienNuoc || null,
          moc_gio_chua_ve: mocGioChuaVe || "24:00",
          ky_hoc_hien_tai: kyHocHienTai || null,
        },
      });
      toast.success("Đã lưu cấu hình.");
      await refreshUser();
      onReload();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMaintenance = async () => {
    const target = !cheDoBaoTri;
    if (!window.confirm(target ? "Bật chế độ bảo trì hệ thống?" : "Tắt chế độ bảo trì hệ thống?")) {
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/admin/settings/config", {
        method: "PUT",
        body: { che_do_bao_tri: target },
      });
      setCheDoBaoTri(target);
      await refreshUser();
      toast.success(target ? "Đã bật chế độ bảo trì." : "Đã tắt chế độ bảo trì.");
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật chế độ bảo trì.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKtxBills = async () => {
    try {
      const res = await apiRequest<any>("/api/admin/bills/generate-ktx", { method: "POST" });
      toast.success(res.thong_bao || "Đã phát hành hóa đơn tiền KTX.");
    } catch (err: any) {
      toast.error(err.message || "Không thể phát hành hóa đơn.");
    }
  };

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          cheDoBaoTri ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white shadow-xs"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              cheDoBaoTri ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Wrench className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            Chế độ bảo trì hệ thống:{" "}
            <span className={cheDoBaoTri ? "text-amber-800" : "text-emerald-700"}>
              {cheDoBaoTri ? "Đang bật" : "Đang tắt"}
            </span>
          </h2>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleToggleMaintenance}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            cheDoBaoTri
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-amber-500 text-white hover:bg-amber-600"
          }`}
        >
          {cheDoBaoTri ? "Tắt bảo trì" : "Bật bảo trì"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleSavePrices}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
        >
          <h3 className="text-base font-semibold text-slate-900">Đơn giá điện &amp; nước</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Đơn giá điện (₫ / kWh)
              </label>
              <input
                type="number"
                required
                min={0}
                value={donGiaDien}
                onChange={(e) => setDonGiaDien(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Đơn giá nước (₫ / m³)
              </label>
              <input
                type="number"
                required
                min={0}
                value={donGiaNuoc}
                onChange={(e) => setDonGiaNuoc(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Lưu đơn giá
          </button>

          {priceHistory.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Lịch sử đơn giá</p>
              <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-slate-600">
                {priceHistory.slice(0, 8).map((p: any) => (
                  <div key={p.ma_dg} className="flex justify-between">
                    <span>
                      {p.loai === "DIEN" ? "Điện" : "Nước"}:{" "}
                      <strong className="text-slate-900">{formatVND(p.don_gia)}</strong>
                    </span>
                    <span className="text-slate-500">{formatDateTime(p.ap_dung_tu)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <form
          onSubmit={handleSaveConfig}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
        >
          <h3 className="text-base font-semibold text-slate-900">Hạn thanh toán &amp; Kỳ học</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hạn đóng tiền KTX
              </label>
              <input
                type="date"
                value={hanNopKtx}
                onChange={(e) => setHanNopKtx(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hạn đóng tiền điện nước
              </label>
              <input
                type="date"
                value={hanNopDienNuoc}
                onChange={(e) => setHanNopDienNuoc(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mốc giờ chưa về
              </label>
              <input
                type="text"
                value={mocGioChuaVe}
                onChange={(e) => setMocGioChuaVe(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kỳ học hiện tại
              </label>
              <select
                value={kyHocHienTai}
                onChange={(e) => setKyHocHienTai(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {semesters.map((s: any) => (
                  <option key={s.ma_ky} value={s.ma_ky}>
                    {s.ten_ky}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Lưu cấu hình
            </button>
            <button
              type="button"
              onClick={handleGenerateKtxBills}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Phát hành hóa đơn KTX kỳ này
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
