"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { RoomMaintStatus } from "./types";

interface RoomStatusGridProps {
  rooms: RoomMaintStatus[];
}

export function RoomStatusGrid({ rooms }: RoomStatusGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {rooms.map((r) => (
        <div
          key={r.ma_phong}
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">{r.ten_phong}</span>
            <span className="text-xs text-slate-500">Khu {r.ma_khu}</span>
          </div>
          <div>
            {r.tinh_trang_bao_tri === "DANG_BAO_TRI" ? (
              <StatusBadge variant="danger" label="Đang bảo trì" maintenanceIcon />
            ) : r.tinh_trang_bao_tri === "CO_YEU_CAU" ? (
              <StatusBadge variant="warning" label={`${r.so_yc_bao_tri} yêu cầu`} />
            ) : (
              <StatusBadge variant="success" label="Bình thường" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
