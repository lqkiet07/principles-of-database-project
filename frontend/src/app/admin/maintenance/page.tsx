"use client";

import * as React from "react";
import Link from "next/link";
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  UserCheck,
  DoorOpen,
  Zap,
  Droplets,
  AirVent,
  SlidersHorizontal,
  ChevronRight,
  Phone,
  Eye,
  Camera,
  Layers,
  List,
  Sparkles,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Ticket {
  id: string;
  code: string;
  room: string;
  building: string;
  studentName: string;
  studentPhone: string;
  category: "Điện" | "Nước" | "Điều hòa" | "Cơ sở vật chất";
  device: string;
  description: string;
  priority: "Khẩn cấp" | "Bình thường";
  status: "pending" | "in_progress" | "review" | "completed";
  createdAt: string;
  technician?: string;
  cost?: number;
}

const mockTickets: Ticket[] = [
  {
    id: "T-01",
    code: "BH-2026-081",
    room: "B.402",
    building: "Tòa B",
    studentName: "Trần Thị Mai",
    studentPhone: "0987.654.321",
    category: "Điều hòa",
    device: "Điều hòa Daikin 12.000 BTU",
    description: "Điều hòa bị rò rỉ nước nhiều ở dàn lạnh nhỏ xuống bàn học của sinh viên.",
    priority: "Khẩn cấp",
    status: "pending",
    createdAt: "24/10/2026 08:30",
  },
  {
    id: "T-02",
    code: "BH-2026-079",
    room: "A.301",
    building: "Tòa A",
    studentName: "Nguyễn Văn An",
    studentPhone: "0912.345.678",
    category: "Điện",
    device: "Bóng đèn LED tuýp 1.2m",
    description: "Bóng đèn bàn học nhấp nháy liên tục không sáng được.",
    priority: "Bình thường",
    status: "in_progress",
    createdAt: "23/10/2026 14:15",
    technician: "Nguyễn Văn Hùng (Thợ điện)",
  },
  {
    id: "T-03",
    code: "BH-2026-077",
    room: "A.205",
    building: "Tòa A",
    studentName: "Lê Hoàng Long",
    studentPhone: "0971.223.344",
    category: "Nước",
    device: "Vòi sen tắm & Vòi xịt WC",
    description: "Vòi sen bị nứt gioăng cao su, rỉ nước cả ngày gây lãng phí nước sạch.",
    priority: "Khẩn cấp",
    status: "pending",
    createdAt: "24/10/2026 09:10",
  },
  {
    id: "T-04",
    code: "BH-2026-072",
    room: "C.104",
    building: "Tòa C",
    studentName: "Phạm Hải Đăng",
    studentPhone: "0904.556.778",
    category: "Cơ sở vật chất",
    device: "Bản lề cánh cửa sổ nhôm kính",
    description: "Cửa sổ bị kẹt bản lề khó khép kín khi trời mưa gió.",
    priority: "Bình thường",
    status: "review",
    createdAt: "22/10/2026 10:00",
    technician: "Trần Đình Nam (Thợ nhôm kính)",
    cost: 50000,
  },
  {
    id: "T-05",
    code: "BH-2026-065",
    room: "B.208",
    building: "Tòa B",
    studentName: "Vũ Phương Thảo",
    studentPhone: "0982.113.355",
    category: "Điện",
    device: "Aptomat tổng 32A",
    description: "Bật bình nóng lạnh thì Aptomat bị nhảy tự ngắt điện.",
    priority: "Khẩn cấp",
    status: "completed",
    createdAt: "21/10/2026 16:45",
    technician: "Nguyễn Văn Hùng (Thợ điện)",
    cost: 120000,
  },
];

