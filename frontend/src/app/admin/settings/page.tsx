"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  Zap,
  Droplets,
  Clock,
  CreditCard,
  ShieldCheck,
  Save,
  CheckCircle2,
  Lock,
  QrCode,
  Building,
  Bell,
  Users,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useDemoMode } from "@/lib/demo-context";
import { GraduationCap, ArrowUpRight } from "lucide-react";

export default function SettingsPage() {
  const { isDemoMode, setDemoMode, toggleDemoMode } = useDemoMode();

  // Utility rates state
  const [electricityRate, setElectricityRate] = React.useState(3000);
  const [waterRate, setWaterRate] = React.useState(12000);
  const [cleaningFee, setCleaningFee] = React.useState(100000);
  const [cutoffDay, setCutoffDay] = React.useState(25);
  const [dueDay, setDueDay] = React.useState(15);

  // Security & Curfew state
  const [curfewStart, setCurfewStart] = React.useState("23:00");
  const [curfewEnd, setCurfewEnd] = React.useState("05:00");
  const [autoRecordViolation, setAutoRecordViolation] = React.useState(true);
  const [maxViolations, setMaxViolations] = React.useState(3);

  // Bank & VietQR state
  const [bankName, setBankName] = React.useState("VietinBank (Ngân hàng TMCP Công Thương Việt Nam)");
  const [accountNumber, setAccountNumber] = React.useState("1028-8921-6868");
  const [accountHolder, setAccountHolder] = React.useState("BAN QUAN LY KY TUC XA DAI HOC");
  const [paymentSyntax, setPaymentSyntax] = React.useState("KTX {MSSV} {ROOM} T{MONTH}");
  const [autoSettleWebhook, setAutoSettleWebhook] = React.useState(true);

  // Saved notification toast
  const [isSaved, setIsSaved] = React.useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Cài Đặt & Cấu Hình Hệ Thống KTX
            </h1>
            <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] font-semibold border-0">
              Quản trị viên
            </Badge>
            {isDemoMode && (
              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-[#FFB800]" />
                Demo Mode Đang Bật
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Thiết lập đơn giá điện nước, cấu hình tự động thanh toán VietQR và giờ giới nghiêm
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          className="bg-[#1F5CA9] text-white hover:bg-[#184988] shadow-sm font-semibold"
        >
          <Save className="mr-2 h-4 w-4" />
          Lưu tất cả thay đổi
        </Button>
      </div>

      {isSaved && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Toàn bộ cài đặt hệ thống KTX đã được lưu thành công và áp dụng cho toàn bộ dữ liệu!</span>
        </div>
      )}

      {/* Special Evaluator Demo Mode Card */}
      <div className="rounded-2xl border-2 border-dashed border-[#1F5CA9]/30 bg-gradient-to-r from-blue-50/80 via-white to-sky-50/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F5CA9] text-white shadow-xs">
                <GraduationCap className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Chế Độ Giảng Viên Chấm Thi (CT221H Evaluator Demo Mode)
              </h2>
              <Badge variant="outline" className="text-[11px] font-mono border-blue-200 text-[#1F5CA9] bg-white">
                Barem CT221H
              </Badge>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Ứng dụng mặc định hoạt động như một hệ sinh thái thương mại thực tế dành cho người dùng cuối. 
              <strong> Khi bật công tắc này</strong>, hệ thống sẽ mở khóa mục <strong>Demo Checkpoints</strong> trên thanh điều hướng và kích hoạt các nút bấm giả lập kịch bản CSDL (Khóa dòng ACID chống Click đúp, Rollback thiếu tiền, Bẫy số điện lùi, Benchmark 1 triệu log).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-700">
                {isDemoMode ? "ĐANG BẬT" : "ĐANG TẮT"}
              </span>
              <button
                type="button"
                onClick={toggleDemoMode}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDemoMode ? "bg-[#1F5CA9]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isDemoMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {isDemoMode && (
              <Link href="/admin/demo-checkpoints">
                <Button size="sm" className="bg-[#1F5CA9] text-white hover:bg-[#184988] text-xs h-9 shadow-xs">
                  Mở Demo Checkpoints
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs defaultValue="utilities" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto grid grid-cols-3">
          <TabsTrigger
            value="utilities"
            className="data-[state=active]:bg-white data-[state=active]:text-[#1F5CA9] data-[state=active]:shadow-xs text-xs font-bold py-2"
          >
            <Zap className="h-4 w-4 mr-1.5" />
            Đơn giá Điện & Nước
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-white data-[state=active]:text-[#1F5CA9] data-[state=active]:shadow-xs text-xs font-bold py-2"
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Giới Nghiêm & An Ninh
          </TabsTrigger>
          <TabsTrigger
            value="banking"
            className="data-[state=active]:bg-white data-[state=active]:text-[#1F5CA9] data-[state=active]:shadow-xs text-xs font-bold py-2"
          >
            <QrCode className="h-4 w-4 mr-1.5" />
            VietQR & Ngân Hàng
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Đơn giá Điện Nước */}
        <TabsContent value="utilities" className="space-y-4">
          <Card className="border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#1F5CA9]" />
                Biểu Phí Điện, Nước & Dịch Vụ Nội Trú
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Đơn giá được áp dụng tự động vào bảng tính hóa đơn hàng tháng cho toàn bộ 480 phòng KTX.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Đơn giá điện */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Đơn giá điện sinh hoạt
                    </span>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                      VNĐ / kWh
                    </Badge>
                  </div>
                  <Input
                    type="number"
                    value={electricityRate}
                    onChange={(e) => setElectricityRate(Number(e.target.value))}
                    className="h-10 text-sm font-bold text-[#1F5CA9] bg-white border-slate-200"
                  />
                  <p className="text-[11px] text-slate-500">
                    Theo quyết định giá điện nội trú ưu đãi của Bộ Công Thương.
                  </p>
                </div>

                {/* Đơn giá nước */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Droplets className="h-4 w-4 text-[#00AFEF]" />
                      Đơn giá nước sạch
                    </span>
                    <Badge className="bg-sky-100 text-[#00AFEF] border-sky-200 text-[10px]">
                      VNĐ / m³
                    </Badge>
                  </div>
                  <Input
                    type="number"
                    value={waterRate}
                    onChange={(e) => setWaterRate(Number(e.target.value))}
                    className="h-10 text-sm font-bold text-[#00AFEF] bg-white border-slate-200"
                  />
                  <p className="text-[11px] text-slate-500">
                    Bao gồm thuế VAT và phí bảo vệ môi trường thoát nước thải.
                  </p>
                </div>

                {/* Phí vệ sinh & Internet */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-[#1F5CA9]" />
                      Phí vệ sinh & Mạng WiFi
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      VNĐ / phòng / tháng
                    </Badge>
                  </div>
                  <Input
                    type="number"
                    value={cleaningFee}
                    onChange={(e) => setCleaningFee(Number(e.target.value))}
                    className="h-10 text-sm font-bold text-slate-800 bg-white border-slate-200"
                  />
                  <p className="text-[11px] text-slate-500">
                    Thu gom rác hành lang hàng ngày và đường truyền cáp quang tốc độ cao.
                  </p>
                </div>

                {/* Ngày chốt & Hạn nộp */}
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-purple-600" />
                      Chu kỳ chốt số & Hạn thanh toán
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Ngày chốt số đồng hồ:</span>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={cutoffDay}
                        onChange={(e) => setCutoffDay(Number(e.target.value))}
                        className="h-9 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Hạn nộp tiền (tháng sau):</span>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={dueDay}
                        onChange={(e) => setDueDay(Number(e.target.value))}
                        className="h-9 text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Quá ngày {dueDay} sẽ tự động kích hoạt trạng thái cảnh báo nợ phí (Vàng).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Giới Nghiêm & An Ninh */}
        <TabsContent value="security" className="space-y-4">
          <Card className="border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#1F5CA9]" />
                Khung Giờ Giới Nghiêm & Quy Chế An Ninh Thẻ KTX
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Hệ thống kiểm soát cổng tự động nhận diện thời gian quẹt thẻ của 1,840 sinh viên.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800 block">
                    Giờ đóng cổng giới nghiêm ban đêm
                  </span>
                  <Input
                    type="time"
                    value={curfewStart}
                    onChange={(e) => setCurfewStart(e.target.value)}
                    className="h-10 text-sm font-bold text-red-600 bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Sinh viên vào KTX sau {curfewStart} bắt buộc phải có giấy phép tạm vắng hoặc bảo vệ ghi nhận vi phạm.
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800 block">
                    Giờ mở cổng đón sinh viên buổi sáng
                  </span>
                  <Input
                    type="time"
                    value={curfewEnd}
                    onChange={(e) => setCurfewEnd(e.target.value)}
                    className="h-10 text-sm font-bold text-emerald-600 bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Hệ thống Barrier tự động mở cho sinh viên chạy bộ, tập thể dục buổi sáng.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-[#FFB800]" />
                      Tự động ghi nhận biên bản vi phạm vào hồ sơ sinh viên
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Nếu quẹt thẻ vào cổng sau {curfewStart} mà không đăng ký tạm vắng trước trên ứng dụng iPhone.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRecordViolation}
                    onChange={(e) => setAutoRecordViolation(e.target.checked)}
                    className="h-5 w-5 rounded text-[#1F5CA9] focus:ring-[#1F5CA9]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: VietQR & Ngân Hàng */}
        <TabsContent value="banking" className="space-y-4">
          <Card className="border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#1F5CA9]" />
                Tài Khoản Thụ Hưởng VietQR & Cổng Thanh Toán
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Cấu hình tài khoản ngân hàng hiển thị trên mã QR động trong ứng dụng iPhone sinh viên.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Ngân hàng thụ hưởng liên kết
                  </label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="text-xs font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Số tài khoản chuyên thu KTX
                  </label>
                  <Input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="text-xs font-mono font-bold text-[#1F5CA9]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Tên chủ tài khoản đơn vị
                  </label>
                  <Input
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="text-xs font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Cấu trúc nội dung chuyển khoản tự động
                  </label>
                  <Input
                    value={paymentSyntax}
                    onChange={(e) => setPaymentSyntax(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    Hệ thống Webhook tự động giải mã MSSV và Tháng để gạch nợ tức thì 24/7.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#1F5CA9] flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#00AFEF]" />
                    Tự động gạch nợ ngay khi tiền nổi vào tài khoản (Instant Reconciliation)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sinh viên quét mã VietQR trên điện thoại, hóa đơn chuyển sang &quot;Đã thanh toán&quot; sau 2 giây.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSettleWebhook}
                  onChange={(e) => setAutoSettleWebhook(e.target.checked)}
                  className="h-5 w-5 rounded text-[#1F5CA9] focus:ring-[#1F5CA9]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
