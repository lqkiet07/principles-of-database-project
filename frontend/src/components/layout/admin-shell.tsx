"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  Building2,
  Fingerprint,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Wrench,
  X,
} from "lucide-react";
import { getRoleLabel, useAuth } from "@/lib/auth-context";

const ALL_NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, exact: true, superOnly: false },
  { href: "/admin/rooms", label: "Phòng ở", icon: BedDouble, superOnly: false },
  { href: "/admin/students", label: "Sinh viên", icon: GraduationCap, superOnly: false },
  { href: "/admin/attendance", label: "Điểm danh cổng KTX", icon: Fingerprint, superOnly: false },
  { href: "/admin/bills", label: "Hóa đơn điện nước", icon: Receipt, superOnly: false },
  { href: "/admin/maintenance", label: "Bảo trì", icon: Wrench, superOnly: false },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings, superOnly: true },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, kyHoc, maintenanceMode, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.superOnly || user?.vai_tro === "QUAN_LY"
  );

  const currentNav =
    navItems.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href)
    ) || navItems[0];

  const roleLabel = getRoleLabel(user?.vai_tro);

  const renderNavLinks = (onClickItem?: () => void) => (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Điều hướng quản lý">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClickItem}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[#1F5CA9] text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex h-15 items-center gap-2.5 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1F5CA9] text-white shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">KTX ĐH Cần Thơ</p>
            <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
          </div>
        </div>

        {renderNavLinks()}

        {kyHoc && (
          <div className="m-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 space-y-1">
            <div>
              <p className="text-slate-400">Phạm vi quản lý</p>
              <p className="font-semibold text-[#1F5CA9]">
                {user?.ma_khu_phu_trach ? `Khu ${user.ma_khu_phu_trach}` : "Khu A & Khu B"}
              </p>
            </div>
            <div className="pt-1 border-t border-slate-200">
              <p className="text-slate-400">Học kỳ hiện hành</p>
              <p className="mt-0.5 font-semibold text-slate-800">{kyHoc.ten_ky}</p>
            </div>
          </div>
        )}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/30"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-white border-r border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-15 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-sm font-bold text-slate-900">KTX ĐH Cần Thơ</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Đóng menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNavLinks(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:pl-60 min-w-0">
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
              className="lg:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 truncate">
              {currentNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {maintenanceMode && (
              <span className="hidden sm:inline-flex items-center rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">
                Đang bảo trì
              </span>
            )}

            <span className="hidden sm:inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1F5CA9]">
              {user?.ma_khu_phu_trach ? `Khu ${user.ma_khu_phu_trach}` : "Khu A & B"}
            </span>

            <span className="hidden md:inline text-sm font-medium text-slate-700">
              {user?.ho_ten_hien_thi}
            </span>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
