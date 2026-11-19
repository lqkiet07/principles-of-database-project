"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatMonthLabel } from "@/lib/format";
import { Modal } from "@/components/shared/modal";

interface SendBillsModalProps {
  open: boolean;
  thang: string;
  selectedRoomIds: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SendBillsModal({
  open,
  thang,
  selectedRoomIds,
  onClose,
  onSuccess,
}: SendBillsModalProps) {
  const [mode, setMode] = useState<"all" | "rooms" | "student">("all");
  const [mssv, setMssv] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(selectedRoomIds.length > 0 ? "rooms" : "all");
      setMssv("");
    }
  }, [open, selectedRoomIds.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "rooms" && selectedRoomIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất một phòng.");
      return;
    }
    if (mode === "student" && !mssv.trim()) {
      toast.error("Vui lòng nhập MSSV.");
      return;
    }
    if (!window.confirm("Xác nhận gửi thông báo hóa đơn điện nước?")) return;

    setSending(true);
    try {
      const res = await apiRequest<any>("/api/admin/bills/send", {
        method: "POST",
        body: {
          thang,
          mode,
          ma_phong_list: mode === "rooms" ? selectedRoomIds : null,
          mssv: mode === "student" ? mssv.trim().toUpperCase() : null,
          gui_email_ctu: sendEmail,
        },
      });
      toast.success(res.thong_bao || "Đã gửi hóa đơn.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi hóa đơn.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title={`Gửi hóa đơn (${formatMonthLabel(thang)})`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="sendMode" checked={mode === "all"} onChange={() => setMode("all")} />
            <span className="text-sm font-medium text-slate-900">
              Gửi tất cả các phòng trong tháng {thang}
            </span>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="sendMode" checked={mode === "rooms"} onChange={() => setMode("rooms")} />
            <span className="text-sm font-medium text-slate-900">
              Gửi các phòng đang chọn ({selectedRoomIds.length} phòng)
            </span>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="sendMode" checked={mode === "student"} onChange={() => setMode("student")} />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-900">Gửi riêng cho một sinh viên</span>
              {mode === "student" && (
                <input
                  type="text"
                  required
                  value={mssv}
                  onChange={(e) => setMssv(e.target.value)}
                  placeholder="Nhập MSSV..."
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm uppercase"
                />
              )}
            </div>
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#1F5CA9]"
          />
          Gửi kèm email CTU
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F5CA9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194B8B] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gửi
          </button>
        </div>
      </form>
    </Modal>
  );
}
