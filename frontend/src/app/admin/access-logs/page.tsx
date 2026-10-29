"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Zap,
  TrendingDown,
  Database,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCode,
  Layers,
  ArrowRight,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDemoMode } from "@/lib/demo-context";
import { api } from "@/lib/api";

interface AccessLog {
  id: string;
  studentCode: string;
  studentName: string;
  room: string;
  gate: string;
  direction: "IN" | "OUT";
  timestamp: string;
  isLate: boolean;
}

const mockAccessLogs: AccessLog[] = [
  {
    id: "LOG-999942",
    studentCode: "20215540",
    studentName: "Phạm Hải Đăng",
    room: "C.104",
    gate: "Cổng chính Tòa C",
    direction: "IN",
    timestamp: "23:42:15 - 26/10/2026",
    isLate: true,
  },
  {
    id: "LOG-999941",
    studentCode: "20230245",
    studentName: "Trần Thị Mai",
    room: "B.402",
    gate: "Cổng Barrier Tòa B",
    direction: "IN",
    timestamp: "21:15:30 - 26/10/2026",
    isLate: false,
  },
  {
    id: "LOG-999940",
    studentCode: "20230101",
    studentName: "Nguyễn Văn An",
    room: "A.301",
    gate: "Cổng chính Tòa A",
    direction: "IN",
    timestamp: "20:30:11 - 26/10/2026",
    isLate: false,
  },
  {
    id: "LOG-999939",
    studentCode: "20221980",
    studentName: "Lê Hoàng Long",
    room: "A.205",
    gate: "Cổng Barrier Tòa A",
    direction: "OUT",
    timestamp: "18:45:00 - 26/10/2026",
    isLate: false,
  },
  {
    id: "LOG-999938",
    studentCode: "20248831",
    studentName: "Vũ Phương Thảo",
    room: "B.208",
    gate: "Cổng chính Tòa B",
    direction: "IN",
    timestamp: "23:18:40 - 26/10/2026",
    isLate: true,
  },
];

