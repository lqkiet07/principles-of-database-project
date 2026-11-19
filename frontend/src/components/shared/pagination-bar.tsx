"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  unitLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  unitLabel = "mục",
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Hiển thị{" "}
          <strong className="font-semibold text-slate-900">
            {start}–{end}
          </strong>{" "}
          trên tổng{" "}
          <strong className="font-semibold text-slate-900">{total}</strong>{" "}
          {unitLabel}
        </span>

        <label className="inline-flex items-center gap-1.5 text-slate-600">
          <span>Số dòng:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            aria-label="Số dòng mỗi trang"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-800 focus:border-[#1F5CA9] focus:outline-none focus:ring-2 focus:ring-[#1F5CA9]/20"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Trước
        </button>
        <span className="px-2.5 text-sm font-medium text-slate-700">
          Trang {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          Sau
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