export default function MaintenancePage() {
  const [tickets, setTickets] = React.useState<Ticket[]>(mockTickets);
  const [viewMode, setViewMode] = React.useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");

  // Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [assignTargetTicket, setAssignTargetTicket] = React.useState<Ticket | null>(null);
  const [selectedTech, setSelectedTech] = React.useState("Nguyễn Văn Hùng (Kỹ thuật điện nước)");

  // Complete / Settle Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = React.useState(false);
  const [completeTargetTicket, setCompleteTargetTicket] = React.useState<Ticket | null>(null);
  const [settledCost, setSettledCost] = React.useState(120000);

  // Detail Modal
  const [selectedTicketDetail, setSelectedTicketDetail] = React.useState<Ticket | null>(null);

  // Filter
  const filteredTickets = React.useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        searchQuery === "" ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.device.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === "all" || t.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [tickets, searchQuery, selectedCategory]);

  // Open Assign
  const handleOpenAssign = (ticket: Ticket) => {
    setAssignTargetTicket(ticket);
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = () => {
    if (!assignTargetTicket) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === assignTargetTicket.id
          ? { ...t, status: "in_progress", technician: selectedTech }
          : t
      )
    );
    setIsAssignModalOpen(false);
  };

  // Open Complete
  const handleOpenComplete = (ticket: Ticket) => {
    setCompleteTargetTicket(ticket);
    setIsCompleteModalOpen(true);
  };

  const handleConfirmComplete = () => {
    if (!completeTargetTicket) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === completeTargetTicket.id
          ? { ...t, status: "completed", cost: settledCost }
          : t
      )
    );
    setIsCompleteModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Báo Hỏng & Sửa Chữa Kỹ Thuật
            </h1>
            <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] font-semibold border-0">
              8 yêu cầu mới
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tiếp nhận sự cố điện nước, phân công kỹ thuật viên và kiểm soát vật tư thay thế
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View toggle button */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === "kanban"
                  ? "bg-white text-[#1F5CA9] shadow-xs dark:bg-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Bảng Kanban
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-white text-[#1F5CA9] shadow-xs dark:bg-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Danh sách
            </button>
          </div>

          <Button
            className="bg-[#1F5CA9] text-white hover:bg-[#184988] shadow-sm font-medium"
            onClick={() => {
              const newTicket: Ticket = {
                id: `T-${Date.now().toString().slice(-4)}`,
                code: `BH-2026-${Math.floor(100 + Math.random() * 900)}`,
                room: "B.304",
                building: "Tòa B",
                studentName: "Đỗ Mai Linh",
                studentPhone: "0915.222.888",
                category: "Nước",
                device: "Vòi nước chậu rửa mặt",
                description: "Vòi bị rỉ nước liên tục dưới gầm chậu.",
                priority: "Bình thường",
                status: "pending",
                createdAt: "Vừa xong",
              };
              setTickets([newTicket, ...tickets]);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tạo phiếu sửa chữa
          </Button>
        </div>
      </div>

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Chờ tiếp nhận (Vàng #FFB800) */}
        <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#FFB800]" />
                Chờ tiếp nhận
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-amber-800">8</span>
                <span className="text-xs font-bold bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full border border-amber-200">
                  Cần phân công
                </span>
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1">
                Từ ứng dụng sinh viên iPhone 16
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-[#B45309]">
              <AlertTriangle className="h-6 w-6 text-[#FFB800]" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Đang xử lý */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Đang sửa chữa tại phòng
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-[#1F5CA9]">14</span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  3 kỹ thuật viên
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Đang trực tiếp khắc phục tại tòa
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1F5CA9]">
              <Wrench className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Khẩn cấp */}
        <Card className="border-red-200 shadow-sm bg-gradient-to-br from-white to-red-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
                Sự cố hỏa tốc khẩn cấp
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-red-600">3</span>
                <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Ưu tiên số 1
                </span>
              </div>
              <p className="text-[11px] text-red-600/80 mt-1">
                Chập điện & rò rỉ nước áp lực
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Zap className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Hoàn thành */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Đã xử lý xong (Tháng 10)
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-emerald-600">86</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  96.2% hài lòng
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Thời gian trung bình 2.5 giờ
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Row */}
      <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm mã phiếu (BH-...), phòng, tên sinh viên, thiết bị..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-slate-200 bg-slate-50/50 focus-visible:bg-white"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-500 font-medium">Hạng mục:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm"
              >
                <option value="all">Tất cả hạng mục</option>
                <option value="Điện">Hệ thống Điện</option>
                <option value="Nước">Nước & Thiết bị vệ sinh</option>
                <option value="Điều hòa">Điều hòa / Làm mát</option>
                <option value="Cơ sở vật chất">Cơ sở vật chất / Cửa sổ</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board View */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Cột 1: Chờ tiếp nhận */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/20 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFB800]" />
                <h3 className="text-sm font-bold text-slate-900">Chờ tiếp nhận</h3>
              </div>
              <Badge className="bg-[#FEF3C7] text-[#B45309] font-bold border-amber-300">
                {filteredTickets.filter((t) => t.status === "pending").length}
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredTickets
                .filter((t) => t.status === "pending")
                .map((ticket) => (
                  <Card key={ticket.id} className="border-slate-200 shadow-xs hover:shadow-md transition-shadow bg-white">
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono font-bold text-[#1F5CA9]">
                          {ticket.code}
                        </span>
                        {ticket.priority === "Khẩn cấp" ? (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold">
                            Hỏa tốc
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-500">
                            Thường
                          </Badge>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <DoorOpen className="h-3.5 w-3.5 text-[#1F5CA9]" />
                          Phòng {ticket.room} ({ticket.building})
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1">
                          {ticket.device}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                        <span>{ticket.studentName}</span>
                        <span>{ticket.createdAt.split(" ")[1]}</span>
                      </div>

                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-[#1F5CA9] text-white hover:bg-[#184988] mt-1"
                        onClick={() => handleOpenAssign(ticket)}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        Phân công thợ
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Cột 2: Đang sửa chữa */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/20 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#00AFEF]" />
                <h3 className="text-sm font-bold text-slate-900">Đang sửa chữa</h3>
              </div>
              <Badge className="bg-sky-100 text-sky-800 font-bold border-sky-300">
                {filteredTickets.filter((t) => t.status === "in_progress" || t.status === "review").length}
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredTickets
                .filter((t) => t.status === "in_progress" || t.status === "review")
                .map((ticket) => (
                  <Card key={ticket.id} className="border-slate-200 shadow-xs hover:shadow-md transition-shadow bg-white">
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono font-bold text-[#1F5CA9]">
                          {ticket.code}
                        </span>
                        <Badge className="bg-sky-50 text-[#00AFEF] border-sky-200 text-[10px]">
                          Đang làm
                        </Badge>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <DoorOpen className="h-3.5 w-3.5 text-[#1F5CA9]" />
                          Phòng {ticket.room} ({ticket.building})
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1">
                          {ticket.device}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 flex items-center justify-between border border-slate-100">
                        <span className="font-medium text-[#1F5CA9]">Kỹ thuật phụ trách:</span>
                        <span className="font-bold">{ticket.technician?.split(" ")[0]} {ticket.technician?.split(" ")[1]}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
                        onClick={() => handleOpenComplete(ticket)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                        Nghiệm thu & Chốt phí
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Cột 3: Hoàn tất */}
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900">Đã hoàn thành</h3>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 font-bold border-emerald-300">
                {filteredTickets.filter((t) => t.status === "completed").length}
              </Badge>
            </div>

            <div className="space-y-3">
              {filteredTickets
                .filter((t) => t.status === "completed")
                .map((ticket) => (
                  <Card key={ticket.id} className="border-slate-200 shadow-xs bg-white opacity-90">
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {ticket.code}
                        </span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          Đã xong
                        </Badge>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                          Phòng {ticket.room} • {ticket.device}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          KTV: {ticket.technician}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-400">Chi phí vật tư:</span>
                        <span className="font-bold text-[#1F5CA9]">
                          {ticket.cost ? ticket.cost.toLocaleString("vi-VN") + " đ" : "Miễn phí"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        </div>
      ) : (
        /* Table View */
        <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-slate-200">
                <TableHead className="font-semibold text-slate-700 py-3.5">Mã Phiếu</TableHead>
                <TableHead className="font-semibold text-slate-700">Phòng & Tòa</TableHead>
                <TableHead className="font-semibold text-slate-700">Hạng Mục & Thiết Bị</TableHead>
                <TableHead className="font-semibold text-slate-700">Mô Tả Sự Cố</TableHead>
                <TableHead className="font-semibold text-slate-700">Sinh Viên Báo</TableHead>
                <TableHead className="font-semibold text-slate-700">Kỹ Thuật Phụ Trách</TableHead>
                <TableHead className="font-semibold text-slate-700">Trạng Thái</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 pr-6">Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/70 border-slate-100 text-xs">
                  <TableCell className="font-mono font-bold text-[#1F5CA9] py-3.5">
                    {t.code}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {t.room} ({t.building})
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800">{t.device}</span>
                    <Badge variant="outline" className="text-[10px] ml-1.5 px-1 py-0 text-slate-500">
                      {t.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-slate-600">
                    {t.description}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-800 block">{t.studentName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{t.studentPhone}</span>
                  </TableCell>
                  <TableCell>
                    {t.technician ? (
                      <span className="font-medium text-slate-800">{t.technician}</span>
                    ) : (
                      <span className="text-slate-400 italic">Chưa phân công</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full border border-amber-200">
                        Chờ tiếp nhận
                      </span>
                    ) : t.status === "in_progress" || t.status === "review" ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                        Đang sửa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Hoàn thành
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {t.status === "pending" ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-[#1F5CA9] text-white"
                        onClick={() => handleOpenAssign(t)}
                      >
                        Phân công
                      </Button>
                    ) : t.status !== "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-300 text-emerald-700"
                        onClick={() => handleOpenComplete(t)}
                      >
                        Nghiệm thu
                      </Button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Đã chốt</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal Phân Công Kỹ Thuật Viên */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[#1F5CA9]" />
              Phân Công Thợ Kỹ Thuật
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Chỉ định kỹ thuật viên kiểm tra và sửa chữa tại phòng ở.
            </DialogDescription>
          </DialogHeader>

          {assignTargetTicket && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1">
                <p>
                  Mã phiếu: <strong>{assignTargetTicket.code}</strong> • Phòng: <strong className="text-[#1F5CA9]">{assignTargetTicket.room}</strong>
                </p>
                <p>
                  Sự cố: <strong>{assignTargetTicket.device}</strong> ({assignTargetTicket.description})
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Chọn kỹ thuật viên phụ trách
                </label>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                >
                  <option value="Nguyễn Văn Hùng (Kỹ thuật điện nước)">Nguyễn Văn Hùng (Điện nước — Đang rảnh)</option>
                  <option value="Trần Đình Nam (Kỹ thuật điện lạnh/điều hòa)">Trần Đình Nam (Điều hòa Daikin/Panasonic)</option>
                  <option value="Lê Văn Toàn (Cơ khí & Cửa kính)">Lê Văn Toàn (Khóa cửa, giường tủ)</option>
                </select>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 border border-blue-100 text-xs text-[#1F5CA9]">
                ✓ Hệ thống sẽ tự động gửi thông báo SMS và App tới sinh viên <strong>{assignTargetTicket.studentName}</strong> để sinh viên sắp xếp mở cửa phòng.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              Đóng
            </Button>
            <Button size="sm" className="bg-[#1F5CA9] text-white hover:bg-[#184988]" onClick={handleConfirmAssign}>
              Xác nhận phân công
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nghiệm Thu & Chốt Phí */}
      <Dialog open={isCompleteModalOpen} onOpenChange={setIsCompleteModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Nghiệm Thu & Hoàn Tất Phiếu Sửa Chữa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Xác nhận thiết bị đã được sửa chữa hoạt động tốt và quyết toán phụ tùng.
            </DialogDescription>
          </DialogHeader>

          {completeTargetTicket && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1">
                <p>
                  Phiếu: <strong>{completeTargetTicket.code}</strong> • Phòng: <strong className="text-[#1F5CA9]">{completeTargetTicket.room}</strong>
                </p>
                <p>
                  Thiết bị: <strong>{completeTargetTicket.device}</strong>
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Chi phí vật tư thay thế (VNĐ)
                </label>
                <Input
                  type="number"
                  value={settledCost}
                  onChange={(e) => setSettledCost(Number(e.target.value))}
                  placeholder="0 đ nếu được bảo hành KTX miễn phí"
                  className="text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Nhập 0 đ nếu thuộc diện KTX bảo dưỡng định kỳ miễn phí
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCompleteModalOpen(false)}>
              Đóng
            </Button>
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleConfirmComplete}>
              Nghiệm thu hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
