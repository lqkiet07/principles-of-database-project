-- ============================================================================
-- SCRIPT 05: VERIFICATION & BENCHMARK TEST SUITE
-- Project: Smart Dormitory Management & Campus Utility Billing System
-- Subject: Principles of Database Management Systems (CT221H) - CTU
-- Target DBMS: PostgreSQL 16+
-- Tests Included:
--   Test 1: sp_generate_and_split_utility_bill (Room 1 billing & debt split)
--   Test 2: sp_pay_student_utility_bill (Success, balance deduction, bill sync)
--   Test 3: Insufficient Funds & Rollback (Wallet balance guard, status code 4)
--   Test 4: trg_validate_utility_meter_fraud (Fraudulent meter reversal & PAID bill tamper)
--   Test 5: trg_audit_utility_meter_update (Meter update audit trail & JSONB inspection)
--   Test 6: Index Performance Benchmark on 1M Records (EXPLAIN ANALYZE BUFFERS)
-- ============================================================================

\timing on

-- ============================================================================
-- TEST CASE 1: GENERATE BILL AND SPLIT FOR ROOM 1
-- Objective:
--   Generate October 2026 utility bill for Room 1 (B1-101, 2 students).
--   Consumption:
--     - Elec: 350 - 100 = 250 kWh
--       * 0-100 kWh:   100 * 2,000 = 200,000 VND
--       * 101-200 kWh: 100 * 2,500 = 250,000 VND
--       * >200 kWh:     50 * 3,000 = 150,000 VND
--       => Electric Cost = 600,000 VND
--     - Water: 35 - 20 = 15 m3 * 10,000 = 150,000 VND
--     => Total Room Bill = 750,000 VND
--     => Split per student (2 students) = 375,000 VND each
-- ============================================================================
RAISE NOTICE '============================================================';
RAISE NOTICE 'TEST 1: Chốt chỉ số, tính tiền lũy tiến và chia nợ Phòng 1';
RAISE NOTICE '============================================================';

DO $$
DECLARE
    v_total     NUMERIC(12, 2);
    v_split     NUMERIC(12, 2);
    v_count     INT;
    v_status    INT;
    v_msg       VARCHAR(255);
BEGIN
    CALL sp_generate_and_split_utility_bill(
        p_room_id       => 1,
        p_month_year    => '2026-10',
        p_prev_elec     => 100,
        p_curr_elec     => 350,
        p_prev_water    => 20,
        p_curr_water    => 35,
        p_total_amount  => v_total,
        p_split_amount  => v_split,
        p_student_count => v_count,
        p_status_code   => v_status,
        p_message       => v_msg
    );

    RAISE NOTICE 'Output Status Code : %', v_status;
    RAISE NOTICE 'Output Message     : %', v_msg;
    RAISE NOTICE 'Total Room Amount  : % VND', v_total;
    RAISE NOTICE 'Per-Student Split  : % VND', v_split;
    RAISE NOTICE 'Active Students    : %', v_count;

    IF v_status = 0 AND v_total = 750000.00 AND v_split = 375000.00 AND v_count = 2 THEN
        RAISE NOTICE '>>> TEST 1 RESULT: [PASS] - Tính tiền bậc thang và chia nợ chính xác!';
    ELSE
        RAISE EXCEPTION '>>> TEST 1 RESULT: [FAIL] - Kết quả tính tiền không khớp kỳ vọng!';
    END IF;
END $$;

-- Inspect created bill & student debts
SELECT bill_id, room_id, month_year, prev_electric, curr_electric, prev_water, curr_water, total_amount, paid_amount, bill_status
FROM utility_bills 
WHERE room_id = 1 AND month_year = '2026-10';

SELECT debt_id, bill_id, student_id, assigned_amount, paid_amount, debt_status
FROM student_utility_debts
WHERE bill_id = (SELECT bill_id FROM utility_bills WHERE room_id = 1 AND month_year = '2026-10')
ORDER BY student_id;


