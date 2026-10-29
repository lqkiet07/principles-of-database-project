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
  HelpCircle,
  Building,
  Smartphone,
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
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Rooms & Beds", href: "/admin/rooms", icon: DoorOpen },
      { label: "Utility & Bills", href: "/admin/bills", icon: Zap },
      { label: "Students", href: "/admin/students", icon: Users },
      { label: "Contracts", href: "/admin/contracts", icon: FileText },
      { label: "Maintenance", href: "/admin/maintenance", icon: Wrench },
      { label: "Cổng Sinh Viên", href: "/student", icon: Smartphone },
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
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 shadow-sm",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Brand Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1F5CA9] text-white shadow-sm font-bold text-lg">
            KTX
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                  <div className="flex flex-1 items-center justify-between">
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

      {/* Footer Support Card */}
      {!collapsed ? (
        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00AFEF] text-white">
                <HelpCircle className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Hỗ trợ kỹ thuật
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mb-2.5">
              Cần giải đáp nghiệp vụ KTX? Liên hệ quản trị viên.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs font-medium h-7 bg-white dark:bg-slate-800 border-slate-200 text-[#1F5CA9] hover:bg-slate-50 shadow-none"
            >
              Liên hệ quản lý
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
            <span className="text-[10px] text-slate-400">v1.0.0</span>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-sidebar-border flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </aside>
  );
}
