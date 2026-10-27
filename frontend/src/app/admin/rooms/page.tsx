"use client";

import * as React from "react";
import {
  DoorOpen,
  Plus,
  ArrowRightLeft,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  User,
  Bed,
  Building2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BedInfo {
  bedNumber: string;
  isOccupied: boolean;
  status: "occupied" | "empty" | "maintenance";
  studentName?: string;
  studentId?: string;
  checkInDate?: string;
}

interface RoomInfo {
  id: string;
  roomNumber: string;
  type: string;
  gender: "Nam" | "Nữ";
  totalBeds: number;
  occupiedBeds: number;
  status: "Full" | "Available" | "Maintenance";
  price: string;
  beds: BedInfo[];
}

const mockRooms: RoomInfo[] = [
  {
    id: "a201",
    roomNumber: "Phòng A.201",
    type: "Phòng 4 giường",
    gender: "Nam",
    totalBeds: 4,
    occupiedBeds: 4,
    status: "Full",
    price: "650.000 đ/tháng",
    beds: [
      { bedNumber: "G01", isOccupied: true, status: "occupied", studentName: "Nguyễn Văn An", studentId: "21020001", checkInDate: "01/09/2026" },
      { bedNumber: "G02", isOccupied: true, status: "occupied", studentName: "Trần Minh Quân", studentId: "21020002", checkInDate: "01/09/2026" },
      { bedNumber: "G03", isOccupied: true, status: "occupied", studentName: "Phạm Quốc Tuấn", studentId: "21020003", checkInDate: "05/09/2026" },
      { bedNumber: "G04", isOccupied: true, status: "occupied", studentName: "Hoàng Minh Trí", studentId: "21020004", checkInDate: "01/09/2026" },
    ],
  },
  {
    id: "a202",
    roomNumber: "Phòng A.202",
    type: "Phòng 4 giường",
    gender: "Nam",
    totalBeds: 4,
    occupiedBeds: 3,
    status: "Available",
    price: "650.000 đ/tháng",
    beds: [
      { bedNumber: "G01", isOccupied: true, status: "occupied", studentName: "Lê Văn Hùng", studentId: "22020015", checkInDate: "01/09/2026" },
      { bedNumber: "G02", isOccupied: true, status: "occupied", studentName: "Đặng Tiến Dũng", studentId: "22020016", checkInDate: "02/09/2026" },
      { bedNumber: "G03", isOccupied: true, status: "occupied", studentName: "Vũ Hải Đăng", studentId: "22020017", checkInDate: "03/09/2026" },
      { bedNumber: "G04", isOccupied: false, status: "empty" },
    ],
  },
  {
    id: "a203",
    roomNumber: "Phòng A.203",
    type: "Phòng 6 giường",
    gender: "Nam",
    totalBeds: 6,
    occupiedBeds: 4,
    status: "Available",
    price: "500.000 đ/tháng",
    beds: [
      { bedNumber: "G01", isOccupied: true, status: "occupied", studentName: "Trịnh Thăng Long", studentId: "23020041", checkInDate: "01/09/2026" },
      { bedNumber: "G02", isOccupied: true, status: "occupied", studentName: "Đỗ Xuân Bách", studentId: "23020042", checkInDate: "01/09/2026" },
      { bedNumber: "G03", isOccupied: false, status: "empty" },
      { bedNumber: "G04", isOccupied: true, status: "occupied", studentName: "Bùi Anh Tuấn", studentId: "23020043", checkInDate: "04/09/2026" },
      { bedNumber: "G05", isOccupied: true, status: "occupied", studentName: "Ngô Quang Huy", studentId: "23020044", checkInDate: "04/09/2026" },
      { bedNumber: "G06", isOccupied: false, status: "empty" },
    ],
  },
  {
    id: "a204",
    roomNumber: "Phòng A.204",
    type: "Phòng 4 giường",
    gender: "Nam",
    totalBeds: 4,
    occupiedBeds: 2,
    status: "Maintenance",
    price: "650.000 đ/tháng",
    beds: [
      { bedNumber: "G01", isOccupied: true, status: "occupied", studentName: "Cao Bá Quát", studentId: "21020088", checkInDate: "01/09/2026" },
      { bedNumber: "G02", isOccupied: true, status: "occupied", studentName: "Lý Thường Kiệt", studentId: "21020089", checkInDate: "01/09/2026" },
      { bedNumber: "G03", isOccupied: false, status: "maintenance" },
      { bedNumber: "G04", isOccupied: false, status: "maintenance" },
    ],
  },
  {
    id: "a205",
    roomNumber: "Phòng A.205",
    type: "Phòng 4 giường",
    gender: "Nam",
    totalBeds: 4,
    occupiedBeds: 4,
    status: "Full",
    price: "650.000 đ/tháng",
    beds: [
      { bedNumber: "G01", isOccupied: true, status: "occupied", studentName: "Nguyễn Du", studentId: "22020101", checkInDate: "01/09/2026" },
      { bedNumber: "G02", isOccupied: true, status: "occupied", studentName: "Hồ Xuân Hương", studentId: "22020102", checkInDate: "01/09/2026" },
      { bedNumber: "G03", isOccupied: true, status: "occupied", studentName: "Nguyễn Trãi", studentId: "22020103", checkInDate: "01/09/2026" },
      { bedNumber: "G04", isOccupied: true, status: "occupied", studentName: "Chu Văn An", studentId: "22020104", checkInDate: "01/09/2026" },
    ],
  },
  {
    id: "a206",
    roomNumber: "Phòng A.206",
    type: "Phòng 4 giường",
    gender: "Nam",
    totalBeds: 4,
    occupiedBeds: 1,
    status: "Available",
    price: "650.000 đ/tháng",
    beds: [
      { bedNumber: "G01", isOccupied: true, status: "occupied", studentName: "Phan Bội Châu", studentId: "24020050", checkInDate: "10/09/2026" },
      { bedNumber: "G02", isOccupied: false, status: "empty" },
      { bedNumber: "G03", isOccupied: false, status: "empty" },
      { bedNumber: "G04", isOccupied: false, status: "empty" },
    ],
  },
];

export default function RoomsManagementPage() {
  const [selectedBuilding, setSelectedBuilding] = React.useState("A");
  const [selectedFloor, setSelectedFloor] = React.useState("2");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("all");

  const filteredRooms = mockRooms.filter((room) => {
    if (filterStatus === "available" && room.status !== "Available") return false;
    if (filterStatus === "full" && room.status !== "Full") return false;
    if (filterStatus === "maintenance" && room.status !== "Maintenance") return false;
    if (searchQuery && !room.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header section matching Figma */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Room & Bed Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            4-6 bed student rooms. Manage spaces, beds, and resident history.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs font-medium">
            <Download className="h-3.5 w-3.5" />
            <span>Quick Export</span>
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs font-medium">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[#00AFEF]" />
            <span>Transfer Student</span>
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs font-medium bg-[#1F5CA9] text-white hover:bg-[#1a4f91] shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Room</span>
          </Button>
        </div>
      </div>

      {/* Selector & Filters Row */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Building & Floor Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Building tabs */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              {["A", "B", "C"].map((building) => (
                <button
                  key={building}
                  onClick={() => setSelectedBuilding(building)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedBuilding === building
                      ? "bg-[#1F5CA9] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  Tòa {building}
                </button>
              ))}
            </div>

            {/* Floor tabs */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              {["1", "2", "3", "4", "5"].map((floor) => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedFloor === floor
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Tầng {floor}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Tìm phòng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterStatus === "all"
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Tất cả (6)
              </button>
              <button
                onClick={() => setFilterStatus("available")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterStatus === "available"
                    ? "bg-[#00AFEF] text-white border-[#00AFEF]"
                    : "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
                }`}
              >
                Còn trống (3)
              </button>
              <button
                onClick={() => setFilterStatus("full")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterStatus === "full"
                    ? "bg-[#1F5CA9] text-white border-[#1F5CA9]"
                    : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                }`}
              >
                Đầy (2)
              </button>
              <button
                onClick={() => setFilterStatus("maintenance")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterStatus === "maintenance"
                    ? "bg-[#FFB800] text-amber-900 border-[#FFB800]"
                    : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
                }`}
              >
                Bảo trì (1)
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Visual Room Grid matching Figma */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRooms.map((room) => {
          const occupancyRate = (room.occupiedBeds / room.totalBeds) * 100;
          return (
            <Card
              key={room.id}
              className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Room Header */}
                <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                        {room.roomNumber}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{room.type}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {room.gender}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {room.status === "Full" && (
                      <Badge className="bg-blue-50 text-[#1F5CA9] border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-semibold rounded-full px-2.5">
                        Kín phòng
                      </Badge>
                    )}
                    {room.status === "Available" && (
                      <Badge className="bg-sky-50 text-[#00AFEF] border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 text-[11px] font-semibold rounded-full px-2.5">
                        Còn {room.totalBeds - room.occupiedBeds} chỗ
                      </Badge>
                    )}
                    {room.status === "Maintenance" && (
                      <Badge className="bg-amber-50 text-[#B45309] border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-semibold rounded-full px-2.5">
                        Đang sửa chữa
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {/* Bed Slots Grid */}
                <CardContent className="p-4">
                  <div className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center justify-between">
                    <span>Sơ đồ giường:</span>
                    <span className="text-[11px] text-slate-500">{room.price}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {room.beds.map((bed, bIdx) => {
                      if (bed.status === "occupied") {
                        return (
                          <TooltipProvider key={bIdx}>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-[#1F5CA9] dark:bg-blue-950/40 dark:border-blue-900 cursor-pointer hover:bg-blue-100/70 transition-colors">
                                  <div className="h-6 w-6 rounded-lg bg-[#1F5CA9] text-white flex items-center justify-center text-[10px] font-bold">
                                    {bed.bedNumber}
                                  </div>
                                  <div className="truncate text-left">
                                    <div className="text-[11px] font-semibold truncate text-slate-900 dark:text-slate-100">
                                      {bed.studentName}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {bed.studentId}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-xl text-xs p-3">
                                <div className="font-bold">{bed.studentName}</div>
                                <div className="text-[11px] text-muted-foreground">MSSV: {bed.studentId}</div>
                                <div className="text-[11px] text-muted-foreground">Ngày nhận phòng: {bed.checkInDate}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }

                      if (bed.status === "empty") {
                        return (
                          <div
                            key={bIdx}
                            className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-[#00AFEF]/50 bg-sky-50/30 text-[#00AFEF] hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            <div className="h-6 w-6 rounded-lg border border-[#00AFEF] text-[#00AFEF] flex items-center justify-center text-[10px] font-bold">
                              {bed.bedNumber}
                            </div>
                            <div className="text-[11px] font-medium text-[#00AFEF]">
                              + Trống (Xếp SV)
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={bIdx}
                          className="flex items-center gap-2 p-2 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-700"
                        >
                          <div className="h-6 w-6 rounded-lg bg-[#FFB800] text-amber-950 flex items-center justify-center text-[10px] font-bold">
                            {bed.bedNumber}
                          </div>
                          <div className="text-[11px] font-medium">Bảo trì giường</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </div>

              {/* Card Footer with Capacity Progress Bar */}
              <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 mt-2">
                <div className="flex items-center justify-between text-xs mt-3 mb-1.5">
                  <span className="text-muted-foreground">Tỷ lệ lấp đầy:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {room.occupiedBeds}/{room.totalBeds} giường ({Math.round(occupancyRate)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      occupancyRate === 100
                        ? "bg-[#1F5CA9]"
                        : occupancyRate > 50
                        ? "bg-[#00AFEF]"
                        : "bg-[#FFB800]"
                    }`}
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
