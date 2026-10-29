"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Phone,
  Mail,
  DoorOpen,
  Building,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  Lock,
  Unlock,
  Eye,
  FileText,
  Calendar,
  X,
  Plus,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Student {
  id: string;
  name: string;
  studentCode: string;
  avatarText: string;
  gender: "Nam" | "Nữ";
  faculty: string;
  cohort: string;
  building: string;
  room: string;
  bed: string;
  phone: string;
  email: string;
  idCard: string;
  hometown: string;
  priorityCategory: "Bình thường" | "Hộ nghèo" | "Con thương binh" | "Dân tộc";
  feeStatus: "paid" | "unpaid" | "overdue";
  feeAmount: number;
  disciplineStatus: "clean" | "warned";
  checkInDate: string;
  cardActive: boolean;
  rfidCard: string;
}

const mockStudents: Student[] = [
  {
    id: "SV-01",
    name: "Nguyễn Văn An",
    studentCode: "20230101",
    avatarText: "NA",
    gender: "Nam",
    faculty: "Công nghệ thông tin",
    cohort: "K68",
    building: "Tòa A",
    room: "A.301",
    bed: "A1",
    phone: "0912.345.678",
    email: "an.nv230101@sis.hust.edu.vn",
    idCard: "001204018293",
    hometown: "Bắc Ninh",
    priorityCategory: "Bình thường",
    feeStatus: "paid",
    feeAmount: 0,
    disciplineStatus: "clean",
    checkInDate: "15/09/2024",
    cardActive: true,
    rfidCard: "RFID-8829-4410",
  },
  {
    id: "SV-02",
    name: "Trần Thị Mai",
    studentCode: "20230245",
    avatarText: "TM",
    gender: "Nữ",
    faculty: "Kinh tế & Quản lý",
    cohort: "K68",
    building: "Tòa B",
    room: "B.402",
    bed: "B1",
    phone: "0987.654.321",
    email: "mai.tt230245@sis.hust.edu.vn",
    idCard: "024203009412",
    hometown: "Hà Nam",
    priorityCategory: "Hộ nghèo",
    feeStatus: "unpaid",
    feeAmount: 345000,
    disciplineStatus: "clean",
    checkInDate: "01/10/2024",
    cardActive: true,
    rfidCard: "RFID-9902-1234",
  },
  {
    id: "SV-03",
    name: "Lê Hoàng Long",
    studentCode: "20221980",
    avatarText: "LL",
    gender: "Nam",
    faculty: "Điện tử viễn thông",
    cohort: "K67",
    building: "Tòa A",
    room: "A.205",
    bed: "A2",
    phone: "0971.223.344",
    email: "long.lh221980@sis.hust.edu.vn",
    idCard: "019202008741",
    hometown: "Thanh Hóa",
    priorityCategory: "Bình thường",
    feeStatus: "paid",
    feeAmount: 0,
    disciplineStatus: "clean",
    checkInDate: "20/09/2023",
    cardActive: true,
    rfidCard: "RFID-4421-9876",
  },
  {
    id: "SV-04",
    name: "Phạm Hải Đăng",
    studentCode: "20215540",
    avatarText: "HĐ",
    gender: "Nam",
    faculty: "Cơ khí chế tạo máy",
    cohort: "K66",
    building: "Tòa C",
    room: "C.104",
    bed: "C1",
    phone: "0904.556.778",
    email: "dang.ph215540@sis.hust.edu.vn",
    idCard: "031201004523",
    hometown: "Hải Phòng",
    priorityCategory: "Con thương binh",
    feeStatus: "overdue",
    feeAmount: 850000,
    disciplineStatus: "warned",
    checkInDate: "10/09/2022",
    cardActive: false,
    rfidCard: "RFID-1002-3349",
  },
  {
    id: "SV-05",
    name: "Hoàng Ngọc Ánh",
    studentCode: "20241102",
    avatarText: "NA",
    gender: "Nữ",
    faculty: "Ngoại ngữ tiếng Anh",
    cohort: "K69",
    building: "Tòa B",
    room: "B.402",
    bed: "B2",
    phone: "0936.889.900",
    email: "anh.hn241102@sis.hust.edu.vn",
    idCard: "001205011782",
    hometown: "Hà Nội",
    priorityCategory: "Bình thường",
    feeStatus: "paid",
    feeAmount: 0,
    disciplineStatus: "clean",
    checkInDate: "25/09/2025",
    cardActive: true,
    rfidCard: "RFID-7711-2358",
  },
  {
    id: "SV-06",
    name: "Đỗ Quốc Bảo",
    studentCode: "20234419",
    avatarText: "QB",
    gender: "Nam",
    faculty: "Khoa học máy tính",
    cohort: "K68",
    building: "Tòa A",
    room: "A.301",
    bed: "A2",
    phone: "0915.667.788",
    email: "bao.dq234419@sis.hust.edu.vn",
    idCard: "022203014592",
    hometown: "Quảng Ninh",
    priorityCategory: "Dân tộc",
    feeStatus: "paid",
    feeAmount: 0,
    disciplineStatus: "clean",
    checkInDate: "15/09/2024",
    cardActive: true,
    rfidCard: "RFID-9023-8871",
  },
  {
    id: "SV-07",
    name: "Vũ Phương Thảo",
    studentCode: "20248831",
    avatarText: "PT",
    gender: "Nữ",
    faculty: "Công nghệ Sinh học",
    cohort: "K69",
    building: "Tòa B",
    room: "B.208",
    bed: "B1",
    phone: "0982.113.355",
    email: "thao.vp248831@sis.hust.edu.vn",
    idCard: "025205001298",
    hometown: "Nam Định",
    priorityCategory: "Hộ nghèo",
    feeStatus: "unpaid",
    feeAmount: 220000,
    disciplineStatus: "clean",
    checkInDate: "28/09/2025",
    cardActive: true,
    rfidCard: "RFID-6623-1029",
  },
];

