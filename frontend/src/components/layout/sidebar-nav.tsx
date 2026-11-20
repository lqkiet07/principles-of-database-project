"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/lib/demo-context";
import {
  LayoutDashboard,
  DoorOpen,
  Users,
  FileText,
  Zap,
  Wrench,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  highlight?: boolean;
}

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();
  const { isDemoMode } = useDemoMode();

  const navItems: NavItem[] = React.useMemo(() => {
    const baseItems: NavItem[] = [
      { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
      { label: "Phòng & Giường", href: "/admin/rooms", icon: DoorOpen },
      { label: "Điện nước & Hóa đơn", href: "/admin/bills", icon: Zap },
      { label: "Sinh viên", href: "/admin/students", icon: Users },
      { label: "Hợp đồng", href: "/admin/contracts", icon: FileText },
      { label: "Bảo trì", href: "/admin/maintenance", icon: Wrench },
    ];

    if (isDemoMode) {
      return [
        {
          label: "Demo Checkpoints",
          href: "/admin/demo-checkpoints",
          icon: GraduationCap,
          badge: "CT221H",
          highlight: true,
        },
        {
          label: "1M Logs & Index",
          href: "/admin/access-logs",
          icon: ShieldCheck,
        },
        ...baseItems,
      ];
    }

    return baseItems;
  }, [isDemoMode]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 shadow-sm w-[72px]",
        collapsed ? "md:w-[72px]" : "md:w-[240px]"
      )}
    >
      {/* Brand Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1F5CA9] text-white shadow-sm font-bold text-lg">
            KTX
          </div>
          {!collapsed && (
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-tight text-[#1F5CA9]">
                KTX Smart
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Dormitory Management
              </span>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation List */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[#1F5CA9] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white"
                  )}
                />
                {!collapsed && (
                  <div className="hidden md:flex flex-1 items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto text-[10px] font-bold px-1.5 py-0",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>
      </ScrollArea>

      {/* Footer Settings Link */}
      {!collapsed ? (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center justify-center md:justify-between px-1">
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              title="Cài đặt hệ thống"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Cài đặt hệ thống</span>
            </Link>
            <span className="hidden md:inline text-[10px] text-slate-500">v1.0.0</span>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-sidebar-border flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="hidden md:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Link
            href="/admin/settings"
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900"
            title="Cài đặt hệ thống"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      )}
    </aside>
  );
}
