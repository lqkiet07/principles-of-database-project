"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { TransferStatusBadge } from "@/components/shared/status-badge";
import type { TransferItem } from "./types";

interface RoomTransfersTabProps {
  onPendingCountChange: (count: number) => void;
  onRoomsChanged: () => void;
}

export function RoomTransfersTab({
  onPendingCountChange,
  onRoomsChanged,
}: RoomTransfersTabProps) {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState("TAT_CA");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [approving, setApproving] = useState<TransferItem | null>(null);
  const [suggestedRooms, setSuggestedRooms] = useState<any[]>([]);
  const [selectedNewRoom, setSelectedNewRoom] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  const [rejecting, setRejecting] = useState<TransferItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        trang_thai: statusFilter,
      });
      if (search.trim()) qs.set("search", search.trim());
      const res = await apiRequest<any>(`/api/admin/room-transfers?${qs.toString()}`);
      setTransfers(res.items || []);
      setTotal(res.total || 0);
      onPendingCountChange(res.cho_xu_ly ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải yêu cầu đổi phòng.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search, onPendingCountChange]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const openApprove = async (yc: TransferItem) => {
    setApproving(yc);
    setSelectedNewRoom("");
    setApproveNote("");
    setLoadingSuggested(true);
    try {
      const res = await apiRequest<any>(
        `/api/admin/room-transfers/${yc.ma_yc}/suggested-rooms`
      );
      const list = res.phong_goi_y || [];
      setSuggestedRooms(list);
      if (list.length > 0) setSelectedNewRoom(String(list[0].ma_phong));
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách phòng trống.");
    } finally {
      setLoadingSuggested(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approving || !selectedNewRoom) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/room-transfers/${approving.ma_yc}/approve`, {
        method: "POST",
        body: {
          ma_phong_moi: Number(selectedNewRoom),
          ghi_chu_duyet: approveNote.trim() || null,
        },
      });
      toast.success(`Đã duyệt đổi phòng cho ${approving.ho_ten} (${approving.mssv}).`);
      setApproving(null);
      loadTransfers();
      onRoomsChanged();
    } catch (err: any) {
      toast.error(err.message || "Không thể duyệt yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejecting || rejectReason.trim().length < 3) {
      toast.error("Vui lòng nhập lý do từ chối.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/room-transfers/${rejecting.ma_yc}/reject`, {
        method: "POST",
        body: { ly_do_tu_choi: rejectReason.trim() },
      });
      toast.success(`Đã từ chối yêu cầu #${rejecting.ma_yc}.`);
      setRejecting(null);
      setRejectReason("");
      loadTransfers();
    } catch (err: any) {
      toast.error(err.message || "Không thể từ chối yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo MSSV, họ tên hoặc phòng..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="TAT_CA">Mọi trạng thái</option>
            <option value="CHO_XU_LY">Chờ xử lý</option>
            <option value="DA_DUYET">Đã duyệt</option>
            <option value="TU_CHOI">Từ chối</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3.5">Sinh viên</th>
                <th className="px-4 py-3.5">Phòng</th>
                <th className="px-4 py-3.5">Lý do &amp; Ghi chú</th>
                <th className="px-4 py-3.5">Ngày gửi</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
                    Đang tải...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Chưa có yêu cầu đổi phòng nào.
                  </td>
                </tr>
              ) : (
                transfers.map((yc) => (
                  <tr key={yc.ma_yc} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{yc.ho_ten}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {yc.mssv} · {yc.gioi_tinh === "NAM" ? "Nam" : "Nữ"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{yc.ten_phong_hien_tai}</span>
                      {yc.ten_phong_moi && (
                        <span className="ml-1.5 text-xs font-semibold text-emerald-700">
                          → {yc.ten_phong_moi}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 max-w-md space-y-1">
                      <p className="text-slate-800">{yc.ly_do}</p>
                      {(yc.nguyen_vong_khu || yc.nguyen_vong_loai) && (
                        <p className="text-xs text-slate-500">
                          Nguyện vọng: {yc.nguyen_vong_khu ? `Khu ${yc.nguyen_vong_khu}` : "Mọi khu"} ·{" "}
                          {yc.nguyen_vong_loai ? `Phòng ${yc.nguyen_vong_loai} người` : "Mọi loại"}
                        </p>
                      )}
                      {yc.ghi_chu_duyet && (
                        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                          <strong>Ghi chú chuyển phòng quản lý:</strong> {yc.ghi_chu_duyet}
                        </p>
                      )}
                      {yc.ly_do_tu_choi && (
                        <p className="text-xs text-red-700">
                          <strong>Lý do từ chối:</strong> {yc.ly_do_tu_choi}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {formatDateTime(yc.thoi_gian)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <TransferStatusBadge status={yc.trang_thai} />
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {yc.trang_thai === "CHO_XU_LY" && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openApprove(yc)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Duyệt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejecting(yc);
                              setRejectReason("");
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            Từ chối
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          unitLabel="yêu cầu"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal Duyệt đổi phòng */}
      <Modal
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        size="md"
        title={approving ? `Duyệt đổi phòng — ${approving.ho_ten} (${approving.mssv})` : ""}
      >
        <form onSubmit={handleApprove} className="space-y-4">
          {loadingSuggested ? (
            <div className="py-6 text-center text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
              Đang tải phòng phù hợp...
            </div>
          ) : suggestedRooms.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Hiện không còn phòng phù hợp cùng giới tính.
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phòng mới *</label>
              <select
                required
                value={selectedNewRoom}
                onChange={(e) => setSelectedNewRoom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {suggestedRooms.map((r) => (
                  <option key={r.ma_phong} value={r.ma_phong}>
                    Phòng {r.ten_phong} — Khu {r.ma_khu} · {r.so_nguoi_o}/{r.suc_chua} ·{" "}
                    {r.co_nau_an ? "Có nấu ăn" : "Không nấu ăn"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ghi chú chuyển phòng quản lý KTX làm thủ tục *
            </label>
            <textarea
              required
              rows={3}
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Nhập ghi chú hẹn làm thủ tục bàn giao tại Phòng Quản lý KTX..."
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setApproving(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedNewRoom}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận duyệt
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Từ chối */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        size="sm"
        title={rejecting ? `Từ chối yêu cầu #${rejecting.ma_yc}` : ""}
      >
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lý do từ chối *</label>
            <textarea
              required
              minLength={3}
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Từ chối
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
