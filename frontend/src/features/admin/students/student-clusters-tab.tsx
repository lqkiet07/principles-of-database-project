"use client";

import React, { useEffect, useState } from "react";
import {
  BellRing,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { apiDownload, apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Modal } from "@/components/shared/modal";
import { SectionCard } from "@/components/shared/section-card";

type ClusterCode = "GUONG_MAU" | "NHAC_THANH_TOAN" | "LUU_Y_GIO_GIAC";

interface ClusterSummary {
  code: string;
  label: string;
  description: string;
  so_luong: number;
}

interface ClusteredStudent {
  mssv: string;
  ho_ten: string;
  nganh: string;
  ten_phong: string;
  ma_khu: string;
  nhom_code: ClusterCode;
  nhom_codes?: ClusterCode[];
  nhom_label: string;
  so_ky_dong_tre: number;
  late_count: number;
}

interface StrangerScan {
  ma_cb: number;
  ma_van_tay_quet: string;
  cong: string;
  loai_luot: string;
  mssv: string | null;
  ho_ten: string | null;
  ten_phong: string | null;
  ket_qua: string;
  ly_do: string;
  thoi_gian: string;
}

interface NotifyModalTarget {
  nhom_label: string;
  mssv?: string;
  ho_ten?: string;
  count: number;
}

const DEFAULT_FEE_MESSAGE = {
  title: "Nhắc nhở đóng phí KTX trễ hạn",
  body:
    "Ban Quản lý KTX ĐH Cần Thơ ghi nhận bạn chưa đóng phí KTX từ 2 kỳ trở lên. Vui lòng hoàn tất thanh toán phí KTX đúng hạn để tránh bị gửi cảnh cáo và xem xét thu hồi chỗ ở theo quy định.",
};

const EXPORT_FILENAME: Record<ClusterCode, string> = {
  GUONG_MAU: "danh_sach_sv_guong_mau.xlsx",
  NHAC_THANH_TOAN: "danh_sach_sv_tre_phi_ktx.xlsx",
  LUU_Y_GIO_GIAC: "danh_sach_ra_vao_khuya.xlsx",
};

export function StudentClustersTab() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ClusterSummary[]>([]);
  const [students, setStudents] = useState<ClusteredStudent[]>([]);
  const [strangers, setStrangers] = useState<StrangerScan[]>([]);
  const [filterCode, setFilterCode] = useState<string>("");
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const [notifyTarget, setNotifyTarget] = useState<NotifyModalTarget | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState(false);

  const loadClusters = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>("/api/admin/students/ai/clusters");
      setSummary(res.summary || []);
      setStudents(res.students || []);
      setStrangers(res.nguoi_la_quet_cong || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể chạy phân nhóm sinh viên.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleExportCluster = async (code: ClusterCode) => {
    setExportingKey(code);
    try {
      await apiDownload(
        `/api/admin/students/ai/clusters/export?nhom_code=${code}`,
        EXPORT_FILENAME[code]
      );
      toast.success("Đã xuất danh sách Excel.");
    } catch (err: any) {
      toast.error(err.message || "Không thể xuất danh sách.");
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportStrangers = async () => {
    setExportingKey("NGUOI_LA");
    try {
      await apiDownload(
        "/api/admin/students/ai/clusters/export-strangers",
        "danh_sach_nguoi_la_quet_cong.xlsx"
      );
      toast.success("Đã xuất danh sách người lạ quét cổng.");
    } catch (err: any) {
      toast.error(err.message || "Không thể xuất danh sách người lạ.");
    } finally {
      setExportingKey(null);
    }
  };

  const openNotifyModal = (
    nhomLabel: string,
    count: number,
    student?: ClusteredStudent
  ) => {
    setNotifyTarget({
      nhom_label: nhomLabel,
      mssv: student?.mssv,
      ho_ten: student?.ho_ten,
      count,
    });
    setCustomTitle(DEFAULT_FEE_MESSAGE.title);
    setCustomBody(DEFAULT_FEE_MESSAGE.body);
  };

  const handleSendNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyTarget) return;
    setSending(true);
    try {
      const res = await apiRequest<any>("/api/admin/students/ai/clusters/notify", {
        method: "POST",
        body: {
          nhom_code: "NHAC_THANH_TOAN",
          mssv: notifyTarget.mssv || null,
          tieu_de: customTitle.trim(),
          noi_dung: customBody.trim(),
        },
      });
      toast.success(res.thong_bao || "Đã gửi nhắc nhở đến sinh viên.");
      setNotifyTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi nhắc nhở.");
    } finally {
      setSending(false);
    }
  };

  const visibleStudents = filterCode
    ? students.filter((s) =>
        (s.nhom_codes || [s.nhom_code]).includes(filterCode as ClusterCode)
      )
    : students;

  const badgeStyle = (code: string) => {
    if (code === "GUONG_MAU") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (code === "NHAC_THANH_TOAN") return "bg-amber-50 text-amber-800 border-amber-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  const isFeeFilter = filterCode === "NHAC_THANH_TOAN";
  const isAccessFilter = filterCode === "LUU_Y_GIO_GIAC";
  const isModelFilter = filterCode === "GUONG_MAU";

  return (
    <div className="space-y-5">
      <SectionCard
        title="Phân nhóm quản lý sinh viên nội trú"
        subtitle="Theo dõi đóng phí KTX và lưu thông tin ra vào cổng vân tay"
        right={
          <button
            type="button"
            onClick={loadClusters}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Cập nhật
          </button>
        }
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
            Đang tải dữ liệu phân nhóm...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary.map((g) => {
              const code = g.code as ClusterCode;
              const selected = filterCode === g.code;
              return (
                <div
                  key={g.code}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                    selected
                      ? "border-[#1F5CA9] bg-blue-50/40"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFilterCode((prev) => (prev === g.code ? "" : g.code))}
                    className="text-left w-full"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{g.label}</span>
                      <span
                        className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${badgeStyle(
                          g.code
                        )}`}
                      >
                        {g.so_luong} SV
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600">{g.description}</p>
                  </button>

                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap gap-2">
                    {code === "GUONG_MAU" && (
                      <button
                        type="button"
                        disabled={g.so_luong === 0 || exportingKey === code}
                        onClick={() => handleExportCluster(code)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                        {exportingKey === code ? "Đang xuất..." : "Xuất danh sách"}
                      </button>
                    )}

                    {code === "NHAC_THANH_TOAN" && (
                      <>
                        <button
                          type="button"
                          disabled={g.so_luong === 0 || exportingKey === code}
                          onClick={() => handleExportCluster(code)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                          {exportingKey === code ? "Đang xuất..." : "Xuất danh sách"}
                        </button>
                        <button
                          type="button"
                          disabled={g.so_luong === 0}
                          onClick={() => openNotifyModal(g.label, g.so_luong)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          <BellRing className="h-3.5 w-3.5" />
                          Nhắc nhở
                        </button>
                      </>
                    )}

                    {code === "LUU_Y_GIO_GIAC" && (
                      <>
                        <button
                          type="button"
                          disabled={g.so_luong === 0 || exportingKey === code}
                          onClick={() => handleExportCluster(code)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-[#1F5CA9]" />
                          {exportingKey === code ? "Đang xuất..." : "Xuất DS ra vào"}
                        </button>
                        <button
                          type="button"
                          disabled={strangers.length === 0 || exportingKey === "NGUOI_LA"}
                          onClick={handleExportStrangers}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                          {exportingKey === "NGUOI_LA" ? "Đang xuất..." : "Xuất DS người lạ"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {!loading && (
        <SectionCard
          title={
            isAccessFilter
              ? "Thông tin ra vào khung giờ khuya (23:00–05:00)"
              : "Danh sách sinh viên theo nhóm"
          }
          subtitle={`Hiển thị ${visibleStudents.length} sinh viên${filterCode ? " (đang lọc)" : ""}`}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">MSSV</th>
                  <th className="px-4 py-3">Họ tên</th>
                  <th className="px-4 py-3">Phòng</th>
                  {(!filterCode || isFeeFilter) && (
                    <th className="px-4 py-3 text-right">Trễ phí KTX</th>
                  )}
                  {(!filterCode || isAccessFilter) && (
                    <th className="px-4 py-3 text-right">Ra vào khuya (23h–5h)</th>
                  )}
                  {(!filterCode || isModelFilter) && (
                    <th className="px-4 py-3 text-center">Nhóm</th>
                  )}
                  {(!filterCode || isFeeFilter) && (
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStudents.slice(0, 80).map((s) => {
                  const codes = s.nhom_codes || [s.nhom_code];
                  const hasFeeArrears = codes.includes("NHAC_THANH_TOAN");
                  return (
                    <tr key={s.mssv} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold">{s.mssv}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{s.ho_ten}</td>
                      <td className="px-4 py-2.5 text-slate-700">{s.ten_phong}</td>
                      {(!filterCode || isFeeFilter) && (
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          <span
                            className={
                              s.so_ky_dong_tre >= 2
                                ? "font-bold text-amber-700"
                                : "text-slate-600"
                            }
                          >
                            {s.so_ky_dong_tre} kỳ
                          </span>
                        </td>
                      )}
                      {(!filterCode || isAccessFilter) && (
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          <span
                            className={
                              s.late_count > 0 ? "font-bold text-red-700" : "text-slate-600"
                            }
                          >
                            {s.late_count} lượt
                          </span>
                        </td>
                      )}
                      {(!filterCode || isModelFilter) && (
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`inline-block rounded-lg border px-2 py-0.5 text-xs font-medium ${badgeStyle(
                              s.nhom_code
                            )}`}
                          >
                            {s.nhom_label}
                          </span>
                        </td>
                      )}
                      {(!filterCode || isFeeFilter) && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {hasFeeArrears ? (
                            <button
                              type="button"
                              onClick={() => openNotifyModal("Đóng phí KTX trễ", 1, s)}
                              className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                            >
                              Nhắc nhở
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!loading && (isAccessFilter || (!filterCode && strangers.length > 0)) && (
        <SectionCard
          title="Danh sách người lạ / từ chối quét vân tay cổng KTX"
          subtitle={`${strangers.length} lượt quét bị chặn tại cổng vân tay`}
          right={
            <button
              type="button"
              disabled={strangers.length === 0 || exportingKey === "NGUOI_LA"}
              onClick={handleExportStrangers}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exportingKey === "NGUOI_LA" ? "Đang xuất..." : "Xuất DS người lạ"}
            </button>
          }
          noPadding
        >
          {strangers.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Chưa ghi nhận lượt quét người lạ nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Cổng</th>
                    <th className="px-4 py-3 text-center">Lượt</th>
                    <th className="px-4 py-3">Mã vân tay</th>
                    <th className="px-4 py-3 text-center">Kết quả</th>
                    <th className="px-4 py-3">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {strangers.map((a) => (
                    <tr key={a.ma_cb} className="bg-red-50/30 hover:bg-red-50/60">
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(a.thoi_gian)}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-800 whitespace-nowrap">
                        {a.cong}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs whitespace-nowrap">
                        {a.loai_luot === "RA" ? "Ra" : "Vào"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">
                        {a.ma_van_tay_quet}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <span className="inline-block rounded bg-red-100 border border-red-300 px-2 py-0.5 text-xs font-bold text-red-800">
                          {a.ket_qua === "CHAN_NGUOI_LA"
                            ? "Người lạ"
                            : a.ket_qua === "CHAN_KHONG_CO_PHONG"
                              ? "Không có phòng"
                              : "Chưa ĐK vân tay"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">{a.ly_do}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      <Modal
        open={Boolean(notifyTarget)}
        onClose={() => setNotifyTarget(null)}
        size="md"
        title={
          notifyTarget?.mssv
            ? `Nhắc nhở ${notifyTarget.ho_ten} (${notifyTarget.mssv})`
            : `Nhắc nhở đóng phí KTX (${notifyTarget?.count || 0} SV)`
        }
      >
        <form onSubmit={handleSendNotify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tiêu đề *
            </label>
            <input
              type="text"
              required
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nội dung nhắc nhở *
            </label>
            <textarea
              rows={4}
              required
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNotifyTarget(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Đang gửi..." : "Gửi"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
