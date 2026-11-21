"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isAdminRole, useAuth } from "@/lib/auth-context";

export default function HomeRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (isAdminRole(user.vai_tro)) {
      router.replace("/admin");
    } else {
      router.replace("/student");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-3 text-slate-600">
      <Loader2 className="h-8 w-8 animate-spin text-[#1F5CA9]" />
      <p className="text-sm font-medium">Đang chuyển hướng hệ thống...</p>
    </div>
  );
}
