"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SectionCard } from "@/components/shared/section-card";
import { StudentRow } from "@/features/admin/students/types";
import { StudentDetailModal } from "@/features/admin/students/student-detail-modal";
import { StudentClustersTab } from "@/features/admin/students/student-clusters-tab";

function getTomorrowIso(): string {
  const d = new Date(Date.now() + 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const scopeKhu = user?.ma_khu_phu_trach || null;

  const [tab, setTab] = useState<"list" | "clusters">("list");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [nganhList, setNganhList] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [soDaKy, setSoDaKy] = useState(0);
  const [soChuaKy, setSoChuaKy] = useState(0);
  const [soTre12Ky, setSoTre12Ky] = useState(0);
  const [soTreTren2Ky, setSoTreTren2Ky] = useState(0);
  const [soChuaCanhCao, setSoChuaCanhCao] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [maKhu, setMaKhu] = useState(scopeKhu || "");
  const [nganh, setNganh] = useState("");
  const [trangThaiO, setTrangThaiO] = useState<"TAT_CA" | "DA_CO_PHONG" | "CHUA_CO_PHONG">("TAT_CA");
  const [soKyTreMin, setSoKyTreMin] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actingMssv, setActingMssv] = useState<string | null>(null);
  const [warningAll, setWarningAll] = useState(false);
  const [remindingLateAll, setRemindingLateAll] = useState(false);

  const [detailData, setDetailData] = useState<any>(null);

  // Modal gửi thông báo thu hồi phòng (hẹn đến trình bày)
  const [noticeStudent, setNoticeStudent] = useState<StudentRow | null>(null);
  const [henNgay, setHenNgay] = useState(getTomorrowIso());
  const [henGio, setHenGio] = useState("08:30");
  const [diaDiem, setDiaDiem] = useState("Phòng Quản lý Ký túc xá - Trường ĐH Cần Thơ");
  const [lyDoThuHoi, setLyDoThuHoi] = useState("");
  const [sendingNotice, setSendingNotice] = useState(false);

  useEffect(() => {
    if (scopeKhu) setMaKhu(scopeKhu);
  }, [scopeKhu]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        trang_thai_o: trangThaiO,
      });
      const effectiveKhu = scopeKhu || maKhu;
      if (effectiveKhu) params.set("ma_khu", effectiveKhu);
      if (search.trim()) params.set("search", search.trim());
      if (nganh) params.set("nganh", nganh);
      if (soKyTreMin) params.set("so_ky_tre_min", soKyTreMin);

      const res = await apiRequest<{
        items: StudentRow[];
        total: number;
        so_da_ky: number;
        so_chua_ky: number;
        so_tre_1_2_ky: number;
        so_tre_tren_2_ky: number;
        so_chua_canh_cao: number;
        nganh_list: string[];
      }>(`/api/admin/students?${params.toString()}`);

      setStudents(res.items);
      setTotal(res.total);
      setSoDaKy(res.so_da_ky ?? 0);
      setSoChuaKy(res.so_chua_ky ?? 0);
      setSoTre12Ky(res.so_tre_1_2_ky ?? 0);
      setSoTreTren2Ky(res.so_tre_tren_2_ky ?? 0);
      setSoChuaCanhCao(res.so_chua_canh_cao ?? 0);
      setNganhList(res.nganh_list || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tải danh sách sinh viên.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, scopeKhu, maKhu, nganh, trangThaiO, soKyTreMin]);

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

  const handleSendWarning = async (sv: StudentRow) => {
    setActingMssv(sv.mssv);
    try {
      const res = await apiRequest<any>(`/api/admin/students/${sv.mssv}/send-warning`, {
        method: "POST",
        body: {},
      });
      toast.success(res.thong_bao || `Đã gửi cảnh cáo đến sinh viên ${sv.mssv}.`);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi cảnh cáo.");
    } finally {
      setActingMssv(null);
    }
  };

  const handleSendWarningAllOverdue = async () => {
    setWarningAll(true);
    try {
      const res = await apiRequest<any>("/api/admin/students/send-warning-all-overdue", {
        method: "POST",
        body: {},
      });
      toast.success(res.thong_bao || "Đã gửi cảnh cáo các sinh viên đóng trễ > 2 kỳ.");
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi cảnh cáo hàng loạt.");
    } finally {
      setWarningAll(false);
    }
  };

  const handleSendLateReminder = async (sv: StudentRow) => {
    setActingMssv(sv.mssv);
    try {
      const res = await apiRequest<any>(`/api/admin/students/${sv.mssv}/send-late-reminder`, {
        method: "POST",
        body: {},
      });
      toast.success(res.thong_bao || `Đã gửi nhắc đóng phí trễ đến ${sv.mssv}.`);
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi nhắc nhở.");
    } finally {
      setActingMssv(null);
    }
  };

  const handleSendLateRemindersBulk = async () => {
    setRemindingLateAll(true);
    try {
      const res = await apiRequest<any>("/api/admin/students/send-late-reminders", {
        method: "POST",
        body: {},
      });
      toast.success(res.thong_bao || "Đã gửi thông báo nhắc đóng phí KTX trễ hạn.");
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi thông báo nhắc đóng phí.");
    } finally {
      setRemindingLateAll(false);
    }
  };

  const openRevocationNoticeModal = (sv: StudentRow) => {
    setNoticeStudent(sv);
    setHenNgay(getTomorrowIso());
    setHenGio("08:30");
    setDiaDiem("Phòng Quản lý Ký túc xá - Trường ĐH Cần Thơ");
    setLyDoThuHoi(
      `Đóng trễ phí KTX ${sv.so_ky_dong_tre} kỳ (vượt quá 2 kỳ quy định) và chưa hoàn tất thanh toán sau khi đã nhận thông báo cảnh cáo.`
    );
  };

  const handleSubmitRevocationNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeStudent) return;
    if (!henNgay || !henGio) {
      toast.error("Vui lòng chọn ngày và giờ hẹn sinh viên đến trình bày.");
      return;
    }

    setSendingNotice(true);
    try {
      const isoTime = `${henNgay}T${henGio}:00+07:00`;
      const res = await apiRequest<any>(
        `/api/admin/students/${noticeStudent.mssv}/send-revocation-notice`,
        {
          method: "POST",
          body: {
            thoi_gian_trinh_bay: isoTime,
            dia_diem_trinh_bay: diaDiem.trim(),
            ly_do: lyDoThuHoi.trim(),
          },
        }
      );
      toast.success(res.thong_bao || "Đã gửi thông báo thu hồi phòng kèm lịch hẹn trình bày.");
      setNoticeStudent(null);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi thông báo thu hồi phòng.");
    } finally {
      setSendingNotice(false);
    }
  };

  const handleRevokeRoom = async (sv: StudentRow) => {
    if (
      !window.confirm(
        `Xác nhận thu hồi chỗ ở chính thức đối với sinh viên ${sv.ho_ten} (${sv.mssv}) tại phòng ${sv.ten_phong}?${
          sv.la_truong_phong ? " Vai trò Trưởng phòng sẽ được tự động chuyển cho thành viên khác trong phòng." : ""
        }`
      )
    ) {
      return;
    }
    setActingMssv(sv.mssv);
    try {
      const res = await apiRequest<any>(`/api/admin/students/${sv.mssv}/revoke-room`, {
        method: "POST",
        body: {
          ly_do:
            sv.ly_do_thu_hoi ||
            `Đóng trễ phí KTX ${sv.so_ky_dong_tre} kỳ sau khi đã cảnh cáo và mời trình bày`,
        },
      });
      toast.success(res.thong_bao || `Đã thu hồi phòng của sinh viên ${sv.mssv}.`);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Không thể thu hồi phòng.");
    } finally {
      setActingMssv(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
              tab === "list" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Hồ sơ sinh viên
          </button>
          <button
            type="button"
            onClick={() => setTab("clusters")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
              tab === "clusters" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Phân nhóm sinh viên
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scopeKhu && (
            <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1F5CA9]">
              Phạm vi: Khu {scopeKhu}
            </span>
          )}
          {tab === "list" && soTre12Ky > 0 && (
            <button
              type="button"
              disabled={remindingLateAll}
              onClick={handleSendLateRemindersBulk}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {remindingLateAll
                ? "Đang gửi nhắc..."
                : `Nhắc đóng phí trễ (${soTre12Ky} SV)`}
            </button>
          )}
          {tab === "list" && soChuaCanhCao > 0 && (
            <button
              type="button"
              disabled={warningAll}
              onClick={handleSendWarningAllOverdue}
              className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {warningAll
                ? "Đang gửi cảnh cáo..."
                : `Gửi cảnh cáo ${soChuaCanhCao} SV đóng trễ > 2 kỳ`}
            </button>
          )}
        </div>
      </div>

      {tab === "clusters" ? (
        <StudentClustersTab />
      ) : (
        <>
          <SectionCard
            title="Bộ lọc hồ sơ sinh viên (Đồng bộ từ hệ thống trường)"
            right={
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  HĐ đã ký: <strong className="text-emerald-700">{soDaKy}</strong> · Chưa ký:{" "}
                  <strong className="text-amber-700">{soChuaKy}</strong>
                </span>
                <span>
                  Trễ &gt; 2 kỳ: <strong className="text-red-700">{soTreTren2Ky}</strong>
                </span>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm MSSV hoặc họ tên..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                />
              </div>

              <select
                value={scopeKhu || maKhu}
                disabled={Boolean(scopeKhu)}
                onChange={(e) => {
                  setMaKhu(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9] disabled:bg-slate-100"
              >
                {!scopeKhu && <option value="">Khu: Tất cả (A &amp; B)</option>}
                {(!scopeKhu || scopeKhu === "A") && <option value="A">Khu A</option>}
                {(!scopeKhu || scopeKhu === "B") && <option value="B">Khu B</option>}
              </select>

              <select
                value={trangThaiO}
                onChange={(e) => {
                  setTrangThaiO(e.target.value as typeof trangThaiO);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="TAT_CA">Chỗ ở: Tất cả</option>
                <option value="DA_CO_PHONG">Đang ở KTX</option>
                <option value="CHUA_CO_PHONG">Chưa có phòng / Đã thu hồi</option>
              </select>

              <select
                value={soKyTreMin}
                onChange={(e) => {
                  setSoKyTreMin(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              >
                <option value="">Đóng trễ KTX: Tất cả</option>
                <option value="1">Đóng trễ ≥ 1 kỳ</option>
                <option value="2">Đóng trễ ≥ 2 kỳ</option>
                <option value="3">Đóng trễ &gt; 2 kỳ (Diện cảnh cáo / thu hồi)</option>
              </select>

              <select
                value={nganh}
                onChange={(e) => {
                  setNganh(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
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

          <SectionCard title={`Danh sách hồ sơ sinh viên (${total.toLocaleString("vi-VN")})`} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">MSSV</th>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-4 py-3">Phòng</th>
                    <th className="px-4 py-3 text-center">Hợp đồng</th>
                    <th className="px-4 py-3 text-center">Đóng trễ &amp; Xử lý vi phạm</th>
                    <th className="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
                        Đang tải...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        Không tìm thấy sinh viên phù hợp.
                      </td>
                    </tr>
                  ) : (
                    students.map((sv) => {
                      const tre = sv.so_ky_dong_tre ?? 0;
                      const stNo = sv.trang_thai_xu_ly_no;
                      return (
                        <tr key={sv.mssv} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">
                            {sv.mssv}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-900">
                              {sv.ho_ten}
                              <span className="ml-1.5 text-xs font-normal text-slate-400">
                                ({sv.gioi_tinh === "NAM" ? "Nam" : "Nữ"})
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">{sv.nganh}</div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {sv.ten_phong ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900">
                                  {sv.ten_phong}
                                </span>
                                <span className="text-xs text-slate-400">(Khu {sv.ma_khu})</span>
                                {sv.la_truong_phong && (
                                  <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[11px] font-semibold text-[#1F5CA9]">
                                    Trưởng phòng
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Chưa có phòng</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            {sv.trang_thai_hop_dong === "DA_KY" ? (
                              <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                Đã ký
                              </span>
                            ) : sv.trang_thai_hop_dong === "CHUA_KY" ? (
                              <span className="inline-block rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Chưa ký
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            <div className="inline-flex flex-wrap items-center justify-center gap-1.5">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  tre > 2
                                    ? "bg-red-50 border border-red-200 text-red-700 font-semibold"
                                    : tre > 0
                                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                                    : "text-slate-500"
                                }`}
                              >
                                {tre} kỳ
                              </span>

                              {tre >= 1 && tre <= 2 && sv.ma_phong && (
                                <button
                                  type="button"
                                  disabled={actingMssv === sv.mssv}
                                  onClick={() => handleSendLateReminder(sv)}
                                  className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                >
                                  Nhắc đóng phí
                                </button>
                              )}

                              {tre > 2 && sv.ma_phong && !stNo && (
                                <button
                                  type="button"
                                  disabled={actingMssv === sv.mssv}
                                  onClick={() => handleSendWarning(sv)}
                                  className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                >
                                  Gửi cảnh cáo
                                </button>
                              )}

                              {tre > 2 && sv.ma_phong && stNo === "DA_CANH_CAO" && (
                                <>
                                  <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                    Đã cảnh cáo
                                  </span>
                                  <button
                                    type="button"
                                    disabled={actingMssv === sv.mssv}
                                    onClick={() => openRevocationNoticeModal(sv)}
                                    className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Gửi TB thu hồi phòng
                                  </button>
                                </>
                              )}

                              {tre > 2 && sv.ma_phong && stNo === "DA_GUI_TB_THU_HOI" && (
                                <>
                                  <span className="rounded bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                    Hẹn trình bày: {formatDateTime(sv.thoi_gian_trinh_bay)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={actingMssv === sv.mssv}
                                    onClick={() => handleRevokeRoom(sv)}
                                    className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Thu hồi chính thức
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openDetail(sv.mssv)}
                              className="text-xs font-semibold text-[#1F5CA9] hover:underline"
                            >
                              Xem hồ sơ
                            </button>
                          </td>
                        </tr>
                      );
                    })
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

      <Modal
        open={Boolean(noticeStudent)}
        onClose={() => setNoticeStudent(null)}
        size="md"
        title="Gửi thông báo thu hồi phòng & Lịch hẹn trình bày"
        description={
          noticeStudent
            ? `${noticeStudent.ho_ten} (${noticeStudent.mssv}) · Phòng ${noticeStudent.ten_phong}`
            : ""
        }
      >
        <form onSubmit={handleSubmitRevocationNotice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ngày hẹn đến trình bày *
              </label>
              <input
                type="date"
                required
                value={henNgay}
                onChange={(e) => setHenNgay(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Giờ hẹn *
              </label>
              <input
                type="time"
                required
                value={henGio}
                onChange={(e) => setHenGio(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Địa điểm trình bày *
            </label>
            <input
              type="text"
              required
              value={diaDiem}
              onChange={(e) => setDiaDiem(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Lý do &amp; Nội dung thông báo *
            </label>
            <textarea
              rows={3}
              required
              value={lyDoThuHoi}
              onChange={(e) => setLyDoThuHoi(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNoticeStudent(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={sendingNotice}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {sendingNotice ? "Đang gửi..." : "Gửi thông báo thu hồi phòng"}
            </button>
          </div>
        </form>
      </Modal>

      <StudentDetailModal detail={detailData} onClose={() => setDetailData(null)} />
    </div>
  );
}
