"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  Building2,
  Loader2,
  LogOut,
  Menu,
  Receipt,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const STUDENT_NAV = [
  { href: "/student", label: "Hóa đơn & Thanh toán", icon: Receipt, exact: true },
  { href: "/student/room", label: "Phòng ở & Đổi phòng", icon: BedDouble },
  { href: "/student/maintenance", label: "Báo hỏng & Thông báo", icon: Wrench },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    user,
    kyHoc,
    loading,
    maintenanceMode,
    phongHienTai,
    unreadNotifications,
    logout,
    refreshUser,
  } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.vai_tro !== "SINH_VIEN") {
      router.replace("/admin");
    }
  }, [user, loading, router]);

  if (loading || !user || user.vai_tro !== "SINH_VIEN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-[#1F5CA9]" />
        <span className="text-sm">Đang tải...</span>
      </div>
    );
  }

  if (maintenanceMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 text-center">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
          <h1 className="text-base font-bold text-slate-900">Hệ thống đang bảo trì</h1>
          <p className="text-sm text-slate-600">Vui lòng quay lại sau.</p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => refreshUser()}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-xl bg-[#1F5CA9] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#194B8B]"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentNav =
    STUDENT_NAV.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href)
    ) || STUDENT_NAV[0];

  const renderNavLinks = (onClickItem?: () => void) => (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Điều hướng sinh viên">
      {STUDENT_NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClickItem}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[#1F5CA9] text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-2.5 truncate">
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
              <span className="truncate">{item.label}</span>
            </span>
            {item.href === "/student/maintenance" && unreadNotifications > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? "bg-white text-[#1F5CA9]" : "bg-red-600 text-white"
                }`}
              >
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            )}
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
            <p className="text-xs text-slate-500 truncate">Phân hệ Sinh viên</p>
          </div>
        </div>

        {renderNavLinks()}

        <div className="m-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-800 truncate">{user.ho_ten_hien_thi}</p>
          <p className="mt-0.5 text-slate-500 truncate">
            {user.mssv}
            {phongHienTai?.ten_phong ? ` · Phòng ${phongHienTai.ten_phong}` : ""}
          </p>
          {kyHoc && <p className="mt-1 text-slate-400 truncate">{kyHoc.ten_ky}</p>}
        </div>
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
            <span className="hidden md:inline text-sm font-medium text-slate-700">
              {user.ho_ten_hien_thi}
              {phongHienTai?.ten_phong ? ` · Phòng ${phongHienTai.ten_phong}` : ""}
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

        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