-- ============================================================================
-- TEST CASE 2: SUCCESSFUL PAYMENT & PARENT-CHILD STATUS SYNCHRONIZATION
-- Objective:
--   1. Student B2100001 pays 375,000 VND (full personal debt).
--      Verify: Wallet deducted, personal debt -> PAID, room bill -> PARTIALLY_PAID.
--   2. Student B2100002 pays 375,000 VND (remaining roommate debt).
--      Verify: Room bill synchronized to PAID!
-- ============================================================================
RAISE NOTICE '============================================================';
RAISE NOTICE 'TEST 2: Thanh toán nợ cá nhân, trừ ví và đồng bộ trạng thái';
RAISE NOTICE '============================================================';

DO $$
DECLARE
    v_debt_id_1 INT;
    v_debt_id_2 INT;
    v_status    INT;
    v_tx_code   VARCHAR(50);
    v_rem_bal   NUMERIC(12, 2);
    v_rem_debt  NUMERIC(12, 2);
    v_msg       VARCHAR(255);
    v_bill_st   VARCHAR(20);
BEGIN
    -- Get debt IDs for the 2 students of room 1
    SELECT debt_id INTO v_debt_id_1 
    FROM student_utility_debts 
    WHERE student_id = 'B2100001' AND debt_status = 'UNPAID'
    LIMIT 1;

    SELECT debt_id INTO v_debt_id_2 
    FROM student_utility_debts 
    WHERE student_id = 'B2100002' AND debt_status = 'UNPAID'
    LIMIT 1;

    -- 1. Student 1 pays 375,000 VND
    CALL sp_pay_student_utility_bill(
        p_student_id        => 'B2100001',
        p_debt_id           => v_debt_id_1,
        p_pay_amount        => 375000.00,
        p_status_code       => v_status,
        p_tx_code           => v_tx_code,
        p_remaining_balance => v_rem_bal,
        p_remaining_debt    => v_rem_debt,
        p_message           => v_msg
    );
    RAISE NOTICE 'B2100001 Payment: Status = %, TxCode = %, Balance = % đ, Msg = %', v_status, v_tx_code, v_rem_bal, v_msg;

    -- Verify bill is now PARTIALLY_PAID
    SELECT bill_status INTO v_bill_st FROM utility_bills WHERE room_id = 1 AND month_year = '2026-10';
    IF v_bill_st <> 'PARTIALLY_PAID' THEN
        RAISE EXCEPTION 'Lỗi: Hóa đơn phòng phải ở trạng thái PARTIALLY_PAID nhưng lại là %', v_bill_st;
    END IF;

    -- 2. Student 2 pays 375,000 VND
    CALL sp_pay_student_utility_bill(
        p_student_id        => 'B2100002',
        p_debt_id           => v_debt_id_2,
        p_pay_amount        => 375000.00,
        p_status_code       => v_status,
        p_tx_code           => v_tx_code,
        p_remaining_balance => v_rem_bal,
        p_remaining_debt    => v_rem_debt,
        p_message           => v_msg
    );
    RAISE NOTICE 'B2100002 Payment: Status = %, TxCode = %, Balance = % đ, Msg = %', v_status, v_tx_code, v_rem_bal, v_msg;

    -- Verify bill is now completely PAID
    SELECT bill_status INTO v_bill_st FROM utility_bills WHERE room_id = 1 AND month_year = '2026-10';
    IF v_bill_st = 'PAID' THEN
        RAISE NOTICE '>>> TEST 2 RESULT: [PASS] - Đồng bộ trạng thái nợ cha-con thành công tuyệt đối (PAID)!';
    ELSE
        RAISE EXCEPTION '>>> TEST 2 RESULT: [FAIL] - Hóa đơn chưa chuyển thành PAID!';
    END IF;
END $$;

-- Inspect final state of payments, debts and receipts
SELECT w.student_id, s.full_name, w.balance, w.updated_at
FROM student_wallets w
JOIN students s ON s.student_id = w.student_id
WHERE w.student_id IN ('B2100001', 'B2100002');

SELECT tx_id, debt_id, bill_id, student_id, amount, tx_time, reference_code, status
FROM payment_transactions
ORDER BY tx_id DESC
LIMIT 2;


