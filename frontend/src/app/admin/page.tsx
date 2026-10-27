"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  DoorOpen,
  Zap,
  Wrench,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Consumption data for Monthly Utility Chart
const consumptionData = [
  { month: "Jan", electricity: 12400, water: 3400 },
  { month: "Feb", electricity: 11200, water: 3100 },
  { month: "Mar", electricity: 14500, water: 4200 },
  { month: "Apr", electricity: 16800, water: 4800 },
  { month: "May", electricity: 19200, water: 5400 },
  { month: "Jun", electricity: 22100, water: 6100 },
  { month: "Jul", electricity: 15300, water: 4100 },
  { month: "Aug", electricity: 18900, water: 5200 },
  { month: "Sep", electricity: 21500, water: 5900 },
  { month: "Oct", electricity: 19800, water: 5600 },
];

// Room Availability Donut data
const roomAvailabilityData = [
  { name: "Occupied", value: 460, color: "#1F5CA9" },
  { name: "Available", value: 30, color: "#00AFEF" },
  { name: "Maintenance", value: 10, color: "#FFB800" },
];

// Recent Activity table data matching Figma
const recentActivities = [
  {
    student: "Nguyễn Văn An",
    studentId: "2102001",
    activity: "Thanh toán tiền điện nước",
    room: "P.302 - Tòa A",
    time: "Hôm nay, 10:42",
    amount: "350.000 đ",
    status: "paid",
  },
  {
    student: "Trần Thị Bích",
    studentId: "2202045",
    activity: "Gia hạn hợp đồng KTX",
    room: "P.112 - Tòa B",
    time: "Hôm nay, 09:15",
    amount: "—",
    status: "completed",
  },
  {
    student: "Lê Tuấn Anh",
    studentId: "2302089",
    activity: "Báo hỏng vòi nước phòng tắm",
    room: "P.405 - Tòa A",
    time: "Hôm nay, 08:30",
    amount: "—",
    status: "pending",
  },
  {
    student: "Phạm Quốc Bảo",
    studentId: "2002012",
    activity: "Nhận phòng đầu kỳ học",
    room: "P.201 - Tòa A",
    time: "Hôm qua, 16:20",
    amount: "1.200.000 đ",
    status: "paid",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Dashboard overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back! Here&apos;s what&apos;s happening in your dormitory today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-xs font-medium">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Tháng 10, 2026</span>
          </Button>
          <Button
            size="sm"
            className="h-9 gap-2 rounded-xl text-xs font-medium bg-[#1F5CA9] text-white hover:bg-[#1a4f91] shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export report</span>
          </Button>
        </div>
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Students</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1F5CA9] dark:bg-blue-950/60 dark:text-blue-400">
                <Users className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                1,840
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                  <ArrowUpRight className="h-3 w-3" /> +12%
                </span>
                <span className="text-muted-foreground">so với kỳ trước</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Room Occupancy Rate */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Room Occupancy Rate</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#00AFEF] dark:bg-sky-950/60 dark:text-sky-400">
                <DoorOpen className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  92%
                </span>
                <span className="text-xs text-muted-foreground">460 / 500 beds</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-[#00AFEF] h-full rounded-full transition-all duration-500"
                  style={{ width: "92%" }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Pending Utility Bills (Yellow Alert Badge) */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pending Utility Bills</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-[#FFB800] dark:bg-amber-950/60 dark:text-amber-400">
                <Zap className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                24
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                  Hạn chót 3 ngày
                </span>
                <span className="text-muted-foreground">cần thu</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Room Maintenance Requests */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Maintenance Requests</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1F5CA9] dark:bg-slate-800 dark:text-blue-400">
                <Wrench className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                3
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="text-muted-foreground">yêu cầu chờ xử lý kỹ thuật</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monthly Utility Consumption (2 cols) */}
        <Card className="lg:col-span-2 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Monthly Utility Consumption
                </CardTitle>
                <CardDescription className="text-xs">
                  Electricity & Water usage across all buildings
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-[#1F5CA9]" />
                  <span className="text-slate-600 dark:text-slate-300">Điện (kWh)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-[#00AFEF]" />
                  <span className="text-slate-600 dark:text-slate-300">Nước (m³)</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumptionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="electricity" fill="#1F5CA9" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="water" fill="#00AFEF" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Right: Quick Room Availability Donut (1 col) */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
              Quick Room Availability
            </CardTitle>
            <CardDescription className="text-xs">
              Live capacity breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 flex-1 flex flex-col items-center justify-center">
            <div className="relative h-[180px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roomAvailabilityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {roomAvailabilityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  500
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">Total Beds</span>
              </div>
            </div>

            {/* Legend items */}
            <div className="w-full space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1F5CA9]" />
                  <span className="text-slate-600 dark:text-slate-300">Occupied</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">460 beds</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#00AFEF]" />
                  <span className="text-slate-600 dark:text-slate-300">Available</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">30 beds</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FFB800]" />
                  <span className="text-slate-600 dark:text-slate-300">Maintenance</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">10 beds</span>
              </div>
            </div>
          </CardContent>
          <div className="p-4 pt-0">
            <Link href="/admin/rooms">
              <Button
                variant="outline"
                className="w-full rounded-xl text-xs font-semibold text-[#1F5CA9] border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950"
              >
                <span>View details & assign bed</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Row 3: Recent Activity Table */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-50">
              Recent activity
            </CardTitle>
            <CardDescription className="text-xs">
              Latest transactions, check-ins, and dormitory maintenance logs
            </CardDescription>
          </div>
          <Link
            href="/admin/activity"
            className="text-xs font-semibold text-[#1F5CA9] hover:underline flex items-center gap-1"
          >
            <span>View all activity</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-y border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-6">Sinh viên</th>
                  <th className="py-3 px-6">Hoạt động</th>
                  <th className="py-3 px-6">Phòng</th>
                  <th className="py-3 px-6">Thời gian</th>
                  <th className="py-3 px-6">Số tiền</th>
                  <th className="py-3 px-6 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentActivities.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-slate-100">
                      <div>{row.student}</div>
                      <div className="text-[11px] text-muted-foreground">{row.studentId}</div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                      {row.activity}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-800 dark:text-slate-200">
                      {row.room}
                    </td>
                    <td className="py-3.5 px-6 text-muted-foreground text-xs">
                      {row.time}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                      {row.amount}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {row.status === "paid" && (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium rounded-full px-2.5 py-0.5">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Đã nộp
                        </Badge>
                      )}
                      {row.status === "completed" && (
                        <Badge className="bg-blue-50 text-[#1F5CA9] hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-medium rounded-full px-2.5 py-0.5">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Hoàn tất
                        </Badge>
                      )}
                      {row.status === "pending" && (
                        <Badge className="bg-amber-50 text-[#B45309] hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-medium rounded-full px-2.5 py-0.5">
                          <Clock className="h-3 w-3 mr-1" /> Chờ xử lý
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
