"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";
import type { BillRow } from "./types";

interface ManualMeterModalProps {
  room: BillRow | null;
  thang: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualMeterModal({
  room,
  thang,
  onClose,
  onSuccess,
}: ManualMeterModalProps) {
  const [dien, setDien] = useState("");
  const [nuoc, setNuoc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (room) {
      setDien(room.chi_so_dien_cuoi !== null ? String(room.chi_so_dien_cuoi) : "");
      setNuoc(room.chi_so_nuoc_cuoi !== null ? String(room.chi_so_nuoc_cuoi) : "");
    }
  }, [room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    setSaving(true);
    try {
      await apiRequest("/api/admin/bills/manual", {
        method: "POST",
        body: {
          ma_phong: room.ma_phong,
          thang,
          chi_so_dien_cuoi: Number(dien),
          chi_so_nuoc_cuoi: Number(nuoc),
        },
      });
      toast.success(`Đã lưu chỉ số phòng ${room.ten_phong}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu chỉ số.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(room)}
      onClose={onClose}
      size="sm"
      title={room ? `Chỉ số — Phòng ${room.ten_phong}` : ""}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Chỉ số điện cuối (kWh) *
          </label>
          <input
            type="number"
            required
            min={room?.chi_so_dien_dau ?? 0}
            value={dien}
            onChange={(e) => setDien(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Chỉ số nước cuối (m³) *
          </label>
          <input
            type="number"
            required
            min={room?.chi_so_nuoc_dau ?? 0}
            value={nuoc}
            onChange={(e) => setNuoc(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
