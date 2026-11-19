"use client";

import React, { useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { ISSUE_GROUP_LABELS } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import type { RoomMaintStatus } from "./types";

interface CreateMaintenanceModalProps {
  open: boolean;
  roomStatus: RoomMaintStatus[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMaintenanceModal({
  open,
  roomStatus,
  onClose,
  onSuccess,
}: CreateMaintenanceModalProps) {
  const [phamVi, setPhamVi] = useState<"PHONG" | "NHIEU_PHONG" | "KHU">("PHONG");
  const [maPhong, setMaPhong] = useState("");
  const [multiRooms, setMultiRooms] = useState<number[]>([]);
  const [maKhu, setMaKhu] = useState("A");
  const [nhom, setNhom] = useState("DIEN");
  const [moTa, setMoTa] = useState("");
  const [datBaoTri, setDatBaoTri] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: any = {
        pham_vi: phamVi,
        nhom_su_co: nhom,
        mo_ta: moTa.trim(),
        dat_phong_bao_tri: datBaoTri,
      };
      if (phamVi === "KHU") body.ma_khu = maKhu;
      else if (phamVi === "PHONG") body.ma_phong = Number(maPhong);
      else body.ma_phong_list = multiRooms;

      const res = await apiRequest<any>("/api/admin/maintenance", {
        method: "POST",
        body,
      });
      toast.success(res.thong_bao || "Đã lập yêu cầu bảo trì.");
      setMoTa("");
      setMultiRooms([]);
      setDatBaoTri(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title="Lập yêu cầu bảo trì">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phạm vi</label>
          <select
            value={phamVi}
            onChange={(e) => setPhamVi(e.target.value as any)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="PHONG">Một phòng</option>
            <option value="NHIEU_PHONG">Nhiều phòng</option>
            <option value="KHU">Toàn khu</option>
          </select>
        </div>

        {phamVi === "KHU" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Khu *</label>
            <select
              value={maKhu}
              onChange={(e) => setMaKhu(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="A">Khu A</option>
              <option value="B">Khu B</option>
            </select>
          </div>
        )}

        {phamVi === "PHONG" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phòng *</label>
            <select
              required
              value={maPhong}
              onChange={(e) => setMaPhong(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn phòng --</option>
              {roomStatus.map((r) => (
                <option key={r.ma_phong} value={r.ma_phong}>
                  Phòng {r.ten_phong} (Khu {r.ma_khu})
                </option>
              ))}
            </select>
          </div>
        )}

        {phamVi === "NHIEU_PHONG" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Chọn phòng ({multiRooms.length}) *
            </label>
            <div className="max-h-36 overflow-y-auto grid grid-cols-4 gap-1.5 rounded-lg border border-slate-200 p-2.5">
              {roomStatus.map((r) => {
                const checked = multiRooms.includes(r.ma_phong);
                return (
                  <label
                    key={r.ma_phong}
                    className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs cursor-pointer ${
                      checked ? "bg-blue-50 text-[#1F5CA9] font-semibold" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setMultiRooms((prev) =>
                          prev.includes(r.ma_phong)
                            ? prev.filter((id) => id !== r.ma_phong)
                            : [...prev, r.ma_phong]
                        )
                      }
                    />
                    {r.ten_phong}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm sự cố *</label>
          <select
            value={nhom}
            onChange={(e) => setNhom(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.entries(ISSUE_GROUP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả *</label>
          <textarea
            required
            rows={3}
            value={moTa}
            onChange={(e) => setMoTa(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
        </div>

        {phamVi !== "KHU" && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={datBaoTri}
              onChange={(e) => setDatBaoTri(e.target.checked)}
            />
            Đặt trạng thái phòng sang &ldquo;Đang bảo trì&rdquo;
          </label>
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
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            Tạo yêu cầu
          </button>
        </div>
      </form>
    </Modal>
  );
}
