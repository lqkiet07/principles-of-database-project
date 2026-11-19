"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Database, Gauge, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatDateTime, formatNumber, formatVND } from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";

export function DbFeaturesTab() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [walletLogs, setWalletLogs] = useState<any[]>([]);
  const [quyThu, setQuyThu] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [trapResult, setTrapResult] = useState<any>(null);
  const [testingTrap, setTestingTrap] = useState(false);

  const [benchmark, setBenchmark] = useState<any>(null);
  const [runningBench, setRunningBench] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const [aRes, wRes] = await Promise.all([
        apiRequest<any>("/api/admin/settings/audit-logs?limit=20"),
        apiRequest<any>("/api/admin/settings/wallet-transactions?limit=15"),
      ]);
      setAuditLogs(aRes.items || []);
      setWalletLogs(wRes.items || []);
      setQuyThu(wRes.quy_thu_ktx || 0);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải dữ liệu kiểm tra CSDL.");
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleTestTrap = async () => {
    setTestingTrap(true);
    try {
      const res = await apiRequest<any>("/api/admin/settings/test-trigger-trap", {
        method: "POST",
        body: {},
      });
      setTrapResult(res);
      toast.success("Trigger đã bẫy và chặn thao tác sửa hóa đơn đã nộp.");
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi kiểm thử Trigger.");
    } finally {
      setTestingTrap(false);
    }
  };

  const handleRunBenchmark = async () => {
    setRunningBench(true);
    try {
      const res = await apiRequest<any>("/api/admin/settings/index-benchmark");
      setBenchmark(res);
      toast.success("Đã chạy EXPLAIN ANALYZE trên bảng 1.000.000+ dòng.");
    } catch (err: any) {
      toast.error(err.message || "Không thể chạy benchmark chỉ mục.");
    } finally {
      setRunningBench(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Giao dịch ACID Cộng / Trừ tiền */}
      <SectionCard
        title="Giao dịch ACID Cộng / Trừ tiền (Ví SV ↔ Quỹ KTX)"
        subtitle="Thủ tục sp_thanh_toan_bang_vi trừ ví sinh viên và cộng quỹ KTX trong 1 transaction nguyên tử"
        icon={Wallet}
        right={
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#1F5CA9]">
            Tổng quỹ thu KTX: {formatVND(quyThu)}
          </span>
        }
        noPadding
      >
        {loadingLogs ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
            Đang tải...
          </div>
        ) : walletLogs.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Chưa có giao dịch ví nào. Sinh viên có thể nạp tiền hoặc thanh toán hóa đơn bằng số dư ví ở phân hệ Sinh viên.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Sinh viên</th>
                  <th className="px-5 py-3">Loại</th>
                  <th className="px-5 py-3 text-right">Số tiền</th>
                  <th className="px-5 py-3 text-right">Số dư trước → sau</th>
                  <th className="px-5 py-3 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {walletLogs.map((w) => (
                  <tr key={w.ma_gd}>
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-xs font-semibold text-slate-900">{w.mssv}</span>{" "}
                      <span className="text-slate-600">({w.ho_ten})</span>
                    </td>
                    <td className="px-5 py-2.5 text-xs font-medium text-slate-700">{w.loai}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-900">
                      {formatVND(w.so_tien)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-600">
                      {formatVND(w.so_du_truoc)} → <strong>{formatVND(w.so_du_sau)}</strong>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs text-slate-500">
                      {formatDateTime(w.thoi_gian)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* 2. Trigger Audit Log (OLD -> NEW) & Bẫy chặn */}
      <SectionCard
        title="Trigger Ghi log Giá trị Cũ / Mới & Bẫy kiểm tra"
        subtitle="Tự động lưu OLD → NEW vào nhat_ky_du_lieu và chặn sửa/xóa hóa đơn đã nộp"
        icon={ShieldAlert}
        iconBg="bg-amber-50 text-amber-700"
        right={
          <button
            type="button"
            onClick={handleTestTrap}
            disabled={testingTrap}
            className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {testingTrap ? "Đang thử..." : "Thử sửa hóa đơn đã nộp (Test Bẫy)"}
          </button>
        }
      >
        <div className="space-y-4">
          {trapResult && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              <p className="font-bold">
                Kết quả Trigger: {trapResult.bi_chan ? "ĐÃ BẪY & CHẶN THÀNH CÔNG" : "Không chặn"}
              </p>
              <p className="mt-1 font-mono">{trapResult.thong_bao_trigger}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Bảng</th>
                  <th className="px-4 py-2.5">Thao tác</th>
                  <th className="px-4 py-2.5">Khóa chính</th>
                  <th className="px-4 py-2.5">Giá trị cũ (OLD)</th>
                  <th className="px-4 py-2.5">Giá trị mới (NEW)</th>
                  <th className="px-4 py-2.5 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Chưa có bản ghi nhật ký thay đổi. Hãy thử cập nhật đơn giá hoặc thanh toán hóa đơn.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.ma_log}>
                      <td className="px-4 py-2 font-mono font-semibold text-slate-800">
                        {log.bang_tac_dong}
                      </td>
                      <td className="px-4 py-2 font-semibold text-[#1F5CA9]">{log.hanh_dong}</td>
                      <td className="px-4 py-2 font-mono">{log.khoa_chinh}</td>
                      <td className="px-4 py-2 max-w-[220px] truncate font-mono text-slate-500">
                        {log.gia_tri_cu ? JSON.stringify(log.gia_tri_cu) : "—"}
                      </td>
                      <td className="px-4 py-2 max-w-[220px] truncate font-mono text-slate-800">
                        {log.gia_tri_moi ? JSON.stringify(log.gia_tri_moi) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">
                        {formatDateTime(log.thoi_gian)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* 3. Benchmark Chỉ mục lớn (>1.000.000 dòng) */}
      <SectionCard
        title="Hiệu năng Chỉ mục lớn (EXPLAIN ANALYZE)"
        subtitle="So sánh quét tuần tự (Seq Scan) vs Chỉ mục B-Tree trên bảng luot_ra_vao (1.000.000+ dòng)"
        icon={Gauge}
        iconBg="bg-emerald-50 text-emerald-700"
        right={
          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={runningBench}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5CA9] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
          >
            <Database className="h-3.5 w-3.5" />
            {runningBench ? "Đang đo..." : "Chạy EXPLAIN ANALYZE"}
          </button>
        }
      >
        {!benchmark ? (
          <p className="text-sm text-slate-500">
            Nhấn &ldquo;Chạy EXPLAIN ANALYZE&rdquo; để đo trực tiếp tốc độ truy vấn có và không có chỉ mục trên bảng dữ liệu lớn.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Quy mô bảng {benchmark.bang}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatNumber(benchmark.tong_so_dong)} dòng
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Bảng: {benchmark.kich_thuoc_bang} · Chỉ mục: {benchmark.kich_thuoc_chi_muc}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <p className="text-xs text-red-700 font-semibold">
                Không dùng Index ({benchmark.seq_scan.node_type})
              </p>
              <p className="mt-1 text-xl font-bold text-red-700">
                {benchmark.seq_scan.execution_time_ms} ms
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Trả về {formatNumber(benchmark.seq_scan.actual_rows)} dòng
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-xs text-emerald-700 font-semibold">
                Có Index ({benchmark.index_scan.node_type})
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700">
                {benchmark.index_scan.execution_time_ms} ms
              </p>
              <p className="text-xs text-emerald-800 font-semibold mt-1">
                Nhanh gấp {benchmark.speedup_x}x lần
              </p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