export default function StudentsPage() {
  const [students, setStudents] = React.useState<Student[]>(mockStudents);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedBuilding, setSelectedBuilding] = React.useState("all");
  const [selectedCohort, setSelectedCohort] = React.useState("all");
  const [selectedStatus, setSelectedStatus] = React.useState("all");

  // Selected student for slide-over drawer
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = React.useState(false);
  const [transferTargetStudent, setTransferTargetStudent] = React.useState<Student | null>(null);
  const [newRoomSelection, setNewRoomSelection] = React.useState("A.405");
  const [newBedSelection, setNewBedSelection] = React.useState("A1");
  const [transferReason, setTransferReason] = React.useState("Theo nguyện vọng cá nhân");

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = React.useState(false);
  const [newStudentForm, setNewStudentForm] = React.useState({
    name: "",
    studentCode: "",
    gender: "Nam" as "Nam" | "Nữ",
    faculty: "Công nghệ thông tin",
    cohort: "K69",
    building: "Tòa A",
    room: "A.302",
    bed: "A1",
    phone: "",
    email: "",
    idCard: "",
    hometown: "",
    priorityCategory: "Bình thường" as "Bình thường" | "Hộ nghèo" | "Con thương binh" | "Dân tộc",
  });

  // Filter logic
  const filteredStudents = React.useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        searchQuery === "" ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentCode.includes(searchQuery) ||
        s.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery);

      const matchBuilding =
        selectedBuilding === "all" || s.building === selectedBuilding;

      const matchCohort =
        selectedCohort === "all" || s.cohort === selectedCohort;

      const matchStatus =
        selectedStatus === "all" ||
        (selectedStatus === "paid" && s.feeStatus === "paid") ||
        (selectedStatus === "unpaid" && s.feeStatus !== "paid") ||
        (selectedStatus === "warned" && s.disciplineStatus === "warned") ||
        (selectedStatus === "priority" && s.priorityCategory !== "Bình thường");

      return matchSearch && matchBuilding && matchCohort && matchStatus;
    });
  }, [students, searchQuery, selectedBuilding, selectedCohort, selectedStatus]);

  // Handle open drawer
  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setIsDrawerOpen(true);
  };

  // Handle open transfer modal
  const handleOpenTransfer = (student: Student) => {
    setTransferTargetStudent(student);
    setIsTransferModalOpen(true);
  };

  // Execute room transfer
  const handleConfirmTransfer = () => {
    if (!transferTargetStudent) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === transferTargetStudent.id
          ? {
              ...s,
              room: newRoomSelection,
              bed: newBedSelection,
            }
          : s
      )
    );
    if (selectedStudent && selectedStudent.id === transferTargetStudent.id) {
      setSelectedStudent({
        ...selectedStudent,
        room: newRoomSelection,
        bed: newBedSelection,
      });
    }
    setIsTransferModalOpen(false);
  };

  // Toggle card lock
  const handleToggleCardLock = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, cardActive: !s.cardActive } : s
      )
    );
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent({
        ...selectedStudent,
        cardActive: !selectedStudent.cardActive,
      });
    }
  };

  // Handle Add Student
  const handleSaveNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name || !newStudentForm.studentCode) return;

    const newEntry: Student = {
      id: `SV-${Date.now().toString().slice(-4)}`,
      name: newStudentForm.name,
      studentCode: newStudentForm.studentCode,
      avatarText: newStudentForm.name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase(),
      gender: newStudentForm.gender,
      faculty: newStudentForm.faculty,
      cohort: newStudentForm.cohort,
      building: newStudentForm.building,
      room: newStudentForm.room,
      bed: newStudentForm.bed,
      phone: newStudentForm.phone || "0988.000.111",
      email: newStudentForm.email || `${newStudentForm.studentCode}@sis.hust.edu.vn`,
      idCard: newStudentForm.idCard || "001205009999",
      hometown: newStudentForm.hometown || "Hà Nội",
      priorityCategory: newStudentForm.priorityCategory,
      feeStatus: "paid",
      feeAmount: 0,
      disciplineStatus: "clean",
      checkInDate: "24/10/2026",
      cardActive: true,
      rfidCard: `RFID-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    setStudents([newEntry, ...students]);
    setIsAddStudentModalOpen(false);
    setNewStudentForm({
      name: "",
      studentCode: "",
      gender: "Nam",
      faculty: "Công nghệ thông tin",
      cohort: "K69",
      building: "Tòa A",
      room: "A.302",
      bed: "A1",
      phone: "",
      email: "",
      idCard: "",
      hometown: "",
      priorityCategory: "Bình thường",
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hồ Sơ & Danh Sách Sinh Viên
            </h1>
            <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] hover:bg-[#1F5CA9]/20 font-semibold border-0">
              Sinh viên nội trú
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý thông tin cư trú, phòng ở, thẻ từ ra vào và đối tượng chính sách KTX
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            onClick={() => {
              // Export handler
            }}
          >
            <Download className="mr-2 h-4 w-4 text-slate-500" />
            Xuất Excel
          </Button>

          <Button
            className="bg-[#1F5CA9] text-white hover:bg-[#184988] shadow-sm font-medium"
            onClick={() => setIsAddStudentModalOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Tiếp nhận sinh viên mới
          </Button>
        </div>
      </div>

      {/* 4 Quick Stat Highlight Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng sinh viên */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Tổng sinh viên nội trú
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  1,840
                </span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  92% lấp đầy
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                +45 sinh viên so với học kỳ trước
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1F5CA9] dark:bg-blue-950 dark:text-blue-300">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Sinh viên mới nhập KTX */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Tân sinh viên (K69)
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-[#00AFEF]">
                  320
                </span>
                <span className="text-xs font-medium text-[#00AFEF] bg-sky-50 px-2 py-0.5 rounded-full">
                  Đã nhận phòng
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Hoàn thành cấp phát thẻ từ NFC 100%
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#00AFEF] dark:bg-sky-950">
              <Sparkles className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Cảnh báo nợ phí & kỷ luật */}
        <Card className="border-amber-200/80 shadow-sm bg-gradient-to-br from-white to-amber-50/30 dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#FFB800]" />
                Nợ phí & Cần nhắc nhở
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-amber-700">
                  24
                </span>
                <span className="text-xs font-medium bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full border border-amber-200">
                  18 nợ phí / 6 vi phạm
                </span>
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1">
                Tự động gửi SMS cảnh báo hôm nay
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/80 text-[#B45309]">
              <AlertTriangle className="h-6 w-6 text-[#FFB800]" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Diện chính sách ưu tiên */}
        <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Diện chính sách ưu tiên
              </p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  85
                </span>
                <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  Miễn giảm 50-100%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Hộ nghèo, con TB-LS, dân tộc thiểu số
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-slate-200/80 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm tên sinh viên, MSSV, phòng (A.301), SĐT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-slate-200 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-[#1F5CA9]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Filter Selectors */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Tòa nhà */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                <span>Tòa:</span>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1F5CA9] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="all">Tất cả các tòa</option>
                  <option value="Tòa A">Tòa A (Nam)</option>
                  <option value="Tòa B">Tòa B (Nữ)</option>
                  <option value="Tòa C">Tòa C (Chất lượng cao)</option>
                </select>
              </div>

              {/* Khóa */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                <span>Khóa:</span>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1F5CA9] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="all">Tất cả khóa</option>
                  <option value="K69">K69 (Năm 1)</option>
                  <option value="K68">K68 (Năm 2)</option>
                  <option value="K67">K67 (Năm 3)</option>
                  <option value="K66">K66 (Năm 4)</option>
                </select>
              </div>

              {/* Trạng thái */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                <span>Trạng thái:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1F5CA9] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="paid">Đã hoàn thành phí</option>
                  <option value="unpaid">Còn nợ phí (Vàng)</option>
                  <option value="warned">Có cảnh báo nội quy</option>
                  <option value="priority">Thuộc diện chính sách</option>
                </select>
              </div>

              {(searchQuery || selectedBuilding !== "all" || selectedCohort !== "all" || selectedStatus !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedBuilding("all");
                    setSelectedCohort("all");
                    setSelectedStatus("all");
                  }}
                  className="h-9 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                >
                  Đặt lại bộ lọc
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Student Records Table */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
              <TableRow className="border-slate-200 dark:border-slate-700">
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-3.5">
                  Sinh viên
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">
                  Khoa & Khóa
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">
                  Phòng & Giường
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">
                  Số điện thoại & Email
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">
                  Chính sách
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">
                  Tình trạng phí
                </TableHead>
                <TableHead className="font-semibold text-slate-700 dark:text-slate-200">
                  Thẻ KTX
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-200 pr-6">
                  Hành động
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                    Không tìm thấy sinh viên nào phù hợp với bộ lọc.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((s) => (
                  <TableRow
                    key={s.id}
                    className="hover:bg-slate-50/70 transition-colors border-slate-100 dark:border-slate-800"
                  >
                    {/* Sinh viên */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 bg-blue-100 text-[#1F5CA9] font-bold text-xs ring-1 ring-[#1F5CA9]/20">
                          <AvatarFallback>{s.avatarText}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white hover:text-[#1F5CA9] cursor-pointer"
                              onClick={() => handleViewStudent(s)}
                            >
                              {s.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-slate-200 text-slate-500">
                              {s.studentCode}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {s.gender} • Quê quán: {s.hometown}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Khoa & Khóa */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {s.faculty}
                        </span>
                        <span className="text-[11px] font-semibold text-[#00AFEF]">
                          Khóa {s.cohort}
                        </span>
                      </div>
                    </TableCell>

                    {/* Phòng & Giường */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] hover:bg-[#1F5CA9]/15 border-0 font-bold px-2 py-0.5">
                          {s.room}
                        </Badge>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          Giường {s.bed}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {s.building}
                      </span>
                    </TableCell>

                    {/* SĐT & Email */}
                    <TableCell>
                      <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {s.phone}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {s.email}
                        </span>
                      </div>
                    </TableCell>

                    {/* Chính sách */}
                    <TableCell>
                      {s.priorityCategory === "Bình thường" ? (
                        <span className="text-xs text-slate-400">Đại trà</span>
                      ) : (
                        <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 text-[11px] font-medium">
                          {s.priorityCategory}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Tình trạng phí */}
                    <TableCell>
                      {s.feeStatus === "paid" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Đã thanh toán
                        </span>
                      ) : s.feeStatus === "overdue" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          Nợ {s.feeAmount.toLocaleString("vi-VN")} đ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] bg-[#FEF3C7] px-2.5 py-1 rounded-full border border-amber-200">
                          <Clock className="h-3 w-3 text-[#FFB800]" />
                          Nợ {s.feeAmount.toLocaleString("vi-VN")} đ
                        </span>
                      )}
                    </TableCell>

                    {/* Thẻ KTX */}
                    <TableCell>
                      {s.cardActive ? (
                        <button
                          onClick={() => handleToggleCardLock(s.id)}
                          title="Nhấn để tạm khóa thẻ"
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                          Hoạt động
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleCardLock(s.id)}
                          title="Nhấn để mở khóa thẻ"
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200"
                        >
                          <Lock className="h-3.5 w-3.5 text-red-600" />
                          Đã khóa thẻ
                        </button>
                      )}
                    </TableCell>

                    {/* Hành động */}
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-medium text-[#1F5CA9] hover:bg-blue-50 hover:text-[#184988]"
                          onClick={() => handleViewStudent(s)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Hồ sơ
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50"
                          onClick={() => handleOpenTransfer(s)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1 text-[#00AFEF]" />
                          Đổi phòng
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer Pagination */}
        <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 bg-slate-50/50 text-xs text-slate-500">
          <span>
            Hiển thị <strong>{filteredStudents.length}</strong> trên tổng số <strong>1,840</strong> hồ sơ sinh viên
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
              Trước
            </Button>
            <span className="font-semibold text-slate-700">Trang 1 / 184</span>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Sau
            </Button>
          </div>
        </div>
      </Card>

      {/* Slide-over Sheet: Student Detailed Dossier */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selectedStudent && (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900">
              {/* Header profile banner */}
              <div className="bg-gradient-to-r from-[#1F5CA9] to-[#00AFEF] p-6 text-white relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 bg-white text-[#1F5CA9] font-extrabold text-xl shadow-md ring-4 ring-white/30">
                      <AvatarFallback>{selectedStudent.avatarText}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                      <p className="text-xs text-sky-100 font-mono mt-0.5">
                        MSSV: {selectedStudent.studentCode} • Khóa {selectedStudent.cohort}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-white/20 hover:bg-white/30 text-white text-[11px] border-0 backdrop-blur-sm">
                          {selectedStudent.faculty}
                        </Badge>
                        <Badge className="bg-emerald-500 text-white text-[11px] border-0">
                          Đang lưu trú
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 flex-1">
                {/* Section 1: Thẻ NFC & Phòng lưu trú */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Phòng ở & Vị trí hiện tại
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-[#1F5CA9] border-[#1F5CA9]/30 hover:bg-blue-50"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        handleOpenTransfer(selectedStudent);
                      }}
                    >
                      <ArrowRightLeft className="h-3 w-3 mr-1" />
                      Điều chuyển
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 block">Tòa nhà</span>
                      <span className="text-sm font-bold text-slate-800">
                        {selectedStudent.building}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 block">Số phòng</span>
                      <span className="text-sm font-bold text-[#1F5CA9]">
                        {selectedStudent.room}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 block">Vị trí giường</span>
                      <span className="text-sm font-bold text-slate-800">
                        Giường {selectedStudent.bed}
                      </span>
                    </div>
                  </div>

                  {/* Card status */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#00AFEF]" />
                      <span className="text-slate-600 font-mono">
                        {selectedStudent.rfidCard}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-semibold"
                      onClick={() => handleToggleCardLock(selectedStudent.id)}
                    >
                      {selectedStudent.cardActive ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Tạm khóa thẻ
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Unlock className="h-3 w-3" /> Kích hoạt thẻ
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Section 2: Thông tin nhân thân & Liên hệ */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Thông tin nhân thân & Liên hệ
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-slate-100 bg-white">
                      <span className="text-slate-400 block text-[11px]">Số điện thoại</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {selectedStudent.phone}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-100 bg-white">
                      <span className="text-slate-400 block text-[11px]">Số CCCD / ĐDCN</span>
                      <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                        {selectedStudent.idCard}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-100 bg-white col-span-2">
                      <span className="text-slate-400 block text-[11px]">Email trường</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {selectedStudent.email}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-100 bg-white">
                      <span className="text-slate-400 block text-[11px]">Quê quán</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">
                        {selectedStudent.hometown}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-100 bg-white">
                      <span className="text-slate-400 block text-[11px]">Đối tượng ưu tiên</span>
                      <span className="font-semibold text-purple-700 mt-0.5 block">
                        {selectedStudent.priorityCategory}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Tình trạng tài chính & Hợp đồng */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Tài chính & Nghĩa vụ nội trú
                  </h3>
                  <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Hợp đồng lưu trú:</span>
                      <span className="font-bold text-slate-800">
                        HĐ-KTX-{selectedStudent.studentCode} (Còn 8 tháng)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Ngày bắt đầu ở:</span>
                      <span className="font-medium text-slate-700">
                        {selectedStudent.checkInDate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Hóa đơn điện nước T10/2026:</span>
                      {selectedStudent.feeStatus === "paid" ? (
                        <span className="font-bold text-emerald-600">Đã thanh toán (0 đ)</span>
                      ) : (
                        <span className="font-bold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded">
                          Còn nợ {selectedStudent.feeAmount.toLocaleString("vi-VN")} đ
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 4: Lịch sử quẹt thẻ gần nhất */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Nhật ký quẹt thẻ cổng KTX
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-medium text-slate-800">Cổng chính Tòa {selectedStudent.building.slice(-1)} (Vào)</span>
                      </div>
                      <span className="text-slate-400">21:42 - 23/10/2026</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="font-medium text-slate-800">Cổng Barrier xe máy (Ra)</span>
                      </div>
                      <span className="text-slate-400">14:15 - 23/10/2026</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer footer actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Đóng
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1F5CA9] text-white hover:bg-[#184988]"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Gửi thông báo SMS / App
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal: Chuyển Phòng (Room Transfer) */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#1F5CA9]" />
              Điều Chuyển Phòng Lưu Trú
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Chuyển sinh viên sang phòng hoặc giường mới trong hệ thống KTX.
            </DialogDescription>
          </DialogHeader>

          {transferTargetStudent && (
            <div className="space-y-4 py-2">
              {/* Current Room Info */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{transferTargetStudent.name}</span>
                  <Badge variant="outline" className="font-mono">{transferTargetStudent.studentCode}</Badge>
                </div>
                <p className="text-slate-500">
                  Phòng hiện tại: <strong className="text-[#1F5CA9]">{transferTargetStudent.room}</strong> ({transferTargetStudent.building}) • Giường: <strong>{transferTargetStudent.bed}</strong>
                </p>
              </div>

              {/* Destination Form */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Chọn phòng đích đến (còn giường trống)
                  </label>
                  <select
                    value={newRoomSelection}
                    onChange={(e) => setNewRoomSelection(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1F5CA9]"
                  >
                    <option value="A.302">Phòng A.302 (Tòa A - Còn 2 giường trống)</option>
                    <option value="A.405">Phòng A.405 (Tòa A - Còn 1 giường trống)</option>
                    <option value="B.208">Phòng B.208 (Tòa B - Còn 1 giường trống)</option>
                    <option value="C.104">Phòng C.104 (Tòa C CLC - Còn 2 giường trống)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Chọn vị trí giường
                  </label>
                  <select
                    value={newBedSelection}
                    onChange={(e) => setNewBedSelection(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1F5CA9]"
                  >
                    <option value="A1">Giường A1 (Tầng 1 - Cạnh cửa sổ)</option>
                    <option value="A2">Giường A2 (Tầng 2 - Phía trong)</option>
                    <option value="B1">Giường B1 (Tầng 1 - Cạnh bàn học)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Lý do chuyển phòng
                  </label>
                  <Input
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="VD: Điều chỉnh theo nguyện vọng, chuyển cơ sở..."
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 border border-blue-100 text-[11px] text-[#1F5CA9] flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Hệ thống sẽ tự động cập nhật phân quyền thẻ từ ra vào cổng và chốt số điện nước phòng cũ.
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsTransferModalOpen(false)}>
              Hủy
            </Button>
            <Button
              size="sm"
              className="bg-[#1F5CA9] text-white hover:bg-[#184988]"
              onClick={handleConfirmTransfer}
            >
              Xác nhận chuyển phòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Tiếp Nhận Sinh Viên Mới (Add Student) */}
      <Dialog open={isAddStudentModalOpen} onOpenChange={setIsAddStudentModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#1F5CA9]" />
              Tiếp Nhận & Đăng Ký Sinh Viên Nội Trú Mới
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Nhập thông tin hồ sơ sinh viên để xếp phòng và cấp quyền thẻ KTX.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveNewStudent} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Họ và tên sinh viên <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="VD: Lê Đức Anh"
                  value={newStudentForm.name}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mã số sinh viên (MSSV) <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="VD: 20245678"
                  value={newStudentForm.studentCode}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, studentCode: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Giới tính
                </label>
                <select
                  value={newStudentForm.gender}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, gender: e.target.value as "Nam" | "Nữ" })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Khóa học
                </label>
                <select
                  value={newStudentForm.cohort}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, cohort: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="K69">K69 (Năm 1)</option>
                  <option value="K68">K68 (Năm 2)</option>
                  <option value="K67">K67 (Năm 3)</option>
                  <option value="K66">K66 (Năm 4)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Khoa / Viện
                </label>
                <select
                  value={newStudentForm.faculty}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, faculty: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="Công nghệ thông tin">CNTT & TT</option>
                  <option value="Điện tử viễn thông">Điện tử VT</option>
                  <option value="Kinh tế & Quản lý">Kinh tế QL</option>
                  <option value="Cơ khí">Cơ khí</option>
                  <option value="Ngoại ngữ">Ngoại ngữ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Số điện thoại liên hệ
                </label>
                <Input
                  placeholder="0912.xxx.xxx"
                  value={newStudentForm.phone}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Số CCCD / Mã định danh
                </label>
                <Input
                  placeholder="00120xxxxxxx"
                  value={newStudentForm.idCard}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, idCard: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Quê quán (Tỉnh / Thành phố)
                </label>
                <Input
                  placeholder="VD: Hải Dương, Nam Định..."
                  value={newStudentForm.hometown}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, hometown: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Diện ưu tiên chính sách
                </label>
                <select
                  value={newStudentForm.priorityCategory}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, priorityCategory: e.target.value as any })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="Bình thường">Bình thường (Đại trà)</option>
                  <option value="Hộ nghèo">Hộ nghèo (Giảm 50% tiền phòng)</option>
                  <option value="Con thương binh">Con thương binh / Liệt sĩ (Miễn 100%)</option>
                  <option value="Dân tộc">Dân tộc thiểu số</option>
                </select>
              </div>
            </div>

            {/* Room assignment */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2">
              <span className="text-xs font-bold text-[#1F5CA9] block">
                Phân bổ phòng ở ban đầu
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Tòa nhà</span>
                  <select
                    value={newStudentForm.building}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, building: e.target.value })}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="Tòa A">Tòa A (Nam)</option>
                    <option value="Tòa B">Tòa B (Nữ)</option>
                    <option value="Tòa C">Tòa C (Chất lượng cao)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Phòng</span>
                  <select
                    value={newStudentForm.room}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, room: e.target.value })}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="A.301">P.301 (Còn 1 chỗ)</option>
                    <option value="A.302">P.302 (Còn 2 chỗ)</option>
                    <option value="A.405">P.405 (Còn 1 chỗ)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Giường</span>
                  <select
                    value={newStudentForm.bed}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, bed: e.target.value })}
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="A1">Giường A1</option>
                    <option value="A2">Giường A2</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddStudentModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button type="submit" size="sm" className="bg-[#1F5CA9] text-white hover:bg-[#184988]">
                Lưu hồ sơ & Xếp phòng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
