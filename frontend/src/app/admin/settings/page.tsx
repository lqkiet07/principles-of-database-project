"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { AccountsRoleTab } from "@/features/admin/settings/accounts-role-tab";
import { DbFeaturesTab } from "@/features/admin/settings/db-features-tab";
import { GeneralSettingsTab } from "@/features/admin/settings/general-settings-tab";
import { StructureSettingsTab } from "@/features/admin/settings/structure-settings-tab";

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<"general" | "structure" | "accounts" | "db">("general");
  const [settingsData, setSettingsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>("/api/admin/settings");
      setSettingsData(res);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải cài đặt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
            tab === "general" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Đơn giá, Hạn nộp &amp; Bảo trì
        </button>
        <button
          type="button"
          onClick={() => setTab("structure")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
            tab === "structure" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Khu, Phòng, Số giường &amp; Kỳ học
        </button>
        <button
          type="button"
          onClick={() => setTab("accounts")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
            tab === "accounts" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Phân quyền tài khoản
        </button>
        <button
          type="button"
          onClick={() => setTab("db")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
            tab === "db" ? "bg-[#1F5CA9] text-white" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Giao dịch, Trigger &amp; Chỉ mục
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
      {tab === "db" && <DbFeaturesTab />}
    </div>
  );
}
