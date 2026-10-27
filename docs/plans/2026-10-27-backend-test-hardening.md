# Backend Test Hardening & Verification Plan

> **For agentic workers:** Execute Task 1 -> Task 5 sequentially. Do not commit or push unless explicitly requested.

**Goal:** Make the backend test suite reproducible on a clean database, remove the SQL 05 false-positive, and synchronize documentation; final state is 56/56 pytest passing, ruff clean, and no false PASS in SQL 05.

**Architecture:** Isolate pytest from the main database through `conftest.py` plus a PowerShell runner; make the PAID-bill tamper test deterministic; convert `05_test_cases.sql` into a transactional, self-rollback script; do not change stored procedures, triggers, or schema.

**Tech Stack:** Python 3.12, pytest + pytest-asyncio, psycopg3, PostgreSQL 16 + pgvector, PowerShell 5.1.

**Spec:** `.handoffs/HANDOFF_backend-ai-complete_2026-10-27.md` and the 2026-10-27 verification results.

## Global Constraints
- Main database `smart_dormitory_db` is read-only; never write or delete there.
- All writes run on `smart_dormitory_test`.
- Do not modify `database/01_schema.sql`, `02_procedures.sql`, or `03_triggers.sql`.
- Do not change API, stored procedures, or triggers; the trigger was proven correct with `prev=100`, `curr=50` -> `check_violation`.
- Do not commit or push.
- Do not build the frontend or thesis report in this plan.
- Keep files below 500 lines and functions below 50 lines; leave no debug logging.

## Review Focus
1. Tests must never touch the main database.
2. The PAID-bill test must be deterministic and must not use `LIMIT 1`.
3. SQL 05 must not swallow `[FAIL]` through `WHEN OTHERS`.
4. SQL 05 must roll back cleanly and leave row counts unchanged.
5. Documentation must match the actual test count, commit count, and benchmark source.

---

### Task 1: Isolate tests from the main database

**Files:**
- Modify: `backend/tests/conftest.py`
- Create: `backend/scripts/run_tests.ps1`
- Modify: `backend/README.md`

**Interfaces:**
- `settings.test_database_url` is the default test database.
- The runner accepts optional pytest arguments and returns pytest's exit code.

- [ ] **Step 1: Add the guard in `conftest.py`**
  - Before importing `app.db`/`app.main`:
    ```python
    from app.config import settings
    settings.database_url = settings.test_database_url
    if "test" not in settings.database_url.lower():
        raise RuntimeError("Refusing to run tests against a non-test database")
    ```
  - Add a session fixture check for:
    - `dorm_access_logs >= 1_000_000`
    - 144 historical `utility_bills` rows (6 rooms x 24 months)
  - Fail early with `Run scripts/run_tests.ps1` when the test database is not seeded.

- [ ] **Step 2: Create `backend/scripts/run_tests.ps1`**
  - Run `reset_test_db --with-logs`.
  - Set `$env:DATABASE_URL` from `settings.test_database_url` (do not hardcode credentials).
  - Run `python -m scripts.seed_history`.
  - Run `python -m pytest @PytestArgs`.
  - Return pytest's exit code.

- [ ] **Step 3: Verify RED/GREEN**
  - RED: run `pytest` without an env override and confirm it selects the test database, not the main one.
  - GREEN: `run_tests.ps1` runs the suite against `smart_dormitory_test`.

---

### Task 2: Fix the PAID-bill tamper test

**Files:**
- Modify: `backend/tests/test_meters_audit.py:81-106`

**Interfaces:**
- Use the existing `setup_test_bill(room_id=2)` helper.
- Do not depend on a PAID bill already present in the seed.

- [ ] **Step 1: Write the deterministic test**
  - Create a dedicated bill with `setup_test_bill(room_id=2)` (`prev=100`, `curr=350`).
  - Run `UPDATE utility_bills SET bill_status='PAID' WHERE bill_id=%s`.
  - PATCH `{"curr_electric": 360, "curr_water": 38}` (both above previous values).
  - Assert `422` and `error_code == "FRAUD_PAID_BILL_TAMPER"`.

- [ ] **Step 2: Verify RED**
  - On a clean database the old test fails with
    `FRAUD_METER_REVERSAL != FRAUD_PAID_BILL_TAMPER`.
  - The new test must fail before the fix if the seam is wrong.

