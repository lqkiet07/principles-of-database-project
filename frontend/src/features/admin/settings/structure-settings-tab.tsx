"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BedDouble, Building2, CalendarPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatVND } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import { PaginationBar } from "@/components/shared/pagination-bar";

interface StructureSettingsTabProps {
  zones: any[];
  semesters: any[];
  onReloadSettings: () => void;
}

export function StructureSettingsTab({
  zones,
  semesters,
  onReloadSettings,
}: StructureSettingsTabProps) {
  const { refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);

  // Rooms & Beds
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomTotal, setRoomTotal] = useState(0);
  const [roomPage, setRoomPage] = useState(1);
  const [roomPageSize, setRoomPageSize] = useState(10);
  const [roomKhuFilter, setRoomKhuFilter] = useState("");

  // Add room modal
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [rTenPhong, setRTenPhong] = useState("");
  const [rKhu, setRKhu] = useState("A");
  const [rSucChua, setRSucChua] = useState<4 | 6 | 8>(4);
  const [rNauAn, setRNauAn] = useState(false);
  const [rGioiTinh, setRGioiTinh] = useState<"NAM" | "NU">("NAM");
  const [rGiaPhong, setRGiaPhong] = useState("2400000");

  // Add semester modal
  const [semOpen, setSemOpen] = useState(false);
  const [sMaKy, setSMaKy] = useState("");
  const [sTenKy, setSTenKy] = useState("");
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sActive, setSActive] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        page: String(roomPage),
        page_size: String(roomPageSize),
      });
      if (roomKhuFilter) qs.set("ma_khu", roomKhuFilter);
      const res = await apiRequest<any>(`/api/admin/rooms?${qs.toString()}`);
      setRooms(res.items || []);
      setRoomTotal(res.total || 0);
    } catch {
      // ignore
    }
  }, [roomPage, roomPageSize, roomKhuFilter]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/api/admin/rooms", {
        method: "POST",
        body: {
          ten_phong: rTenPhong.trim().toUpperCase(),
          ma_khu: rKhu,
          suc_chua: rSucChua,
          co_nau_an: rNauAn,
          gioi_tinh: rGioiTinh,
          gia_phong: Number(rGiaPhong),
        },
      });
      toast.success(`Đã thêm phòng ${rTenPhong.trim().toUpperCase()}.`);
      setAddRoomOpen(false);
      setRTenPhong("");
      onReloadSettings();
      loadRooms();
    } catch (err: any) {
      toast.error(err.message || "Không thể thêm phòng.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRoomBeds = async (maPhong: number, tenPhong: string, newBeds: number) => {
    try {
      await apiRequest(`/api/admin/rooms/${maPhong}`, {
        method: "PUT",
        body: { suc_chua: newBeds },
      });
      toast.success(`Đã cập nhật số giường phòng ${tenPhong} thành ${newBeds}.`);
      loadRooms();
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật số giường.");
    }
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/api/admin/settings/semesters", {
        method: "POST",
        body: {
          ma_ky: sMaKy.trim().toUpperCase(),
          ten_ky: sTenKy.trim(),
          ngay_bat_dau: sStart,
          ngay_ket_thuc: sEnd,
          dat_lam_hien_hanh: sActive,
        },
      });
      toast.success("Đã tạo kỳ học mới.");
      setSemOpen(false);
      setSMaKy("");
      setSTenKy("");
      await refreshUser();
      onReloadSettings();
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo kỳ học.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#1F5CA9]" />
            Khu ký túc xá
          </h3>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {zones.map((z) => (
              <div key={z.ma_khu} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-bold text-slate-900">
                  {z.ten_khu} <span className="font-mono text-xs text-slate-500">({z.ma_khu})</span>
                </span>
                <span className="font-semibold text-slate-700">{z.so_phong} phòng</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Kỳ học</h3>
            <button
              type="button"
              onClick={() => setSemOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1F5CA9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#194B8B]"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Thêm kỳ học
            </button>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {semesters.map((s) => (
              <div key={s.ma_ky} className="px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">
                  {s.ten_ky}{" "}
                  {s.dang_hien_hanh && (
                    <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Hiện hành
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(s.ngay_bat_dau)} – {formatDate(s.ngay_ket_thuc)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phòng & Số giường */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-[#1F5CA9]" />
            Phòng &amp; Số giường
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={roomKhuFilter}
              onChange={(e) => {
                setRoomKhuFilter(e.target.value);
                setRoomPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Tất cả khu</option>
              {zones.map((z) => (
                <option key={z.ma_khu} value={z.ma_khu}>
                  {z.ten_khu}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAddRoomOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1F5CA9] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              <Plus className="h-4 w-4" />
              Thêm phòng
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                <th className="px-4 py-3">Phòng</th>
                <th className="px-4 py-3">Khu</th>
                <th className="px-4 py-3">Giới tính</th>
                <th className="px-4 py-3">Đang ở</th>
                <th className="px-4 py-3">Tiền phòng</th>
                <th className="px-4 py-3 text-right">Số giường (sức chứa)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rooms.map((r) => (
                <tr key={r.ma_phong} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.ten_phong}</td>
                  <td className="px-4 py-3 text-slate-700">{r.ten_khu}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.gioi_tinh === "NAM" ? "Nam" : "Nữ"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.so_nguoi_o}</td>
                  <td className="px-4 py-3 text-slate-800">{formatVND(r.gia_phong)}</td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={r.suc_chua}
                      onChange={(e) =>
                        handleChangeRoomBeds(r.ma_phong, r.ten_phong, Number(e.target.value))
                      }
                      aria-label={`Số giường phòng ${r.ten_phong}`}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800"
                    >
                      <option value={4}>4 giường</option>
                      <option value={6}>6 giường</option>
                      <option value={8}>8 giường</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={roomPage}
          pageSize={roomPageSize}
          total={roomTotal}
          unitLabel="phòng"
          onPageChange={setRoomPage}
          onPageSizeChange={setRoomPageSize}
        />
      </div>

      {/* Modal Thêm phòng */}
      <Modal open={addRoomOpen} onClose={() => setAddRoomOpen(false)} size="md" title="Thêm phòng mới">
        <form onSubmit={handleAddRoom} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên phòng *</label>
              <input
                type="text"
                required
                value={rTenPhong}
                onChange={(e) => setRTenPhong(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Khu *</label>
              <select
                value={rKhu}
                onChange={(e) => setRKhu(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {zones.map((z) => (
                  <option key={z.ma_khu} value={z.ma_khu}>
                    {z.ten_khu}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Số giường *</label>
              <select
                value={rSucChua}
                onChange={(e) => setRSucChua(Number(e.target.value) as 4 | 6 | 8)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value={4}>4 giường</option>
                <option value={6}>6 giường</option>
                <option value={8}>8 giường</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Giới tính *</label>
              <select
                value={rGioiTinh}
                onChange={(e) => setRGioiTinh(e.target.value as "NAM" | "NU")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="NAM">Nam</option>
                <option value="NU">Nữ</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tiền phòng / kỳ (₫) *
              </label>
              <input
                type="number"
                required
                min={0}
                step={50000}
                value={rGiaPhong}
                onChange={(e) => setRGiaPhong(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nấu ăn</label>
              <select
                value={rNauAn ? "true" : "false"}
                onChange={(e) => setRNauAn(e.target.value === "true")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="false">Không nấu ăn</option>
                <option value="true">Có nấu ăn</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddRoomOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              Thêm phòng
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Tạo kỳ học */}
      <Modal open={semOpen} onClose={() => setSemOpen(false)} size="sm" title="Thêm kỳ học">
        <form onSubmit={handleCreateSemester} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mã kỳ *</label>
            <input
              type="text"
              required
              value={sMaKy}
              onChange={(e) => setSMaKy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên kỳ học *</label>
            <input
              type="text"
              required
              value={sTenKy}
              onChange={(e) => setSTenKy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ngày bắt đầu *</label>
              <input
                type="date"
                required
                value={sStart}
                onChange={(e) => setSStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ngày kết thúc *</label>
              <input
                type="date"
                required
                value={sEnd}
                onChange={(e) => setSEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={sActive} onChange={(e) => setSActive(e.target.checked)} />
            Đặt làm kỳ học hiện hành
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSemOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              Tạo kỳ học
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
