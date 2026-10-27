-- ============================================================================
-- SCRIPT 03: DATABASE TRIGGERS (AUDIT TRAIL & FRAUD PREVENTION)
-- Project: Smart Dormitory Management & Campus Utility Billing System
-- Subject: Principles of Database Management Systems (CT221H) - CTU
-- Target DBMS: PostgreSQL 16+ (PL/pgSQL)
-- Standards: JSONB Audit Logging, Invariant Enforcement, Exception Trapping
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TRIGGER 1: trg_validate_utility_meter_fraud
-- Type: BEFORE INSERT OR UPDATE ON utility_bills
-- Business Rules:
--   1. Reversal Meter Fraud: curr_electric < prev_electric -> RAISE EXCEPTION
--   2. Reversal Water Fraud: curr_water < prev_water -> RAISE EXCEPTION
--   3. Settled Bill Protection: If bill_status = 'PAID', meter values CANNOT be altered
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_utility_meter_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Rule 1: Validate electricity meter reading consistency
    IF NEW.curr_electric < NEW.prev_electric THEN
        RAISE EXCEPTION 'Lỗi gian lận: Chỉ số điện mới (%) không được nhỏ hơn chỉ số cũ (%)!', 
            NEW.curr_electric, NEW.prev_electric
            USING ERRCODE = 'check_violation';
    END IF;

    -- Rule 2: Validate water meter reading consistency
    IF NEW.curr_water < NEW.prev_water THEN
        RAISE EXCEPTION 'Lỗi gian lận: Chỉ số nước mới (%) không được nhỏ hơn chỉ số cũ (%)!', 
            NEW.curr_water, NEW.prev_water
            USING ERRCODE = 'check_violation';
    END IF;

    -- Rule 3: Protect settled bills from retroactive meter tampering
    IF TG_OP = 'UPDATE' THEN
        IF OLD.bill_status = 'PAID' AND (
            OLD.curr_electric <> NEW.curr_electric OR 
            OLD.curr_water    <> NEW.curr_water    OR 
            OLD.prev_electric <> NEW.prev_electric OR 
            OLD.prev_water    <> NEW.prev_water
        ) THEN
            RAISE EXCEPTION 'Lỗi toàn vẹn kế toán: Hóa đơn #% đã tất toán (PAID), tuyệt đối không được phép chỉnh sửa chỉ số công tơ!', 
                OLD.bill_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_utility_meter_fraud ON utility_bills;

CREATE TRIGGER trg_validate_utility_meter_fraud
BEFORE INSERT OR UPDATE ON utility_bills
FOR EACH ROW
EXECUTE FUNCTION fn_validate_utility_meter_fraud();


-- ----------------------------------------------------------------------------
-- TRIGGER 2: trg_audit_utility_meter_update
-- Type: AFTER UPDATE ON utility_bills
-- Condition: WHEN OLD.curr_electric <> NEW.curr_electric OR OLD.curr_water <> NEW.curr_water
-- Purpose:
--   Automatically captures pre-change (OLD) and post-change (NEW) states
--   as structured JSONB snapshots into audit_logs for financial inspection.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_audit_utility_meter_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        action_type,
        record_id,
        old_data,
        new_data,
        changed_by,
        changed_at,
        reason
    ) VALUES (
        'utility_bills',
        'UPDATE',
        NEW.bill_id::VARCHAR,
        to_jsonb(OLD),
        to_jsonb(NEW),
        SESSION_USER,
        CURRENT_TIMESTAMP,
        'Điều chỉnh chỉ số công tơ phòng ' || NEW.room_id || ' kỳ ' || NEW.month_year || 
        ' (Điện: ' || OLD.curr_electric || ' -> ' || NEW.curr_electric || 
        ', Nước: ' || OLD.curr_water || ' -> ' || NEW.curr_water || ')'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_utility_meter_update ON utility_bills;

CREATE TRIGGER trg_audit_utility_meter_update
AFTER UPDATE ON utility_bills
FOR EACH ROW
WHEN (
    OLD.curr_electric IS DISTINCT FROM NEW.curr_electric OR 
    OLD.curr_water    IS DISTINCT FROM NEW.curr_water
)
EXECUTE FUNCTION fn_audit_utility_meter_update();
