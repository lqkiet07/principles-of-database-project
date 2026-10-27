-- ============================================================================
-- SCRIPT 02: BUSINESS STORED PROCEDURES (DUAL SP ARCHITECTURE)
-- Project: Smart Dormitory Management & Campus Utility Billing System
-- Subject: Principles of Database Management Systems (CT221H) - CTU
-- Target DBMS: PostgreSQL 16+ (PL/pgSQL)
-- Standards: Pessimistic Locking (SELECT ... FOR UPDATE), ACID Concurrency,
--            Tiered Tariff Calculation, Automated Debt Allocation & Synchronization
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STORED PROCEDURE 1: sp_generate_and_split_utility_bill
-- Purpose:
--   1. Calculates progressive electricity bill based on 3-tier tariff:
--      - 0 to 100 kWh: 2,000 VND / kWh
--      - 101 to 200 kWh: 2,500 VND / kWh
--      - > 200 kWh: 3,000 VND / kWh
--   2. Calculates water bill: 10,000 VND / m3
--   3. Counts active resident students in the designated room (is_active = TRUE)
--   4. Creates master room bill (utility_bills) in 'UNPAID' status
--   5. Automatically allocates equal debt splits to each resident (student_utility_debts)
-- Status Codes:
--   0 = SUCCESS
--   1 = NO_STUDENTS (room empty or non-existent)
--   2 = BILL_EXISTS (monthly bill already generated for this room)
--   3 = INVALID_METERS (curr_electric < prev_electric or curr_water < prev_water)
--   99 = SYSTEM_ERROR
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_generate_and_split_utility_bill(
    IN  p_room_id        INT,
    IN  p_month_year     VARCHAR(7),
    IN  p_prev_elec      INT,
    IN  p_curr_elec      INT,
    IN  p_prev_water     INT,
    IN  p_curr_water     INT,
    OUT p_total_amount   NUMERIC(12, 2),
    OUT p_split_amount   NUMERIC(12, 2),
    OUT p_student_count  INT,
    OUT p_status_code    INT,
    OUT p_message        VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_delta_elec    INT;
    v_delta_water   INT;
    v_elec_cost     NUMERIC(12, 2) := 0.00;
    v_water_cost    NUMERIC(12, 2) := 0.00;
    v_bill_id       INT;
BEGIN
    -- Initialize default outputs
    p_total_amount  := 0.00;
    p_split_amount  := 0.00;
    p_student_count := 0;
    p_status_code   := 99;
    p_message       := 'Khởi tạo thủ tục tính tiền điện nước';

    -- 1. Validation: Validate meter readings (Fraud / Typo prevention)
    IF p_curr_elec < p_prev_elec OR p_curr_water < p_prev_water THEN
        p_status_code := 3;
        p_message     := 'Lỗi: Chỉ số đo mới không được nhỏ hơn chỉ số cũ (INVALID_METERS)';
        RETURN;
    END IF;

    -- 2. Validation: Check if bill already exists for this room in this billing cycle
    IF EXISTS (
        SELECT 1 
        FROM utility_bills 
        WHERE room_id = p_room_id AND month_year = p_month_year
    ) THEN
        p_status_code := 2;
        p_message     := 'Lỗi: Hóa đơn kỳ ' || p_month_year || ' của phòng này đã được lập trước đó (BILL_EXISTS)';
        RETURN;
    END IF;

    -- 3. Validation: Verify active students currently assigned to this room
    SELECT COUNT(*) 
    INTO p_student_count
    FROM room_assignments
    WHERE room_id = p_room_id AND is_active = TRUE;

    IF p_student_count IS NULL OR p_student_count = 0 THEN
        p_status_code   := 1;
        p_student_count := 0;
        p_message       := 'Lỗi: Phòng hiện không có sinh viên nào lưu trú hợp lệ (NO_STUDENTS)';
        RETURN;
    END IF;

    -- 4. Calculate Consumption
    v_delta_elec  := p_curr_elec - p_prev_elec;
    v_delta_water := p_curr_water - p_prev_water;

    -- 5. Calculate Tiered Electricity Cost
    -- Tier 1: 0 - 100 kWh @ 2,000 VND/kWh
    -- Tier 2: 101 - 200 kWh @ 2,500 VND/kWh
    -- Tier 3: > 200 kWh @ 3,000 VND/kWh
    IF v_delta_elec <= 100 THEN
        v_elec_cost := v_delta_elec * 2000.00;
    ELSIF v_delta_elec <= 200 THEN
        v_elec_cost := (100 * 2000.00) + ((v_delta_elec - 100) * 2500.00);
    ELSE
        v_elec_cost := (100 * 2000.00) + (100 * 2500.00) + ((v_delta_elec - 200) * 3000.00);
    END IF;

    -- 6. Calculate Water Cost: 10,000 VND / m3
    v_water_cost := v_delta_water * 10000.00;

    -- 7. Calculate Total and Per-student Allocation
    p_total_amount := v_elec_cost + v_water_cost;
    p_split_amount := ROUND(p_total_amount / p_student_count, 2);

    -- 8. Insert Master Utility Bill
    INSERT INTO utility_bills (
        room_id,
        month_year,
        prev_electric,
        curr_electric,
        prev_water,
        curr_water,
        total_amount,
        paid_amount,
        bill_status
    ) VALUES (
        p_room_id,
        p_month_year,
        p_prev_elec,
        p_curr_elec,
        p_prev_water,
        p_curr_water,
        p_total_amount,
        0.00,
        'UNPAID'
    )
    RETURNING bill_id INTO v_bill_id;

    -- 9. Insert Child Debt Allocations for each active student in the room
    INSERT INTO student_utility_debts (
        bill_id,
        student_id,
        assigned_amount,
        paid_amount,
        debt_status
    )
    SELECT 
        v_bill_id,
        student_id,
        p_split_amount,
        0.00,
        'UNPAID'
    FROM room_assignments
    WHERE room_id = p_room_id AND is_active = TRUE;

    -- 10. Success Response
    p_status_code := 0;
    p_message     := 'Thành công: Đã phát hành hóa đơn phòng và tự động chia nợ cho ' || p_student_count || ' sinh viên (SUCCESS)';
END;
$$;


-- ----------------------------------------------------------------------------
-- STORED PROCEDURE 2: sp_pay_student_utility_bill
-- Purpose:
--   1. Executes atomic deduction of student wallet balance for personal utility debt
--   2. Employs Pessimistic Row-level Locking (SELECT ... FOR UPDATE) on:
--      - student_wallets (protects against double-click & race-condition double-spending)
--      - student_utility_debts (protects against concurrent double settlements)
--      - utility_bills (prevents lost updates when roommates pay simultaneously)
--   3. Synchronizes parent room bill status:
--      - If all roommates have paid in full -> marks bill_status = 'PAID'
--      - If partially collected -> marks bill_status = 'PARTIALLY_PAID'
--   4. Emits a financial transaction receipt into payment_transactions
-- Status Codes:
--   0 = SUCCESS
--   1 = DEBT_NOT_FOUND (debt record does not exist or does not belong to student)
--   2 = DEBT_ALREADY_PAID (debt is already fully settled)
--   3 = AMOUNT_EXCEEDS_DEBT (pay amount <= 0 or exceeds outstanding balance)
--   4 = INSUFFICIENT_FUNDS (wallet balance is strictly less than pay amount)
--   99 = ERROR (system exception or wallet not found)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_pay_student_utility_bill(
    IN  p_student_id        VARCHAR(20),
    IN  p_debt_id           INT,
    IN  p_pay_amount        NUMERIC(12, 2),
    OUT p_status_code       INT,
    OUT p_tx_code           VARCHAR(50),
    OUT p_remaining_balance NUMERIC(12, 2),
    OUT p_remaining_debt    NUMERIC(12, 2),
    OUT p_message           VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet_balance    NUMERIC(12, 2);
    v_bill_id           INT;
    v_assigned_amt      NUMERIC(12, 2);
    v_paid_amt          NUMERIC(12, 2);
    v_debt_status       VARCHAR(20);
    v_unpaid_remaining  NUMERIC(12, 2);
    v_new_debt_paid     NUMERIC(12, 2);
    v_new_debt_status   VARCHAR(20);
BEGIN
    -- Initialize default outputs
    p_status_code       := 99;
    p_tx_code           := NULL;
    p_remaining_balance := 0.00;
    p_remaining_debt    := 0.00;
    p_message           := 'Khởi tạo thủ tục thanh toán';

    -- Step 1: Input sanity check
    IF p_pay_amount IS NULL OR p_pay_amount <= 0 THEN
        p_status_code := 3;
        p_message     := 'Lỗi: Số tiền thanh toán phải lớn hơn 0 (AMOUNT_EXCEEDS_DEBT)';
        RETURN;
    END IF;

    -- Step 2: Pessimistic Lock on student wallet (Exclusive Row-Level Lock)
    SELECT balance 
    INTO v_wallet_balance
    FROM student_wallets
    WHERE student_id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        p_status_code := 99;
        p_message     := 'Lỗi: Không tìm thấy ví điện tử của sinh viên ' || p_student_id || ' (ERROR)';
        RETURN;
    END IF;

    -- Step 3: Pessimistic Lock on student debt record
    SELECT bill_id, assigned_amount, paid_amount, debt_status
    INTO v_bill_id, v_assigned_amt, v_paid_amt, v_debt_status
    FROM student_utility_debts
    WHERE debt_id = p_debt_id AND student_id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        p_status_code       := 1;
        p_remaining_balance := v_wallet_balance;
        p_remaining_debt    := 0.00;
        p_message           := 'Lỗi: Khoản nợ #' || p_debt_id || ' không tồn tại hoặc không thuộc sinh viên này (DEBT_NOT_FOUND)';
        RETURN;
    END IF;

    -- Step 4: Validate debt is not already fully paid
    IF v_debt_status = 'PAID' OR v_paid_amt >= v_assigned_amt THEN
        p_status_code       := 2;
        p_remaining_balance := v_wallet_balance;
        p_remaining_debt    := 0.00;
        p_message           := 'Thông báo: Khoản nợ này đã được thanh toán hoàn tất trước đó (DEBT_ALREADY_PAID)';
        RETURN;
    END IF;

    -- Step 5: Validate payment amount against outstanding debt balance
    v_unpaid_remaining := v_assigned_amt - v_paid_amt;
    IF p_pay_amount > v_unpaid_remaining THEN
        p_status_code       := 3;
        p_remaining_balance := v_wallet_balance;
        p_remaining_debt    := v_unpaid_remaining;
        p_message           := 'Lỗi: Số tiền nộp (' || p_pay_amount || ' đ) vượt quá số nợ còn lại (' || v_unpaid_remaining || ' đ) (AMOUNT_EXCEEDS_DEBT)';
        RETURN;
    END IF;

    -- Step 6: Validate sufficient wallet balance (Atomic Rollback guard)
    IF v_wallet_balance < p_pay_amount THEN
        p_status_code       := 4;
        p_remaining_balance := v_wallet_balance;
        p_remaining_debt    := v_unpaid_remaining;
        p_message           := 'Lỗi: Số dư ví (' || v_wallet_balance || ' đ) không đủ để thanh toán ' || p_pay_amount || ' đ (INSUFFICIENT_FUNDS)';
        RETURN;
    END IF;

    -- Step 7: Deduct funds from student wallet
    UPDATE student_wallets
    SET balance    = balance - p_pay_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE student_id = p_student_id;

    -- Step 8: Update student personal utility debt record
    v_new_debt_paid   := v_paid_amt + p_pay_amount;
    v_new_debt_status := CASE 
                            WHEN v_new_debt_paid >= v_assigned_amt THEN 'PAID' 
                            ELSE 'UNPAID' 
                         END;

    UPDATE student_utility_debts
    SET paid_amount = v_new_debt_paid,
        debt_status = v_new_debt_status
    WHERE debt_id = p_debt_id;

    -- Step 9: Lock parent room bill and increment total collected amount (Prevents Lost Update)
    PERFORM 1 
    FROM utility_bills 
    WHERE bill_id = v_bill_id 
    FOR UPDATE;

    UPDATE utility_bills
    SET paid_amount = paid_amount + p_pay_amount
    WHERE bill_id = v_bill_id;

    -- Step 10: Synchronize parent room bill status based on child debts
    IF NOT EXISTS (
        SELECT 1 
        FROM student_utility_debts
        WHERE bill_id = v_bill_id AND debt_status <> 'PAID'
    ) THEN
        UPDATE utility_bills 
        SET bill_status = 'PAID' 
        WHERE bill_id = v_bill_id;
    ELSE
        UPDATE utility_bills 
        SET bill_status = 'PARTIALLY_PAID' 
        WHERE bill_id = v_bill_id;
    END IF;

    -- Step 11: Generate unique transaction reference code (TX-YYYYMMDD-HHMMSS-RANDOM)
    p_tx_code := 'TX-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 6));

    -- Step 12: Insert immutable payment transaction record
    INSERT INTO payment_transactions (
        debt_id,
        bill_id,
        student_id,
        amount,
        tx_time,
        reference_code,
        status
    ) VALUES (
        p_debt_id,
        v_bill_id,
        p_student_id,
        p_pay_amount,
        CURRENT_TIMESTAMP,
        p_tx_code,
        'SUCCESS'
    );

    -- Step 13: Finalize success outputs
    p_status_code       := 0;
    p_remaining_balance := v_wallet_balance - p_pay_amount;
    p_remaining_debt    := v_unpaid_remaining - p_pay_amount;
    p_message           := 'Thanh toán thành công ' || p_pay_amount || ' đ. Biên lai: ' || p_tx_code || ' (SUCCESS)';
END;
$$;
