"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AccountsRoleTab } from "@/features/admin/settings/accounts-role-tab";
import { GeneralSettingsTab } from "@/features/admin/settings/general-settings-tab";
import { StructureSettingsTab } from "@/features/admin/settings/structure-settings-tab";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.vai_tro === "QUAN_LY";

  const [tab, setTab] = useState<"general" | "structure" | "accounts">("general");
  const [settingsData, setSettingsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<any>("/api/admin/settings");
      setSettingsData(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải cài đặt.");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-bold">Không đủ thẩm quyền truy cập</h2>
          <p className="mt-1 text-sm text-amber-800">
            Chỉ Ban Quản lý toàn KTX mới có quyền cài đặt hệ thống và phân quyền tài khoản Khu A / Khu B.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !settingsData) {
    return (
      <div className="py-20 text-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
        Đang tải...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
            tab === "general" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Đơn giá &amp; Hạn nộp
        </button>
        <button
          type="button"
          onClick={() => setTab("structure")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
            tab === "structure" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Khu, Phòng &amp; Kỳ học
        </button>
        <button
          type="button"
          onClick={() => setTab("accounts")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
            tab === "accounts" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Phân quyền tài khoản
        </button>
      </div>

      {tab === "general" && (
        <GeneralSettingsTab settingsData={settingsData} onReload={loadSettings} />
      )}
      {tab === "structure" && (
        <StructureSettingsTab
          zones={settingsData?.khu_list || []}
          semesters={settingsData?.ky_hoc_list || []}
          onReloadSettings={loadSettings}
        />
      )}
      {tab === "accounts" && <AccountsRoleTab />}
    </div>
  );
}
