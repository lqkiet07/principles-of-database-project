"use client";

import * as React from "react";
import {
  Zap,
  Droplets,
  CreditCard,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Send,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  X,
  Printer,
  Copy,
  Receipt,
  Check,
  History,
  ShieldAlert,
  Flame,
  Terminal,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDemoMode } from "@/lib/demo-context";

interface AuditLogRecord {
  id: string;
  tableName: string;
  operation: "UPDATE" | "INSERT" | "TRIGGER_ERROR";
  changedBy: string;
  timestamp: string;
  status: "SUCCESS" | "BLOCKED_BY_TRIGGER";
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  message?: string;
}

interface BillRecord {
  id: string;
  roomNumber: string;
  building: string;
  studentCount: number;
  prevElec: number;
  currElec: number;
  prevWater: number;
  currWater: number;
  serviceFee: number;
  dueDate: string;
  status: "paid" | "unpaid";
  paidDate?: string;
}

const initialBills: BillRecord[] = [
  {
    id: "B-A201",
    roomNumber: "Phòng A.201",
    building: "Tòa A",
    studentCount: 4,
    prevElec: 1240,
    currElec: 1395,
    prevWater: 88,
    currWater: 102,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "paid",
    paidDate: "20/10/2026",
  },
  {
    id: "B-A202",
    roomNumber: "Phòng A.202",
    building: "Tòa A",
    studentCount: 3,
    prevElec: 1420,
    currElec: 1585,
    prevWater: 110,
    currWater: 126,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "unpaid",
  },
  {
    id: "B-A203",
    roomNumber: "Phòng A.203",
    building: "Tòa A",
    studentCount: 4,
    prevElec: 1980,
    currElec: 2190,
    prevWater: 145,
    currWater: 168,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "unpaid",
  },
  {
    id: "B-A204",
    roomNumber: "Phòng A.204",
    building: "Tòa A",
    studentCount: 2,
    prevElec: 950,
    currElec: 1045,
    prevWater: 72,
    currWater: 82,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "paid",
    paidDate: "18/10/2026",
  },
  {
    id: "B-A205",
    roomNumber: "Phòng A.205",
    building: "Tòa A",
    studentCount: 4,
    prevElec: 1610,
    currElec: 1782,
    prevWater: 120,
    currWater: 137,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "paid",
    paidDate: "21/10/2026",
  },
  {
    id: "B-A206",
    roomNumber: "Phòng A.206",
    building: "Tòa A",
    studentCount: 1,
    prevElec: 820,
    currElec: 875,
    prevWater: 55,
    currWater: 62,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "unpaid",
  },
  {
    id: "B-B101",
    roomNumber: "Phòng B.101",
    building: "Tòa B",
    studentCount: 4,
    prevElec: 1530,
    currElec: 1690,
    prevWater: 95,
    currWater: 112,
    serviceFee: 80000,
    dueDate: "25/10/2026",
    status: "paid",
    paidDate: "19/10/2026",
  },
];

const initialAuditLogs: AuditLogRecord[] = [
  {
    id: "LOG-9041",
    tableName: "utility_bills",
    operation: "UPDATE",
    changedBy: "admin_user",
    timestamp: "27/10/2026 14:15:02",
    status: "SUCCESS",
    oldData: { bill_id: "B-A201", prev_elec: 1240, curr_elec: 1395 },
    newData: { bill_id: "B-A201", prev_elec: 1240, curr_elec: 1395, status: "paid" },
    message: "Cập nhật chỉ số công tơ định kỳ tháng 10/2026",
  },
  {
    id: "LOG-9038",
    tableName: "utility_bills",
    operation: "TRIGGER_ERROR",
    changedBy: "trigger:trg_prevent_meter_decrement",
    timestamp: "26/10/2026 09:30:11",
    status: "BLOCKED_BY_TRIGGER",
    oldData: { bill_id: "B-A202", prev_elec: 1420 },
    newData: { attempted_curr_elec: 1380 },
    message: "Chỉ số mới (1380) không được nhỏ hơn chỉ số cũ (1420). Giao dịch bị ROLLBACK tự động bởi Trigger.",
  },
  {
    id: "LOG-9022",
    tableName: "student_utility_debts",
    operation: "INSERT",
    changedBy: "sp_generate_and_split_utility_bill",
    timestamp: "25/10/2026 08:00:00",
    status: "SUCCESS",
    oldData: {},
    newData: { parent_bill_id: "B-A201", split_count: 4, per_student_debt: 172500 },
    message: "Dual SP tự động chia nợ thành 4 khoản con cho sinh viên trong phòng",
  },
];

