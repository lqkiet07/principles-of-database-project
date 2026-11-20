"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Moon, Sun, Search, Smartphone, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useDemoMode } from "@/lib/demo-context";
import { api } from "@/lib/api";
import { GraduationCap } from "lucide-react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { isDemoMode } = useDemoMode();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dbOnline, setDbOnline] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    api
      .health()
      .then((res) => {
        if (mounted) {
          setDbOnline(Boolean((res as { status?: string })?.status === "ok" || res?.success));
        }
      })
      .catch(() => {
        if (mounted) setDbOnline(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-white/80 dark:bg-slate-900/80 px-6 backdrop-blur-md">
      {/* Global Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchQuery.trim().toLowerCase();
          if (!q) return;
          const isRoom = /^(b[123]|p\.|phòng)/.test(q) || q.includes("-");
          router.push(isRoom ? "/admin/rooms" : "/admin/students");
        }}
        className="relative w-full max-w-md"
      >
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm phòng (B1-101) hoặc MSSV rồi nhấn Enter..."
          className="h-10 w-full rounded-full bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 text-sm border-slate-200 dark:border-slate-700 focus-visible:ring-[#1F5CA9]"
        />
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {dbOnline !== null && (
          <Badge
            variant="outline"
            className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              dbOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <Database className="h-3 w-3" />
            <span>{dbOnline ? "DB Online" : "Offline"}</span>
          </Badge>
        )}

        {/* Evaluator Demo Mode Pill - Only visible when turned ON in Settings */}
        {isDemoMode && (
          <Link href="/admin/demo-checkpoints">
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 shadow-xs"
            >
              <GraduationCap className="h-4 w-4 text-amber-700" />
              <span>Demo Checkpoints (6)</span>
            </Button>
          </Link>
        )}

        <Link href="/student">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs font-semibold text-[#1F5CA9] border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950"
          >
            <Smartphone className="h-3.5 w-3.5 text-[#00AFEF]" />
            <span className="hidden sm:inline">Cổng Sinh Viên</span>
          </Button>
        </Link>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9 rounded-full text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications with Static Status Dot */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-slate-600 hover:text-slate-900 dark:text-slate-300"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 border border-white dark:border-slate-900" />
          <span className="sr-only">Notifications</span>
        </Button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none cursor-pointer">
            <Avatar className="h-9 w-9 border-2 border-[#1F5CA9]/20">
                <AvatarFallback className="bg-[#1F5CA9] text-white text-xs font-semibold">
                  QL
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Quản lý Ký túc xá
                </span>
                <span className="text-[10px] text-muted-foreground">
                  admin@dormitory.edu.vn
                </span>
              </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>Tài khoản Quản trị</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Hồ sơ cá nhân</DropdownMenuItem>
            <DropdownMenuItem>Cài đặt hệ thống</DropdownMenuItem>
            <DropdownMenuItem>Nhật ký bảo mật</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">Đăng xuất</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
