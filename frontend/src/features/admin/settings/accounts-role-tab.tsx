"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import type { UserRole } from "@/lib/auth-context";
import { PaginationBar } from "@/components/shared/pagination-bar";

export function AccountsRoleTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [roleFilter, setRoleFilter] = useState("TAT_CA");
  const [search, setSearch] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        vai_tro: roleFilter,
        page: String(page),
        page_size: String(pageSize),
      });
      if (search.trim()) qs.set("search", search.trim());
      const res = await apiRequest<any>(`/api/admin/settings/accounts?${qs.toString()}`);
      setAccounts(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách tài khoản.");
    }
  }, [roleFilter, page, pageSize, search]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleChangeRole = async (acc: any, newRole: UserRole) => {
    if (acc.vai_tro === newRole) return;
    try {
      const res = await apiRequest<any>(`/api/admin/settings/accounts/${acc.ma_tk}/role`, {
        method: "PATCH",
        body: { vai_tro: newRole },
      });
      toast.success(res.thong_bao || "Đã cập nhật phân quyền.");
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật phân quyền.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative min-w-60 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm tên đăng nhập hoặc họ tên..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="TAT_CA">Tất cả vai trò</option>
          <option value="QUAN_LY">Ban Quản lý KTX (Khu A &amp; B)</option>
          <option value="QUAN_LY_KHU_A">Quản lý Khu A</option>
          <option value="QUAN_LY_KHU_B">Quản lý Khu B</option>
          <option value="SINH_VIEN">Sinh viên</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3.5">Tên đăng nhập</th>
                <th className="px-4 py-3.5">Họ tên</th>
                <th className="px-4 py-3.5 text-center">Phạm vi</th>
                <th className="px-4 py-3.5 text-right">Vai trò</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {accounts.map((acc) => (
                <tr key={acc.ma_tk} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                    {acc.ten_dang_nhap}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{acc.ho_ten_hien_thi}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    {acc.vai_tro === "QUAN_LY_KHU_A" ? (
                      <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 font-semibold text-[#1F5CA9]">
                        Khu A
                      </span>
                    ) : acc.vai_tro === "QUAN_LY_KHU_B" ? (
                      <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-semibold text-indigo-700">
                        Khu B
                      </span>
                    ) : acc.vai_tro === "QUAN_LY" ? (
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-700">
                        Khu A &amp; B
                      </span>
                    ) : (
                      <span className="text-slate-400">Cá nhân SV</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={acc.vai_tro}
                      onChange={(e) => handleChangeRole(acc, e.target.value as UserRole)}
                      aria-label={`Vai trò của ${acc.ten_dang_nhap}`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800"
                    >
                      <option value="QUAN_LY">Ban Quản lý KTX (Khu A &amp; B)</option>
                      <option value="QUAN_LY_KHU_A">Quản lý Khu A</option>
                      <option value="QUAN_LY_KHU_B">Quản lý Khu B</option>
                      <option value="SINH_VIEN">Sinh viên</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          unitLabel="tài khoản"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