const ELEC_RATE = 3000; // 3.000 đ/kWh
const WATER_RATE = 12000; // 12.000 đ/m3

function calculateTotals(bill: {
  prevElec: number;
  currElec: number;
  prevWater: number;
  currWater: number;
  serviceFee: number;
}) {
  const elecUsage = Math.max(0, bill.currElec - bill.prevElec);
  const waterUsage = Math.max(0, bill.currWater - bill.prevWater);
  const elecCost = elecUsage * ELEC_RATE;
  const waterCost = waterUsage * WATER_RATE;
  const total = elecCost + waterCost + bill.serviceFee;
  return { elecUsage, waterUsage, elecCost, waterCost, total };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export default function BillingPage() {
  const { isDemoMode } = useDemoMode();
  const [bills, setBills] = React.useState<BillRecord[]>(initialBills);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogRecord[]>(initialAuditLogs);
  const [activeView, setActiveView] = React.useState<"bills" | "audit">("bills");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "paid" | "unpaid">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMonth, setSelectedMonth] = React.useState("10/2026");

  // Slide-over drawer state
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [editingBill, setEditingBill] = React.useState<BillRecord | null>(null);
  const [tempCurrElec, setTempCurrElec] = React.useState(0);
  const [tempCurrWater, setTempCurrWater] = React.useState(0);
  const [triggerError, setTriggerError] = React.useState<string | null>(null);

  // Invoice modal state
  const [invoiceModalBill, setInvoiceModalBill] = React.useState<BillRecord | null>(null);

  // Bulk generate dialog state
  const [isBulkDialogOpen, setIsBulkDialogOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Trigger feedback toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredBills = bills.filter((b) => {
    if (statusFilter === "paid" && b.status !== "paid") return false;
    if (statusFilter === "unpaid" && b.status !== "unpaid") return false;
    if (searchQuery && !b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate high-level summary
  const totalCollected = bills
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + calculateTotals(b).total, 0);

  const totalUnpaid = bills
    .filter((b) => b.status === "unpaid")
    .reduce((sum, b) => sum + calculateTotals(b).total, 0);

  const overdueCount = bills.filter((b) => b.status === "unpaid").length;

  const openMeterDrawer = (bill: BillRecord) => {
    setEditingBill(bill);
    setTempCurrElec(bill.currElec);
    setTempCurrWater(bill.currWater);
    setTriggerError(null);
    setIsDrawerOpen(true);
  };

  const saveMeterReading = () => {
    if (!editingBill) return;

    // Check Trigger constraint: new reading CANNOT be lower than previous reading
    if (tempCurrElec < editingBill.prevElec) {
      const err = `ERROR P0001: Chỉ số điện mới (${tempCurrElec}) không được nhỏ hơn chỉ số cũ (${editingBill.prevElec})! Trigger trg_prevent_meter_decrement đã RAISE EXCEPTION và ROLLBACK giao dịch.`;
      setTriggerError(err);
      const newLog: AuditLogRecord = {
        id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
        tableName: "utility_bills",
        operation: "TRIGGER_ERROR",
        changedBy: "trigger:trg_prevent_meter_decrement",
        timestamp: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
        status: "BLOCKED_BY_TRIGGER",
        oldData: { bill_id: editingBill.id, room: editingBill.roomNumber, prev_elec: editingBill.prevElec },
        newData: { attempted_curr_elec: tempCurrElec },
        message: `Trigger chặn gian lận chỉ số điện lùi (${tempCurrElec} < ${editingBill.prevElec}). Rollback hoàn toàn.`,
      };
      setAuditLogs((prev) => [newLog, ...prev]);
      showToast("Trigger CSDL đã chặn và ROLLBACK: Chỉ số mới không thể nhỏ hơn chỉ số cũ!");
      return;
    }

    if (tempCurrWater < editingBill.prevWater) {
      const err = `ERROR P0001: Chỉ số nước mới (${tempCurrWater}) không được nhỏ hơn chỉ số cũ (${editingBill.prevWater})! Transaction rolled back.`;
      setTriggerError(err);
      showToast("Chỉ số nước mới không thể nhỏ hơn chỉ số cũ!");
      return;
    }

    // Valid update: proceed
    setBills((prev) =>
      prev.map((b) =>
        b.id === editingBill.id
          ? {
              ...b,
              currElec: tempCurrElec,
              currWater: tempCurrWater,
            }
          : b
      )
    );

    const successLog: AuditLogRecord = {
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      tableName: "utility_bills",
      operation: "UPDATE",
      changedBy: "admin_user",
      timestamp: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
      status: "SUCCESS",
      oldData: { bill_id: editingBill.id, prev_elec: editingBill.currElec, prev_water: editingBill.currWater },
      newData: { bill_id: editingBill.id, curr_elec: tempCurrElec, curr_water: tempCurrWater },
      message: `Đã ghi nhận chỉ số công tơ mới cho ${editingBill.roomNumber}`,
    };
    setAuditLogs((prev) => [successLog, ...prev]);

    setTriggerError(null);
    setIsDrawerOpen(false);
    showToast(`Đã cập nhật chỉ số điện nước thành công cho ${editingBill.roomNumber}!`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Quản lý Điện Nước & Hóa Đơn
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tính toán chỉ số công tơ, xuất hóa đơn và theo dõi tiến độ nộp tiền phòng của sinh viên.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Xuất Excel</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsBulkDialogOpen(true)}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold bg-[#1F5CA9] text-white hover:bg-[#1a4f91] shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo hóa đơn hàng loạt</span>
          </Button>
        </div>
      </div>

      {/* 1. Overview Summary: 3 quick highlight widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Widget 1: Total Collected This Month */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Collected This Month</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1F5CA9] dark:bg-blue-950/60 dark:text-blue-400">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-3xl font-extrabold tracking-tight text-[#1F5CA9]">
                {formatCurrency(totalCollected)}
              </span>
              <div className="flex items-center justify-between text-xs mt-2 text-muted-foreground">
                <span>Tiến độ thu: 75% phòng đã nộp</span>
                <span className="font-semibold text-emerald-600">Đạt mục tiêu</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#00AFEF] h-full rounded-full" style={{ width: "75%" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget 2: Overdue Bills (Yellow alert #FFB800) */}
        <Card className="rounded-2xl border-amber-200/80 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                Overdue Bills (Chưa nộp)
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-[#B45309] dark:bg-amber-950/80 dark:text-amber-400">
                <AlertCircle className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-[#B45309]">
                  {overdueCount} phòng
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  ({formatCurrency(totalUnpaid)})
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-amber-300/80">
                  Hạn chót: 25/10/2026
                </span>
                <span className="text-[11px] text-muted-foreground">Cần gửi SMS nhắc</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget 3: Water/Power Usage Rate */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Water/Power Usage Rate</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#00AFEF] dark:bg-sky-950/60 dark:text-sky-400">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <Zap className="h-3.5 w-3.5 text-[#1F5CA9]" />
                  <span>Điện: 19.800 kWh</span>
                </div>
                <span className="text-emerald-600 font-semibold">+6.4% kỳ trước</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <Droplets className="h-3.5 w-3.5 text-[#00AFEF]" />
                  <span>Nước: 5.600 m³</span>
                </div>
                <span className="text-emerald-600 font-semibold">+2.1% kỳ trước</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                Đơn giá chuẩn: 3.000 đ/kWh • 12.000 đ/m³
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Switcher: Commercial Bills vs Audit Logs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setActiveView("bills")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeView === "bills"
                ? "bg-white text-[#1F5CA9] shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Hóa Đơn & Chỉ Số Công Tơ</span>
          </button>
          <button
            onClick={() => setActiveView("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeView === "audit"
                ? "bg-[#1F5CA9] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <History className="h-4 w-4" />
            <span>Nhật Ký Kiểm Toán (Audit Logs)</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${activeView === "audit" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {auditLogs.length}
            </Badge>
          </button>
        </div>

        {isDemoMode && activeView === "audit" && (
          <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[11px] flex items-center gap-1.5 py-1 px-3">
            <Flame className="h-3.5 w-3.5 text-amber-600" />
            <span>PostgreSQL Trigger `trg_prevent_meter_decrement` & `audit_logs` (JSONB)</span>
          </Badge>
        )}
      </div>

      {activeView === "bills" ? (
        <>
          {/* 2. Filter & Bulk Action Row */}
          <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Month Picker */}
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm">
                  <Calendar className="h-3.5 w-3.5 text-[#1F5CA9]" />
                  <span>Kỳ thu: Tháng {selectedMonth}</span>
                </div>

                {/* Paid / Unpaid Status Pills */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === "all"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Tất cả ({bills.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("paid")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === "paid"
                        ? "bg-[#1F5CA9] text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Đã nộp ({bills.filter((b) => b.status === "paid").length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("unpaid")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === "unpaid"
                        ? "bg-[#FFB800] text-amber-950 shadow-sm"
                        : "text-amber-700 dark:text-amber-400 hover:text-amber-900"
                    }`}
                  >
                    Chưa nộp ({bills.filter((b) => b.status === "unpaid").length})
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo số phòng (vd: A.201)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs rounded-xl border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          </Card>

      {/* 3. Billing Data Table */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold uppercase tracking-wider text-muted-foreground border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-5">Phòng / Tòa</th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1 text-[#1F5CA9]">
                    <Zap className="h-3 w-3" />
                    <span>Điện (Cũ → Mới)</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1 text-[#00AFEF]">
                    <Droplets className="h-3 w-3" />
                    <span>Nước (Cũ → Mới)</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">Dịch vụ</th>
                <th className="py-3.5 px-4">Tổng tiền (VND)</th>
                <th className="py-3.5 px-4">Hạn nộp</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredBills.map((bill) => {
                const { elecUsage, waterUsage, total } = calculateTotals(bill);
                return (
                  <tr
                    key={bill.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Room & Building */}
                    <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-100">
                      <div>{bill.roomNumber}</div>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {bill.building} • {bill.studentCount} sinh viên
                      </span>
                    </td>

                    {/* Electricity */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div>
                        {bill.prevElec} → <span className="font-semibold text-slate-900 dark:text-slate-100">{bill.currElec}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {elecUsage} kWh ({formatCurrency(elecUsage * ELEC_RATE)})
                      </div>
                    </td>

                    {/* Water */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div>
                        {bill.prevWater} → <span className="font-semibold text-slate-900 dark:text-slate-100">{bill.currWater}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {waterUsage} m³ ({formatCurrency(waterUsage * WATER_RATE)})
                      </div>
                    </td>

                    {/* Service Fee */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {formatCurrency(bill.serviceFee)}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 font-bold text-sm text-[#1F5CA9] dark:text-sky-400">
                      {formatCurrency(total)}
                      <div className="text-[10px] font-normal text-muted-foreground">
                        ~{formatCurrency(Math.round(total / bill.studentCount))}/SV
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {bill.dueDate}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4">
                      {bill.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Đã nộp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                          <Clock className="h-3 w-3" /> Chưa nộp
                        </span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMeterDrawer(bill)}
                          title="Ghi chỉ số điện nước"
                          className="h-8 px-2 text-xs text-[#1F5CA9] hover:bg-blue-50 dark:hover:bg-blue-950"
                        >
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          <span>Ghi số</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInvoiceModalBill(bill)}
                          title="Xem hóa đơn PDF"
                          className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>

                        {bill.status === "unpaid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              showToast(`Đã gửi SMS nhắc đóng tiền đến đại diện ${bill.roomNumber}!`)
                            }
                            title="Gửi SMS nhắc nhở"
                            className="h-8 px-2 text-xs text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  ) : (
    /* Audit Logs View (PostgreSQL audit_logs & Trigger Inspector) */
    <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#1F5CA9]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              PostgreSQL `audit_logs` — Nhật Ký Thay Đổi & Kích Hoạt Trigger
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bảng nhật ký tự động ghi nhận mọi sự kiện DML và các giao dịch bị ROLLBACK bởi Trigger công tơ điện nước.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono bg-white">
            Total: {auditLogs.length} events
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-100/70 dark:bg-slate-800/80 uppercase tracking-wider text-muted-foreground border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Log ID</th>
              <th className="py-3 px-3">Bảng (Table)</th>
              <th className="py-3 px-3">Hành Động</th>
              <th className="py-3 px-3">Thực Hiện Bởi</th>
              <th className="py-3 px-4">Thời Gian</th>
              <th className="py-3 px-3">Trạng Thái</th>
              <th className="py-3 px-4">Chi Tiết Thay Đổi (JSONB Snapshot)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                  {log.id}
                </td>
                <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                    {log.tableName}
                  </span>
                </td>
                <td className="py-3 px-3">
                  {log.operation === "TRIGGER_ERROR" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                      <Flame className="h-3 w-3" /> TRIGGER_ERROR
                    </span>
                  ) : log.operation === "UPDATE" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1F5CA9]">
                      UPDATE
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      INSERT
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {log.changedBy}
                </td>
                <td className="py-3 px-4 text-muted-foreground text-[11px]">
                  {log.timestamp}
                </td>
                <td className="py-3 px-3">
                  {log.status === "BLOCKED_BY_TRIGGER" ? (
                    <span className="font-bold text-red-600 text-[11px]">
                      ROLLBACK
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-600 text-[11px]">
                      COMMITTED
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 max-w-xs font-mono text-[11px]">
                  <div className="bg-slate-900 text-slate-100 p-2 rounded-lg text-[10px] overflow-x-auto leading-relaxed">
                    <div><span className="text-amber-400">old_data:</span> {JSON.stringify(log.oldData)}</div>
                    <div><span className="text-sky-400">new_data:</span> {JSON.stringify(log.newData)}</div>
                    {log.message && (
                      <div className="text-red-300 mt-1 italic font-sans text-[10px]">
                        • {log.message}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )}

      {/* 4. Slide-over Drawer for entering meter numbers */}
      {isDrawerOpen && editingBill && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative z-50 flex h-full w-full max-w-md flex-col bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  Ghi nhận chỉ số & Tính tiền
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingBill.roomNumber} • {editingBill.building} (Kỳ {selectedMonth})
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDrawerOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Stepper Inputs */}
            <div className="flex-1 space-y-6 overflow-y-auto py-5">
              {/* Electricity Stepper */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[#1F5CA9]">
                      <Zap className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Chỉ số Điện (kWh)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1F5CA9]">
                    {formatCurrency(ELEC_RATE)}/kWh
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  Chỉ số tháng trước: <span className="font-semibold text-slate-800 dark:text-slate-200">{editingBill.prevElec}</span>
                </div>

                {/* Friendly Stepper */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrElec((prev) => Math.max(0, prev - 10))}
                    className="h-10 w-12 rounded-xl text-base font-bold"
                  >
                    -10
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrElec((prev) => Math.max(0, prev - 1))}
                    className="h-10 w-10 rounded-xl text-base font-bold"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={tempCurrElec}
                    onChange={(e) => setTempCurrElec(Number(e.target.value))}
                    className="h-10 text-center text-base font-bold rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrElec((prev) => prev + 1)}
                    className="h-10 w-10 rounded-xl text-base font-bold"
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrElec((prev) => prev + 10)}
                    className="h-10 w-12 rounded-xl text-base font-bold"
                  >
                    +10
                  </Button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span>Tiêu thụ: {Math.max(0, tempCurrElec - editingBill.prevElec)} kWh</span>
                  <span className="font-bold text-[#1F5CA9]">
                    {formatCurrency(Math.max(0, tempCurrElec - editingBill.prevElec) * ELEC_RATE)}
                  </span>
                </div>
              </div>

              {/* Evaluator Trigger Testing Box (Only in Demo Mode) */}
              {isDemoMode && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                      <Flame className="h-4 w-4 text-amber-600" />
                      <span>Test Trigger Gian Lận (CT221H)</span>
                    </div>
                    <Badge className="bg-amber-200 text-amber-950 border-0 text-[10px] font-mono">
                      trg_prevent_meter_decrement
                    </Badge>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Giả lập gian lận: Nhập số điện mới thấp hơn chỉ số cũ (<code>{editingBill.prevElec - 15} &lt; {editingBill.prevElec}</code>). Khi bấm <strong>Lưu & Cập nhật</strong>, Trigger sẽ lập tức phát sinh Exception ROLLBACK và lưu vào <code>audit_logs</code>.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTempCurrElec(editingBill.prevElec - 15);
                      setTriggerError(null);
                    }}
                    className="h-8 text-xs bg-white text-amber-900 border-amber-300 hover:bg-amber-100 font-semibold w-full"
                  >
                    🧪 Gán số điện lùi ({editingBill.prevElec - 15} kWh)
                  </Button>
                </div>
              )}

              {/* Trigger Error SQL Terminal Display */}
              {triggerError && (
                <div className="rounded-2xl border border-red-400 bg-slate-950 text-red-300 p-4 font-mono text-xs space-y-2 shadow-lg">
                  <div className="flex items-center justify-between text-red-400 border-b border-red-900 pb-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Terminal className="h-4 w-4" />
                      <span>PostgreSQL RAISE EXCEPTION</span>
                    </div>
                    <Badge variant="destructive" className="text-[10px] font-mono">CODE: P0001</Badge>
                  </div>
                  <div className="text-[11px] leading-relaxed text-red-200">
                    {triggerError}
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                    <span>STATE: 23514 (Trigger Abort)</span>
                    <span className="text-emerald-400 font-bold">✓ Đã ghi vào audit_logs</span>
                  </div>
                </div>
              )}

              {/* Water Stepper */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-[#00AFEF]">
                      <Droplets className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Chỉ số Nước (m³)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#00AFEF]">
                    {formatCurrency(WATER_RATE)}/m³
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  Chỉ số tháng trước: <span className="font-semibold text-slate-800 dark:text-slate-200">{editingBill.prevWater}</span>
                </div>

                {/* Friendly Stepper */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrWater((prev) => Math.max(editingBill.prevWater, prev - 5))}
                    className="h-10 w-12 rounded-xl text-base font-bold"
                  >
                    -5
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrWater((prev) => Math.max(editingBill.prevWater, prev - 1))}
                    className="h-10 w-10 rounded-xl text-base font-bold"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={tempCurrWater}
                    onChange={(e) => setTempCurrWater(Number(e.target.value))}
                    className="h-10 text-center text-base font-bold rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrWater((prev) => prev + 1)}
                    className="h-10 w-10 rounded-xl text-base font-bold"
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTempCurrWater((prev) => prev + 5)}
                    className="h-10 w-12 rounded-xl text-base font-bold"
                  >
                    +5
                  </Button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span>Tiêu thụ: {Math.max(0, tempCurrWater - editingBill.prevWater)} m³</span>
                  <span className="font-bold text-[#00AFEF]">
                    {formatCurrency(Math.max(0, tempCurrWater - editingBill.prevWater) * WATER_RATE)}
                  </span>
                </div>
              </div>

              {/* Real-time Calculation Summary Card */}
              {(() => {
                const eDiff = Math.max(0, tempCurrElec - editingBill.prevElec);
                const wDiff = Math.max(0, tempCurrWater - editingBill.prevWater);
                const totalCost = eDiff * ELEC_RATE + wDiff * WATER_RATE + editingBill.serviceFee;
                const perStudent = Math.round(totalCost / editingBill.studentCount);
                return (
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50/80 to-sky-50/60 dark:from-slate-800 dark:to-slate-800/80 border border-blue-100 dark:border-slate-700 p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">
                      Bảng tính chi phí tự động:
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Tiền điện ({eDiff} kWh):</span>
                      <span>{formatCurrency(eDiff * ELEC_RATE)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Tiền nước ({wDiff} m³):</span>
                      <span>{formatCurrency(wDiff * WATER_RATE)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Phí dịch vụ (Rác, Wifi):</span>
                      <span>{formatCurrency(editingBill.serviceFee)}</span>
                    </div>
                    <div className="pt-2 border-t border-blue-200/60 dark:border-slate-700 flex justify-between items-baseline">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
                        Tổng cộng:
                      </span>
                      <span className="text-lg font-extrabold text-[#1F5CA9]">
                        {formatCurrency(totalCost)}
                      </span>
                    </div>
                    <div className="text-[11px] text-right font-medium text-slate-500">
                      Chia bình quân: <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(perStudent)}</span> / sinh viên
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Drawer Footer Actions */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 rounded-xl text-xs font-medium"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={saveMeterReading}
                className="flex-1 rounded-xl text-xs font-semibold bg-[#1F5CA9] text-white hover:bg-[#1a4f91]"
              >
                Lưu & Cập nhật
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Invoice PDF Modal Preview */}
      <Dialog
        open={!!invoiceModalBill}
        onOpenChange={(open) => !open && setInvoiceModalBill(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          {invoiceModalBill && (
            <div>
              <DialogHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-[#1F5CA9]" />
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Hóa Đơn Thu Tiền KTX
                    </DialogTitle>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-semibold text-[#1F5CA9]">
                    Số: #{invoiceModalBill.id}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Ban Quản lý Ký túc xá Đại học Quốc gia • Tháng {selectedMonth}
                </DialogDescription>
              </DialogHeader>

              {/* Invoice Printable Body */}
              <div className="py-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phòng:</span>
                    <span className="font-bold text-slate-900">{invoiceModalBill.roomNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Số sinh viên:</span>
                    <span className="font-semibold text-slate-800">{invoiceModalBill.studentCount} người</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Hạn nộp:</span>
                    <span className="font-semibold text-amber-700">{invoiceModalBill.dueDate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Trạng thái:</span>
                    <span className={`font-bold ${invoiceModalBill.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                      {invoiceModalBill.status === "paid" ? "Đã nộp đủ" : "Chưa thanh toán"}
                    </span>
                  </div>
                </div>

                {/* Calculation lines */}
                {(() => {
                  const t = calculateTotals(invoiceModalBill);
                  return (
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between border-b border-dashed pb-1.5 text-slate-600">
                        <span>Tiền điện ({t.elecUsage} kWh × 3.000đ):</span>
                        <span className="font-medium text-slate-900">{formatCurrency(t.elecCost)}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1.5 text-slate-600">
                        <span>Tiền nước ({t.waterUsage} m³ × 12.000đ):</span>
                        <span className="font-medium text-slate-900">{formatCurrency(t.waterCost)}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1.5 text-slate-600">
                        <span>Phí vệ sinh & quản trị KTX:</span>
                        <span className="font-medium text-slate-900">{formatCurrency(invoiceModalBill.serviceFee)}</span>
                      </div>
                      <div className="flex justify-between pt-1 text-sm font-extrabold text-[#1F5CA9]">
                        <span>TỔNG TIỀN PHẢI NỘP:</span>
                        <span>{formatCurrency(t.total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <DialogFooter className="flex gap-2 sm:justify-end pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoiceModalBill(null)}
                  className="rounded-xl text-xs"
                >
                  Đóng
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    showToast("Đã gửi lệnh in hóa đơn ra máy in Ban Quản lý!");
                    setInvoiceModalBill(null);
                  }}
                  className="rounded-xl text-xs gap-1.5 bg-[#1F5CA9] text-white hover:bg-[#1a4f91]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In Hóa Đơn PDF</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Bulk Generation Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Tạo Hóa Đơn Hàng Loạt
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Hệ thống sẽ tự động quét chỉ số công tơ điện nước mới nhất và phát hành thông báo nộp tiền cho sinh viên.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3 text-slate-700 space-y-1.5">
              <div className="font-semibold text-[#1F5CA9]">Thông số phát hành kỳ {selectedMonth}:</div>
              <div>• Số phòng áp dụng: <strong>48 phòng</strong> (Tòa A & Tòa B)</div>
              <div>• Đơn giá điện: <strong>3.000 đ/kWh</strong></div>
              <div>• Đơn giá nước: <strong>12.000 đ/m³</strong></div>
              <div>• Hạn nộp dự kiến: <strong>25/10/2026</strong></div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsBulkDialogOpen(false);
                showToast("Đã tạo và gửi thông báo 48 hóa đơn thành công!");
              }}
              className="rounded-xl text-xs font-semibold bg-[#1F5CA9] text-white hover:bg-[#1a4f91]"
            >
              Xác nhận Tạo hóa đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
