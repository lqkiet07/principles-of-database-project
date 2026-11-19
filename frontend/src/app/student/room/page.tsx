"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, BedDouble, Loader2, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { formatDateTime, formatVND } from "@/lib/format";
import { SectionCard } from "@/components/shared/section-card";
import { TransferStatusBadge } from "@/components/shared/status-badge";

export default function StudentRoomPage() {
  const [data, setData] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [lyDo, setLyDo] = useState("");
  const [nvKhu, setNvKhu] = useState("");
  const [nvLoai, setNvLoai] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<any[] | null>(null);
  const [searchingSemantic, setSearchingSemantic] = useState(false);

  const loadRoom = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRes, contractRes] = await Promise.all([
        apiRequest("/api/student/room"),
        apiRequest("/api/student/contract").catch(() => null),
      ]);
      setData(roomRes);
      setContract(contractRes);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải thông tin phòng ở.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lyDo.trim().length < 5) {
      toast.error("Vui lòng nhập lý do đổi phòng (tối thiểu 5 ký tự).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<any>("/api/student/room-transfers", {
        method: "POST",
        body: {
          ly_do: lyDo.trim(),
          nguyen_vong_khu: nvKhu || null,
          nguyen_vong_loai: nvLoai ? Number(nvLoai) : null,
        },
      });
      toast.success(res.thong_bao || "Đã gửi yêu cầu đổi phòng.");
      setLyDo("");
      setNvKhu("");
      setNvLoai("");
      loadRoom();
    } catch (err: any) {
      toast.error(err.message || "Không thể gửi yêu cầu đổi phòng.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (semanticQuery.trim().length < 2) return;
    setSearchingSemantic(true);
    try {
      const res = await apiRequest<{ items: any[] }>(
        `/api/student/rooms/semantic-search?q=${encodeURIComponent(semanticQuery.trim())}&limit=4`
      );
      setSemanticResults(res.items || []);
    } catch (err: any) {
      toast.error(err.message || "Không thể tìm kiếm ngữ nghĩa.");
    } finally {
      setSearchingSemantic(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-[#1F5CA9]" />
        Đang tải thông tin phòng...
      </div>
    );
  }

  const phong = data?.phong;
  const roommates = data?.ban_cung_phong || [];
  const transfers = data?.yeu_cau_doi_phong || [];
  const hasPending = Boolean(data?.co_yeu_cau_dang_cho);
  const zones = data?.khu_list || [];
  const daKyHopDong = Boolean(contract?.hop_dong);

  return (
    <div className="space-y-5">
      {/* Khung bao 1: Thông tin phòng & hợp đồng */}
      <SectionCard
        title="Thông tin phòng ở hiện tại"
        subtitle={phong ? `${phong.ten_khu} · Phòng ${phong.ten_phong}` : "Chưa xếp phòng"}
        icon={BedDouble}
        right={
          phong ? (
            <span
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                daKyHopDong
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              Hợp đồng: {daKyHopDong ? "Đã ký" : "Chưa ký"}
            </span>
          ) : null
        }
      >
        {!phong ? (
          <p className="text-sm text-slate-500">Bạn chưa được xếp phòng trong kỳ này.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Phòng</p>
              <p className="mt-1 text-lg font-bold text-[#1F5CA9]">{phong.ten_phong}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Khu</p>
              <p className="mt-1 font-semibold text-slate-900">{phong.ten_khu}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Sĩ số</p>
              <p className="mt-1 font-semibold text-slate-900">
                {phong.so_nguoi_o} / {phong.suc_chua} người
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Nấu ăn</p>
              <p className="mt-1 font-semibold text-slate-900">
                {phong.co_nau_an ? "Có nấu ăn" : "Không nấu ăn"}
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Khung bao 2: Thành viên cùng phòng */}
      {roommates.length > 0 && (
        <SectionCard
          title="Thành viên trong phòng"
          subtitle={`${roommates.length} sinh viên đang lưu trú`}
          icon={Users}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">MSSV</th>
                  <th className="px-5 py-3">Họ tên</th>
                  <th className="px-5 py-3">Ngành</th>
                  <th className="px-5 py-3">SĐT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roommates.map((m: any) => (
                  <tr key={m.mssv}>
                    <td className="px-5 py-2.5 font-mono text-xs">{m.mssv}</td>
                    <td className="px-5 py-2.5 font-medium text-slate-900">
                      {m.ho_ten}
                      {m.la_dai_dien && (
                        <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-[#1F5CA9]">
                          Đại diện
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{m.nganh}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{m.sdt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Khung bao 3: Tìm phòng phù hợp theo mô tả + Gửi yêu cầu đổi phòng */}
      {phong && (
        <SectionCard
          title="Đổi phòng & Gợi ý phòng còn chỗ"
          subtitle="Tìm phòng theo nhu cầu và gửi yêu cầu đến Ban Quản lý"
          icon={ArrowLeftRight}
          iconBg="bg-indigo-50 text-indigo-700"
        >
          <div className="space-y-5">
            {/* Tìm kiếm ngữ nghĩa phòng còn chỗ */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700">
                Tìm phòng gợi ý theo nhu cầu (Tìm kiếm ngữ nghĩa AI)
              </p>
              <form onSubmit={handleSemanticSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={semanticQuery}
                    onChange={(e) => setSemanticQuery(e.target.value)}
                    placeholder="Ví dụ: phòng nữ 4 người có nấu ăn yên tĩnh tầng cao..."
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchingSemantic}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {searchingSemantic ? "Đang tìm..." : "Tìm phòng"}
                </button>
              </form>

              {semanticResults && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {semanticResults.length === 0 ? (
                    <p className="text-xs text-slate-500">Không có phòng trống phù hợp.</p>
                  ) : (
                    semanticResults.map((r) => (
                      <div
                        key={r.ma_phong}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            Phòng {r.ten_phong} ({r.ten_khu})
                          </span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-[#1F5CA9]">
                            Phù hợp {Math.round(r.similarity * 100)}%
                          </span>
                        </div>
                        <p className="text-slate-600">{r.mo_ta}</p>
                        <p className="text-slate-500">
                          Còn {r.suc_chua - r.so_nguoi_o} chỗ · {formatVND(r.gia_phong)}/kỳ
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {hasPending ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                Bạn đang có yêu cầu đổi phòng chờ Ban Quản lý duyệt.
              </p>
            ) : (
              <form onSubmit={handleSubmitTransfer} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={nvKhu}
                    onChange={(e) => setNvKhu(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                  >
                    <option value="">Nguyện vọng khu (tùy chọn)</option>
                    {zones.map((z: any) => (
                      <option key={z.ma_khu} value={z.ma_khu}>
                        {z.ten_khu}
                      </option>
                    ))}
                  </select>
                  <select
                    value={nvLoai}
                    onChange={(e) => setNvLoai(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                  >
                    <option value="">Nguyện vọng loại phòng (tùy chọn)</option>
                    <option value="4">Phòng 4 người</option>
                    <option value="6">Phòng 6 người</option>
                    <option value="8">Phòng 8 người</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                  placeholder="Nhập lý do muốn đổi phòng..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5CA9]"
                />
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
            )}

            {transfers.length > 0 && (
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Lịch sử yêu cầu đổi phòng</p>
                {transfers.map((tr: any) => (
                  <div
                    key={tr.ma_yc}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-slate-900">{tr.ly_do}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDateTime(tr.thoi_gian)}
                        {tr.ten_phong_moi ? ` · Phòng mới: ${tr.ten_phong_moi}` : ""}
                        {tr.ghi_chu_duyet ? ` · Ghi chú BQL: ${tr.ghi_chu_duyet}` : ""}
                      </p>
                    </div>
                    <TransferStatusBadge status={tr.trang_thai} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
