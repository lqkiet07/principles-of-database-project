"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Zap,
  Clock,
  ShieldCheck,
  Database,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Layers,
  Flame,
  FileCode,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemoMode } from "@/lib/demo-context";

export default function DemoCheckpointsPage() {
  const { isDemoMode } = useDemoMode();

  // Checkpoint 1: Dual SP 1 (Generate & Split)
  const [cp1Status, setCp1Status] = React.useState<"idle" | "running" | "done">("idle");

  // Checkpoint 2: Dual SP 2 (Wallet Pay)
  const [cp2Status, setCp2Status] = React.useState<"idle" | "running" | "done">("idle");
  const [walletBalance, setWalletBalance] = React.useState(1200000);
  const [debtPaid, setDebtPaid] = React.useState(false);

  // Checkpoint 3: Double click race condition
  const [cp3Status, setCp3Status] = React.useState<"idle" | "running" | "done">("idle");
  const [req1State, setReq1State] = React.useState<string>("Chờ kích hoạt");
  const [req2State, setReq2State] = React.useState<string>("Chờ kích hoạt");

  // Checkpoint 4: Rollback insufficient funds
  const [cp4Status, setCp4Status] = React.useState<"idle" | "running" | "rollback">("idle");

  // Checkpoint 5: Fraud trigger & Audit JSONB
  const [cp5Status, setCp5Status] = React.useState<"idle" | "fraud_blocked" | "audit_view">("idle");

  // Checkpoint 6: Index benchmark
  const [hasIndex, setHasIndex] = React.useState(true);
  const [benchmarking, setBenchmarking] = React.useState(false);
  const [benchResult, setBenchResult] = React.useState<{ time: string; scanType: string; buffers: string } | null>({
    time: "6.4 ms",
    scanType: "Index Scan using idx_access_late_time",
    buffers: "24 buffers (hit 24)",
  });

  // Handler CP1: Split
  const handleRunCP1 = () => {
    setCp1Status("running");
    setTimeout(() => {
      setCp1Status("done");
    }, 800);
  };

  // Handler CP2: Wallet Pay
  const handleRunCP2 = () => {
    setCp2Status("running");
    setTimeout(() => {
      setWalletBalance((prev) => Math.max(0, prev - 345000));
      setDebtPaid(true);
      setCp2Status("done");
    }, 800);
  };

  // Handler CP3: Double Click Simulation
  const handleRunCP3 = () => {
    setCp3Status("running");
    setReq1State("Đang gửi Request 1 (giành khóa FOR UPDATE)...");
    setReq2State("Đang gửi Request 2 (bị chặn, Lock Wait)...");

    setTimeout(() => {
      setReq1State("Request 1: Commit thành công, nợ -> PAID (Code = 0)");
      setReq2State("Request 2: Đọc nợ đã PAID -> Trả về DEBT_ALREADY_PAID (Code = 2)");
      setCp3Status("done");
    }, 1400);
  };

  // Handler CP4: Insufficient funds rollback
  const handleRunCP4 = () => {
    setCp4Status("running");
    setTimeout(() => {
      setCp4Status("rollback");
    }, 800);
  };

  // Handler CP6: Run benchmark
  const handleRunBenchmark = () => {
    setBenchmarking(true);
    setTimeout(() => {
      if (hasIndex) {
        setBenchResult({
          time: "6.4 ms",
          scanType: "Bitmap Index Scan on idx_access_late_time",
          buffers: "24 buffers (hit 24)",
        });
      } else {
        setBenchResult({
          time: "1,842.3 ms",
          scanType: "Seq Scan on dorm_access_logs (1.000.000 rows)",
          buffers: "35,420 buffers (read 34,210)",
        });
      }
      setBenchmarking(false);
    }, hasIndex ? 400 : 1200);
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Top Banner Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1F5CA9] via-[#1b5093] to-[#00AFEF] p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-0 font-bold px-2.5 py-0.5 text-xs">
                🎓 CT221H Barem Chấm Điểm
              </Badge>
              <Badge className="bg-amber-400 text-slate-900 font-extrabold text-xs">
                6 Trọng Tâm Kỹ Thuật
              </Badge>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Trung Tâm Kiểm Thử & Chấm Thi Đồ Án (Demo Checkpoints)
            </h1>
            <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
              Mô phỏng trực quan 6 kịch bản CSDL cốt lõi được Hội đồng Giảng viên đánh giá: Stored Procedure chia nợ theo đầu người, Khóa dòng bi quan chống Click đúp (Double-Spending), Rollback ACID, Trigger bẫy số lùi và Benchmark 1 triệu dòng log.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/admin/settings">
              <Button size="sm" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs">
                Cài đặt Demo Mode
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* Grid of 6 Checkpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CHECKPOINT 1: Dual SP 1 - Chia nợ tự động */}
        <Card className="border-slate-200/90 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[#1F5CA9] font-bold text-xs">
                  01
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Dual SP: Chốt Chỉ Số & Tự Động Chia Nợ
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-blue-200 text-[#1F5CA9]">
                sp_generate_and_split
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Tính tiền điện lũy tiến 3 bậc + nước sạch ➔ Chia đều nợ cho các sinh viên đang ở (`is_active = TRUE`) vào `student_utility_debts`.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Phòng P.402 (Tòa B)</span>
                <span>Số SV đang ở: <strong>2 sinh viên</strong></span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div>Điện: 150 kWh ➔ 340.000 đ</div>
                <div>Nước: 25 m³ ➔ 250.000 đ</div>
                <div>Phí dịch vụ: 100.000 đ</div>
                <div className="font-bold text-[#1F5CA9]">Tổng: 690.000 đ</div>
              </div>
            </div>

            {cp1Status === "done" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Đã sinh 1 hóa đơn tổng và 2 khoản nợ cá nhân:
                </div>
                <div className="text-[11px] text-emerald-900 space-y-0.5 pl-5">
                  <p>• <strong>Trần Thị Mai</strong> (20230245): Nợ <strong>345.000 đ</strong> (`UNPAID`)</p>
                  <p>• <strong>Hoàng Ngọc Ánh</strong> (20241102): Nợ <strong>345.000 đ</strong> (`UNPAID`)</p>
                </div>
              </div>
            )}

            <Button
              size="sm"
              onClick={handleRunCP1}
              disabled={cp1Status === "running"}
              className="w-full text-xs font-semibold bg-[#1F5CA9] text-white hover:bg-[#184988]"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              {cp1Status === "done" ? "Chạy lại Stored Procedure 1" : "Kích hoạt sp_generate_and_split_utility_bill"}
            </Button>
          </CardContent>
        </Card>

        {/* CHECKPOINT 2: Dual SP 2 - Thanh toán nợ qua Ví KTX */}
        <Card className="border-slate-200/90 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs">
                  02
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Dual SP: Nộp Tiền Qua Ví Sinh Viên KTX
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-200 text-emerald-700">
                sp_pay_student_bill
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Trừ tiền `student_wallets` ➔ Gạch nợ cá nhân `student_utility_debts` ➔ Dồn tiền cập nhật `utility_bills` ➔ Xuất biên lai.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số dư ví sinh viên (Trần Thị Mai):</span>
                <span className="font-extrabold text-sm text-slate-900">
                  {walletBalance.toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Khoản nợ T10/2026:</span>
                <span className={debtPaid ? "font-bold text-emerald-600" : "font-bold text-[#B45309]"}>
                  {debtPaid ? "Đã nộp (0 đ)" : "345.000 đ (Chưa nộp)"}
                </span>
              </div>
            </div>

            {cp2Status === "done" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1 animate-in fade-in">
                <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Giao dịch thành công (ACID Commit)!
                </p>
                <p className="text-[11px] text-emerald-700">
                  Mã biên lai: <strong className="font-mono">TX-20261027-8841-MAI</strong> • Hóa đơn phòng cha: <strong>PARTIALLY_PAID</strong> (345k / 690k).
                </p>
              </div>
            )}

            <Button
              size="sm"
              onClick={handleRunCP2}
              disabled={cp2Status === "running" || debtPaid}
              className="w-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              {debtPaid ? "Khoản nợ đã được tất toán" : "Nộp 345.000 đ bằng Ví KTX"}
            </Button>
          </CardContent>
        </Card>

        {/* CHECKPOINT 3: Khóa dòng FOR UPDATE - Chống Click đúp */}
        <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/20 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-amber-200/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                  03
                </span>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-[#FFB800]" />
                  Chống Click Đúp (Pessimistic Lock)
                </CardTitle>
              </div>
              <Badge className="bg-[#FEF3C7] text-[#B45309] border-amber-300 text-[10px] font-mono">
                SELECT ... FOR UPDATE
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Thực nghiệm 2 giao dịch đồng thời (Concurrent Race Condition). Request 2 phải chờ (Lock Wait) và thoát an toàn `DEBT_ALREADY_PAID`.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Luồng 1 (Request 1 - T=0ms):</span>
                  <Badge variant="outline" className="text-[10px] text-blue-600">FOR UPDATE Lock</Badge>
                </div>
                <p className="text-[11px] text-slate-500">{req1State}</p>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Luồng 2 (Request 2 - T=+10ms):</span>
                  <Badge variant="outline" className="text-[10px] text-amber-700">Lock Wait</Badge>
                </div>
                <p className="text-[11px] text-slate-500">{req2State}</p>
              </div>
            </div>

            {cp3Status === "done" && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 font-medium">
                ✓ <strong>Bảo toàn tuyệt đối:</strong> Ví sinh viên chỉ bị trừ đúng 1 lần (345.000 đ), hoàn toàn triệt tiêu rủi ro Double-Spending!
              </div>
            )}

            <Button
              size="sm"
              onClick={handleRunCP3}
              disabled={cp3Status === "running"}
              className="w-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Giả lập Click đúp đồng thời (2 Request)
            </Button>
          </CardContent>
        </Card>

        {/* CHECKPOINT 4: Rollback khi ví thiếu tiền */}
        <Card className="border-slate-200/90 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700 font-bold text-xs">
                  04
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Rollback Khi Ví Không Đủ Tiền
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-red-200 text-red-600">
                INSUFFICIENT_FUNDS
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Kiểm thử tính nguyên tử (Atomicity): Số dư ví 50.000 đ &lt; nợ 345.000 đ ➔ Transaction Rollback an toàn 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">Số dư ví sinh viên thử nghiệm:</span>
                <span className="text-base font-extrabold text-red-600">50.000 đ</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Khoản nợ cần trả:</span>
                <span className="text-sm font-bold text-slate-800">345.000 đ</span>
              </div>
            </div>

            {cp4Status === "rollback" && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs space-y-1 animate-in fade-in">
                <p className="font-bold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Transaction Đã Rollback Hoàn Toàn (Code = 1)!
                </p>
                <p className="text-[11px] text-red-700">
                  CSDL ném ngoại lệ `INSUFFICIENT_FUNDS`. Số dư ví không đổi, trạng thái nợ giữ nguyên `UNPAID`.
                </p>
              </div>
            )}

            <Button
              size="sm"
              onClick={handleRunCP4}
              disabled={cp4Status === "running"}
              className="w-full text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Thử thanh toán khi ví chỉ có 50.000 đ
            </Button>
          </CardContent>
        </Card>

        {/* CHECKPOINT 5: Trigger bẫy số lùi & Audit Log JSONB */}
        <Card className="border-slate-200/90 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold text-xs">
                  05
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Trigger Bẫy Số Lùi & Audit Log JSONB
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-purple-200 text-purple-700">
                to_jsonb(OLD/NEW)
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Trigger chặn cán bộ nhập số mới nhỏ hơn số cũ và tự động lưu vết thanh tra vào `audit_logs`.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={cp5Status === "fraud_blocked" ? "default" : "outline"}
                size="sm"
                onClick={() => setCp5Status("fraud_blocked")}
                className="text-xs h-9 text-slate-700 border-slate-200"
              >
                1. Test Bẫy Số Điện Lùi
              </Button>
              <Button
                variant={cp5Status === "audit_view" ? "default" : "outline"}
                size="sm"
                onClick={() => setCp5Status("audit_view")}
                className="text-xs h-9 text-slate-700 border-slate-200"
              >
                2. Xem Audit Log JSONB
              </Button>
            </div>

            {cp5Status === "fraud_blocked" && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs space-y-1">
                <p className="font-bold text-red-800">
                  [BLOCKED BY TRIGGER] trg_validate_utility_meter_fraud
                </p>
                <p className="text-[11px] text-red-700 font-mono">
                  ERROR: Chỉ số mới (120) nhỏ hơn chỉ số cũ (150). Giao dịch bị hủy bỏ ngay lập tức!
                </p>
              </div>
            )}

            {cp5Status === "audit_view" && (
              <div className="rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-slate-200 space-y-1 overflow-x-auto">
                <p className="text-emerald-400 font-bold">// Bản ghi trong audit_logs (Trigger đóng gói JSONB):</p>
                <pre>{JSON.stringify({
                  log_id: 1042,
                  table_name: "utility_bills",
                  action: "UPDATE",
                  changed_by: "admin_huy",
                  old_data: { curr_electric: 150, total_amount: 690000 },
                  new_data: { curr_electric: 165, total_amount: 725000 },
                  timestamp: "2026-10-27T10:15:22Z"
                }, null, 2)}</pre>
              </div>
            )}

            {cp5Status === "idle" && (
              <p className="text-xs text-slate-500 italic text-center py-2">
                Nhấn 1 trong 2 nút trên để xem mô phỏng hoạt động của Trigger PL/pgSQL
              </p>
            )}
          </CardContent>
        </Card>

        {/* CHECKPOINT 6: Benchmark 1 Triệu Dòng Log */}
        <Card className="border-slate-200/90 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-[#00AFEF] font-bold text-xs">
                  06
                </span>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Benchmark Index: 1.000.000 Bản Ghi
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-sky-200 text-[#00AFEF]">
                EXPLAIN ANALYZE
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              So sánh thời gian quét bảng `Seq Scan` vs `Index Scan` trên tập dữ liệu 1 triệu log quẹt thẻ `dorm_access_logs`.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">
                Composite Index (is_late, check_time):
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {hasIndex ? "ĐANG BẬT" : "TẮT"}
                </span>
                <button
                  type="button"
                  onClick={() => setHasIndex(!hasIndex)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    hasIndex ? "bg-[#1F5CA9]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      hasIndex ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {benchResult && (
              <div className={`rounded-xl p-3 text-xs space-y-1.5 border ${hasIndex ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Thời gian thực thi:</span>
                  <span className={`text-base font-extrabold ${hasIndex ? "text-emerald-700" : "text-red-700"}`}>
                    {benchResult.time}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  {benchResult.scanType}
                </div>
                <div className="text-[10px] text-slate-500">
                  Bộ nhớ đệm: {benchResult.buffers} • Tăng tốc: <strong>{hasIndex ? "x287 lần" : "Chậm"}</strong>
                </div>
              </div>
            )}

            <Button
              size="sm"
              onClick={handleRunBenchmark}
              disabled={benchmarking}
              className="w-full text-xs font-semibold bg-[#00AFEF] text-white hover:bg-[#0090c5]"
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              {benchmarking ? "Đang chạy EXPLAIN ANALYZE..." : "Đo thời gian thực thi (EXPLAIN ANALYZE)"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
