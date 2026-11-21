"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconBg?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  right,
  children,
  className = "",
  noPadding = false,
}: SectionCardProps) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${className}`}
    >
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-3">
          {title ? (
            <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
          ) : (
            <div />
          )}
          {right && <div className="flex flex-wrap items-center gap-2 shrink-0">{right}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}
