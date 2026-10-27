# Backend Verification Report — 2026-10-27

## Scope
Verification and hardening of the Smart Dormitory backend/AI subsystem after the
`HANDOFF_backend-ai-complete_2026-10-27.md` session.

Out of scope: frontend, thesis report, slide deck, GitHub push.

## Environment
- Windows 10, PowerShell 5.1
- Python 3.12.7
- FastAPI 0.162.0, psycopg 3.3.6, scikit-learn 1.9.1, sentence-transformers 6.2.0
- PostgreSQL 16.15 + pgvector in `smart_dorm_postgres`
- Main DB: `smart_dormitory_db` (read-only in this session)
- Test DB: `smart_dormitory_test` (reset/recreated)

## Result Summary

| Phase | Result | Evidence |
|:--|:--|:--|
| Preflight | PASS | Docker healthy; dependencies import; port 8000 free |
| Main DB invariants | PASS | 10 tables, 2 SPs, 2 triggers, index; 1,000,000 logs; 6×24 history bills; 0 meter-chain breaks; 0 parent-child mismatches |
| SQL 05 pre-fix | FAIL | Test 4.1 printed `[PASS]` while swallowing its own `[FAIL]` |
| Pytest pre-fix | FAIL | 55 passed, 1 failed (`test_patch_meters_paid_bill_tamper_rejected`) |
| API smoke | PASS | `/health`, `/docs`, 22 OpenAPI paths, semantic search, forecast, clustering, benchmark, dashboard |
| Evidence JSON | PASS | 30/30 invariant checks across 11 files |
| Post-fix pytest | PASS | 56 passed in 7.44s (latest run) |
| Post-fix ruff | PASS | `All checks passed!` |
| Post-fix SQL 05 | PASS | Six explicit PASS lines; row counts unchanged after rollback |
| Main DB after verification | PASS | `logs=1000000, bills=146, debts=292, txs=110, audits=19` (unchanged) |

## High-Severity Findings (pre-fix)

### 1. Non-hermetic PAID-bill test
`backend/tests/test_meters_audit.py` selected an arbitrary PAID bill with
`LIMIT 1`. On a clean seeded DB the first PAID bill was `2024-10` room 1
(`prev_electric=1000`); the payload `curr_electric=999` triggered
`FRAUD_METER_REVERSAL` before the PAID-bill rule. The test expected
`FRAUD_PAID_BILL_TAMPER` and failed. On the main DB the first PAID bill was
`2026-10` (`prev=100`), so the test passed. Result depended on physical row order.

### 2. SQL 05 Test 4.1 false-positive
Test 3 created a room 2 bill with `prev_electric=0`. Test 4.1 then set
`curr_electric=50`; this was not a meter reversal, so the UPDATE succeeded.
The test's own `RAISE EXCEPTION '[FAIL]'` was caught by `WHEN OTHERS` and
reported as `[PASS]`. Test 4.2 had the same `WHEN OTHERS` masking risk.

### 3. Destructive default test target
`backend/tests/conftest.py` used `settings.database_url` (main DB) while
`test_database_url` was unused. Running plain `pytest` could reseed history,
top up wallets, and delete assignments on the demo DB.

## Fixes Applied
1. `backend/tests/conftest.py`
   - Forces `settings.database_url = settings.test_database_url`.
   - Refuses non-test database URLs.
   - Fails early unless the test DB has 1,000,000 access logs and 144 historical bills.
2. `backend/scripts/run_tests.ps1`
   - Resets `smart_dormitory_test`, loads 1M logs, seeds 24 months, runs pytest.
3. `backend/tests/test_meters_audit.py`
   - Creates a dedicated room 2 bill, marks it PAID, and patches values above
     the previous readings so only the PAID-bill rule fires.
4. `database/05_test_cases.sql`
   - Refuses to run on `smart_dormitory_db`.
   - Wraps the suite in `BEGIN; ... ROLLBACK;`.
   - Test 2 selects debts by the bill created in Test 1.
   - Test 4.1 creates a dedicated bill with `prev_electric=100`; catches only
     `check_violation`.
   - Test 4.2 catches only `integrity_constraint_violation`.
   - Test 5 asserts an audit row exists and `old_data <> new_data`.
   - Test 6 is labelled a manual benchmark.
5. Documentation
   - `README.md`, `backend/README.md`, `CHOT_QUYET_DINH_KY_THUAT.md`: 56 tests.
   - Benchmark sources split into API evidence and clean-room harness.
   - Handoff corrected to 16 commits ahead and post-hardening status.

## Post-Fix Verification Evidence
- `.\scripts\run_tests.ps1 -q`:
  `56 passed in 7.44s`, exit code 0.
- `ruff check .`: `All checks passed!`, exit code 0.
- `05_test_cases.sql` on `smart_dormitory_test`:
  - Test 1, 2, 3, 4.1, 4.2, 5: explicit `[PASS]`.
  - Test 4.1 message: `Chỉ số điện mới (50) không được nhỏ hơn chỉ số cũ (100)`.
  - Test 6: `Parallel Seq Scan` and `Bitmap Index Scan` plans.
  - Counts before/after: `bills=144, debts=288, txs=5, audits=2` -> unchanged.
  - `PSQL_EXIT=0`.
- API smoke on the test DB:
  - `/health`: `ok`, 2 procedures.
  - `/docs`: 200.
  - OpenAPI: 22 paths.
  - Semantic search: `B2-201` / `B2` / similarity `0.7648`.

## Benchmark Sources
- Evidence API (`07/08`): seq ~47 ms / 19,066 buffers; index ~8 ms / 4,655 buffers.
- Clean-room `05` (psql, clean DB): seq ~39 ms / ~9.3k–9.5k buffers;
  bitmap ~1.5–2 ms / ~590–770 buffers.
- These are different harnesses; do not mix the numbers in the report.

## Residual Notes
- The main DB still has two `2026-10` bills (1 PAID, 1 UNPAID) from an earlier
  SQL 05 run. They were intentionally not deleted in this session.
- Uvicorn 0.54 on Windows needs `--reload`; without it, uvicorn selects
  `ProactorEventLoop` and psycopg async fails. The documented demo command uses
  `--reload`, so it works.
- `test_openapi.py` rewrites `docs/api/openapi.json` during pytest. Content was
  unchanged this run.
- `capture_evidence.py` mutates bills/wallets; run it only on a disposable DB.
- CORS is configured as wildcard with credentials; harmless for the current
  header-based demo but should be tightened before any real deployment.

## Files Changed
- `backend/tests/conftest.py`
- `backend/tests/test_meters_audit.py`
- `backend/scripts/run_tests.ps1` (new)
- `database/05_test_cases.sql`
- `README.md`
- `backend/README.md`
- `CHOT_QUYET_DINH_KY_THUAT.md`
- `.handoffs/HANDOFF_backend-ai-complete_2026-10-27.md`
- `docs/plans/2026-10-27-backend-test-hardening.md` (new)
- `docs/verification/2026-10-27-backend-verification.md` (new)

No commit or push was performed.
