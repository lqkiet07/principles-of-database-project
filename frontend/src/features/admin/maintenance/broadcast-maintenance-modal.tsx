"use client";

import React, { useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";

interface BroadcastMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
}

export function BroadcastMaintenanceModal({
  open,
  onClose,
}: BroadcastMaintenanceModalProps) {
  const [khu, setKhu] = useState("B");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<any>("/api/admin/maintenance/broadcast", {
        method: "POST",
        body: {
          tieu_de: title.trim(),
          noi_dung: content.trim(),
          ma_khu: khu || null,
        },
      });
      toast.success(res.thong_bao || "Đã gửi thông báo.");
      setTitle("");
      setContent("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi thông báo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title="Gửi thông báo bảo trì">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phạm vi nhận</label>
          <select
            value={khu}
            onChange={(e) => setKhu(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Toàn KTX</option>
            <option value="A">Khu A</option>
            <option value="B">Khu B</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung *</label>
          <textarea
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            Gửi
          </button>
        </div>
      </form>
    </Modal>
  );
}
