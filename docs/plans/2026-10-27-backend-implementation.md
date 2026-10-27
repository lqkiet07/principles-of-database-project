# Backend Implementation Plan — Smart Dormitory API + AI

> **For agentic workers:** REQUIRED SUB-SKILL: use `tdd` or inline execution task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Backend FastAPI phục vụ 2 Stored Procedure, trigger/audit, benchmark 1M log và 3 module AI; toàn bộ endpoint có test chạy trên PostgreSQL thật, 100% pass.

**Architecture:** FastAPI async → routers → services → repositories SQL thuần qua `psycopg3` pool. AI tách riêng `app/ai/`, đọc/ghi trực tiếp DB. Không ORM, không auth thật (header role), không ghi đè file DB của TV1 (trừ Task 15 có điều phối).

**Tech Stack:** Python 3.11+, FastAPI, `psycopg[binary,pool]>=3.2`, pydantic-settings, sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`, 384 chiều), scikit-learn, pytest + pytest-asyncio + httpx, ruff.

**Spec:** `docs/specs/2026-10-20-smart-dormitory-system.md`

## Global Constraints
- Response `snake_case`, envelope lỗi: `{success, status_code, error_code, message, data}`.
- SQL là nguồn chuẩn cho status code. Map HTTP: SP1 `0→201, 1→422, 2→409, 3→422, 99→500`; SP2 `0→200, 1→404, 2→409, 3→422, 4→422, 99→500`. Body giữ `status_code` gốc.
- Không auth/JWT: `X-Role: student|admin`, `X-Student-Id`. Admin routes yêu cầu `X-Role: admin`.
- Không sửa `database/01–05` (Task 15 mới sửa `02`, có bàn giao TV1). Không tạo hóa đơn kỳ `2026-10` trong seed lịch sử.
- Mỗi file < 500 dòng, hàm < 50 dòng; không debug log; không comment mô tả lại code.
- `.env`, `.venv`, `__pycache__`, model cache không commit.

## Review Focus (RF)
1. **Double-spending / concurrent payments** → Task 6 test concurrency + Task 9 evidence.
2. **Map sai status code hoặc trigger exception** → Task 2 parametrized + Task 8 tests 422/409.
3. **`current_occupancy` lệch sau assign/unassign** → Task 7 transaction tests.
4. **Benchmark không trung thực (số ảo, plan không đổi)** → Task 9 ép GUC, so `Buffers`; số thật.
5. **AI vô nghĩa do embedding giả/thiếu lịch sử, nhãn cụm sai** → Task 10 seed + Task 11/13 tests.

## File Map
```text
backend/
├── app/ main.py config.py db.py errors.py schemas.py
│   ├── routers/ students.py admin.py ai.py
│   ├── services/ students.py wallet.py billing.py rooms.py admin.py
│   └── ai/ embeddings.py semantic_search.py forecasting.py clustering.py
├── scripts/ reset_test_db.py seed_history.py embed_rooms.py capture_evidence.py
├── tests/ conftest.py test_health.py test_errors.py test_students.py test_wallet.py
│         test_billing.py test_payments.py test_admin_rooms.py test_meters_audit.py
│         test_benchmark.py test_seed.py test_ai_search.py test_ai_forecast.py
│         test_ai_clusters.py test_openapi.py
├── requirements.txt  README.md  .env.example
```

---

### Task 0: M0 — DB preflight gate
- [ ] `docker compose up -d` → `docker compose ps` báo `smart_dorm_postgres` healthy.
- [ ] Nạp `04` rồi `05` bằng `docker compose cp` + `psql -f`.
- [ ] **Gate:** `count(dorm_access_logs)=1.000.000`; `count(utility_bills)=2`; `count(audit_logs)>=1`; `pg_indexes` có `idx_access_late_time`; 6 test `[PASS]`.

### Task 1: Skeleton + config + pool + test DB
**Files:** `backend/requirements.txt`, `app/config.py`, `app/db.py`, `app/main.py`, `scripts/reset_test_db.py`, `tests/conftest.py`, `tests/test_health.py`, `.env.example`.
- [ ] **Test:** `test_health_returns_db_version` — `GET /health` = 200, `db_version` chứa `"PostgreSQL"`, `procedures` chứa 2 tên SP.
- [ ] **RED:** `pytest tests/test_health.py -v` fail.
- [ ] **Implement:** app factory, CORS, pool lifespan, script reset test DB.
- [ ] **GREEN:** pass; `ruff check app`.

### Task 2: Error envelope + status-code mapping (RF2)
**Files:** `app/errors.py`, `app/schemas.py`, `tests/test_errors.py`.
- [ ] **Test:** parametrize `(code,http,label)` cho 2 SP; `raise_sp_error(2,...)` → 409 `BILL_EXISTS`.
- [ ] **RED:** fail.
- [ ] **Implement:** mapping + handler; `schemas.py` base models.
- [ ] **GREEN:** pass.

### Task 3: Student read APIs (ST-02/03/06/07)
**Files:** `routers/students.py`, `services/students.py`, `tests/test_students.py`.
- [ ] **Tests:** profile B2100001 đúng tên/phòng B1-101; roommates gồm B2100002; debts join `month_year`,`total_amount`; transactions rỗng ban đầu; access summary trả `total`, `late_count`.
- [ ] **RED → Implement SQL → GREEN**.

### Task 4: Wallet top-up (ST-04)
**Files:** `routers/students.py`, `services/wallet.py`, `tests/test_wallet.py`.
- [ ] **Tests:** +500k đúng; 0/âm/vượt hạn → 422; SV lạ → 404.
- [ ] **RED → Implement → GREEN**.

### Task 5: SP1 — generate & split bill (RF5)
**Files:** `services/billing.py`, `routers/admin.py`, `tests/test_billing.py`.
- [ ] **Tests (kỳ 2026-11, phòng 1):** success → 201, total `750000`, split `375000`, count `2`; trùng kỳ → 409; `curr<prev` → 422; phòng trống → 422; `SUM(assigned_amount)=total` (N=2); `@pytest.mark.xfail(strict=True)` cho N=3.
- [ ] **RED → Implement → GREEN**.

### Task 6: SP2 — payment + concurrency (RF1)
**Files:** `services/billing.py`, `routers/payments.py`, `tests/test_payments.py`.
- [ ] **Tests:** trả đủ → ví giảm, debt `PAID`, bill `PAID` khi cùng phòng đã trả; trả một phần → debt `UNPAID`, bill `PARTIALLY_PAID`; sai SV → 404; đã trả → 409; vượt nợ → 422; thiếu tiền → 422; concurrency: 2 kết nối song song → đúng 1 success + 1 `DEBT_ALREADY_PAID`.
- [ ] **RED → Implement → GREEN**.

### Task 7: Admin rooms, assignments, dashboard (RF3)
**Files:** `services/rooms.py`, `services/admin.py`, `routers/admin.py`, `tests/test_admin_rooms.py`.
- [ ] **Tests:** gán SV thứ 3 vào phòng 1 → occupancy `3`; trùng giường → 409; vượt capacity → 422; trả phòng → occupancy `2`, `end_date` có giá trị; dashboard khớp `SUM(total_amount)`, đếm phòng/SV.
- [ ] **RED → Implement → GREEN**.

### Task 8: Meter PATCH + audit trail (AD-04/05, RF2)
**Files:** `services/admin.py`, `routers/admin.py`, `tests/test_meters_audit.py`.
- [ ] **Tests:** sửa bill UNPAID → 200 + 1 audit row; `curr<prev` → 422; bill PAID → 422; filter audit theo `record_id`.
- [ ] **RED → Implement → GREEN**.

### Task 9: Access logs + benchmark (AD-06, RF4)
**Files:** `services/admin.py`, `services/benchmark.py`, `routers/admin.py`, `tests/test_benchmark.py`.
- [ ] **Tests:** plan seq chứa `"Seq Scan"`; plan index chứa `"Index Scan"`/`"Bitmap"`; `buffers(index) < buffers(seq)`.
- [ ] **RED → Implement → GREEN**.

### Task 10: Seed lịch sử 24 tháng + skew log (RF5)
**Files:** `scripts/seed_history.py`, `tests/test_seed.py`.
- [ ] **Tests:** chạy 2 lần không đổi counts; mỗi tòa đủ 24 tháng; `curr` tháng M = `prev` tháng M+1; `SUM(assigned)=total`; 3 SV cú đêm có `late_count` cao hơn.
- [ ] **RED → Implement → GREEN**.

### Task 11: Embeddings + Semantic Search (ST-01, RF5)
**Files:** `app/ai/embeddings.py`, `app/ai/semantic_search.py`, `scripts/embed_rooms.py`, `routers/ai.py`, `tests/test_ai_search.py`.
- [ ] **Tests (mark ai):** reindex 6 phòng → vector 384 chiều, norm ≈ 1; query tiếng Việt top-2 thuộc B2; phòng `MAINTENANCE` bị loại.
- [ ] **RED → Implement → GREEN**.

### Task 12: Forecasting (AD-07, RF5)
**Files:** `app/ai/forecasting.py`, `routers/ai.py`, `tests/test_ai_forecast.py`.
- [ ] **Tests:** đủ 24 điểm lịch sử; 3 dự báo > 0; `mae` hữu hạn; building lạ → 404.
- [ ] **RED → Implement → GREEN**.

### Task 13: Clustering (AD-08, RF5)
**Files:** `app/ai/clustering.py`, `routers/ai.py`, `tests/test_ai_clusters.py`.
- [ ] **Tests:** 12 SV, 3 nhóm; centroid `unpaid_ratio` cao nhất → `FINANCIAL_RISK`, `late_count` cao nhất → `SECURITY_RISK`, còn lại `STANDARD`; mỗi điểm có toạ độ PCA.
- [ ] **RED → Implement → GREEN**.

### Task 14: Evidence + OpenAPI + README
**Files:** `scripts/capture_evidence.py`, `tests/test_openapi.py`, `backend/README.md`, `docs/evidence/backend/*.json`.
- [ ] **Tests:** OpenAPI chứa đủ path bắt buộc.
- [ ] **Implement + chạy script xuất JSON minh chứng**.

### Task 15: Full verification + M7 docs sync
**Files:** `database/02_procedures.sql`, `docs/specs/...`, `CHOT_QUYET_DINH_KY_THUAT.md`, root `README.md`.
- [ ] `pytest` toàn bộ + `ruff check .` → 0 fail; chạy lại `capture_evidence.py`.
- [ ] Fix rounding SP1 bù dư SV cuối, gỡ `xfail`, test N=3 pass.
- [ ] Đồng bộ spec theo SQL thực tế, cập nhật nhóm 4→3 người.
