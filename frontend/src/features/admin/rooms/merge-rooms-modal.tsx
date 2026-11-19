"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";
import type { MergeProposal } from "./types";

interface MergeRoomsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MergeRoomsModal({
  open,
  onClose,
  onSuccess,
}: MergeRoomsModalProps) {
  const [mergeList, setMergeList] = useState<MergeProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: MergeProposal[] }>(
        "/api/admin/rooms/merge-proposals"
      );
      setMergeList(res.items || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải đề xuất gộp phòng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadProposals();
  }, [open, loadProposals]);

  const handleApprove = async (items: MergeProposal[]) => {
    if (items.length === 0) return;
    const msg =
      items.length === 1
        ? `Chuyển sinh viên ${items[0].ho_ten} (${items[0].mssv}) từ phòng ${items[0].ten_phong_cu} sang phòng ${items[0].ten_phong_moi}?`
        : `Xác nhận gộp toàn bộ ${items.length} phòng?`;
    if (!window.confirm(msg)) return;

    setSubmitting(true);
    try {
      await apiRequest("/api/admin/rooms/merge-confirm", {
        method: "POST",
        body: {
          de_xuat: items.map((i) => ({
            mssv: i.mssv,
            ma_phong_cu: i.ma_phong_cu,
            ma_phong_moi: i.ma_phong_moi,
          })),
        },
      });
      toast.success(`Đã gộp ${items.length} phòng.`);
      await loadProposals();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Gộp phòng thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Gộp phòng"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Đóng
          </button>
          {mergeList.length > 0 && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleApprove(mergeList)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Duyệt tất cả ({mergeList.length})
            </button>
          )}
        </>
      }
    >
      {loading ? (
        <div className="py-10 text-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
          Đang tải...
        </div>
      ) : mergeList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Không có phòng cần gộp.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <th className="py-2.5 pr-3">Sinh viên</th>
                <th className="py-2.5 pr-3">Phòng hiện tại</th>
                <th className="py-2.5 pr-3">Phòng đích</th>
                <th className="py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mergeList.map((m) => (
                <tr key={m.mssv}>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-900">{m.ho_ten}</div>
                    <div className="text-xs font-mono text-slate-500">{m.mssv}</div>
                  </td>
                  <td className="py-3 pr-3 font-semibold text-red-700">{m.ten_phong_cu}</td>
                  <td className="py-3 pr-3">
                    <span className="font-semibold text-emerald-700">{m.ten_phong_moi}</span>
                    <span className="ml-1.5 text-xs text-slate-500">
                      ({m.so_nguoi_phong_moi_hien_tai} → {m.so_nguoi_phong_moi_sau_gop}/{m.suc_chua})
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleApprove([m])}
                      className="rounded-md bg-[#1F5CA9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
                    >
                      Duyệt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
