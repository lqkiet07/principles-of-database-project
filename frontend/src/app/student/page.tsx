"use client";

import * as React from "react";
import Link from "next/link";
import {
  Wrench,
  Receipt,
  CalendarCheck,
  BookOpen,
  QrCode,
  Bell,
  Phone,
  Home,
  DoorOpen,
  FileText,
  User,
  ChevronRight,
  Zap,
  Droplets,
  CheckCircle2,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Info,
  Maximize2,
  Smartphone,
  ArrowLeft,
  Calendar,
  Lock,
  AirVent,
  Bed,
  Sparkles,
  AlertTriangle,
  Clock,
  Printer,
  Upload,
  Camera,
  Share2,
  Wallet,
  GraduationCap,
} from "lucide-react";
import { useDemoMode } from "@/lib/demo-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Roommate {
  id: string;
  name: string;
  role: string;
  major: string;
  phone: string;
  avatarText: string;
  isOnline: boolean;
  statusText: string;
}

const roommates: Roommate[] = [
  {
    id: "1",
    name: "Nguyễn Tuấn Anh",
    role: "Trưởng phòng (Bạn)",
    major: "Khoa học Máy tính K67",
    phone: "0981.234.567",
    avatarText: "TA",
    isOnline: true,
    statusText: "Đang ở phòng",
  },
  {
    id: "2",
    name: "Trần Minh Quân",
    role: "Thành viên",
    major: "Kỹ thuật Phần mềm K67",
    phone: "0972.889.123",
    avatarText: "MQ",
    isOnline: true,
    statusText: "Đang ở phòng",
  },
  {
    id: "3",
    name: "Lê Văn Hùng",
    role: "Thành viên",
    major: "Kinh tế Đối ngoại K68",
    phone: "0915.678.901",
    avatarText: "VH",
    isOnline: false,
    statusText: "Đang trên lớp",
  },
  {
    id: "4",
    name: "Đặng Tiến Dũng",
    role: "Thành viên",
    major: "Tự động hóa K67",
    phone: "0963.456.789",
    avatarText: "TD",
    isOnline: true,
    statusText: "Đang ở phòng",
  },
];

