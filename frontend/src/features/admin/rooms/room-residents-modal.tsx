"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import type { Resident, RoomItem } from "./types";

interface RoomResidentsModalProps {
  room: RoomItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function RoomResidentsModal({
  room,
  onClose,
  onUpdated,
}: RoomResidentsModalProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);

  const loadResidents = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    try {
      const res = await apiRequest<any>(`/api/admin/rooms/${room.ma_phong}/residents`);
      setResidents(res.sinh_vien || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách sinh viên.");
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (room) loadResidents();
  }, [room, loadResidents]);

  const handleCheckout = async (mssv: string) => {
    if (!room) return;
    if (!window.confirm(`Xác nhận cho sinh viên ${mssv} rời phòng ${room.ten_phong}?`)) return;
    try {
      await apiRequest(`/api/admin/rooms/${room.ma_phong}/residents/${mssv}`, {
        method: "DELETE",
      });
      toast.success(`Đã cập nhật rời phòng cho sinh viên ${mssv}.`);
      await loadResidents();
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật.");
    }
  };

  return (
    <Modal
      open={Boolean(room)}
      onClose={onClose}
      size="lg"
      title={room ? `Phòng ${room.ten_phong}` : ""}
    >
      {loading ? (
        <div className="py-10 text-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
          Đang tải...
        </div>
      ) : residents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Phòng hiện đang trống.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-2.5 pr-3">MSSV</th>
                <th className="py-2.5 pr-3">Họ và tên</th>
                <th className="py-2.5 pr-3">Ngành học</th>
                <th className="py-2.5 pr-3">Ngày vào</th>
                <th className="py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {residents.map((sv) => (
                <tr key={sv.mssv}>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">
                    {sv.mssv}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      {sv.ho_ten}
                      {sv.la_dai_dien && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-[#1F5CA9]">
                          Đại diện
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{sv.sdt}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{sv.nganh}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{formatDate(sv.ngay_vao)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleCheckout(sv.mssv)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Rời phòng
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
