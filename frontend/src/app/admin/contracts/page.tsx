"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building,
  DoorOpen,
  User,
  DollarSign,
  ArrowRight,
  RefreshCw,
  XCircle,
  Eye,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface Contract {
  id: string;
  contractNumber: string;
  studentName: string;
  studentCode: string;
  avatarText: string;
  room: string;
  building: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  monthlyRent: number;
  depositAmount: number;
  depositStatus: "paid" | "pending";
  status: "active" | "expiring_soon" | "terminated";
  roomType: string;
}

const mockContracts: Contract[] = [
  {
    id: "HD-01",
    contractNumber: "HĐ-2024-0812",
    studentName: "Nguyễn Văn An",
    studentCode: "20230101",
    avatarText: "NA",
    room: "A.301",
    building: "Tòa A",
    startDate: "01/10/2024",
    endDate: "30/06/2025",
    daysRemaining: 120,
    monthlyRent: 450000,
    depositAmount: 1000000,
    depositStatus: "paid",
    status: "active",
    roomType: "Tiêu chuẩn 4 người",
  },
  {
    id: "HD-02",
    contractNumber: "HĐ-2024-0419",
    studentName: "Trần Thị Mai",
    studentCode: "20230245",
    avatarText: "TM",
    room: "B.402",
    building: "Tòa B",
    startDate: "01/10/2024",
    endDate: "30/11/2026",
    daysRemaining: 22,
    monthlyRent: 500000,
    depositAmount: 1000000,
    depositStatus: "paid",
    status: "expiring_soon",
    roomType: "Tiêu chuẩn 4 người",
  },
  {
    id: "HD-03",
    contractNumber: "HĐ-2023-1102",
    studentName: "Lê Hoàng Long",
    studentCode: "20221980",
    avatarText: "LL",
    room: "A.205",
    building: "Tòa A",
    startDate: "15/09/2023",
    endDate: "15/07/2025",
    daysRemaining: 180,
    monthlyRent: 450000,
    depositAmount: 1000000,
    depositStatus: "paid",
    status: "active",
    roomType: "Tiêu chuẩn 4 người",
  },
  {
    id: "HD-04",
    contractNumber: "HĐ-2022-0941",
    studentName: "Phạm Hải Đăng",
    studentCode: "20215540",
    avatarText: "HĐ",
    room: "C.104",
    building: "Tòa C",
    startDate: "01/09/2022",
    endDate: "30/09/2024",
    daysRemaining: -15,
    monthlyRent: 850000,
    depositAmount: 1500000,
    depositStatus: "paid",
    status: "terminated",
    roomType: "Chất lượng cao 2 người",
  },
  {
    id: "HD-05",
    contractNumber: "HĐ-2024-0992",
    studentName: "Hoàng Ngọc Ánh",
    studentCode: "20241102",
    avatarText: "NA",
    room: "B.402",
    building: "Tòa B",
    startDate: "01/10/2024",
    endDate: "30/06/2025",
    daysRemaining: 135,
    monthlyRent: 500000,
    depositAmount: 1000000,
    depositStatus: "paid",
    status: "active",
    roomType: "Tiêu chuẩn 4 người",
  },
  {
    id: "HD-06",
    contractNumber: "HĐ-2024-0315",
    studentName: "Vũ Phương Thảo",
    studentCode: "20248831",
    avatarText: "PT",
    room: "B.208",
    building: "Tòa B",
    startDate: "01/10/2024",
    endDate: "15/11/2026",
    daysRemaining: 14,
    monthlyRent: 450000,
    depositAmount: 1000000,
    depositStatus: "paid",
    status: "expiring_soon",
    roomType: "Tiêu chuẩn 6 người",
  },
];

