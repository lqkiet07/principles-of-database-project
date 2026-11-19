"use client";

import React from "react";
import { UserCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Modal } from "@/components/shared/modal";

interface StudentDetailModalProps {
  detail: any;
  onClose: () => void;
}

export function StudentDetailModal({ detail, onClose }: StudentDetailModalProps) {
  return (
    <Modal
      open={Boolean(detail)}
      onClose={onClose}
      size="md"
      title={detail ? `Hồ sơ sinh viên — ${detail.ho_ten}` : ""}
      description={detail ? `MSSV: ${detail.mssv}` : ""}
    >
      {detail && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Họ và tên</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{detail.ho_ten}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Giới tính</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {detail.gioi_tinh === "NAM" ? "Nam" : "Nữ"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Ngành học</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{detail.nganh}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Số điện thoại</dt>
            <dd className="mt-0.5 font-mono font-medium text-slate-800">{detail.sdt}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email CTU</dt>
            <dd className="mt-0.5 text-slate-800 break-all">{detail.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Phòng đang ở</dt>
            <dd className="mt-0.5 font-semibold text-[#1F5CA9]">
              {detail.ten_phong ? `${detail.ten_phong} (Khu ${detail.ma_khu})` : "Chưa xếp phòng"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Ngày vào KTX</dt>
            <dd className="mt-0.5 text-slate-800">{formatDate(detail.ngay_vao)}</dd>
          </div>
          {detail.la_dai_dien && (
            <div className="sm:col-span-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-semibold text-[#1F5CA9] flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" />
              Đại diện phòng {detail.ten_phong}
            </div>
          )}
        </dl>
      )}
    </Modal>
  );
}