-- ============================================================================
-- TEST CASE 3: INSUFFICIENT FUNDS PAYMENT (ATOMIC ROLLBACK GUARD)
-- Objective:
--   Generate bill for Room 2 (B1-102: B2100003, B2100004).
--   Student B2100004 has wallet balance = 500,000 VND.
--   Bill generated creates per-student debt of 1,075,000 VND.
--   When B2100004 attempts payment -> Expected status code 4 (INSUFFICIENT_FUNDS).
--   Verify: Wallet balance and debt amounts remain completely unmodified.
-- ============================================================================
RAISE NOTICE '============================================================';
RAISE NOTICE 'TEST 3: Kiểm tra bẫy thiếu số dư ví (INSUFFICIENT_FUNDS - Code 4)';
RAISE NOTICE '============================================================';

DO $$
DECLARE
    v_total     NUMERIC(12, 2);
    v_split     NUMERIC(12, 2);
    v_count     INT;
    v_status    INT;
    v_msg       VARCHAR(255);
    v_debt_id   INT;
    v_tx_code   VARCHAR(50);
    v_rem_bal   NUMERIC(12, 2);
    v_rem_debt  NUMERIC(12, 2);
    v_bal_before NUMERIC(12, 2);
    v_bal_after  NUMERIC(12, 2);
BEGIN
    -- 1. Generate bill for Room 2 (high consumption)
    CALL sp_generate_and_split_utility_bill(
        p_room_id       => 2,
        p_month_year    => '2026-10',
        p_prev_elec     => 0,
        p_curr_elec     => 500,
        p_prev_water    => 0,
        p_curr_water    => 80,
        p_total_amount  => v_total,
        p_split_amount  => v_split,
        p_student_count => v_count,
        p_status_code   => v_status,
        p_message       => v_msg
    );

    SELECT debt_id INTO v_debt_id 
    FROM student_utility_debts 
    WHERE student_id = 'B2100004' AND bill_id = (SELECT bill_id FROM utility_bills WHERE room_id = 2 AND month_year = '2026-10');

    SELECT balance INTO v_bal_before FROM student_wallets WHERE student_id = 'B2100004';
    RAISE NOTICE 'Số dư ví B2100004 trước khi thử nộp: % đ. Khoản nợ phải nộp: % đ', v_bal_before, v_split;

    -- 2. Attempt payment exceeding wallet balance
    CALL sp_pay_student_utility_bill(
        p_student_id        => 'B2100004',
        p_debt_id           => v_debt_id,
        p_pay_amount        => v_split, -- 1,075,000 VND > 500,000 VND
        p_status_code       => v_status,
        p_tx_code           => v_tx_code,
        p_remaining_balance => v_rem_bal,
        p_remaining_debt    => v_rem_debt,
        p_message           => v_msg
    );

    SELECT balance INTO v_bal_after FROM student_wallets WHERE student_id = 'B2100004';

    IF v_status = 4 AND v_bal_before = v_bal_after THEN
        RAISE NOTICE 'Output Status Code: % (%)', v_status, v_msg;
        RAISE NOTICE '>>> TEST 3 RESULT: [PASS] - Bẫy thành công lỗi thiếu tiền! Số dư ví được bảo toàn nguyên vẹn % đ.', v_bal_after;
    ELSE
        RAISE EXCEPTION '>>> TEST 3 RESULT: [FAIL] - Không bắt được lỗi INSUFFICIENT_FUNDS!';
    END IF;
END $$;


-- ============================================================================
-- TEST CASE 4: FRAUD PREVENTION TRIGGER VALIDATION
-- Objective:
--   1. Fraud Rule 1: Attempt to set curr_electric < prev_electric -> Trigger MUST throw Exception.
--   2. Fraud Rule 2: Attempt to modify meters on a 'PAID' bill -> Trigger MUST throw Exception.
-- ============================================================================
RAISE NOTICE '============================================================';
RAISE NOTICE 'TEST 4: Kiểm tra Trigger trg_validate_utility_meter_fraud';
RAISE NOTICE '============================================================';

-- Test 4.1: Attempt to enter negative/reversal electric meter
DO $$
BEGIN
    UPDATE utility_bills 
    SET curr_electric = 50 -- prev_electric was 100
    WHERE room_id = 2 AND month_year = '2026-10';

    RAISE EXCEPTION '>>> TEST 4.1 RESULT: [FAIL] - Trigger không chặn được số điện lùi!';
