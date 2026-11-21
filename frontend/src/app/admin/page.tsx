"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, BarChart3, CheckSquare, Globe, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMonthLabel, formatNumber } from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";

interface OverviewData {
  pham_vi_khu?: string | null;
  tong_quan: {
    thang_hien_tai: string;
    tong_sv_dang_o: number;
    so_giuong_trong: number;
    tong_so_phong: number;
    so_phong_da_nhap_chi_so: number;
    so_phong_chua_nop_dien_nuoc: number;
  };
  luot_truy_cap_web: {
    hom_nay: number;
    tuan_nay: number;
    thang_nay: number;
  };
  canh_bao_nhanh: {
    yc_doi_phong_cho: number;
    yc_bao_tri_mo: number;
  };
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<OverviewData>("/api/admin/overview")
      .then(setData)
      .catch((err) => setError(err.message || "Không thể tải dữ liệu tổng quan."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#1F5CA9]" />
        <span className="text-sm">Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{error || "Không có dữ liệu tổng quan."}</span>
      </div>
    );
  }

  const tq = data.tong_quan;
  const web = data.luot_truy_cap_web;
  const cb = data.canh_bao_nhanh;
  const thangLabel = formatMonthLabel(tq.thang_hien_tai);
  const scopeText =
    data.pham_vi_khu || user?.ma_khu_phu_trach
      ? `Khu ${data.pham_vi_khu || user?.ma_khu_phu_trach}`
      : "Toàn KTX (Khu A & Khu B)";

  const stats = [
    { label: "Sinh viên đang ở", value: formatNumber(tq.tong_sv_dang_o), href: "/admin/students" },
    { label: "Giường còn trống", value: formatNumber(tq.so_giuong_trong), href: "/admin/rooms" },
    {
      label: `Chưa nộp điện nước (${thangLabel})`,
      value: formatNumber(tq.so_phong_chua_nop_dien_nuoc),
      href: "/admin/bills",
    },
    { label: "Phiếu bảo trì đang mở", value: formatNumber(cb.yc_bao_tri_mo), href: "/admin/maintenance" },
  ];

  return (
    <div className="space-y-5">
      <SectionCard
        title="Thống kê ký túc xá"
        subtitle={`Phạm vi: ${scopeText} · ${thangLabel}`}
        icon={BarChart3}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-[#1F5CA9]/50 transition-colors"
            >
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{s.value}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="Lượt truy cập trang web"
          subtitle="Số lượt truy cập hệ thống web"
          icon={Globe}
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-4 px-2">
              <p className="text-xs text-slate-500">Hôm nay</p>
              <p className="mt-1 text-2xl font-bold text-[#1F5CA9]">{formatNumber(web.hom_nay)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-4 px-2">
              <p className="text-xs text-slate-500">Tuần này</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(web.tuan_nay)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-4 px-2">
              <p className="text-xs text-slate-500">Tháng này</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{formatNumber(web.thang_nay)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Công việc cần xử lý"
          subtitle="Truy cập nhanh các đầu việc tồn đọng"
          icon={CheckSquare}
          iconBg="bg-amber-50 text-amber-700"
        >
          <div className="space-y-2.5">
            <Link
              href="/admin/rooms?tab=transfers"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-[#1F5CA9]/50"
            >
              <span>Yêu cầu đổi phòng chờ duyệt</span>
              <span className="font-bold text-[#1F5CA9]">{cb.yc_doi_phong_cho}</span>
            </Link>
            <Link
              href="/admin/maintenance"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-[#1F5CA9]/50"
            >
              <span>Đơn bảo trì đang mở</span>
              <span className="font-bold text-amber-700">{cb.yc_bao_tri_mo}</span>
            </Link>
            <Link
              href="/admin/bills"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-[#1F5CA9]/50"
            >
              <span>Phòng đã nhập chỉ số ({thangLabel})</span>
              <span className="font-bold text-slate-900">
                {tq.so_phong_da_nhap_chi_so} / {tq.tong_so_phong}
              </span>
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
