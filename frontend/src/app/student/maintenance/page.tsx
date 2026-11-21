"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2, Send, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatDateTime, ISSUE_GROUP_LABELS } from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";
import { MaintenanceStatusBadge } from "@/components/shared/status-badge";

export default function StudentMaintenanceAndNoticesPage() {
  const { unreadNotifications, setUnreadNotifications } = useAuth();
  const [tab, setTab] = useState<"maintenance" | "notifications">("maintenance");

  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [nhom, setNhom] = useState("DIEN");
  const [moTa, setMoTa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await apiRequest<any>("/api/student/maintenance");
      setTickets(res.items || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải danh sách bảo trì.");
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoadingNotices(true);
    try {
      const res = await apiRequest<any>("/api/student/notifications");
      setNotifications(res.items || []);
      setUnreadNotifications(res.so_chua_doc || 0);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải thông báo.");
    } finally {
      setLoadingNotices(false);
    }
  }, [setUnreadNotifications]);

  useEffect(() => {
    loadTickets();
    loadNotifications();
  }, [loadTickets, loadNotifications]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (moTa.trim().length < 5) {
      toast.error("Vui lòng mô tả tình trạng hỏng hóc (tối thiểu 5 ký tự).");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/student/maintenance", {
        method: "POST",
        body: { nhom_su_co: nhom, mo_ta: moTa.trim(), anh_url: null },
      });
      toast.success("Đã gửi phiếu báo hỏng.");
      setMoTa("");
      loadTickets();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async (maTb: number, alreadyRead: boolean) => {
    if (alreadyRead) return;
    try {
      await apiRequest(`/api/student/notifications/${maTb}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((item) => (item.ma_tb === maTb ? { ...item, da_doc: true } : item))
      );
      setUnreadNotifications(Math.max(0, unreadNotifications - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest("/api/student/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((item) => ({ ...item, da_doc: true })));
      setUnreadNotifications(0);
      toast.success("Đã đánh dấu đọc tất cả.");
    } catch (err: any) {
      toast.error(err.message || "Không thể cập nhật.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("maintenance")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
            tab === "maintenance"
              ? "bg-[#1F5CA9] text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Wrench className="h-4 w-4" />
          Báo hỏng & Sửa chữa
        </button>
        <button
          type="button"
          onClick={() => setTab("notifications")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
            tab === "notifications"
              ? "bg-[#1F5CA9] text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Thông báo</span>
          {unreadNotifications > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                tab === "notifications" ? "bg-white text-[#1F5CA9]" : "bg-red-600 text-white"
              }`}
            >
              {unreadNotifications}
            </span>
          )}
        </button>
      </div>

      {tab === "maintenance" ? (
        <div className="space-y-5">
          <SectionCard
            title="Gửi phiếu báo hỏng"
            subtitle="Phản ánh sự cố điện, nước, cơ sở vật chất tại phòng"
            icon={Wrench}
          >
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={nhom}
                  onChange={(e) => setNhom(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                >
                  <option value="DIEN">Điện</option>
                  <option value="NUOC">Nước</option>
                  <option value="NOI_THAT">Nội thất</option>
                  <option value="KHAC">Khác</option>
                </select>
                <input
                  type="text"
                  value={moTa}
                  onChange={(e) => setMoTa(e.target.value)}
                  placeholder="Mô tả sự cố cần sửa chữa..."
                  className="sm:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Lịch sử báo hỏng của phòng"
            subtitle={`${tickets.length} phiếu đã gửi`}
            icon={Wrench}
            iconBg="bg-slate-100 text-slate-700"
            noPadding
          >
            {loadingTickets ? (
              <div className="py-10 text-center text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
                Đang tải...
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Chưa có phiếu báo hỏng nào.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((t: any) => (
                  <div
                    key={t.ma_yc}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {ISSUE_GROUP_LABELS[t.nhom_su_co] || t.nhom_su_co}
                        </span>
                        <span>·</span>
                        <span>{formatDateTime(t.thoi_gian)}</span>
                      </div>
                      <p className="text-sm text-slate-900">{t.mo_ta}</p>
                      {(t.ngay_sua || t.sdt_nguoi_sua || t.ghi_chu_xu_ly) && (
                        <p className="text-xs text-[#1F5CA9] bg-blue-50/70 rounded-lg px-2.5 py-1.5 inline-block mt-1">
                          {t.ngay_sua ? `Ngày sửa: ${formatDate(t.ngay_sua)}` : ""}
                          {t.sdt_nguoi_sua ? ` · SĐT thợ: ${t.sdt_nguoi_sua}` : ""}
                          {t.ghi_chu_xu_ly ? ` · Ghi chú: ${t.ghi_chu_xu_ly}` : ""}
                        </p>
                      )}
                    </div>
                    <MaintenanceStatusBadge status={t.trang_thai} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : (
        <SectionCard
          title="Danh sách thông báo"
          subtitle={`${notifications.length} thông báo`}
          icon={Bell}
          noPadding
          right={
            unreadNotifications > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F5CA9] hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Đánh dấu tất cả đã đọc
              </button>
            ) : null
          }
        >
          {loadingNotices ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-[#1F5CA9]" />
              Đang tải...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Không có thông báo nào.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n: any) => {
                const isWarning = n.loai === "CANH_CAO";
                const isRevocation = n.loai === "THU_HOI_PHONG";
                return (
                  <div
                    key={n.ma_tb}
                    onClick={() => markRead(n.ma_tb, n.da_doc)}
                    className={`p-4 sm:px-5 cursor-pointer hover:bg-slate-50 ${
                      isRevocation
                        ? "bg-red-50/70 border-l-4 border-l-red-600"
                        : isWarning
                        ? "bg-amber-50/70 border-l-4 border-l-amber-500"
                        : !n.da_doc
                        ? "bg-blue-50/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isRevocation && (
                          <span className="rounded bg-red-100 border border-red-300 px-2 py-0.5 text-[11px] font-bold text-red-800">
                            Thông báo thu hồi phòng
                          </span>
                        )}
                        {isWarning && (
                          <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            Cảnh cáo vi phạm
                          </span>
                        )}
                        <p
                          className={`text-sm ${
                            isRevocation
                              ? "font-bold text-red-900"
                              : isWarning
                              ? "font-bold text-amber-900"
                              : !n.da_doc
                              ? "font-semibold text-slate-900"
                              : "font-medium text-slate-700"
                          }`}
                        >
                          {n.tieu_de}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {formatDateTime(n.thoi_gian)}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-sm ${
                        isRevocation
                          ? "text-red-900 font-medium"
                          : isWarning
                          ? "text-amber-900"
                          : "text-slate-600"
                      }`}
                    >
                      {n.noi_dung}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
