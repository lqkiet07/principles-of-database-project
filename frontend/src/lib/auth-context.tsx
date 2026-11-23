"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  apiRequest,
  getStoredToken,
  registerApiHandlers,
  setStoredToken,
} from "@/lib/api";

export type UserRole = "QUAN_LY" | "QUAN_LY_KHU_A" | "QUAN_LY_KHU_B" | "SINH_VIEN";

export function isAdminRole(role?: string | null): boolean {
  return role === "QUAN_LY" || role === "QUAN_LY_KHU_A" || role === "QUAN_LY_KHU_B";
}

export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case "QUAN_LY":
      return "Ban Quản lý KTX (Khu A & B)";
    case "QUAN_LY_KHU_A":
      return "Quản lý Khu A";
    case "QUAN_LY_KHU_B":
      return "Quản lý Khu B";
    case "SINH_VIEN":
      return "Sinh viên";
    default:
      return role || "";
  }
}

export interface AuthUser {
  ma_tk: number;
  ten_dang_nhap: string;
  vai_tro: UserRole;
  ma_khu_phu_trach?: "A" | "B" | null;
  mssv: string | null;
  ho_ten_hien_thi: string;
}

export interface ActiveSemester {
  ma_ky: string;
  ten_ky: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
}

export interface StudentRoomBrief {
  ma_phong: number;
  ten_phong: string;
  ma_khu: string;
  la_dai_dien: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  maintenanceMode: boolean;
  kyHoc: ActiveSemester | null;
  phongHienTai: StudentRoomBrief | null;
  unreadNotifications: number;
  login: (tenDangNhap: string, matKhau: string) => Promise<AuthUser>;
  logout: (reason?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUnreadNotifications: (count: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [kyHoc, setKyHoc] = useState<ActiveSemester | null>(null);
  const [phongHienTai, setPhongHienTai] = useState<StudentRoomBrief | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback(
    (reason?: string) => {
      setStoredToken(null);
      setUser(null);
      setPhongHienTai(null);
      setUnreadNotifications(0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (reason) {
        toast.warning(reason);
      }
      router.replace("/login");
    },
    [router]
  );

  const logout = useCallback(
    async (reason?: string) => {
      const token = getStoredToken();
      if (token) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          skipAuthRedirect: true,
        }).catch(() => {});
      }
      clearSession(reason);
    },
    [clearSession]
  );

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<any>("/api/auth/me", {
        skipAuthRedirect: true,
      });
      setUser(data.user);
      setMaintenanceMode(Boolean(data.maintenance_mode));
      setKyHoc(data.ky_hoc_hien_tai || null);
      setPhongHienTai(data.phong_hien_tai || null);
      setUnreadNotifications(Number(data.thong_bao_chua_doc || 0));
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    registerApiHandlers(
      (msg) => clearSession(msg),
      () => setMaintenanceMode(true)
    );
  }, [clearSession]);

  // Ghi nhận lượt truy cập trang web (1 lần mỗi phiên mở trình duyệt)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "ktx_web_visit_recorded";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      apiRequest("/api/auth/track-visit", {
        method: "POST",
        body: { duong_dan: window.location.pathname || "/" },
        skipAuthRedirect: true,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout("Phiên đăng nhập đã hết hạn sau 30 phút không hoạt động.");
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, logout]);

  const login = useCallback(
    async (tenDangNhap: string, matKhau: string): Promise<AuthUser> => {
      const data = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: { ten_dang_nhap: tenDangNhap, mat_khau: matKhau },
        skipAuthRedirect: true,
      });
      setStoredToken(data.access_token);
      setUser(data.user);
      setMaintenanceMode(Boolean(data.maintenance_mode));
      setKyHoc(data.ky_hoc_hien_tai || null);
      await refreshUser();
      return data.user as AuthUser;
    },
    [refreshUser]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        maintenanceMode,
        kyHoc,
        phongHienTai,
        unreadNotifications,
        login,
        logout,
        refreshUser,
        setUnreadNotifications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return ctx;
}
