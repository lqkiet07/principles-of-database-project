"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GraduationCap, Loader2, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SectionCard } from "@/components/shared/section-card";
import { StudentRow } from "@/features/admin/students/types";
import { StudentDetailModal } from "@/features/admin/students/student-detail-modal";
import { StudentFormModal } from "@/features/admin/students/student-form-modal";
import { StudentClustersTab } from "@/features/admin/students/student-clusters-tab";

export default function AdminStudentsPage() {
  const [tab, setTab] = useState<"list" | "clusters">("list");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [nganhList, setNganhList] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [soDaKy, setSoDaKy] = useState(0);
  const [soChuaKy, setSoChuaKy] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [nganh, setNganh] = useState("");
  const [trangThaiO, setTrangThaiO] = useState<"TAT_CA" | "DA_CO_PHONG" | "CHUA_CO_PHONG">("TAT_CA");
  const [loading, setLoading] = useState(true);

  const [detailData, setDetailData] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        trang_thai_o: trangThaiO,
      });
      if (search.trim()) params.set("search", search.trim());
      if (nganh) params.set("nganh", nganh);

      const res = await apiRequest<{
        items: StudentRow[];
        total: number;
        so_da_ky: number;
        so_chua_ky: number;
        nganh_list: string[];
      }>(`/api/admin/students?${params.toString()}`);

      setStudents(res.items);
      setTotal(res.total);
      setSoDaKy(res.so_da_ky ?? 0);
      setSoChuaKy(res.so_chua_ky ?? 0);
      setNganhList(res.nganh_list || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tải danh sách sinh viên.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, nganh, trangThaiO]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const openDetail = async (mssv: string) => {
    try {
      const res = await apiRequest(`/api/admin/students/${mssv}`);
      setDetailData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tải hồ sơ sinh viên.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
              tab === "list" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Danh sách sinh viên & Hợp đồng
          </button>
          <button
            type="button"
            onClick={() => setTab("clusters")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
              tab === "clusters" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            Phân loại sinh viên (K-Means)
          </button>
        </div>

        {tab === "list" && (
          <button
            type="button"
            onClick={() => {
              setEditingStudent(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
          >
            <Plus className="h-4 w-4" />
            Thêm sinh viên
          </button>
        )}
      </div>

      {tab === "clusters" ? (
        <StudentClustersTab />
      ) : (
        <>
          <SectionCard
            title="Bộ lọc & Thống kê hợp đồng"
            subtitle={`Tổng: ${total} SV · Đã ký HĐ: ${soDaKy} · Chưa ký: ${soChuaKy}`}
            icon={Search}
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
                  placeholder="Tìm MSSV hoặc họ tên..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                />
              </div>

              <select
                value={trangThaiO}
                onChange={(e) => {
                  setTrangThaiO(e.target.value as typeof trangThaiO);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="TAT_CA">Tất cả trạng thái</option>
                <option value="DA_CO_PHONG">Đang ở KTX</option>
                <option value="CHUA_CO_PHONG">Chưa xếp phòng</option>
              </select>

              <select
                value={nganh}
                onChange={(e) => {
                  setNganh(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="">Tất cả ngành</option>
                {nganhList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </SectionCard>

          <SectionCard
            title="Hồ sơ sinh viên nội trú"
            subtitle="Kèm trạng thái hợp đồng nội trú thực tế"
            icon={GraduationCap}
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">MSSV</th>
                    <th className="px-5 py-3">Họ và tên</th>
                    <th className="px-5 py-3">Ngành</th>
                    <th className="px-5 py-3">SĐT</th>
                    <th className="px-5 py-3">Phòng</th>
                    <th className="px-5 py-3 text-center">Hợp đồng</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
                        Đang tải...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                        Không tìm thấy sinh viên phù hợp.
                      </td>
                    </tr>
                  ) : (
                    students.map((sv) => (
                      <tr key={sv.mssv} className="hover:bg-slate-50/70">
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-900">
                          {sv.mssv}
                        </td>
                        <td className="px-5 py-2.5 font-medium text-slate-900">
                          {sv.ho_ten}
                          <span className="ml-1.5 text-xs font-normal text-slate-400">
                            ({sv.gioi_tinh === "NAM" ? "Nam" : "Nữ"})
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-slate-600">{sv.nganh}</td>
                        <td className="px-5 py-2.5 text-slate-600 font-mono text-xs">{sv.sdt}</td>
                        <td className="px-5 py-2.5">
                          {sv.ten_phong ? (
                            <span className="font-medium text-slate-900">{sv.ten_phong}</span>
                          ) : (
                            <span className="text-xs text-slate-400">Chưa xếp</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          {sv.trang_thai_hop_dong === "DA_KY" ? (
                            <span className="inline-block rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Đã ký
                            </span>
                          ) : sv.trang_thai_hop_dong === "CHUA_KY" ? (
                            <span className="inline-block rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Chưa ký
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => openDetail(sv.mssv)}
                            className="text-xs font-semibold text-[#1F5CA9] hover:underline"
                          >
                            Xem
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStudent(sv);
                              setFormOpen(true);
                            }}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                          >
                            Sửa
                          </button>
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
        </>
      )}

      <StudentDetailModal detail={detailData} onClose={() => setDetailData(null)} />

      <StudentFormModal
        open={formOpen}
        editing={editingStudent}
        nganhList={nganhList}
        onClose={() => setFormOpen(false)}
        onSuccess={fetchStudents}
      />
    </div>
  );
}