export default function ContractsPage() {
  const [contracts, setContracts] = React.useState<Contract[]>(mockContracts);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedBuilding, setSelectedBuilding] = React.useState("all");

  // Modals state
  const [isExtendModalOpen, setIsExtendModalOpen] = React.useState(false);
  const [extendTargetContract, setExtendTargetContract] = React.useState<Contract | null>(null);
  const [extendDurationMonths, setExtendDurationMonths] = React.useState("5");

  const [isTerminateModalOpen, setIsTerminateModalOpen] = React.useState(false);
  const [terminateTargetContract, setTerminateTargetContract] = React.useState<Contract | null>(null);
  const [damageFee, setDamageFee] = React.useState(0);
  const [terminateReason, setTerminateReason] = React.useState("Hết thời gian lưu trú / Tốt nghiệp");

  const [isPreviewModalOpen, setIsPreviewModalOpen] = React.useState(false);
  const [previewContract, setPreviewContract] = React.useState<Contract | null>(null);

  const [isNewContractModalOpen, setIsNewContractModalOpen] = React.useState(false);
  const [newContractForm, setNewContractForm] = React.useState({
    studentName: "",
    studentCode: "",
    room: "A.302",
    building: "Tòa A",
    durationMonths: "10",
    monthlyRent: 450000,
    depositAmount: 1000000,
  });

  // Filter
  const filteredContracts = React.useMemo(() => {
    return contracts.filter((c) => {
      const matchSearch =
        searchQuery === "" ||
        c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.studentCode.includes(searchQuery) ||
        c.room.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        selectedStatus === "all" || c.status === selectedStatus;

      const matchBuilding =
        selectedBuilding === "all" || c.building === selectedBuilding;

      return matchSearch && matchStatus && matchBuilding;
    });
  }, [contracts, searchQuery, selectedStatus, selectedBuilding]);

  // Handle Extend
  const handleOpenExtend = (contract: Contract) => {
    setExtendTargetContract(contract);
    setIsExtendModalOpen(true);
  };

  const handleConfirmExtend = () => {
    if (!extendTargetContract) return;
    setContracts((prev) =>
      prev.map((c) =>
        c.id === extendTargetContract.id
          ? {
              ...c,
              endDate: "30/06/2027",
              daysRemaining: c.daysRemaining + parseInt(extendDurationMonths) * 30,
              status: "active",
            }
          : c
      )
    );
    setIsExtendModalOpen(false);
  };

  // Handle Terminate
  const handleOpenTerminate = (contract: Contract) => {
    setTerminateTargetContract(contract);
    setIsTerminateModalOpen(true);
  };

  const handleConfirmTerminate = () => {
    if (!terminateTargetContract) return;
    setContracts((prev) =>
      prev.map((c) =>
        c.id === terminateTargetContract.id
          ? {
              ...c,
              status: "terminated",
              daysRemaining: 0,
            }
          : c
      )
    );
    setIsTerminateModalOpen(false);
  };

  // Handle Preview PDF
  const handleOpenPreview = (contract: Contract) => {
    setPreviewContract(contract);
    setIsPreviewModalOpen(true);
  };

  // Handle Create Contract
  const handleCreateNewContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractForm.studentName || !newContractForm.studentCode) return;

    const newEntry: Contract = {
      id: `HD-${Date.now().toString().slice(-4)}`,
      contractNumber: `HĐ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      studentName: newContractForm.studentName,
      studentCode: newContractForm.studentCode,
      avatarText: newContractForm.studentName.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase(),
      room: newContractForm.room,
      building: newContractForm.building,
      startDate: "24/10/2026",
      endDate: "30/06/2027",
      daysRemaining: 240,
      monthlyRent: newContractForm.monthlyRent,
      depositAmount: newContractForm.depositAmount,
      depositStatus: "paid",
      status: "active",
      roomType: "Tiêu chuẩn 4 người",
    };

    setContracts([newEntry, ...contracts]);
    setIsNewContractModalOpen(false);
    setNewContractForm({
      studentName: "",
      studentCode: "",
      room: "A.302",
      building: "Tòa A",
      durationMonths: "10",
      monthlyRent: 450000,
      depositAmount: 1000000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hợp Đồng Lưu Trú & Ký Quỹ
            </h1>
            <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] font-semibold border-0">
              1,840 hợp đồng
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý thời hạn lưu trú, tiền ký quỹ tài sản phòng ở và phụ lục gia hạn
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            onClick={() => alert("Đang xuất danh sách hợp đồng lưu trú ra file Excel...")}
          >
            <Download className="mr-2 h-4 w-4 text-slate-500" />
            Xuất Excel
          </Button>

          <Button
            className="bg-[#1F5CA9] text-white hover:bg-[#184988] shadow-sm font-medium"
            onClick={() => setIsNewContractModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Lập hợp đồng mới
          </Button>
        </div>
      </div>

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Đang có hiệu lực
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  1,720
                </span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  93.5%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Lưu trú đúng quy định KTX
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1F5CA9]">
              <FileCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Sắp hết hạn (Vàng cảnh báo #FFB800) */}
        <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#FFB800]" />
                Sắp hết hạn (30 ngày)
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-amber-800">
                  48
                </span>
                <span className="text-xs font-bold bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full border border-amber-200">
                  Cần nhắc gia hạn
                </span>
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1">
                Hạn chót trước ngày 30/11
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/90 text-[#B45309]">
              <Clock className="h-6 w-6 text-[#FFB800]" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Đã thanh lý */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Đã thanh lý & hoàn tất
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  72
                </span>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Kỳ trước
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Đã bàn giao phòng & hoàn cọc
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Tổng quỹ ký quỹ */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Quỹ đặt cọc cơ sở vật chất
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-[#00AFEF]">
                  1.84 tỷ
                </span>
                <span className="text-xs font-semibold text-[#00AFEF] bg-sky-50 px-2 py-0.5 rounded-full">
                  100% bảo đảm
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                1.000.000 đ/sinh viên lưu trú
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#00AFEF]">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm số hợp đồng (HĐ-2024...), tên SV, MSSV, phòng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-slate-200 bg-slate-50/50 focus-visible:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>Trạng thái:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm"
                >
                  <option value="all">Tất cả hợp đồng</option>
                  <option value="active">Đang hiệu lực (Xanh)</option>
                  <option value="expiring_soon">Sắp hết hạn trong 30 ngày (Vàng)</option>
                  <option value="terminated">Đã thanh lý</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>Tòa:</span>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm"
                >
                  <option value="all">Tất cả tòa</option>
                  <option value="Tòa A">Tòa A</option>
                  <option value="Tòa B">Tòa B</option>
                  <option value="Tòa C">Tòa C</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-slate-200">
                <TableHead className="font-semibold text-slate-700 py-3.5">
                  Số Hợp Đồng
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Sinh Viên Đại Diện
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Phòng Ở
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Thời Hạn Hiệu Lực
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Đơn Giá Thuê
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Tiền Cọc Ký Quỹ
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Trạng Thái
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 pr-6">
                  Thao Tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/70 border-slate-100">
                  {/* Mã hợp đồng */}
                  <TableCell className="py-3.5">
                    <span className="font-mono text-xs font-bold text-[#1F5CA9]">
                      {c.contractNumber}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {c.roomType}
                    </span>
                  </TableCell>

                  {/* Sinh viên */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 bg-blue-100 text-[#1F5CA9] text-xs font-bold">
                        <AvatarFallback>{c.avatarText}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {c.studentName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {c.studentCode}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Phòng */}
                  <TableCell>
                    <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] hover:bg-[#1F5CA9]/15 border-0 font-bold px-2 py-0.5">
                      {c.room}
                    </Badge>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {c.building}
                    </span>
                  </TableCell>

                  {/* Thời hạn */}
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-slate-800">
                        {c.startDate} - {c.endDate}
                      </span>
                      {c.daysRemaining > 0 ? (
                        <span className={c.daysRemaining <= 30 ? "text-[11px] font-bold text-[#B45309]" : "text-[11px] text-slate-400"}>
                          Còn {c.daysRemaining} ngày
                        </span>
                      ) : (
                        <span className="text-[11px] text-red-500 font-semibold">
                          Đã kết thúc
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Đơn giá */}
                  <TableCell>
                    <span className="text-xs font-bold text-slate-800">
                      {c.monthlyRent.toLocaleString("vi-VN")} đ
                    </span>
                    <span className="text-[10px] text-slate-400 block">/tháng/sinh viên</span>
                  </TableCell>

                  {/* Tiền cọc */}
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-800">
                      {c.depositAmount.toLocaleString("vi-VN")} đ
                    </span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-50 border-emerald-200 ml-1.5 px-1 py-0">
                      Đã ký quỹ
                    </Badge>
                  </TableCell>

                  {/* Trạng thái */}
                  <TableCell>
                    {c.status === "active" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Đang hiệu lực
                      </span>
                    ) : c.status === "expiring_soon" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#FEF3C7] px-2.5 py-1 rounded-full border border-amber-200">
                        <AlertTriangle className="h-3 w-3 text-[#FFB800]" />
                        Sắp hết hạn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                        Đã thanh lý
                      </span>
                    )}
                  </TableCell>

                  {/* Thao tác */}
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-medium text-[#1F5CA9] hover:bg-blue-50"
                        onClick={() => handleOpenPreview(c)}
                        title="Xem bản in hợp đồng"
                      >
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        Bản in
                      </Button>

                      {c.status !== "terminated" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium border-slate-200 text-[#00AFEF] hover:bg-sky-50"
                            onClick={() => handleOpenExtend(c)}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Gia hạn
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium border-slate-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleOpenTerminate(c)}
                          >
                            Thanh lý
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal Gia hạn Hợp đồng */}
      <Dialog open={isExtendModalOpen} onOpenChange={setIsExtendModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#1F5CA9]" />
              Gia Hạn Hợp Đồng Lưu Trú
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Kéo dài thời hạn lưu trú cho sinh viên vào kỳ học tiếp theo.
            </DialogDescription>
          </DialogHeader>

          {extendTargetContract && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1">
                <p>
                  Hợp đồng: <strong>{extendTargetContract.contractNumber}</strong> • Sinh viên: <strong>{extendTargetContract.studentName}</strong> ({extendTargetContract.studentCode})
                </p>
                <p className="text-slate-500">
                  Phòng: <strong className="text-[#1F5CA9]">{extendTargetContract.room}</strong> • Ngày hết hạn cũ: <strong>{extendTargetContract.endDate}</strong>
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Chọn thời gian gia hạn thêm
                </label>
                <select
                  value={extendDurationMonths}
                  onChange={(e) => setExtendDurationMonths(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
                >
                  <option value="5">Gia hạn thêm 1 học kỳ (5 tháng) — Đến 30/06/2027</option>
                  <option value="10">Gia hạn cả năm học mới (10 tháng) — Đến 31/12/2027</option>
                </select>
              </div>

              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800">
                Tiền cọc phòng 1.000.000 đ được tự động bảo lưu sang kỳ tiếp theo.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsExtendModalOpen(false)}>
              Đóng
            </Button>
            <Button size="sm" className="bg-[#1F5CA9] text-white hover:bg-[#184988]" onClick={handleConfirmExtend}>
              Xác nhận gia hạn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Thanh lý & Hoàn cọc */}
      <Dialog open={isTerminateModalOpen} onOpenChange={setIsTerminateModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-red-600" />
              Thanh Lý Hợp Đồng & Hoàn Cọc Ký Quỹ
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Kiểm tra tình trạng tài sản phòng ở trước khi hoàn trả tiền cọc cho sinh viên.
            </DialogDescription>
          </DialogHeader>

          {terminateTargetContract && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1">
                <p>
                  Sinh viên: <strong>{terminateTargetContract.studentName}</strong> ({terminateTargetContract.studentCode})
                </p>
                <p>
                  Tiền cọc ban đầu: <strong>{terminateTargetContract.depositAmount.toLocaleString("vi-VN")} đ</strong>
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Khấu trừ hư hao tài sản phòng (nếu có)
                </label>
                <Input
                  type="number"
                  value={damageFee}
                  onChange={(e) => setDamageFee(Number(e.target.value))}
                  placeholder="0 đ"
                  className="text-xs"
                />
              </div>

              <div className="rounded-lg bg-sky-50 p-3 border border-sky-200 text-xs flex items-center justify-between">
                <span className="text-slate-600 font-medium">Số tiền hoàn lại cho SV:</span>
                <span className="text-base font-extrabold text-[#1F5CA9]">
                  {(terminateTargetContract.depositAmount - damageFee).toLocaleString("vi-VN")} đ
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsTerminateModalOpen(false)}>
              Hủy
            </Button>
            <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={handleConfirmTerminate}>
              Xác nhận thanh lý & Hoàn cọc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Bản In PDF Hợp Đồng KTX */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Mẫu Hợp Đồng Thuê Chỗ Ở KTX Chuẩn</span>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5 mr-1" />
                In hợp đồng
              </Button>
            </DialogTitle>
          </DialogHeader>

          {previewContract && (
            <div className="p-6 bg-white border border-slate-200 rounded-lg text-slate-800 space-y-4 font-serif text-xs leading-relaxed">
              <div className="text-center space-y-1">
                <p className="font-bold uppercase tracking-wider text-[11px]">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </p>
                <p className="italic text-[10px]">Độc lập - Tự do - Hạnh phúc</p>
                <div className="w-24 h-[1px] bg-slate-400 mx-auto my-1" />
                <h3 className="font-bold text-sm uppercase pt-2 text-[#1F5CA9]">
                  HỢP ĐỒNG THUÊ CHỖ Ở KÝ TÚC XÁ
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">
                  Số: {previewContract.contractNumber}
                </p>
              </div>

              <div className="space-y-1 pt-2">
                <p className="font-bold">BÊN A (BÊN CHO THUÊ): BAN QUẢN LÝ KÝ TÚC XÁ THÔNG MINH</p>
                <p>Đại diện: TS. Trần Quang Huy — Trưởng Ban Quản lý</p>
                <p>Địa chỉ: Khu Ký túc xá Đại học, Tòa nhà Điều hành</p>
              </div>

              <div className="space-y-1">
                <p className="font-bold">BÊN B (BÊN THUÊ CHỖ Ở):</p>
                <p>Họ và tên sinh viên: <strong>{previewContract.studentName}</strong></p>
                <p>Mã số sinh viên (MSSV): <strong>{previewContract.studentCode}</strong></p>
                <p>Phòng bố trí: <strong>{previewContract.room}</strong> ({previewContract.building})</p>
                <p>Thời hạn hợp đồng: Từ ngày <strong>{previewContract.startDate}</strong> đến hết ngày <strong>{previewContract.endDate}</strong></p>
                <p>Tiền phòng hàng tháng: <strong>{previewContract.monthlyRent.toLocaleString("vi-VN")} đ/tháng</strong></p>
                <p>Tiền ký quỹ cơ sở vật chất: <strong>{previewContract.depositAmount.toLocaleString("vi-VN")} đ</strong></p>
              </div>

              <div className="pt-2 space-y-1">
                <p className="font-bold">ĐIỀU KHOẢN CHUNG:</p>
                <p>1. Bên B có trách nhiệm bảo quản tốt toàn bộ cơ sở vật chất, trang thiết bị trong phòng ở.</p>
                <p>2. Chấp hành nghiêm chỉnh nội quy giờ giới nghiêm KTX (23:00 - 05:00) và quy định phòng cháy chữa cháy.</p>
                <p>3. Thanh toán đầy đủ tiền phòng, tiền điện, tiền nước trước ngày 15 hàng tháng qua hệ thống VNPay / VietQR.</p>
              </div>

              <div className="grid grid-cols-2 pt-6 text-center text-xs">
                <div>
                  <p className="font-bold">ĐẠI DIỆN BÊN A</p>
                  <p className="text-[10px] text-slate-400 italic">(Ký và đóng dấu điện tử)</p>
                  <div className="mt-8 font-semibold text-[#1F5CA9]">TS. Trần Quang Huy</div>
                </div>
                <div>
                  <p className="font-bold">ĐẠI DIỆN BÊN B</p>
                  <p className="text-[10px] text-slate-400 italic">(Ký xác nhận)</p>
                  <div className="mt-8 font-semibold">{previewContract.studentName}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Lập Hợp Đồng Mới */}
      <Dialog open={isNewContractModalOpen} onOpenChange={setIsNewContractModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#1F5CA9]" />
              Lập Hợp Đồng Lưu Trú Mới
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ký kết hợp đồng lưu trú cho sinh viên mới vào KTX.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewContract} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Họ và tên sinh viên <span className="text-red-500">*</span>
              </label>
              <Input
                required
                placeholder="VD: Nguyễn Thành Nam"
                value={newContractForm.studentName}
                onChange={(e) => setNewContractForm({ ...newContractForm, studentName: e.target.value })}
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mã số sinh viên (MSSV) <span className="text-red-500">*</span>
              </label>
              <Input
                required
                placeholder="VD: 20241999"
                value={newContractForm.studentCode}
                onChange={(e) => setNewContractForm({ ...newContractForm, studentCode: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tòa nhà
                </label>
                <select
                  value={newContractForm.building}
                  onChange={(e) => setNewContractForm({ ...newContractForm, building: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="Tòa A">Tòa A</option>
                  <option value="Tòa B">Tòa B</option>
                  <option value="Tòa C">Tòa C CLC</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Phòng ở
                </label>
                <Input
                  value={newContractForm.room}
                  onChange={(e) => setNewContractForm({ ...newContractForm, room: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tiền phòng / tháng (VNĐ)
                </label>
                <Input
                  type="number"
                  value={newContractForm.monthlyRent}
                  onChange={(e) => setNewContractForm({ ...newContractForm, monthlyRent: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tiền ký quỹ cọc (VNĐ)
                </label>
                <Input
                  type="number"
                  value={newContractForm.depositAmount}
                  onChange={(e) => setNewContractForm({ ...newContractForm, depositAmount: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewContractModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button type="submit" size="sm" className="bg-[#1F5CA9] text-white hover:bg-[#184988]">
                Ký & Lưu Hợp Đồng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
