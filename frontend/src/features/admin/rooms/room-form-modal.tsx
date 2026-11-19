"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";
import type { RoomItem, ZoneItem } from "./types";

interface RoomFormModalProps {
  open: boolean;
  editingRoom: RoomItem | null;
  zones: ZoneItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function RoomFormModal({
  open,
  editingRoom,
  zones,
  onClose,
  onSuccess,
}: RoomFormModalProps) {
  const [tenPhong, setTenPhong] = useState("");
  const [khu, setKhu] = useState("A");
  const [sucChua, setSucChua] = useState<4 | 6 | 8>(4);
  const [nauAn, setNauAn] = useState(false);
  const [gioiTinh, setGioiTinh] = useState<"NAM" | "NU">("NAM");
  const [giaPhong, setGiaPhong] = useState("2400000");
  const [tinhTrang, setTinhTrang] = useState("TRONG");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRoom) {
      setTenPhong(editingRoom.ten_phong);
      setKhu(editingRoom.ma_khu);
      setSucChua(editingRoom.suc_chua as 4 | 6 | 8);
      setNauAn(editingRoom.co_nau_an);
      setGioiTinh(editingRoom.gioi_tinh);
      setGiaPhong(String(editingRoom.gia_phong));
      setTinhTrang(editingRoom.trang_thai_phong);
    } else {
      setTenPhong("");
      setKhu(zones[0]?.ma_khu || "A");
      setSucChua(4);
      setNauAn(false);
      setGioiTinh("NAM");
      setGiaPhong("2400000");
      setTinhTrang("TRONG");
    }
  }, [open, editingRoom, zones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingRoom) {
        await apiRequest(`/api/admin/rooms/${editingRoom.ma_phong}`, {
          method: "PUT",
          body: {
            suc_chua: sucChua,
            co_nau_an: nauAn,
            gioi_tinh: gioiTinh,
            gia_phong: Number(giaPhong),
            tinh_trang: tinhTrang,
          },
        });
        toast.success(`Đã cập nhật phòng ${editingRoom.ten_phong}.`);
      } else {
        await apiRequest("/api/admin/rooms", {
          method: "POST",
          body: {
            ten_phong: tenPhong.trim().toUpperCase(),
            ma_khu: khu,
            suc_chua: sucChua,
            co_nau_an: nauAn,
            gioi_tinh: gioiTinh,
            gia_phong: Number(giaPhong),
          },
        });
        toast.success(`Đã thêm phòng ${tenPhong.trim().toUpperCase()}.`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu phòng.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editingRoom ? `Sửa phòng ${editingRoom.ten_phong}` : "Thêm phòng"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên phòng *</label>
            <input
              type="text"
              required
              disabled={Boolean(editingRoom)}
              value={tenPhong}
              onChange={(e) => setTenPhong(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Khu *</label>
            <select
              disabled={Boolean(editingRoom)}
              value={khu}
              onChange={(e) => setKhu(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Sức chứa *</label>
            <select
              value={sucChua}
              onChange={(e) => setSucChua(Number(e.target.value) as 4 | 6 | 8)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={4}>4 người</option>
              <option value={6}>6 người</option>
              <option value={8}>8 người</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Giới tính *</label>
            <select
              value={gioiTinh}
              onChange={(e) => setGioiTinh(e.target.value as "NAM" | "NU")}
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
              value={giaPhong}
              onChange={(e) => setGiaPhong(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nấu ăn</label>
            <select
              value={nauAn ? "true" : "false"}
              onChange={(e) => setNauAn(e.target.value === "true")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="false">Không nấu ăn</option>
              <option value="true">Có nấu ăn</option>
            </select>
          </div>
        </div>

        {editingRoom && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tình trạng</label>
            <select
              value={tinhTrang}
              onChange={(e) => setTinhTrang(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="TRONG">Hoạt động bình thường</option>
              <option value="BAO_TRI">Đang bảo trì</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  );
}