- [ ] **Step 3: Verify GREEN**
  - `pytest tests/test_meters_audit.py -q` passes.
  - Do not reorder trigger rules.

---

### Task 3: Harden `database/05_test_cases.sql`

**Files:**
- Modify: `database/05_test_cases.sql`

**Interfaces:**
- Run with:
  `docker exec ... psql -v ON_ERROR_STOP=1 -f /tmp/05.sql`
- Leave no data behind after a successful run.

- [ ] **Step 1: Add the guard and transaction**
  - Guard before `BEGIN`:
    ```sql
    DO $$
    BEGIN
      IF current_database() = 'smart_dormitory_db' THEN
        RAISE EXCEPTION 'Refusing to run destructive test suite on main DB';
      END IF;
    END $$;
    ```
  - Add `BEGIN;` after `\timing on`; add `ROLLBACK;` at the end.

- [ ] **Step 2: Fix Test 2**
  - Capture `v_bill_id` for room 1, month `2026-10`.
  - Select debts with `bill_id = v_bill_id`; remove `LIMIT 1`.

- [ ] **Step 3: Fix Test 4.1**
  - Create a room 3 bill for `2026-10` with `prev_electric=100`.
  - UPDATE `curr_electric=50`.
  - Catch only `WHEN check_violation`; remove `WHEN OTHERS`.
  - If the UPDATE succeeds, `RAISE [FAIL]` must propagate.

- [ ] **Step 4: Fix Test 4.2**
  - Catch only `WHEN integrity_constraint_violation`; remove `WHEN OTHERS`.

- [ ] **Step 5: Test 5 and Test 6**
  - Test 5: add a `DO` block asserting an audit row exists and `old_data <> new_data`.
  - Test 6: keep it as a manual benchmark and label it as such.

- [ ] **Step 6: Verify**
  - Run twice on a clean database.
  - Expect six real `[PASS]` lines (Tests 1, 2, 3, 4.1, 4.2, 5) and no `[PASS]` containing `[FAIL]`.
  - Row counts are unchanged because of `ROLLBACK`.

---

### Task 4: Synchronize documentation

**Files:**
- Modify: `README.md` (lines 15, 54, 84)
- Modify: `backend/README.md` (lines 27, 52-53)
- Modify: `CHOT_QUYET_DINH_KY_THUAT.md` (line 126)
- Modify: `.handoffs/HANDOFF_backend-ai-complete_2026-10-27.md`
- Create: `docs/verification/2026-10-27-backend-verification.md`

- [ ] **Step 1: Test count**
  - Change 55/54 to 56 in README, backend README, and CHOT.

- [ ] **Step 2: Benchmark numbers**
  - Evidence API: `19,066 -> 4,655` buffers.
  - Clean-room `05`: `9,346 -> 590` buffers.
  - State clearly that these are two different harnesses.

- [ ] **Step 3: Handoff correction**
  - 15 -> 16 commits ahead.
  - Note that the suite was 55/56 before the fix and 56/56 after.
  - Note the Windows `--reload` requirement for uvicorn 0.54.

- [ ] **Step 4: Verification report**
  - Record PASS/FAIL per phase, both HIGH root causes, and measured numbers.

---

### Task 5: Final verification

- [ ] `backend/scripts/run_tests.ps1` -> 56 passed, 0 failed.
- [ ] `ruff check .` -> exit 0.
- [ ] `05_test_cases.sql` on a clean database -> six real PASS lines, audit check, both plans; counts unchanged.
- [ ] `git diff --stat` shows only the files from Tasks 1-4.
- [ ] Main database counts are unchanged.
- [ ] Smoke `GET /health` and `GET /docs` against the test database.
- [ ] Do not commit or push.

## Acceptance Criteria
- [ ] `pytest` is 56/56 on a clean database and independent of the main database.
- [ ] `test_patch_meters_paid_bill_tamper_rejected` is deterministic.
- [ ] SQL 05 has no false-positive and rolls back cleanly.
- [ ] README/CHOT/handoff agree on 56 tests, 16 commits, and benchmark sources.
- [ ] `smart_dormitory_db` is never written to.

## Out of Scope
- Stored procedures, triggers, and schema changes.
- Deleting the two `2026-10` bills from the main database.
- Frontend, thesis report, and slides.
- Pushing to GitHub.

**Execution mode:** decided by the user; this plan does not auto-select a subagent or inline mode.
