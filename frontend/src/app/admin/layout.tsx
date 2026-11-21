"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isAdminRole, useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!isAdminRole(user.vai_tro)) {
      router.replace("/student");
    }
  }, [user, loading, router]);

  if (loading || !user || !isAdminRole(user.vai_tro)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-3 text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin text-[#1F5CA9]" />
        <p className="text-sm font-medium">Đang kiểm tra quyền truy cập...</p>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
