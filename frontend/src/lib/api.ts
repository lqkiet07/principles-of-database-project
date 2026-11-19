export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface ApiResponse<T> {
  success: boolean;
  status_code: number;
  error_code: string | null;
  message: string;
  data: T;
}

export interface StudentProfile {
  student_id: string;
  full_name: string;
  gender?: string;
  email: string;
  phone: string;
  major: string;
  cohort?: number;
  status: string;
  wallet: {
    balance: number;
    updated_at: string | null;
  };
  wallet_balance?: number;
}

export interface StudentRoomInfo {
  assignment_id: number;
  room_id: number;
  room_number: string;
  building_id: string;
  building_name: string;
  gender_zone: string;
  bed_number: number | string;
  start_date: string;
  end_date: string | null;
  base_price?: number;
  description?: string;
  roommates: {
    student_id: string;
    full_name: string;
    bed_number: number | string;
    major?: string;
    phone?: string;
  }[];
}

export interface StudentDebt {
  debt_id: number;
  bill_id: number;
  student_id: string;
  room_id: number;
  room_number: string;
  month_year: string;
  assigned_amount: number;
  paid_amount: number;
  debt_status: "UNPAID" | "PAID";
  total_room_bill: number;
  bill_total_amount?: number;
  prev_electric: number;
  curr_electric: number;
  prev_water: number;
  curr_water: number;
}

export interface PaymentReceipt {
  tx_id: number;
  debt_id: number;
  bill_id: number;
  student_id: string;
  amount: number;
  tx_time: string;
  reference_code: string;
  status: string;
}

export interface DashboardSummary {
  total_buildings: number;
  total_rooms: number;
  total_capacity: number;
  total_occupancy: number;
  occupancy_rate: number;
  total_students: number;
  total_unpaid_debt: number;
  total_power_kwh: number;
}

export interface RoomOccupant {
  assignment_id: number;
  student_id: string;
  full_name: string;
  major: string;
  bed_number: number;
  start_date: string;
  end_date: string | null;
}

export interface RoomItem {
  room_id: number;
  room_number: string;
  building_id: string;
  building_name: string;
  gender_zone: string;
  capacity: number;
  current_occupancy: number;
  base_price: number;
  description: string;
  status: "AVAILABLE" | "FULL" | "MAINTENANCE";
  occupants?: RoomOccupant[];
}

export interface AdminBillItem {
  bill_id: number;
  room_id: number;
  room_number: string;
  building_id: string;
  building_name: string;
  occupants: number;
  month_year: string;
  prev_electric: number;
  curr_electric: number;
  prev_water: number;
  curr_water: number;
  total_amount: number;
  paid_amount: number;
  bill_status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  created_at: string | null;
}

export interface AdminStudentItem {
  student_id: string;
  full_name: string;
  gender: string;
  email: string;
  phone: string;
  major: string;
  cohort: number;
  status: string;
  wallet_balance: number;
  assignment_id: number | null;
  room_id: number | null;
  room_number: string | null;
  building_id: string | null;
  bed_number: number | null;
  start_date: string | null;
  end_date: string | null;
  unpaid_debt: number;
  late_count: number;
}

export interface AdminAssignmentItem {
  assignment_id: number;
  room_id: number;
  room_number: string;
  building_id: string;
  building_name: string;
  base_price: number;
  capacity: number;
  current_occupancy: number;
  student_id: string;
  full_name: string;
  major: string;
  phone: string;
  bed_number: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface AccessLogEntry {
  log_id: number;
  student_id: string;
  student_name?: string;
  gate_name: string;
  check_time: string;
  is_late: boolean;
}

export interface AuditLogItem {
  log_id: number;
  table_name: string;
  action_type: string;
  record_id: string;
  changed_by: string;
  changed_at: string;
  reason: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface BenchmarkResult {
  mode: string;
  execution_time_ms: number;
  planning_time_ms: number;
  node_type: string;
  shared_hit_blocks: number;
  shared_read_blocks: number;
  total_buffers: number;
  rows_returned: number;
  plan: Record<string, unknown>;
}

export interface ForecastData {
  building_id: string;
  building_name: string;
  model_name: string;
  mae: number;
  history: {
    month_year: string;
    actual_kwh: number;
    total_bill: number;
  }[];
  predictions: {
    month_year: string;
    predicted_kwh: number;
  }[];
}

export interface ClusterSummary {
  total_students: number;
  clusters: {
    cluster_id: number;
    label: string;
    label_vi: string;
    description: string;
    student_count: number;
    avg_late_count: number;
    avg_unpaid_ratio: number;
    avg_power_kwh: number;
  }[];
  points: {
    student_id: string;
    full_name: string;
    room_number: string;
    late_count: number;
    unpaid_ratio: number;
    avg_power_kwh: number;
    cluster_id: number;
    cluster_label: string;
    pca_x: number;
    pca_y: number;
  }[];
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isAdmin = false
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (isAdmin || path.includes("/api/admin")) {
    headers["X-Role"] = "admin";
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({
    success: false,
    status_code: res.status,
    error_code: "NETWORK_ERROR",
    message: `Lỗi kết nối máy chủ (${res.status})`,
    data: null,
  }));

  if (!res.ok && json.success === undefined) {
    return {
      success: false,
      status_code: res.status,
      error_code: "HTTP_ERROR",
      message: json.detail || json.message || `Lỗi HTTP ${res.status}`,
      data: null as unknown as T,
    };
  }

