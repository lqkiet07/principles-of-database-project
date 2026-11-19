"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Modal } from "@/components/shared/modal";
import type { StudentRow } from "./types";

const MSSV_RE = /^[A-Z][0-9]{7}$/;
const PHONE_RE = /^0[0-9]{9,10}$/;

interface StudentFormModalProps {
  open: boolean;
  editing: StudentRow | null;
  nganhList: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function StudentFormModal({
  open,
  editing,
  nganhList,
  onClose,
  onSuccess,
}: StudentFormModalProps) {
  const [mssv, setMssv] = useState("");
  const [hoTen, setHoTen] = useState("");
  const [gioiTinh, setGioiTinh] = useState<"NAM" | "NU">("NAM");
  const [nganh, setNganh] = useState("Công nghệ thông tin");
  const [sdt, setSdt] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setMssv(editing.mssv);
      setHoTen(editing.ho_ten);
      setGioiTinh(editing.gioi_tinh);
      setNganh(editing.nganh);
      setSdt(editing.sdt);
      setEmail(editing.email);
    } else {
      setMssv("");
      setHoTen("");
      setGioiTinh("NAM");
      setNganh("Công nghệ thông tin");
      setSdt("");
      setEmail("");
    }
  }, [open, editing]);

  const handleMssvChange = (val: string) => {
    const clean = val.toUpperCase().replace(/\s/g, "");
    setMssv(clean);
    if (!editing && clean.length === 8) {
      setEmail(`${clean.toLowerCase()}@student.ctu.edu.vn`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const mssvClean = mssv.trim().toUpperCase();
    if (!MSSV_RE.test(mssvClean)) {
      setError("MSSV phải theo mẫu CTU (1 chữ cái + 7 chữ số, ví dụ B2112345).");
      return;
    }
    if (hoTen.trim().length < 2) {
      setError("Vui lòng nhập đầy đủ họ và tên.");
      return;
    }
    if (!PHONE_RE.test(sdt.trim())) {
      setError("Số điện thoại phải bắt đầu bằng số 0 và gồm 10–11 chữ số.");
      return;
    }
    const expectedEmail = `${mssvClean.toLowerCase()}@student.ctu.edu.vn`;
    const emailClean = (email.trim() || expectedEmail).toLowerCase();
    if (emailClean !== expectedEmail) {
      setError(`Email CTU phải có định dạng: ${expectedEmail}`);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/api/admin/students/${editing.mssv}`, {
          method: "PUT",
          body: {
            ho_ten: hoTen.trim(),
            gioi_tinh: gioiTinh,
            nganh: nganh.trim(),
            sdt: sdt.trim(),
            email: emailClean,
          },
        });
        toast.success(`Đã cập nhật hồ sơ ${editing.mssv}.`);
      } else {
        const res = await apiRequest<any>("/api/admin/students", {
          method: "POST",
          body: {
            mssv: mssvClean,
            ho_ten: hoTen.trim(),
            gioi_tinh: gioiTinh,
            nganh: nganh.trim(),
            sdt: sdt.trim(),
            email: emailClean,
          },
        });
        toast.success(res.thong_bao || `Đã thêm hồ sơ ${mssvClean}.`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? `Chỉnh sửa hồ sơ — ${editing.mssv}` : "Thêm sinh viên"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MSSV *</label>
            <input
              type="text"
              required
              maxLength={8}
              disabled={Boolean(editing)}
              value={mssv}
              onChange={(e) => handleMssvChange(e.target.value)}
              placeholder="B2412345"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Giới tính *</label>
            <select
              value={gioiTinh}
              onChange={(e) => setGioiTinh(e.target.value as "NAM" | "NU")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="NAM">Nam</option>
              <option value="NU">Nữ</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên *</label>
          <input
            type="text"
            required
            value={hoTen}
            onChange={(e) => setHoTen(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ngành học *</label>
          <input
            type="text"
            required
            list="ctu-majors"
            value={nganh}
            onChange={(e) => setNganh(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id="ctu-majors">
            {nganhList.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại *</label>
            <input
              type="tel"
              required
              value={sdt}
              onChange={(e) => setSdt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email CTU *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Lưu" : "Thêm sinh viên"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
