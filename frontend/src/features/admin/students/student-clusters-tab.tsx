"use client";

import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";

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
  nhom_code: string;
  nhom_label: string;
  unpaid_ratio: number;
  late_count: number;
  avg_kwh: number;
}

export function StudentClustersTab() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ClusterSummary[]>([]);
  const [students, setStudents] = useState<ClusteredStudent[]>([]);
  const [filterCode, setFilterCode] = useState<string>("");

  const loadClusters = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>("/api/admin/students/ai/clusters");
      setSummary(res.summary || []);
      setStudents(res.students || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể chạy phân nhóm K-Means.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const visibleStudents = filterCode
    ? students.filter((s) => s.nhom_code === filterCode)
    : students;

  const badgeStyle = (code: string) => {
    if (code === "GUONG_MAU") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (code === "NHAC_THANH_TOAN") return "bg-amber-50 text-amber-800 border-amber-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Phân loại sinh viên nội trú (K-Means k=3)"
        subtitle="Phân cụm dựa trên tỷ lệ nợ hóa đơn, số lượt về sau 23:00 và mức tiêu thụ điện"
        icon={Users}
        right={
          <button
            type="button"
            onClick={loadClusters}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Chạy lại phân cụm
          </button>
        }
      >
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
            Đang chạy K-Means trên dữ liệu sinh viên...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary.map((g) => (
              <button
                key={g.code}
                type="button"
                onClick={() => setFilterCode((prev) => (prev === g.code ? "" : g.code))}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  filterCode === g.code
                    ? "border-[#1F5CA9] bg-blue-50/40"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{g.label}</span>
                  <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${badgeStyle(g.code)}`}>
                    {g.so_luong} SV
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600">{g.description}</p>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {!loading && (
        <SectionCard
          title="Danh sách sinh viên theo cụm"
          subtitle={`Hiển thị ${visibleStudents.length} sinh viên${filterCode ? " (đang lọc)" : ""}`}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">MSSV</th>
                  <th className="px-5 py-3">Họ tên</th>
                  <th className="px-5 py-3">Phòng</th>
                  <th className="px-5 py-3 text-right">Tỷ lệ chưa nộp</th>
                  <th className="px-5 py-3 text-right">Về muộn (30 ngày)</th>
                  <th className="px-5 py-3 text-right">Điện TB (kWh)</th>
                  <th className="px-5 py-3 text-center">Nhóm phân loại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStudents.slice(0, 60).map((s) => (
                  <tr key={s.mssv} className="hover:bg-slate-50/70">
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold">{s.mssv}</td>
                    <td className="px-5 py-2.5 font-medium text-slate-900">{s.ho_ten}</td>
                    <td className="px-5 py-2.5 text-slate-700">{s.ten_phong}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs">
                      {Math.round(s.unpaid_ratio * 100)}%
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs">{s.late_count}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs">{s.avg_kwh}</td>
                    <td className="px-5 py-2.5 text-center">
                      <span
                        className={`inline-block rounded-lg border px-2 py-0.5 text-xs font-medium ${badgeStyle(
                          s.nhom_code
                        )}`}
                      >
                        {s.nhom_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
