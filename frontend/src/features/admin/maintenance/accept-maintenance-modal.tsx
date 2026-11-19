"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { todayIsoVN } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import type { MaintenanceItem } from "./types";

interface AcceptMaintenanceModalProps {
  item: MaintenanceItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AcceptMaintenanceModal({
  item,
  onClose,
  onSuccess,
}: AcceptMaintenanceModalProps) {
  const [ngaySua, setNgaySua] = useState(todayIsoVN());
  const [sdt, setSdt] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setNgaySua(item.ngay_sua || todayIsoVN());
      setSdt(item.sdt_nguoi_sua || "");
      setGhiChu(item.ghi_chu_xu_ly || "");
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/maintenance/${item.ma_yc}/status`, {
        method: "PATCH",
        body: {
          trang_thai: "DA_TIEP_NHAN",
          ngay_sua: ngaySua || null,
          sdt_nguoi_sua: sdt.trim() || null,
          ghi_chu_xu_ly: ghiChu.trim() || null,
        },
      });
      toast.success(`Đã tiếp nhận yêu cầu #${item.ma_yc}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể tiếp nhận yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      size="sm"
      title={
        item
          ? `Tiếp nhận bảo trì — ${item.ten_phong ? `Phòng ${item.ten_phong}` : `Khu ${item.ma_khu}`}`
          : ""
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ngày sửa *</label>
          <input
            type="date"
            required
            value={ngaySua}
            onChange={(e) => setNgaySua(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Số điện thoại người sửa *
          </label>
          <input
            type="tel"
            required
            value={sdt}
            onChange={(e) => setSdt(e.target.value)}
            placeholder="09xxxxxxxx"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
          <textarea
            rows={3}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="Khung giờ dự kiến hoặc lưu ý cho sinh viên..."
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận tiếp nhận
          </button>
        </div>
      </form>
    </Modal>
  );
}
