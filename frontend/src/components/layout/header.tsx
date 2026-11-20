"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Smartphone, Database } from "lucide-react";
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

import { api } from "@/lib/api";

export function Header() {
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
          const raw = searchQuery.trim();
          const q = raw.toLowerCase();
          if (!q) return;
          const isRoom = /^(b[123]|p\.|phòng)/.test(q) || q.includes("-");
          router.push(`${isRoom ? "/admin/rooms" : "/admin/students"}?q=${encodeURIComponent(raw)}`);
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

        <Link href="/student">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs font-semibold text-[#1F5CA9] border-blue-200 hover:bg-blue-50 cursor-pointer"
          >
            <Smartphone className="h-3.5 w-3.5 text-[#0369A1]" />
            <span className="hidden sm:inline">Cổng Sinh Viên</span>
          </Button>
        </Link>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100 transition-colors outline-none cursor-pointer">
            <Avatar className="h-9 w-9 border-2 border-[#1F5CA9]/20">
              <AvatarFallback className="bg-[#1F5CA9] text-white text-xs font-semibold">
                QL
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800">
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
            <DropdownMenuItem
              onClick={() => router.push("/admin/settings")}
              className="cursor-pointer"
            >
              Cài đặt hệ thống
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/admin/access-logs")}
              className="cursor-pointer"
            >
              Nhật ký bảo mật
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/student")}
              className="cursor-pointer"
            >
              Cổng Sinh Viên
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
