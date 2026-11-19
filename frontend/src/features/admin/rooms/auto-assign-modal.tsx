"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";
import type { ZoneItem } from "./types";

interface AutoAssignModalProps {
  open: boolean;
  zones: ZoneItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const parseMssvInput = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );

export function AutoAssignModal({
  open,
  zones,
  onClose,
  onSuccess,
}: AutoAssignModalProps) {
  const [mssvText, setMssvText] = useState("");
  const [sucChua, setSucChua] = useState<4 | 6 | 8>(4);
  const [khu, setKhu] = useState("");
  const [nauAn, setNauAn] = useState<"" | "true" | "false">("");
  const [allowPartial, setAllowPartial] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await apiRequest<{ mssv_list: string[]; so_luong: number }>(
        "/api/admin/rooms/auto-assign/parse-file",
        { method: "POST", formData: fd }
      );
      setMssvText(res.mssv_list.join("\n"));
      setPreview(null);
      toast.success(`Đã đọc ${res.so_luong} MSSV từ tệp.`);
    } catch (err: any) {
      toast.error(err.message || "Không thể đọc tệp.");
    } finally {
      e.target.value = "";
    }
  };

  const handlePreview = async () => {
    const list = parseMssvInput(mssvText);
    if (list.length === 0) {
      toast.error("Vui lòng nhập danh sách MSSV.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("/api/admin/rooms/auto-assign/preview", {
        method: "POST",
        body: {
          mssv_list: list,
          suc_chua: sucChua,
          ma_khu: khu || null,
          co_nau_an: nauAn === "" ? null : nauAn === "true",
          cho_phep_chua_day: allowPartial,
        },
      });
      setPreview(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể xem trước.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    const list = parseMssvInput(mssvText);
    if (!preview?.hop_le) return;
    if (preview.canh_bao_thieu_cho?.length > 0 && !allowPartial) {
      toast.warning("Vui lòng xác nhận cho phép xếp vào phòng chưa đầy hoặc bổ sung MSSV.");
      return;
    }
    if (!window.confirm(`Xác nhận xếp phòng cho ${list.length} sinh viên?`)) return;

    setSubmitting(true);
    try {
      await apiRequest("/api/admin/rooms/auto-assign/confirm", {
        method: "POST",
        body: {
          mssv_list: list,
          suc_chua: sucChua,
          ma_khu: khu || null,
          co_nau_an: nauAn === "" ? null : nauAn === "true",
          cho_phep_chua_day: allowPartial,
        },
      });
      toast.success(`Đã xếp phòng thành công cho ${list.length} sinh viên.`);
      setMssvText("");
      setPreview(null);
      setAllowPartial(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Xếp phòng thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Xếp phòng tự động"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handlePreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F5CA9] bg-blue-50 px-4 py-2 text-sm font-semibold text-[#1F5CA9] hover:bg-blue-100 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xem trước
          </button>
          {preview?.hop_le && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Xác nhận xếp phòng
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Loại phòng *</label>
            <select
              value={sucChua}
              onChange={(e) => {
                setSucChua(Number(e.target.value) as 4 | 6 | 8);
                setPreview(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={4}>Phòng 4 người</option>
              <option value={6}>Phòng 6 người</option>
              <option value={8}>Phòng 8 người</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Khu</label>
            <select
              value={khu}
              onChange={(e) => {
                setKhu(e.target.value);
                setPreview(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tất cả khu</option>
              {zones.map((z) => (
                <option key={z.ma_khu} value={z.ma_khu}>
                  {z.ten_khu}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nấu ăn</label>
            <select
              value={nauAn}
              onChange={(e) => {
                setNauAn(e.target.value as "" | "true" | "false");
                setPreview(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tất cả</option>
              <option value="true">Có nấu ăn</option>
              <option value="false">Không nấu ăn</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-slate-700">Danh sách MSSV *</label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5" />
              Tải file
              <input
                type="file"
                accept=".txt,.csv,.xlsx"
                className="hidden"
                onChange={handleUploadFile}
              />
            </label>
          </div>
          <textarea
            rows={4}
            value={mssvText}
            onChange={(e) => {
              setMssvText(e.target.value);
              setPreview(null);
            }}
            placeholder="Nhập mỗi dòng một MSSV..."
            className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
          />
        </div>

        {preview && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            {preview.loi?.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 space-y-1">
                {preview.loi.map((e: any, idx: number) => (
                  <p key={idx}>• {e.thong_bao}</p>
                ))}
              </div>
            )}

            {preview.canh_bao_thieu_cho?.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    {preview.canh_bao_thieu_cho.map((w: any, idx: number) => (
                      <p key={idx}>{w.thong_bao}</p>
                    ))}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={allowPartial}
                    onChange={(e) => setAllowPartial(e.target.checked)}
                  />
                  Cho phép xếp vào phòng chưa đầy
                </label>
              </div>
            )}

            {preview.ke_hoach?.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {preview.ke_hoach.map((plan: any) => (
                  <div
                    key={plan.ma_phong}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-[#1F5CA9]">
                        Phòng {plan.ten_phong} (Khu {plan.ma_khu})
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {plan.dang_o_truoc} → {plan.so_nguoi_sau_xep}/{plan.suc_chua}
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {plan.sinh_vien.map((sv: any) => (
                        <li key={sv.mssv} className="flex justify-between">
                          <span>{sv.ho_ten}</span>
                          <span className="font-mono text-slate-500">{sv.mssv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