  return json;
}

export const api = {
  // System
  health: () => request<{ status: string; db_version: string; procedures: string[] }>("/health"),

  // Students Portal
  getStudentProfile: (studentId: string) =>
    request<StudentProfile>(`/api/students/${studentId}`),

  getStudentRoom: (studentId: string) =>
    request<StudentRoomInfo>(`/api/students/${studentId}/room`),

  getStudentDebts: (studentId: string) =>
    request<StudentDebt[]>(`/api/students/${studentId}/debts`),

  getStudentTransactions: (studentId: string) =>
    request<PaymentReceipt[]>(`/api/students/${studentId}/transactions`),

  getStudentAccessLogs: (studentId: string) =>
    request<{
      total: number;
      late_count: number;
      items: AccessLogEntry[];
    }>(`/api/students/${studentId}/access-logs`),

  topupWallet: (studentId: string, amount: number) =>
    request<{ student_id: string; amount_added: number; new_balance: number }>(
      `/api/students/${studentId}/wallet/topup`,
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      }
    ),

  // Payments (SP2 ACID)
  payDebt: (studentId: string, debtId: number, amount: number) =>
    request<{
      status_code: number;
      tx_code: string;
      student_id: string;
      debt_id: number;
      amount_paid: number;
      remaining_balance: number;
      remaining_debt: number;
      message: string;
    }>("/api/payments", {
      method: "POST",
      body: JSON.stringify({ student_id: studentId, debt_id: debtId, amount }),
    }),

  // Admin Dashboard & Management
  getDashboard: () => request<DashboardSummary>("/api/admin/dashboard", {}, true),

  getRooms: (query: { building_id?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.building_id) params.set("building_id", query.building_id);
    if (query.status) params.set("status", query.status);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<RoomItem[]>(`/api/admin/rooms${qs}`, {}, true);
  },

  getBills: (query: { month_year?: string; status?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (query.month_year) params.set("month_year", query.month_year);
    if (query.status) params.set("status", query.status);
    if (query.limit) params.set("limit", String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<AdminBillItem[]>(`/api/admin/bills${qs}`, {}, true);
  },

  getStudents: () => request<AdminStudentItem[]>("/api/admin/students", {}, true),

  getAssignments: () =>
    request<AdminAssignmentItem[]>("/api/admin/assignments", {}, true),

  createAssignment: (payload: {
    room_id: number;
    student_id: string;
    bed_number: number;
    start_date: string;
    end_date?: string | null;
  }) =>
    request<{
      assignment_id: number;
      room_id: number;
      student_id: string;
      bed_number: number;
      start_date: string;
      end_date: string | null;
      is_active: boolean;
    }>("/api/admin/assignments", { method: "POST", body: JSON.stringify(payload) }, true),

  checkoutAssignment: (assignmentId: number) =>
    request<{ assignment_id: number; is_active: boolean; end_date: string }>(
      `/api/admin/assignments/${assignmentId}`,
      { method: "DELETE" },
      true
    ),

  resetDemoCheckpoints: () =>
    request<{
      reset_month: string;
      cp4_student_id: string;
      cp4_debt_id: number | null;
      cp4_assigned_amount: number;
    }>("/api/admin/demo/reset", { method: "POST" }, true),

  generateBill: (payload: {
    room_id: number;
    month_year: string;
    prev_electric: number;
    curr_electric: number;
    prev_water: number;
    curr_water: number;
  }) =>
    request<{
      bill_id: number;
      room_id: number;
      month_year: string;
      total_amount: number;
      split_amount: number;
      student_count: number;
      status_code: number;
      message: string;
      debts: {
        debt_id: number;
        student_id: string;
        assigned_amount: number;
        paid_amount: number;
        debt_status: "UNPAID" | "PAID";
      }[];
    }>("/api/admin/bills", { method: "POST", body: JSON.stringify(payload) }, true),

  patchBillMeters: (
    billId: number,
    payload: { curr_electric: number; curr_water: number }
  ) =>
    request<{
      bill_id: number;
      room_id: number;
      month_year: string;
      prev_electric: number;
      curr_electric: number;
      prev_water: number;
      curr_water: number;
      total_amount: number;
      paid_amount: number;
      bill_status: string;
    }>(
      `/api/admin/bills/${billId}/meters`,
      { method: "PATCH", body: JSON.stringify(payload) },
      true
    ),

  getAuditLogs: (recordId?: string) => {
    const qs = recordId ? `?record_id=${encodeURIComponent(recordId)}` : "";
    return request<AuditLogItem[]>(`/api/admin/audit-logs${qs}`, {}, true);
  },

  getAccessLogs: (
    query: {
      limit?: number;
      offset?: number;
      late?: boolean;
      student_id?: string;
      gate_name?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (query.limit) params.set("limit", String(query.limit));
    if (query.offset) params.set("offset", String(query.offset));
    if (query.late !== undefined) params.set("late", String(query.late));
    if (query.student_id) params.set("student_id", query.student_id);
    if (query.gate_name) params.set("gate_name", query.gate_name);
    return request<{ total: number; late_count: number; items: AccessLogEntry[] }>(
      `/api/admin/access-logs?${params.toString()}`,
      {},
      true
    );
  },

  runBenchmark: (mode: "index" | "seq" | "natural" = "index") =>
    request<BenchmarkResult>(`/api/admin/benchmark?mode=${mode}`, {}, true),

  reindexAi: () =>
    request<{ reindexed_count: number }>("/api/admin/ai/reindex", { method: "POST" }, true),

  // AI Engine
  semanticSearch: (query: string, limit = 5) =>
    request<
      (RoomItem & {
        cosine_distance: number;
        similarity: number;
      })[]
    >(`/api/ai/semantic-search?q=${encodeURIComponent(query)}&limit=${limit}`),

  getForecast: (buildingId = "B1") =>
    request<ForecastData>(`/api/ai/forecast?building_id=${buildingId}`),

  getClusters: () => request<ClusterSummary>("/api/ai/clusters"),
};
