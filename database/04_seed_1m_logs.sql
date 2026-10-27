-- ============================================================================
-- SCRIPT 04: HIGH-VOLUME DATA SEEDING (1,000,000 ACCESS LOG RECORDS)
-- Project: Smart Dormitory Management & Campus Utility Billing System
-- Subject: Principles of Database Management Systems (CT221H) - CTU
-- Target DBMS: PostgreSQL 16+
-- Purpose: Benchmark Indexing (B-Tree Composite Index vs Seq Scan)
-- Standards: Set-based generate_series, Deterministic Math Distribution,
--            Realistic Temporal Spread (2 years), Foreign Key Compliance
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRUNCATE EXISTING ACCESS LOGS
-- ----------------------------------------------------------------------------
TRUNCATE TABLE dorm_access_logs RESTART IDENTITY;

-- ----------------------------------------------------------------------------
-- 2. BULK INSERT 1,000,000 ACCESS LOGS
-- Characteristics:
--   - student_id: Evenly mapped to the 12 active students (B2100001 - B2100012)
--   - gate_name: Distributed across ('Cổng Chính', 'Cổng Phụ A', 'Cổng Phụ B')
--   - check_time: Distributed across the last 2 years (2024-10-20 to 2026-10-20)
--   - is_late: Exactly ~9% late records (time > 23:00:00 or time < 05:00:00)
-- ----------------------------------------------------------------------------
INSERT INTO dorm_access_logs (student_id, gate_name, check_time, is_late)
SELECT 
    'B21000' || LPAD((( (s.id - 1) % 12 ) + 1)::TEXT, 2, '0') AS student_id,
    CASE (s.id % 3)
        WHEN 0 THEN 'Cổng Chính'
        WHEN 1 THEN 'Cổng Phụ A'
        ELSE 'Cổng Phụ B'
    END AS gate_name,
    t.log_time AS check_time,
    (t.log_time::time > TIME '23:00:00' OR t.log_time::time < TIME '05:00:00') AS is_late
FROM generate_series(1, 1000000) AS s(id)
CROSS JOIN LATERAL (
    SELECT 
        -- Spread date across 730 days (2 years)
        (TIMESTAMP '2024-10-20 00:00:00' + ((s.id % 730) || ' days')::INTERVAL) +
        CASE 
            -- ~9% of records occur during late-night hours (23:00 to 05:00)
            WHEN (s.id % 100) < 9 THEN 
                CASE 
                    WHEN (s.id % 2) = 0 THEN 
                        -- 23:00:00 to 23:59:59
                        INTERVAL '23 hours' + (((s.id * 17) % 3600) || ' seconds')::INTERVAL
                    ELSE 
                        -- 00:00:00 to 04:59:59
                        INTERVAL '0 hours' + (((s.id * 19) % 18000) || ' seconds')::INTERVAL
                END
            -- ~91% of records occur during normal campus hours (05:00:00 to 22:59:59)
            ELSE 
                INTERVAL '5 hours' + (((s.id * 31) % 64800) || ' seconds')::INTERVAL
        END AS log_time
) AS t;

-- ----------------------------------------------------------------------------
-- 3. COMPOSITE B-TREE INDEX FOR BENCHMARKING
-- Strategy: (is_late, check_time)
-- Rationale:
--   - is_late is an Equality condition (is_late = TRUE)
--   - check_time is a Range condition (check_time BETWEEN date1 AND date2)
--   - Placing Equality column first in Composite Index allows B-Tree to instantly
--     prune non-matching entries before performing range scanning.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_access_late_time 
ON dorm_access_logs (is_late, check_time);

-- ----------------------------------------------------------------------------
-- 4. UPDATE PLANNER STATISTICS
-- ----------------------------------------------------------------------------
ANALYZE dorm_access_logs;