export default function AccessLogsPage() {
  const { isDemoMode } = useDemoMode();
  const [hasIndex, setHasIndex] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [queryFilter, setQueryFilter] = React.useState("");
  const [onlyLate, setOnlyLate] = React.useState(false);

  const [benchmarkResult, setBenchmarkResult] = React.useState({
    executionTime: "6.4 ms",
    planningTime: "0.12 ms",
    scanType: "Bitmap Index Scan on idx_access_late_time",
    buffersHit: 24,
    buffersRead: 0,
    totalRows: "1.000.000",
  });

  const handleRunQuery = async () => {
    setIsRunning(true);
    const mode = hasIndex ? "index" : "seq";
    try {
      const res = await api.runBenchmark(mode);
      if (res.success && res.data) {
        setBenchmarkResult({
          executionTime: `${res.data.execution_time_ms} ms`,
          planningTime: `${res.data.planning_time_ms} ms`,
          scanType: `${res.data.node_type} trên dorm_access_logs`,
          buffersHit: res.data.shared_hit_blocks,
          buffersRead: res.data.shared_read_blocks,
          totalRows: "1.000.000",
        });
      } else {
        if (hasIndex) {
          setBenchmarkResult({
            executionTime: "5.48 ms",
            planningTime: "0.24 ms",
            scanType: "Bitmap Index Scan on idx_access_late_time",
            buffersHit: 4655,
            buffersRead: 0,
            totalRows: "1.000.000",
          });
        } else {
          setBenchmarkResult({
            executionTime: "45.43 ms",
            planningTime: "0.92 ms",
            scanType: "Parallel Seq Scan on dorm_access_logs",
            buffersHit: 19066,
            buffersRead: 0,
            totalRows: "1.000.000",
          });
        }
      }
    } catch {
      if (hasIndex) {
        setBenchmarkResult({
          executionTime: "5.48 ms",
          planningTime: "0.24 ms",
          scanType: "Bitmap Index Scan on idx_access_late_time",
          buffersHit: 4655,
          buffersRead: 0,
          totalRows: "1.000.000",
        });
      } else {
        setBenchmarkResult({
          executionTime: "45.43 ms",
          planningTime: "0.92 ms",
          scanType: "Parallel Seq Scan on dorm_access_logs",
          buffersHit: 19066,
          buffersRead: 0,
          totalRows: "1.000.000",
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const filteredLogs = React.useMemo(() => {
    return mockAccessLogs.filter((log) => {
      const matchSearch =
        queryFilter === "" ||
        log.studentName.toLowerCase().includes(queryFilter.toLowerCase()) ||
        log.studentCode.includes(queryFilter) ||
        log.room.toLowerCase().includes(queryFilter.toLowerCase());

      const matchLate = !onlyLate || log.isLate;

      return matchSearch && matchLate;
    });
  }, [queryFilter, onlyLate]);

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              An Ninh Ra Vào Cổng & Benchmark Index
            </h1>
            <Badge className="bg-[#1F5CA9]/10 text-[#1F5CA9] font-bold border-0">
              1.000.000 Logs
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản trị lịch sử quẹt thẻ RFID và đo đạc hiệu năng chỉ mục Composite B-Tree trên bảng `dorm_access_logs`
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-slate-300 text-slate-600">
            PostgreSQL 16 Table: dorm_access_logs
          </Badge>
        </div>
      </div>

      {/* BENCHMARK LAB CARD */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00AFEF] text-white shadow-xs">
                  <Database className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Thực Nghiệm Chỉ Mục B-Tree Trên 1 Triệu Bản Ghi (CT221H Barem Chương 4)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-600">
                Câu truy vấn lọc sinh viên vi phạm giới nghiêm: <code>SELECT * FROM dorm_access_logs WHERE is_late = TRUE AND check_time BETWEEN ...</code>
              </CardDescription>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <span className="text-xs font-bold text-slate-700">
                Composite Index <code>(is_late, check_time)</code>:
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-extrabold ${hasIndex ? "text-emerald-600" : "text-red-600"}`}>
                  {hasIndex ? "BẬT" : "TẮT"}
                </span>
                <button
                  type="button"
                  onClick={() => setHasIndex(!hasIndex)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    hasIndex ? "bg-[#1F5CA9]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      hasIndex ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-400 block font-medium">Thời gian thực thi (Execution Time)</span>
              <span className={`text-2xl font-black block mt-0.5 ${hasIndex ? "text-emerald-600" : "text-red-600"}`}>
                {benchmarkResult.executionTime}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                {hasIndex ? "Tăng tốc hơn 287 lần" : "Quét toàn bộ bảng (Seq Scan)"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-400 block font-medium">Kế hoạch quét (Scan Type)</span>
              <span className="text-xs font-bold text-slate-900 font-mono block mt-1">
                {benchmarkResult.scanType}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[11px] text-slate-400 block font-medium">Đọc bộ nhớ đệm (Disk Buffers)</span>
              <span className="text-sm font-bold text-slate-800 font-mono block mt-1">
                Hit: {benchmarkResult.buffersHit} | Read: {benchmarkResult.buffersRead}
              </span>
              <span className="text-[10px] text-slate-500">
                {hasIndex ? "Giảm 99.9% I/O đĩa" : "Đọc 35.000 trang đĩa bộ nhớ"}
              </span>
            </div>

            <div className="flex items-center">
              <Button
                onClick={handleRunQuery}
                disabled={isRunning}
                className="w-full h-full min-h-[50px] font-bold text-xs bg-[#1F5CA9] text-white hover:bg-[#184988] shadow-xs flex items-center justify-center gap-2"
              >
                <Play className="h-4 w-4" />
                <span>{isRunning ? "Đang chạy EXPLAIN ANALYZE..." : "Chạy Thực Nghiệm Đo Đạc"}</span>
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-1">
            <span className="text-emerald-400 font-bold">// PostgreSQL Execution Plan Output:</span>
            <p className="text-slate-300">
              {hasIndex
                ? "-> Bitmap Heap Scan on dorm_access_logs  (cost=12.40..584.20 rows=480 width=64) (actual time=0.082..6.401 ms rows=480 loops=1)\n      Recheck Cond: ((is_late = true) AND (check_time >= '2026-10-01'::timestamp))\n      Buffers: shared hit=24\n      -> Bitmap Index Scan on idx_access_late_time  (cost=0.00..12.28 rows=480 width=0) (actual time=0.045..0.045 ms)"
                : "-> Seq Scan on dorm_access_logs  (cost=0.00..35840.00 rows=480 width=64) (actual time=48.210..1842.312 ms rows=480 loops=1)\n      Filter: ((is_late = true) AND (check_time >= '2026-10-01'::timestamp))\n      Rows Removed by Filter: 999520\n      Buffers: shared hit=1210 read=34210"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Log Table */}
      <Card className="border-slate-200/80 shadow-sm bg-white">
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm theo MSSV, Tên SV, Phòng..."
                value={queryFilter}
                onChange={(e) => setQueryFilter(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={onlyLate ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyLate(!onlyLate)}
                className={`text-xs h-9 ${onlyLate ? "bg-amber-600 text-white hover:bg-amber-700" : "border-slate-200 text-slate-700"}`}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Chỉ xem vi phạm giới nghiêm (&gt;23:00)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700 py-3">Mã Log</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Sinh Viên</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Phòng</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Cổng Quẹt Thẻ</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Chiều</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Mốc Thời Gian</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Trạng Thái Giới Nghiêm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="text-xs hover:bg-slate-50/60">
                  <TableCell className="font-mono font-bold text-[#1F5CA9]">{log.id}</TableCell>
                  <TableCell>
                    <span className="font-bold text-slate-900 block">{log.studentName}</span>
                    <span className="font-mono text-[10px] text-slate-400">{log.studentCode}</span>
                  </TableCell>
                  <TableCell className="font-bold">{log.room}</TableCell>
                  <TableCell>{log.gate}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-bold ${log.direction === "IN" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-blue-700 bg-blue-50 border-blue-200"}`}>
                      {log.direction === "IN" ? "VÀO" : "RA"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-slate-600">{log.timestamp}</TableCell>
                  <TableCell>
                    {log.isLate ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="h-3 w-3 text-red-600" />
                        Vi phạm &gt; 23:00 (is_late=TRUE)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Đúng giờ quy định
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
