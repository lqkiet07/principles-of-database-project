"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiDownload, apiRequest } from "@/lib/api";
import { formatMonthLabel, formatVND } from "@/lib/format";
import { Modal } from "@/components/shared/modal";

interface ImportMetersModalProps {
  open: boolean;
  defaultMonth: string;
  onClose: () => void;
  onSuccess: (importedMonth: string) => void;
}

export function ImportMetersModal({
  open,
  defaultMonth,
  onClose,
  onSuccess,
}: ImportMetersModalProps) {
  const [importMonth, setImportMonth] = useState(defaultMonth);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (open) {
      setImportMonth(defaultMonth);
      setPreview(null);
    }
  }, [open, defaultMonth]);

  const handleDownloadTemplate = async () => {
    try {
      await apiDownload(
        `/api/admin/bills/template?thang=${encodeURIComponent(importMonth)}`,
        `mau_nhap_chi_so_${importMonth}.xlsx`
      );
    } catch (err: any) {
      toast.error(err.message || "Không thể tải file mẫu.");
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("thang", importMonth);
    fd.append("file", file);
    setImporting(true);
    try {
      const res = await apiRequest<any>("/api/admin/bills/import/preview", {
        method: "POST",
        formData: fd,
      });
      setPreview(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể đọc tệp.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const downloadErrorCsv = () => {
    if (!preview?.loi?.length) return;
    const header = "Dong,TenPhong,ChiSoDienCuoi,ChiSoNuocCuoi,Loi\n";
    const body = preview.loi
      .map(
        (r: any) =>
          `${r.dong},"${r.ten_phong}","${r.chi_so_dien_cuoi}","${r.chi_so_nuoc_cuoi}","${String(r.loi).replaceAll('"', '""')}"`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dong_loi_chi_so_${preview.thang}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    if (!preview?.hop_le?.length) return;
    if (
      !window.confirm(
        `Lưu chỉ số và tạo hóa đơn cho ${preview.hop_le.length} phòng (${formatMonthLabel(preview.thang)})?`
      )
    ) {
      return;
    }
    setImporting(true);
    try {
      const res = await apiRequest<any>("/api/admin/bills/import/confirm", {
        method: "POST",
        body: {
          thang: preview.thang,
          rows: preview.hop_le.map((r: any) => ({
            ma_phong: r.ma_phong,
            chi_so_dien_cuoi: r.chi_so_dien_cuoi,
            chi_so_nuoc_cuoi: r.chi_so_nuoc_cuoi,
          })),
        },
      });
      toast.success(`Đã lưu chỉ số cho ${res.so_phong_da_luu} phòng.`);
      onSuccess(preview.thang);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi lưu chỉ số.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Nhập chỉ số từ Excel / CSV"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Đóng
          </button>
          {preview?.hop_le?.length > 0 && (
            <button
              type="button"
              disabled={importing}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Lưu {preview.hop_le.length} phòng hợp lệ
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tháng</label>
            <input
              type="month"
              value={importMonth}
              onChange={(e) => {
                setImportMonth(e.target.value);
                setPreview(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            <Download className="h-4 w-4 text-[#1F5CA9]" />
            Tải file mẫu
          </button>

          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Chọn file Excel/CSV
            <input
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleUploadFile}
            />
          </label>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">Tổng dòng</p>
                <p className="text-xl font-bold text-slate-900">{preview.tong_dong}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Hợp lệ</p>
                <p className="text-xl font-bold text-emerald-800">{preview.so_dong_hop_le}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">Lỗi</p>
                <p className="text-xl font-bold text-red-800">{preview.so_dong_loi}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">Bất thường</p>
                <p className="text-xl font-bold text-amber-900">{preview.so_bat_thuong}</p>
              </div>
            </div>

            {preview.phong_thieu?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Thiếu {preview.phong_thieu.length} phòng:</strong>{" "}
                {preview.phong_thieu.map((p: any) => p.ten_phong).join(", ")}
              </div>
            )}

            {preview.loi?.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-red-800">
                    Dòng lỗi ({preview.loi.length})
                  </p>
                  <button
                    type="button"
                    onClick={downloadErrorCsv}
                    className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải danh sách lỗi
                  </button>
                </div>
                <ul className="space-y-1 text-xs text-red-700 max-h-36 overflow-y-auto">
                  {preview.loi.map((e: any, i: number) => (
                    <li key={i}>
                      Dòng {e.dong} ({e.ten_phong || "trống"}): {e.loi}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.hop_le?.length > 0 && (
              <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Phòng</th>
                      <th className="px-3 py-2">Điện</th>
                      <th className="px-3 py-2">Nước</th>
                      <th className="px-3 py-2">Thành tiền</th>
                      <th className="px-3 py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {preview.hop_le.map((r: any) => (
                      <tr key={r.ma_phong} className={r.canh_bao?.length ? "bg-amber-50/70" : ""}>
                        <td className="px-3 py-2 font-semibold">{r.ten_phong}</td>
                        <td className="px-3 py-2">
                          {r.chi_so_dien_dau} → {r.chi_so_dien_cuoi} ({r.luong_dien} kWh)
                        </td>
                        <td className="px-3 py-2">
                          {r.chi_so_nuoc_dau} → {r.chi_so_nuoc_cuoi} ({r.luong_nuoc} m³)
                        </td>
                        <td className="px-3 py-2 font-semibold">{formatVND(r.so_tien)}</td>
                        <td className="px-3 py-2">
                          {r.canh_bao?.length ? (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              {r.canh_bao.join(" ")}
                            </span>
                          ) : (
                            <span className="text-emerald-700">Hợp lệ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
