"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";
import type { RoomItem } from "./types";

interface ManualAssignModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualAssignModal({
  open,
  onClose,
  onSuccess,
}: ManualAssignModalProps) {
  const [mssv, setMssv] = useState("");
  const [roomId, setRoomId] = useState("");
  const [availableRooms, setAvailableRooms] = useState<RoomItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMssv("");
    setRoomId("");
    apiRequest<any>("/api/admin/rooms?page=1&page_size=50")
      .then((res) => {
        setAvailableRooms(
          (res.items || []).filter(
            (r: RoomItem) => r.so_giuong_trong > 0 && r.trang_thai_phong !== "BAO_TRI"
          )
        );
      })
      .catch(() => {});
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mssv.trim() || !roomId) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<any>("/api/admin/rooms/manual-assign", {
        method: "POST",
        body: { mssv: mssv.trim().toUpperCase(), ma_phong: Number(roomId) },
      });
      toast.success(res.thong_bao || "Xếp phòng thành công.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể xếp phòng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Xếp phòng thủ công">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">MSSV *</label>
          <input
            type="text"
            required
            value={mssv}
            onChange={(e) => setMssv(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chọn phòng *</label>
          <select
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-- Chọn phòng --</option>
            {availableRooms.map((r) => (
              <option key={r.ma_phong} value={r.ma_phong}>
                {r.ten_phong} ({r.ten_khu} · {r.gioi_tinh === "NAM" ? "Nam" : "Nữ"} · {r.so_nguoi_o}/{r.suc_chua})
              </option>
            ))}
          </select>
        </div>
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
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận
          </button>
        </div>
      </form>
    </Modal>
  );
}