export default function StudentPortalPage() {
  // Navigation Tabs: home | room | bills | profile
  const [activeTab, setActiveTab] = React.useState<"home" | "room" | "bills" | "profile">("home");

  // Display Mode: iPhone 16 (393x852) vs Fullscreen Responsive
  const [isSimulatorMode, setIsSimulatorMode] = React.useState(true);

  // Modals state
  const [isQrModalOpen, setIsQrModalOpen] = React.useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = React.useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = React.useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = React.useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = React.useState(false);

  const [selectedRoommate, setSelectedRoommate] = React.useState<Roommate | null>(null);
  const [selectedReceiptMonth, setSelectedReceiptMonth] = React.useState<string>("Tháng 09/2026");
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Form states for Repair Request
  const [repairCategory, setRepairCategory] = React.useState("dien");
  const [repairPriority, setRepairPriority] = React.useState("binh_thuong");
  const [repairDescription, setRepairDescription] = React.useState("");

  // Form states for Absence Registration
  const [absenceStartDate, setAbsenceStartDate] = React.useState("2026-10-25");
  const [absenceEndDate, setAbsenceEndDate] = React.useState("2026-10-28");
  const [absenceReason, setAbsenceReason] = React.useState("ve_que");
  const [parentPhone, setParentPhone] = React.useState("0912.345.678");

  // CT221H Campus Wallet & Stored Procedure states
  const { isDemoMode } = useDemoMode();
  const [studentWallet, setStudentWallet] = React.useState(1200000);
  const [studentDebtPaid, setStudentDebtPaid] = React.useState(false);
  const [isPayingDebt, setIsPayingDebt] = React.useState(false);
  const [demoSimResult, setDemoSimResult] = React.useState<string | null>(null);

  const handlePayWithWallet = () => {
    setIsPayingDebt(true);
    setTimeout(() => {
      setStudentWallet((prev) => Math.max(0, prev - 345000));
      setStudentDebtPaid(true);
      setIsPayingDebt(false);
      showToast("Đã thanh toán 345.000 đ thành công qua Stored Procedure sp_pay_student_utility_bill!");
    }, 700);
  };

  const handleSimulateDoubleClick = () => {
    setDemoSimResult("⚡ [ACID Simulation] Đang gửi 2 Transaction đồng thời trong 20ms...");
    setTimeout(() => {
      setStudentWallet((prev) => Math.max(0, prev - 345000));
      setStudentDebtPaid(true);
      setDemoSimResult("✓ Request 1: Lock 'FOR UPDATE' thành công (Code 0). Request 2: Lock Wait -> đọc nợ đã PAID -> thoát an toàn với mã DEBT_ALREADY_PAID (Code 2). Không bị trừ tiền 2 lần!");
    }, 1000);
  };

  const handleSimulateInsufficientFunds = () => {
    setStudentWallet(50000);
    setDemoSimResult("⚠️ Đã rút số dư ví còn 50.000 đ. Thử nộp khoản nợ 345.000 đ...");
    setTimeout(() => {
      setDemoSimResult("❌ [ROLLBACK] Stored Procedure ném ngoại lệ INSUFFICIENT_FUNDS (Code 1). Số dư ví giữ nguyên 50.000 đ, trạng thái nợ giữ nguyên UNPAID!");
    }, 800);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleContactClick = (roommate: Roommate) => {
    setSelectedRoommate(roommate);
    setIsPhoneModalOpen(true);
  };

  const handleSubmitRepair = (e: React.FormEvent) => {
    e.preventDefault();
    setIsReportModalOpen(false);
    setRepairDescription("");
    showToast("Đã gửi yêu cầu sửa chữa #SC-4029! Kỹ thuật viên sẽ liên hệ trong 2h.");
  };

  const handleSubmitAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAbsenceModalOpen(false);
    showToast("Đã duyệt đơn đăng ký tạm vắng tự động! Chúc bạn chuyến đi an toàn.");
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-start py-4 px-2 sm:px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-in slide-in-from-top-3 duration-200 border border-slate-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar for Desktop Preview / Viewport Toggle */}
      <div className="w-full max-w-4xl mb-3 flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 font-semibold text-[#1F5CA9] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Về Dashboard Admin</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 hidden sm:inline">
            Cổng Sinh Viên KTX (Student Mobile App)
          </span>
        </div>

        {/* Viewport switch: iPhone 16 (393x852) vs Fullscreen */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px] hidden sm:inline">Khung xem:</span>
          <Button
            size="sm"
            variant={isSimulatorMode ? "default" : "outline"}
            onClick={() => setIsSimulatorMode(true)}
            className={`h-7 px-2.5 rounded-lg text-xs gap-1.5 ${
              isSimulatorMode ? "bg-[#1F5CA9] text-white shadow-xs" : ""
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>iPhone 16 (393×852)</span>
          </Button>
          <Button
            size="sm"
            variant={!isSimulatorMode ? "default" : "outline"}
            onClick={() => setIsSimulatorMode(false)}
            className={`h-7 px-2.5 rounded-lg text-xs gap-1.5 ${
              !isSimulatorMode ? "bg-[#1F5CA9] text-white shadow-xs" : ""
            }`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Mở rộng</span>
          </Button>
        </div>
      </div>

      {/* Main Container — Styled strictly to iPhone 16 specifications (393 × 852 px) */}
      <div
        className={`transition-all duration-300 w-full ${
          isSimulatorMode
            ? "max-w-[393px] h-[852px] rounded-[52px] border-[10px] border-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden bg-white dark:bg-slate-900 relative flex flex-col"
            : "max-w-xl min-h-[852px] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden bg-white dark:bg-slate-900 relative flex flex-col"
        }`}
      >
        {/* iPhone 16 Dynamic Island & Status Bar */}
        {isSimulatorMode && (
          <div className="h-10 w-full flex items-center justify-between px-7 pt-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 select-none bg-white dark:bg-slate-900 z-30 shrink-0">
            <span className="font-semibold text-xs tracking-tight">9:41</span>

            {/* Dynamic Island pill */}
            <div className="h-[28px] w-[116px] bg-black rounded-full flex items-center justify-between px-2.5 text-[10px] text-white/90 shadow-xs cursor-pointer hover:scale-105 transition-transform">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-slate-200 tracking-tight">P.402 Tòa B</span>
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500/80" />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-[10px]">5G</span>
              <div className="h-2.5 w-5 rounded-xs border border-current p-0.5 flex items-center">
                <div className="h-full w-3/4 bg-current rounded-xs" />
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Screen Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-4">
          {/* ========================================================= */}
          {/* TAB 1: TRANG CHỦ (HOME DASHBOARD)                         */}
          {/* ========================================================= */}
          {activeTab === "home" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* 1. Welcome Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-11 w-11 border-2 border-[#1F5CA9]/30">
                      <AvatarFallback className="bg-gradient-to-tr from-[#1F5CA9] to-[#00AFEF] text-white font-bold text-sm">
                        TA
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                      Chào bạn, Tuấn Anh 👋
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[#1F5CA9] bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                        P.402 - Tòa B
                      </span>
                      <span className="text-muted-foreground text-[11px]">MSSV: 22020199</span>
                    </div>
                  </div>
                </div>

                {/* Notification Bell with Yellow Accent Dot (#FFB800) */}
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFB800] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FFB800] border border-white" />
                  </span>
                </button>
              </div>

              {/* 2. Quick Action Grid (4 round icons) */}
              <div className="grid grid-cols-4 gap-2.5 pt-1">
                {/* Action 1: Báo hỏng / Sửa chữa (#00AFEF) */}
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00AFEF] text-white shadow-md shadow-sky-500/20 group-hover:scale-105 active:scale-95 transition-transform">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight text-slate-800 dark:text-slate-200">
                    Báo hỏng / Sửa chữa
                  </span>
                </button>

                {/* Action 2: Hóa đơn tháng này (#FFB800 with badge) */}
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="flex flex-col items-center gap-1.5 group relative cursor-pointer"
                >
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB800] text-amber-950 shadow-md shadow-amber-500/25 group-hover:scale-105 active:scale-95 transition-transform">
                    <Receipt className="h-6 w-6" />
                    <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                      Chờ nộp
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight text-slate-800 dark:text-slate-200">
                    Hóa đơn tháng này
                  </span>
                </button>

                {/* Action 3: Đăng ký tạm vắng */}
                <button
                  onClick={() => setIsAbsenceModalOpen(true)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 active:scale-95 transition-transform">
                    <CalendarCheck className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight text-slate-800 dark:text-slate-200">
                    Đăng ký tạm vắng
                  </span>
                </button>

                {/* Action 4: Nội quy & Liên hệ */}
                <button
                  onClick={() => setIsRulesModalOpen(true)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1F5CA9] text-white shadow-md shadow-blue-900/20 group-hover:scale-105 active:scale-95 transition-transform">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight text-slate-800 dark:text-slate-200">
                    Nội quy & Liên hệ
                  </span>
                </button>
              </div>

              {/* Notice Banner */}
              <div className="rounded-2xl bg-blue-50/80 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 p-3 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-[#1F5CA9] mt-0.5 shrink-0" />
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-[#1F5CA9] block">Lịch phun khử trùng phòng dịch KTX:</span>
                  Thứ Bảy (26/10) từ 08:30 - 11:30. Sinh viên vui lòng cất dọn đồ đạc cá nhân ngăn nắp.
                </div>
              </div>

              {/* 3. Monthly Bill Highlight Card */}
              <div className="rounded-3xl p-[2px] bg-gradient-to-br from-[#1F5CA9] via-[#00AFEF] to-[#FFB800] shadow-lg shadow-sky-500/10">
                <div className="bg-white dark:bg-slate-900 rounded-[22px] p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1F5CA9]">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Hóa đơn điện nước
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Kỳ Tháng 10/2026
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-[#FEF3C7] text-[#B45309] border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Hạn chót: 25/10 (1 ngày)
                    </Badge>
                  </div>

                  {/* Amount Display */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-muted-foreground mb-0.5">Số tiền bạn cần nộp (1/4 phòng):</div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-[#1F5CA9] dark:text-sky-400">
                        345.000 đ
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Tổng phòng: 1.380.000 đ
                      </span>
                    </div>

                    {/* Sub-item details */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 text-[10px]">
                      <div>
                        <span className="text-muted-foreground block">Điện (45 kWh)</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">135.000 đ</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Nước (14 m³)</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">110.000 đ</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Rác & Wifi</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">100.000 đ</span>
                      </div>
                    </div>
                  </div>

                  {/* Prominent Friendly CTA Button */}
                  <Button
                    onClick={() => setIsQrModalOpen(true)}
                    className="w-full h-11 rounded-2xl font-bold text-sm bg-[#1F5CA9] hover:bg-[#184988] text-white shadow-md shadow-blue-800/25 flex items-center justify-center gap-2 group transition-all cursor-pointer"
                  >
                    <QrCode className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
                    <span>Thanh toán qua QR VNPay</span>
                  </Button>
                </div>
              </div>

              {/* 4. Roommate list (Bạn cùng phòng) */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Bạn cùng phòng ({roommates.length} thành viên)
                  </span>
                  <button
                    onClick={() => setActiveTab("room")}
                    className="text-[11px] font-semibold text-[#00AFEF] hover:underline"
                  >
                    Xem chi tiết →
                  </button>
                </div>

                <div className="space-y-2">
                  {roommates.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-xs transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 border border-slate-200">
                            <AvatarFallback
                              className={`font-bold text-xs ${
                                student.id === "1"
                                  ? "bg-[#1F5CA9] text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              {student.avatarText}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                              student.isOnline ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {student.name}
                            </span>
                            {student.id === "1" && (
                              <Badge className="bg-blue-50 text-[#1F5CA9] text-[9px] font-semibold px-1.5 py-0 h-4">
                                Bạn
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{student.major}</div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                            {student.statusText}
                          </div>
                        </div>
                      </div>

                      {/* Phone shortcut button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleContactClick(student)}
                        className="h-8 w-8 rounded-full text-[#1F5CA9] hover:bg-blue-50 dark:hover:bg-blue-950"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PHÒNG CỦA TÔI (MY ROOM)                           */}
          {/* ========================================================= */}
          {activeTab === "room" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Room Banner */}
              <div className="rounded-3xl bg-gradient-to-br from-[#1F5CA9] to-[#00AFEF] p-4 text-white shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase font-semibold text-white/80 tracking-wider">
                      Không gian lưu trú
                    </span>
                    <h2 className="text-xl font-bold mt-0.5">Phòng A.402 • Tòa B</h2>
                    <p className="text-xs text-white/90 mt-1">
                      Tầng 4 • Phòng Nam • 4 Giường tầng • Diện tích: 28m²
                    </p>
                  </div>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[11px]">
                    4/4 Đủ người
                  </Badge>
                </div>
              </div>

              {/* AI Semantic Room Search with pgvector */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#00AFEF]" />
                    <span className="text-xs font-bold text-slate-800">
                      Tìm Phòng Ngữ Nghĩa AI (pgvector)
                    </span>
                  </div>
                  <Badge className="bg-sky-100 text-[#00AFEF] text-[10px] font-mono border-0">
                    vector(384)
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    placeholder="VD: 'Phòng nam tầng 3 thoáng mát có ban công gần căng-tin'..."
                    className="h-8 text-xs bg-white border-sky-200 pl-2.5 pr-16"
                  />
                  <Button size="sm" className="absolute right-0.5 top-0.5 h-7 px-2.5 text-[10px] bg-[#1F5CA9] text-white">
                    Tìm AI
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Truy vấn khoảng cách Cosine `rooms.embedding &lt;=&gt; query_vector` trong PostgreSQL 16
                </p>
              </div>

              {/* Facility & Equipment Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Cơ sở vật chất & Tài sản phòng
                  </span>
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="text-[11px] font-semibold text-[#1F5CA9] hover:underline"
                  >
                    + Báo hỏng thiết bị
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                      <AirVent className="h-4 w-4 text-[#00AFEF]" />
                      <span>Điều hòa Casper</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Mã: TS-A402-DH</div>
                    <div className="text-[10px] text-emerald-600 font-medium">Bảo dưỡng: 15/09/2026</div>
                  </div>

                  <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                      <Bed className="h-4 w-4 text-[#1F5CA9]" />
                      <span>Giường tầng gỗ (4)</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Mã: TS-A402-G1..4</div>
                    <div className="text-[10px] text-emerald-600 font-medium">Tình trạng: Tốt</div>
                  </div>

                  <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                      <Zap className="h-4 w-4 text-[#FFB800]" />
                      <span>Công tơ điện</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Chỉ số: 1.585 kWh</div>
                    <div className="text-[10px] text-slate-500 font-medium">Đo tự động IoT</div>
                  </div>

                  <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                      <Droplets className="h-4 w-4 text-[#00AFEF]" />
                      <span>Đồng hồ nước</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Chỉ số: 126 m³</div>
                    <div className="text-[10px] text-slate-500 font-medium">Hoạt động chuẩn</div>
                  </div>
                </div>
              </div>

              {/* Cleaning Schedule */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Lịch trực nhật tuần này
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold text-[#1F5CA9]">
                    Tuần 42 (T10/2026)
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Thứ 2: Tuấn Anh</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                      <Check className="h-3 w-3" /> Đã xong
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900">
                    <span className="font-bold text-amber-900 dark:text-amber-100">Thứ 4: Minh Quân (Hôm nay 🧹)</span>
                    <span className="text-[#B45309] font-bold text-[11px]">Đang phiên</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Thứ 6: Văn Hùng</span>
                    <span className="text-slate-400 text-[11px]">Sắp tới</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Chủ Nhật: Tiến Dũng</span>
                    <span className="text-slate-400 text-[11px]">Tổng vệ sinh</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: HÓA ĐƠN & VÍ SINH VIÊN (CAMPUS WALLET & BILLS)      */}
          {/* ========================================================= */}
          {activeTab === "bills" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Ví KTX & Công Nợ Điện Nước
                </h2>
                <Badge variant="outline" className="text-[10px] font-mono text-[#1F5CA9] border-blue-200">
                  Phòng B.402
                </Badge>
              </div>

              {/* Campus Wallet Card */}
              <div className="rounded-2xl bg-gradient-to-r from-[#1F5CA9] to-[#00AFEF] p-4 text-white shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-bold text-sky-100 uppercase tracking-wider">
                      Ví Sinh Viên Nội Bộ (Campus Wallet)
                    </span>
                  </div>
                  <Badge className="bg-emerald-400 text-slate-900 text-[10px] font-bold">
                    Hoạt động
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-xs text-sky-100 block">Số dư khả dụng</span>
                    <span className="text-2xl font-black">{studentWallet.toLocaleString("vi-VN")} đ</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[200000, 500000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setStudentWallet((prev) => prev + amt)}
                        className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg backdrop-blur-xs transition-colors"
                      >
                        +{amt / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-sky-100/80">
                  Liên kết tài khoản thẻ sinh viên • Nộp tiền điện nước tự động qua Stored Procedure ACID
                </p>
              </div>

              {/* Current Unpaid Split Debt Card */}
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-[#FFB800] text-amber-950 text-[10px] font-bold px-2 py-0.5">
                    Hóa đơn T10/2026 (Phòng B.402)
                  </Badge>
                  <span className="text-xs font-semibold text-red-600">Hạn chót: 25/10/2026</span>
                </div>

                <div className="rounded-xl bg-white/80 p-2.5 border border-amber-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Hóa đơn phòng tổng (2 người):</span>
                    <span className="font-bold text-slate-900">690.000 đ</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-100">
                    <span className="font-bold text-[#1F5CA9]">Công nợ của bạn (student_utility_debts):</span>
                    <span className={`text-xl font-extrabold ${studentDebtPaid ? "text-emerald-600" : "text-[#1F5CA9]"}`}>
                      {studentDebtPaid ? "ĐÃ NỘP (0 đ)" : "345.000 đ"}
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-slate-600 pt-1">
                  <div className="flex justify-between">
                    <span>Điện lũy tiến 3 bậc (150 kWh / 2):</span>
                    <span className="font-medium text-slate-900">170.000 đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nước sạch (25 m³ × 10.000đ / 2):</span>
                    <span className="font-medium text-slate-900">125.000 đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vệ sinh & Wifi (100.000đ / 2):</span>
                    <span className="font-medium text-slate-900">50.000 đ</span>
                  </div>
                </div>

                {!studentDebtPaid ? (
                  <div className="space-y-2 pt-1">
                    <Button
                      onClick={handlePayWithWallet}
                      disabled={isPayingDebt}
                      className="w-full h-10 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>{isPayingDebt ? "Đang xử lý Stored Procedure ACID..." : "Nộp 345.000 đ Bằng Ví KTX"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setIsQrModalOpen(true)}
                      className="w-full h-8 rounded-xl font-semibold text-xs border-amber-300 text-slate-700 hover:bg-amber-100/50 flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5 text-[#1F5CA9]" />
                      <span>Hoặc Nạp Tiền Qua VietQR / VNPay</span>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-100/80 border border-emerald-300 p-3 text-center space-y-1 text-xs text-emerald-900">
                    <p className="font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Đã gạch nợ thành công qua Stored Procedure!
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      Biên lai: <strong>TX-20261027-8841</strong> • Hóa đơn phòng: <strong>PARTIALLY_PAID</strong>
                    </p>
                  </div>
                )}

                {/* DEMO MODE TEST CASES - ONLY SHOWN WHEN DEMO MODE IS ON IN SETTINGS */}
                {isDemoMode && (
                  <div className="rounded-xl border border-dashed border-amber-400 bg-amber-100/60 p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <GraduationCap className="h-4 w-4 text-[#FFB800]" />
                      <span>Kịch bản Giảng viên chấm thi (Demo Mode):</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSimulateDoubleClick}
                        className="h-8 text-[11px] font-bold bg-white text-amber-900 border-amber-300 hover:bg-amber-50"
                      >
                        ⚡ Test Click đúp (ACID)
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSimulateInsufficientFunds}
                        className="h-8 text-[11px] font-bold bg-white text-red-700 border-red-300 hover:bg-red-50"
                      >
                        ⚠️ Test Thiếu tiền (Rollback)
                      </Button>
                    </div>

                    {demoSimResult && (
                      <div className="p-2 rounded bg-white border border-amber-200 text-[11px] text-slate-800">
                        {demoSimResult}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Paid Past Bills History */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block px-1">
                  Lịch sử biên lai thanh toán (`payment_transactions`)
                </span>

                {[
                  { month: "Tháng 09/2026", amount: "310.000 đ", paidDate: "20/09/2026", receiptCode: "TX-20260920-9042" },
                  { month: "Tháng 08/2026", amount: "285.000 đ", paidDate: "18/08/2026", receiptCode: "TX-20260818-8015" },
                  { month: "Tháng 07/2026", amount: "290.000 đ", paidDate: "19/07/2026", receiptCode: "TX-20260719-7103" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{item.month}</div>
                      <div className="text-[11px] text-muted-foreground">Đã nộp ngày: {item.paidDate}</div>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Số biên lai: #{item.receiptCode}</div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{item.amount}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReceiptMonth(item.month);
                          setIsReceiptModalOpen(true);
                        }}
                        className="h-6 px-2 text-[10px] rounded-lg text-[#1F5CA9] border-blue-200 hover:bg-blue-50"
                      >
                        Xem biên lai
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: CÁ NHÂN & THẺ KTX SỐ (PROFILE & DIGITAL PASS)      */}
          {/* ========================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Apple Wallet Style Digital Pass */}
              <div className="relative rounded-3xl bg-gradient-to-br from-[#1F5CA9] via-[#0077b6] to-[#00AFEF] text-white p-5 shadow-xl overflow-hidden">
                {/* Background Watermark Pattern */}
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
                  <div className="w-48 h-48 rounded-full border-[16px] border-white" />
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-white/20">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-white text-[#1F5CA9] flex items-center justify-center font-extrabold text-sm shadow-xs">
                      KTX
                    </div>
                    <div>
                      <span className="text-xs font-bold tracking-tight block">THẺ CƯ TRÚ KÝ TÚC XÁ</span>
                      <span className="text-[10px] text-white/80">ĐẠI HỌC QUỐC GIA</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-400 text-slate-950 font-bold text-[10px]">
                    ACTIVE
                  </Badge>
                </div>

                <div className="pt-4 flex items-center gap-3.5">
                  <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                    <AvatarFallback className="bg-white text-[#1F5CA9] font-black text-lg">
                      TA
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-base font-bold leading-tight">NGUYỄN TUẤN ANH</h3>
                    <div className="text-xs text-white/90 font-medium">MSSV: 22020199</div>
                    <div className="text-xs text-white/90">Phòng: A.402 • Tòa B (K67 CNTT)</div>
                  </div>
                </div>

                {/* Simulated Barcode for Gate / Elevator Access */}
                <div className="mt-4 pt-3 border-t border-white/20 flex flex-col items-center">
                  <div className="h-8 w-full bg-white/95 rounded-md px-2 py-1 flex items-center justify-between">
                    {Array.from({ length: 42 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-full bg-slate-900 ${
                          i % 3 === 0 ? "w-1" : i % 2 === 0 ? "w-0.5" : "w-1.5"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-white/80 mt-1">
                    22020199-A402-2026-GATE
                  </span>
                </div>
              </div>

              {/* Contract Summary */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block mb-1">
                  Thông tin Hợp đồng KTX
                </span>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-muted-foreground">Mã hợp đồng:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">HD-2026-A402-01</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-muted-foreground">Thời hạn lưu trú:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">01/09/2026 - 30/06/2027</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Tiền ký quỹ (Đặt cọc):</span>
                  <span className="font-bold text-[#1F5CA9]">1.000.000 đ (Đã nộp)</span>
                </div>
              </div>

              {/* Utility actions */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden text-xs divide-y divide-slate-100 dark:divide-slate-800">
                <button
                  onClick={() => setIsRulesModalOpen(true)}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <BookOpen className="h-4 w-4 text-[#1F5CA9]" />
                    <span>Nội quy & Danh bạ liên hệ</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  onClick={() => showToast("Chức năng đổi mật khẩu đã mở!")}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Lock className="h-4 w-4 text-[#00AFEF]" />
                    <span>Đổi mật khẩu tài khoản</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>

                <button
                  onClick={() => showToast("Đã kích hoạt nhận thông báo qua Zalo & SMS!")}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Bell className="h-4 w-4 text-[#FFB800]" />
                    <span>Cài đặt nhận thông báo</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              {/* Logout button */}
              <Button
                variant="outline"
                onClick={() => showToast("Đăng xuất tài khoản an toàn.")}
                className="w-full h-10 rounded-2xl text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
              >
                Đăng xuất tài khoản
              </Button>
            </div>
          )}
        </div>

        {/* 5. Bottom Navigation Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-6 py-2 flex items-center justify-between z-20">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "home" ? "text-[#1F5CA9] font-bold" : "text-slate-500"
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Trang chủ</span>
          </button>

          <button
            onClick={() => setActiveTab("room")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "room" ? "text-[#1F5CA9] font-bold" : "text-slate-500"
            }`}
          >
            <DoorOpen className="h-5 w-5" />
            <span className="text-[10px]">Phòng của tôi</span>
          </button>

          <button
            onClick={() => setActiveTab("bills")}
            className={`flex flex-col items-center gap-1 transition-colors relative cursor-pointer ${
              activeTab === "bills" ? "text-[#1F5CA9] font-bold" : "text-slate-500"
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="absolute -top-1 right-1 h-2 w-2 rounded-full bg-[#FFB800]" />
            <span className="text-[10px]">Hóa đơn</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "profile" ? "text-[#1F5CA9] font-bold" : "text-slate-500"
            }`}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px]">Cá nhân</span>
          </button>
        </div>

        {/* iPhone 16 Home Indicator Bar */}
        {isSimulatorMode && (
          <div className="absolute bottom-1 inset-x-0 flex justify-center pointer-events-none z-30">
            <div className="h-1 w-32 bg-slate-400 dark:bg-slate-600 rounded-full" />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: BÁO HỎNG / SỬA CHỮA THIẾT BỊ                      */}
      {/* ========================================================= */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#00AFEF] mb-1">
              <Wrench className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Báo Hỏng & Đề Nghị Sửa Chữa
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Phòng A.402 • Tòa B. Kỹ thuật viên KTX sẽ tiếp nhận và xử lý trong 2-4 giờ làm việc.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRepair} className="space-y-3.5 py-2 text-xs">
            {/* Category */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Loại thiết bị gặp sự cố:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "dien", label: "Điện & Bóng đèn", icon: Zap },
                  { id: "nuoc", label: "Nước & Vòi sen", icon: Droplets },
                  { id: "dieu_hoa", label: "Điều hòa / Quạt", icon: AirVent },
                  { id: "khoa_cua", label: "Khóa cửa / Giường", icon: Lock },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRepairCategory(item.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all ${
                      repairCategory === item.id
                        ? "border-[#00AFEF] bg-sky-50 text-[#00AFEF] font-bold"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Mức độ khẩn cấp:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRepairPriority("binh_thuong")}
                  className={`flex-1 py-1.5 rounded-xl border text-center font-medium ${
                    repairPriority === "binh_thuong"
                      ? "border-[#1F5CA9] bg-blue-50 text-[#1F5CA9] font-bold"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Bình thường
                </button>
                <button
                  type="button"
                  onClick={() => setRepairPriority("khan_cap")}
                  className={`flex-1 py-1.5 rounded-xl border text-center font-medium ${
                    repairPriority === "khan_cap"
                      ? "border-red-500 bg-red-50 text-red-600 font-bold"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Khẩn cấp (Rò điện/nước)
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Mô tả chi tiết sự cố:
              </label>
              <Textarea
                required
                placeholder="Ví dụ: Vòi nước bồn rửa mặt bị rỉ nước liên tục, khóa cửa phòng hơi kẹt..."
                value={repairDescription}
                onChange={(e) => setRepairDescription(e.target.value)}
                className="text-xs rounded-xl border-slate-200 min-h-[70px]"
              />
            </div>

            {/* Photo Attachment Mock */}
            <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-50 flex items-center justify-center gap-2 text-slate-500 cursor-pointer hover:bg-slate-100">
              <Camera className="h-4 w-4 text-[#00AFEF]" />
              <span>Chụp ảnh hiện trường đính kèm (Tùy chọn)</span>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReportModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl text-xs font-semibold bg-[#1F5CA9] text-white hover:bg-[#1a4f91]"
              >
                Gửi Phiếu Báo Hỏng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 2: ĐĂNG KÝ TẠM VẮNG KÝ TÚC XÁ                        */}
      {/* ========================================================= */}
      <Dialog open={isAbsenceModalOpen} onOpenChange={setIsAbsenceModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <CalendarCheck className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Đăng Ký Tạm Vắng KTX
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Thông báo cho Ban Quản lý khi về quê hoặc vắng mặt qua đêm để đảm bảo an ninh.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitAbsence} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ngày bắt đầu vắng:</label>
                <Input
                  type="date"
                  value={absenceStartDate}
                  onChange={(e) => setAbsenceStartDate(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ngày dự kiến về:</label>
                <Input
                  type="date"
                  value={absenceEndDate}
                  onChange={(e) => setAbsenceEndDate(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Lý do tạm vắng:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "ve_que", label: "Về quê" },
                  { id: "thuc_tap", label: "Đi thực tập" },
                  { id: "khac", label: "Việc gia đình" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAbsenceReason(item.id)}
                    className={`py-2 rounded-xl border text-center font-medium ${
                      absenceReason === item.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Số điện thoại liên hệ Phụ huynh / Gia đình:
              </label>
              <Input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="text-xs rounded-xl font-medium"
              />
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAbsenceModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Xác Nhận Đăng Ký
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 3: NỘI QUY KTX & DANH BẠ LIÊN HỆ KHẨN CẤP           */}
      {/* ========================================================= */}
      <Dialog open={isRulesModalOpen} onOpenChange={setIsRulesModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#1F5CA9] mb-1">
              <BookOpen className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Nội Quy & Đường Dây Nóng KTX
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Ban Quản lý Ký túc xá Đại học Quốc gia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-slate-700 space-y-1">
              <span className="font-bold text-[#1F5CA9] block">1. Giờ giấc sinh hoạt & Giới nghiêm:</span>
              <div>• Giờ mở cổng KTX: <strong>05:00 sáng</strong></div>
              <div>• Giờ đóng cổng giới nghiêm: <strong>23:00 đêm</strong></div>
              <div>• Sau 23h00 phải có giấy phép và quét thẻ an ninh.</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-slate-700">
              <span className="font-bold text-slate-900 block">2. Danh bạ khẩn cấp trực 24/7:</span>
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span>Trực ban Bảo vệ Cổng A:</span>
                <a href="tel:02437547506" className="font-bold text-[#1F5CA9] flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 024.3754.7506
                </a>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span>Phòng Y tế KTX (Tầng 1 Tòa A):</span>
                <a href="tel:02437547507" className="font-bold text-emerald-600 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 024.3754.7507
                </a>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Hotline Kỹ thuật Điện Nước:</span>
                <a href="tel:02437547508" className="font-bold text-[#00AFEF] flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 024.3754.7508
                </a>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setIsRulesModalOpen(false)}
              className="w-full rounded-xl text-xs bg-[#1F5CA9] text-white"
            >
              Đã hiểu & Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 4: QUÉT MÃ QR VNPAY / VIETQR                        */}
      {/* ========================================================= */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="sm:max-w-xs rounded-3xl p-5 text-center">
          <DialogHeader className="space-y-1">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#1F5CA9] mb-1">
              <QrCode className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Thanh Toán Hóa Đơn KTX
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Mã QR động tự điền số tiền và cú pháp chuyển khoản.
            </DialogDescription>
          </DialogHeader>

          {/* QR Code Container */}
          <div className="my-2 p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col items-center">
            <div className="relative p-2 bg-white rounded-xl border border-slate-200">
              <div className="w-40 h-40 bg-slate-900 rounded-lg p-2 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="grid grid-cols-6 gap-1 w-full h-full p-2 opacity-90">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-xs ${
                        i % 2 === 0 || i % 5 === 0 ? "bg-white" : "bg-transparent"
                      }`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-9 w-9 rounded-xl bg-[#1F5CA9] text-white flex items-center justify-center text-xs font-black shadow-md border-2 border-white">
                    KTX
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 text-center">
              <span className="text-[11px] text-muted-foreground block">Số tiền cần thanh toán:</span>
              <span className="text-xl font-black text-[#1F5CA9]">345.000 đ</span>
            </div>
          </div>

          {/* Bank Transfer Details with Copy */}
          <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 text-left">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ngân hàng:</span>
              <span className="font-semibold text-slate-900">Vietcombank (VCB)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Số tài khoản:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900">1028.999.888</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("1028999888", "stk")}
                  className="text-[#1F5CA9] hover:underline"
                >
                  {copiedField === "stk" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Nội dung:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#1F5CA9]">KTX B402 TUANANH T10</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("KTX B402 TUANANH T10", "nd")}
                  className="text-[#1F5CA9] hover:underline"
                >
                  {copiedField === "nd" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Button
              onClick={() => {
                setIsQrModalOpen(false);
                showToast("Cảm ơn bạn! Ban Quản lý sẽ xác nhận hóa đơn trong 5 phút.");
              }}
              className="w-full h-9 rounded-xl text-xs font-semibold bg-[#1F5CA9] text-white hover:bg-[#1a4f91]"
            >
              Tôi đã chuyển khoản thành công
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 5: BIÊN LAI THU TIỀN ĐIỆN TỬ (E-RECEIPT)            */}
      {/* ========================================================= */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-xs rounded-3xl p-5 text-center">
          <DialogHeader>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-1">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Biên Lai Thu Tiền Điện Tử
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chứng từ xác nhận thanh toán kỳ {selectedReceiptMonth}
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Người nộp:</span>
              <span className="font-bold text-slate-900">Nguyễn Tuấn Anh (P.402)</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Số tiền:</span>
              <span className="font-bold text-emerald-600">310.000 đ</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Hình thức:</span>
              <span>Chuyển khoản QR VNPay</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái:</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> ĐÃ HẠCH TOÁN
              </span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setIsReceiptModalOpen(false);
              showToast("Đã lưu biên lai điện tử về máy!");
            }}
            className="w-full rounded-xl text-xs bg-[#1F5CA9] text-white"
          >
            Tải Biên Lai Về Máy
          </Button>
        </DialogContent>
      </Dialog>

      {/* Roommate Contact Quick Action Modal */}
      <Dialog open={isPhoneModalOpen} onOpenChange={setIsPhoneModalOpen}>
        <DialogContent className="sm:max-w-xs rounded-3xl p-5 text-center">
          {selectedRoommate && (
            <div className="space-y-3">
              <Avatar className="h-14 w-14 mx-auto border-2 border-[#1F5CA9]/30">
                <AvatarFallback className="bg-[#1F5CA9] text-white font-bold text-base">
                  {selectedRoommate.avatarText}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {selectedRoommate.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {selectedRoommate.major} • {selectedRoommate.role}
                </DialogDescription>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border text-xs text-slate-800 font-semibold flex items-center justify-between">
                <span>Số điện thoại:</span>
                <span>{selectedRoommate.phone}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  onClick={() => {
                    window.open(`tel:${selectedRoommate.phone}`);
                    setIsPhoneModalOpen(false);
                  }}
                  className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Gọi điện</span>
                </Button>
                <Button
                  onClick={() => {
                    copyToClipboard(selectedRoommate.phone, "phone");
                    setIsPhoneModalOpen(false);
                  }}
                  variant="outline"
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Sao chép SĐT</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
