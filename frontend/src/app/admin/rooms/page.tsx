"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowUpDown,
  BedDouble,
  Combine,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatVND } from "@/lib/format";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SectionCard } from "@/components/shared/section-card";
import { RoomStatusBadge } from "@/components/shared/status-badge";
import { AutoAssignModal } from "@/features/admin/rooms/auto-assign-modal";
import { ManualAssignModal } from "@/features/admin/rooms/manual-assign-modal";
import { MergeRoomsModal } from "@/features/admin/rooms/merge-rooms-modal";
import { RoomFormModal } from "@/features/admin/rooms/room-form-modal";
import { RoomResidentsModal } from "@/features/admin/rooms/room-residents-modal";
import { RoomTransfersTab } from "@/features/admin/rooms/room-transfers-tab";
import type { RoomItem, ZoneItem } from "@/features/admin/rooms/types";

function RoomsPageContent() {
  const { user } = useAuth();
  const scopeKhu = user?.ma_khu_phu_trach || null;

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"rooms" | "transfers">(
    searchParams.get("tab") === "transfers" ? "transfers" : "rooms"
  );

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingTransfers, setPendingTransfers] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  const [filterKhu, setFilterKhu] = useState(scopeKhu || "");
  const [filterSucChua, setFilterSucChua] = useState("");
  const [filterNauAn, setFilterNauAn] = useState("");
  const [filterTrangThai, setFilterTrangThai] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"ten_phong" | "so_nguoi_o" | "gia_phong" | "trang_thai_phong">("ten_phong");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Tìm kiếm ngữ nghĩa
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<any[] | null>(null);
  const [searchingSemantic, setSearchingSemantic] = useState(false);

  // Modal triggers
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);

  useEffect(() => {
    if (scopeKhu) setFilterKhu(scopeKhu);
  }, [scopeKhu]);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      const effectiveKhu = scopeKhu || filterKhu;
      if (effectiveKhu) qs.set("ma_khu", effectiveKhu);
      if (filterSucChua) qs.set("suc_chua", filterSucChua);
      if (filterNauAn) qs.set("co_nau_an", filterNauAn);
      if (filterTrangThai) qs.set("trang_thai", filterTrangThai);
      if (search.trim()) qs.set("search", search.trim());

      const res = await apiRequest<any>(`/api/admin/rooms?${qs.toString()}`);
      setRooms(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách phòng.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, scopeKhu, filterKhu, filterSucChua, filterNauAn, filterTrangThai, search, sortBy, sortDir]);

  useEffect(() => {
    apiRequest<{ items: ZoneItem[] }>("/api/admin/rooms/zones")
      .then((res) => setZones(res.items || []))
      .catch(() => {});
    apiRequest<any>("/api/admin/room-transfers?page=1&page_size=10&trang_thai=CHO_XU_LY")
      .then((res) => setPendingTransfers(res.cho_xu_ly ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const runSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (semanticQuery.trim().length < 2) {
      toast.error("Nhập mô tả cần tìm (ít nhất 2 ký tự).");
      return;
    }
    setSearchingSemantic(true);
    try {
      const res = await apiRequest<{ items: any[] }>(
        `/api/admin/rooms/semantic-search?q=${encodeURIComponent(semanticQuery.trim())}&limit=12`
      );
      setSemanticResults(res.items || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể tìm kiếm ngữ nghĩa.");
    } finally {
      setSearchingSemantic(false);
    }
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
              activeTab === "rooms" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BedDouble className="h-4 w-4" />
            Danh sách phòng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transfers")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
              activeTab === "transfers" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Yêu cầu đổi phòng
            {pendingTransfers > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeTab === "transfers"
                    ? "bg-white text-[#1F5CA9]"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {pendingTransfers}
              </span>
            )}
          </button>
        </div>

        {activeTab === "rooms" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              <Sparkles className="h-4 w-4" />
              Xếp tự động
            </button>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <UserPlus className="h-4 w-4 text-[#1F5CA9]" />
              Xếp thủ công
            </button>
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Combine className="h-4 w-4" />
              Gộp phòng
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRoom(null);
                setRoomFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Thêm phòng
            </button>
          </div>
        )}
      </div>

      {activeTab === "rooms" ? (
        <>
          <SectionCard
            title="Tìm kiếm & Lọc phòng"
            subtitle={semanticMode ? "Tìm theo ngữ nghĩa tiếng Việt (SentenceTransformer)" : "Lọc nhanh theo khu, sức chứa và trạng thái"}
            icon={Search}
            right={
              <button
                type="button"
                onClick={() => {
                  setSemanticMode((m) => !m);
                  setSemanticResults(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  semanticMode
                    ? "border-[#1F5CA9] bg-blue-50 text-[#1F5CA9]"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {semanticMode ? "Tìm theo mã phòng" : "Tìm theo mô tả"}
              </button>
            }
          >
            {semanticMode ? (
              <form onSubmit={runSemanticSearch} className="flex flex-wrap gap-2.5">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={semanticQuery}
                    onChange={(e) => setSemanticQuery(e.target.value)}
                    placeholder="Ví dụ: phòng nữ 4 người có nấu ăn yên tĩnh tầng cao khu B..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#1F5CA9]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchingSemantic}
                  className="rounded-xl bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
                >
                  {searchingSemantic ? "Đang tìm..." : "Tìm ngữ nghĩa"}
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm theo tên phòng..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#1F5CA9]"
                  />
                </div>

                <select
                  value={scopeKhu || filterKhu}
                  disabled={Boolean(scopeKhu)}
                  onChange={(e) => {
                    setFilterKhu(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  {!scopeKhu && <option value="">Tất cả (Khu A &amp; B)</option>}
                  {zones.map((z) => (
                    <option key={z.ma_khu} value={z.ma_khu}>
                      {z.ten_khu}
                    </option>
                  ))}
                </select>

                <select
                  value={filterSucChua}
                  onChange={(e) => {
                    setFilterSucChua(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Mọi sức chứa</option>
                  <option value="4">Phòng 4 người</option>
                  <option value="6">Phòng 6 người</option>
                  <option value="8">Phòng 8 người</option>
                </select>

                <select
                  value={filterNauAn}
                  onChange={(e) => {
                    setFilterNauAn(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Nấu ăn: Tất cả</option>
                  <option value="true">Có nấu ăn</option>
                  <option value="false">Không nấu ăn</option>
                </select>

                <select
                  value={filterTrangThai}
                  onChange={(e) => {
                    setFilterTrangThai(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Mọi trạng thái</option>
                  <option value="TRONG">Trống</option>
                  <option value="CON_CHO">Còn chỗ</option>
                  <option value="DAY">Đầy</option>
                  <option value="BAO_TRI">Đang bảo trì</option>
                </select>
              </div>
            )}
          </SectionCard>

          {semanticMode && semanticResults ? (
            <SectionCard
              title="Kết quả tìm kiếm ngữ nghĩa"
              subtitle={`${semanticResults.length} phòng phù hợp nhất với mô tả`}
              icon={BedDouble}
              noPadding
            >
              <div className="divide-y divide-slate-100">
                {semanticResults.map((r) => (
                  <div
                    key={r.ma_phong}
                    onClick={() => setSelectedRoom(r)}
                    className="p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">Phòng {r.ten_phong}</span>
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1F5CA9]">
                          Tương đồng {Math.round(r.similarity * 100)}%
                        </span>
                        <RoomStatusBadge status={r.trang_thai_phong} />
                      </div>
                      <p className="text-xs text-slate-600">{r.mo_ta}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-slate-900">
                        {r.so_nguoi_o} / {r.suc_chua} SV
                      </p>
                      <p className="text-xs text-slate-500">{formatVND(r.gia_phong)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title="Danh sách phòng ở"
              subtitle={`Tổng ${total} phòng`}
              icon={BedDouble}
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("ten_phong")}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Tên phòng <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("so_nguoi_o")}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Sĩ số / Sức chứa <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("gia_phong")}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Tiền phòng <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("trang_thai_phong")}
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                        >
                          Trạng thái <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                          <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
                          Đang tải...
                        </td>
                      </tr>
                    ) : rooms.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                          Không có phòng phù hợp.
                        </td>
                      </tr>
                    ) : (
                      rooms.map((room) => (
                        <tr
                          key={room.ma_phong}
                          onClick={() => setSelectedRoom(room)}
                          className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-900">{room.ten_phong}</div>
                            <div className="text-xs text-slate-500">
                              {room.ten_khu} · {room.gioi_tinh === "NAM" ? "Nam" : "Nữ"} ·{" "}
                              {room.co_nau_an ? "Có nấu ăn" : "Không nấu ăn"}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            {room.so_nguoi_o} / {room.suc_chua}
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-800">
                            {formatVND(room.gia_phong)}
                          </td>
                          <td className="px-5 py-3">
                            <RoomStatusBadge status={room.trang_thai_phong} />
                          </td>
                          <td
                            className="px-5 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedRoom(room)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                <Users className="h-3.5 w-3.5" />
                                Sinh viên
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRoom(room);
                                  setRoomFormOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Sửa
                              </button>
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
                unitLabel="phòng"
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </SectionCard>
          )}
        </>
      ) : (
        <RoomTransfersTab
          onPendingCountChange={setPendingTransfers}
          onRoomsChanged={loadRooms}
        />
      )}

      <RoomResidentsModal
        room={selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onUpdated={loadRooms}
      />
      <AutoAssignModal
        open={autoOpen}
        zones={zones}
        onClose={() => setAutoOpen(false)}
        onSuccess={loadRooms}
      />
      <ManualAssignModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={loadRooms}
      />
      <MergeRoomsModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onSuccess={loadRooms}
      />
      <RoomFormModal
        open={roomFormOpen}
        editingRoom={editingRoom}
        zones={zones}
        onClose={() => setRoomFormOpen(false)}
        onSuccess={loadRooms}
      />
    </div>
  );
}

export default function AdminRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
          Đang tải...
        </div>
      }
    >
      <RoomsPageContent />
    </Suspense>
  );
}
