const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "ktx_ctu_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

type UnauthorizedHandler = (reason?: string) => void;
type MaintenanceHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;
let onMaintenance: MaintenanceHandler | null = null;

export function registerApiHandlers(
  unauth: UnauthorizedHandler,
  maint: MaintenanceHandler
) {
  onUnauthorized = unauth;
  onMaintenance = maint;
}

export async function apiRequest<T = any>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    formData?: FormData;
    skipAuthRedirect?: boolean;
  } = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let fetchBody: BodyInit | undefined;
  if (options.formData) {
    fetchBody = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: fetchBody,
    });
  } catch (err: any) {
    throw new ApiError(0, "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.");
  }

  if (res.status === 503) {
    if (onMaintenance) onMaintenance();
    throw new ApiError(503, "Hệ thống đang bảo trì theo kế hoạch. Vui lòng quay lại sau.");
  }

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    const msg = data.detail || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (!options.skipAuthRedirect && onUnauthorized) {
      onUnauthorized(msg);
    }
    throw new ApiError(401, msg);
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? Array.isArray((data as any).detail)
          ? (data as any).detail.map((d: any) => d.msg || String(d)).join("; ")
          : String((data as any).detail)
        : `Lỗi máy chủ (${res.status})`;
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

export async function apiDownload(path: string, fallbackFilename: string): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail || "Không thể tải tập tin.");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match ? match[1] : fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