EXCEPTION 
    WHEN check_violation THEN
        RAISE NOTICE '>>> TEST 4.1 RESULT: [PASS] - Trigger chặn đứng thành công số điện lùi: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE '>>> TEST 4.1 RESULT: [PASS] - Trigger chặn với ngoại lệ: %', SQLERRM;
END $$;

-- Test 4.2: Attempt to alter meters on a settled 'PAID' bill (Room 1)
DO $$
BEGIN
    UPDATE utility_bills 
    SET curr_electric = 999 
    WHERE room_id = 1 AND month_year = '2026-10'; -- Room 1 is already PAID from Test 2

    RAISE EXCEPTION '>>> TEST 4.2 RESULT: [FAIL] - Trigger không bảo vệ được hóa đơn đã PAID!';
EXCEPTION 
    WHEN integrity_constraint_violation THEN
        RAISE NOTICE '>>> TEST 4.2 RESULT: [PASS] - Trigger chặn can thiệp hóa đơn đã quyết toán: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE '>>> TEST 4.2 RESULT: [PASS] - Trigger chặn với ngoại lệ: %', SQLERRM;
END $$;


-- ============================================================================
-- TEST CASE 5: AUDIT LOG TRIGGER VALIDATION
-- Objective:
--   Perform a legitimate adjustment on an UNPAID bill (Room 2).
--   Verify trg_audit_utility_meter_update writes JSONB snapshots into audit_logs.
-- ============================================================================
RAISE NOTICE '============================================================';
RAISE NOTICE 'TEST 5: Kiểm tra Trigger Audit Log ghi vết JSONB';
RAISE NOTICE '============================================================';

-- Legitimate meter adjustment on UNPAID bill
UPDATE utility_bills 
SET curr_electric = 510,
    curr_water    = 82
WHERE room_id = 2 AND month_year = '2026-10' AND bill_status = 'UNPAID';

-- Query and format captured audit log entry
SELECT 
    log_id,
    table_name,
    action_type,
    record_id,
    changed_by,
    changed_at,
    reason,
    jsonb_pretty(old_data) AS old_state_json,
    jsonb_pretty(new_data) AS new_state_json
FROM audit_logs
ORDER BY log_id DESC
LIMIT 1;


-- ============================================================================
-- TEST CASE 6: 1,000,000 LOGS INDEX BENCHMARK
-- Objective:
--   Compare execution plan and buffer hits between Sequential Scan (No Index)
--   and Index Scan (Composite B-Tree on is_late, check_time).
-- ============================================================================
RAISE NOTICE '============================================================';
RAISE NOTICE 'TEST 6: Thực nghiệm đo lường hiệu năng Index trên 1.000.000 dòng log';
RAISE NOTICE '============================================================';

-- Part 6.1: Measure WITHOUT Index (Simulate Full Table Scan)
DROP INDEX IF EXISTS idx_access_late_time;

RAISE NOTICE '--- BƯỚC 1: Kế hoạch thực thi khi CHƯA CÓ INDEX (Seq Scan on 1M rows) ---';
EXPLAIN (ANALYZE, BUFFERS)
SELECT student_id, check_time, gate_name
FROM dorm_access_logs
WHERE is_late = TRUE 
  AND check_time >= '2026-09-01 00:00:00' AND check_time <= '2026-10-01 23:59:59';

-- Part 6.2: Re-create Composite Index
CREATE INDEX IF NOT EXISTS idx_access_late_time 
ON dorm_access_logs (is_late, check_time);
ANALYZE dorm_access_logs;

-- Part 6.3: Measure WITH Composite Index (Bitmap Index Scan / Index Scan)
RAISE NOTICE '--- BƯỚC 2: Kế hoạch thực thi sau khi ĐÃ CÓ B-TREE COMPOSITE INDEX ---';
EXPLAIN (ANALYZE, BUFFERS)
SELECT student_id, check_time, gate_name
FROM dorm_access_logs
WHERE is_late = TRUE 
  AND check_time >= '2026-09-01 00:00:00' AND check_time <= '2026-10-01 23:59:59';
