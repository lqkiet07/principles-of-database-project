"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Info,
  Wrench,
  XCircle,
} from "lucide-react";

type Variant = "success" | "warning" | "danger" | "info" | "indigo" | "neutral";

const STYLES: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

const ICONS: Record<Variant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: Info,
  indigo: ClipboardCheck,
  neutral: AlertTriangle,
};

export function StatusBadge({
  variant,
  label,
  maintenanceIcon = false,
}: {
  variant: Variant;
  label: string;
  maintenanceIcon?: boolean;
}) {
  const Icon = maintenanceIcon ? Wrench : ICONS[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STYLES[variant]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

export function RoomStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "TRONG":
      return <StatusBadge variant="neutral" label="Trống" />;
    case "CON_CHO":
      return <StatusBadge variant="warning" label="Còn chỗ" />;
    case "DAY":
      return <StatusBadge variant="success" label="Đầy" />;
    case "BAO_TRI":
      return <StatusBadge variant="danger" label="Đang bảo trì" maintenanceIcon />;
    default:
      return <StatusBadge variant="neutral" label={status} />;
  }
}

export function BillStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "DA_NOP":
      return <StatusBadge variant="success" label="Đã nộp" />;
    case "CHUA_NOP":
      return <StatusBadge variant="danger" label="Chưa nộp" />;
    case "CHUA_NHAP":
      return <StatusBadge variant="neutral" label="Chưa nhập chỉ số" />;
    default:
      return <StatusBadge variant="neutral" label={status} />;
  }
}

export function MaintenanceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "MOI":
      return <StatusBadge variant="info" label="Mới" />;
    case "DA_TIEP_NHAN":
      return <StatusBadge variant="indigo" label="Đã tiếp nhận" />;
    case "DANG_XU_LY":
      return <StatusBadge variant="warning" label="Đang xử lý" maintenanceIcon />;
    case "HOAN_TAT":
      return <StatusBadge variant="success" label="Hoàn tất" />;
    default:
      return <StatusBadge variant="neutral" label={status} />;
  }
}

export function TransferStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "CHO_XU_LY":
      return <StatusBadge variant="warning" label="Chờ xử lý" />;
    case "DA_DUYET":
      return <StatusBadge variant="success" label="Đã duyệt" />;
    case "TU_CHOI":
      return <StatusBadge variant="danger" label="Từ chối" />;
    default:
      return <StatusBadge variant="neutral" label={status} />;
  }
}

export function ContractStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "DA_KY":
      return <StatusBadge variant="success" label="Đã ký" />;
    case "CHUA_KY":
      return <StatusBadge variant="warning" label="Chưa ký" />;
    case "HIEU_LUC":
      return <StatusBadge variant="success" label="Hiệu lực" />;
    case "HET_HAN":
      return <StatusBadge variant="neutral" label="Hết hạn" />;
    case "CHAM_DUT":
      return <StatusBadge variant="danger" label="Chấm dứt" />;
    default:
      return <StatusBadge variant="neutral" label={status} />;
  }
}
