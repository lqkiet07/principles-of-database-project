"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatDate, formatDateTime, ISSUE_GROUP_LABELS } from "@/lib/format";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SectionCard } from "@/components/shared/section-card";
import { MaintenanceStatusBadge } from "@/components/shared/status-badge";
import { MaintenanceItem, RoomMaintStatus } from "@/features/admin/maintenance/types";
import { AcceptMaintenanceModal } from "@/features/admin/maintenance/accept-maintenance-modal";
import { CreateMaintenanceModal } from "@/features/admin/maintenance/create-maintenance-modal";

export default function AdminMaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceItem[]>([]);
  const [roomStatus, setRoomStatus] = useState<RoomMaintStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [trangThai, setTrangThai] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [acceptTicket, setAcceptTicket] = useState<MaintenanceItem | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (trangThai) params.set("trang_thai", trangThai);
      if (search.trim()) params.set("search", search.trim());
      const res = await apiRequest<{
        items: MaintenanceItem[];
        total: number;
        tinh_trang_phong?: RoomMaintStatus[];
      }>(`/api/admin/maintenance?${params.toString()}`);
      setTickets(res.items);
      setTotal(res.total);
      if (res.tinh_trang_phong) setRoomStatus(res.tinh_trang_phong);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tải danh sách bảo trì.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, trangThai, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleUpdateStatus = async (id: number, status: "DANG_XU_LY" | "HOAN_TAT") => {
    setUpdatingId(id);
    try {
      await apiRequest(`/api/admin/maintenance/${id}/status`, {
        method: "PATCH",
        body: { trang_thai: status },
      });
      toast.success("Đã cập nhật trạng thái phiếu bảo trì.");
      fetchTickets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Lọc phiếu bảo trì"
        subtitle="Tìm kiếm theo phòng, nội dung hoặc trạng thái"
        icon={Search}
        right={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
          >
            <Plus className="h-4 w-4" />
            Tạo phiếu
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm phòng, nội dung..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <select
            value={trangThai}
            onChange={(e) => {
              setTrangThai(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="MOI">Mới</option>
            <option value="DA_TIEP_NHAN">Đã tiếp nhận</option>
            <option value="DANG_XU_LY">Đang xử lý</option>
            <option value="HOAN_TAT">Hoàn tất</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard
        title="Danh sách phiếu bảo trì & sửa chữa"
        subtitle={`Tổng ${total} phiếu`}
        icon={Wrench}
        iconBg="bg-amber-50 text-amber-700"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Phòng</th>
                <th className="px-5 py-3">Mô tả & Lịch sửa</th>
                <th className="px-5 py-3">Người báo</th>
                <th className="px-5 py-3">Thời gian</th>
                <th className="px-5 py-3 text-center">Trạng thái</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
                    Đang tải...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    Không có phiếu bảo trì nào.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.ma_yc} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {t.ten_phong || `Khu ${t.ma_khu}`}
                    </td>
                    <td className="px-5 py-3 max-w-md">
                      <p className="text-slate-800">
                        <span className="text-xs font-semibold text-slate-500 mr-1.5">
                          [{ISSUE_GROUP_LABELS[t.nhom_su_co] || t.nhom_su_co}]
                        </span>
                        {t.mo_ta}
                      </p>
                      {(t.ngay_sua || t.sdt_nguoi_sua || t.ghi_chu_xu_ly) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {t.ngay_sua ? `Ngày sửa: ${formatDate(t.ngay_sua)}` : ""}
                          {t.sdt_nguoi_sua ? ` · SĐT thợ: ${t.sdt_nguoi_sua}` : ""}
                          {t.ghi_chu_xu_ly ? ` · ${t.ghi_chu_xu_ly}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {t.ten_sinh_vien || "Quản lý"}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(t.thoi_gian)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <MaintenanceStatusBadge status={t.trang_thai} />
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {t.trang_thai === "MOI" && (
                          <button
                            type="button"
                            disabled={updatingId === t.ma_yc}
                            onClick={() => setAcceptTicket(t)}
                            className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
                          >
                            Tiếp nhận
                          </button>
                        )}
                        {t.trang_thai === "DA_TIEP_NHAN" && (
                          <button
                            type="button"
                            disabled={updatingId === t.ma_yc}
                            onClick={() => handleUpdateStatus(t.ma_yc, "DANG_XU_LY")}
                            className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                          >
                            Đang xử lý
                          </button>
                        )}
                        {t.trang_thai !== "HOAN_TAT" && (
                          <button
                            type="button"
                            disabled={updatingId === t.ma_yc}
                            onClick={() => handleUpdateStatus(t.ma_yc, "HOAN_TAT")}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Hoàn tất
                          </button>
                        )}
                      </div>
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
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </SectionCard>

      <AcceptMaintenanceModal
        item={acceptTicket}
        onClose={() => setAcceptTicket(null)}
        onSuccess={fetchTickets}
      />

      <CreateMaintenanceModal
        open={createOpen}
        roomStatus={roomStatus}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchTickets}
      />
    </div>
  );
}
