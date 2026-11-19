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
  subtitle,
  icon: Icon,
  iconBg = "bg-blue-50 text-[#1F5CA9]",
  right,
  children,
  className = "",
  noPadding = false,
}: SectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden ${className}`}
    >
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className={`rounded-xl p-2.5 shrink-0 ${iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-bold text-slate-900 truncate">{title}</h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {right && <div className="flex flex-wrap items-center gap-2 shrink-0">{right}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}
