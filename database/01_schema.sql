-- ============================================================================
-- SCRIPT 01: SCHEMA DEFINITION & SEED DATA
-- Project: Smart Dormitory Management & Campus Utility Billing System
-- Subject: Principles of Database Management Systems (CT221H) - CTU
-- Target DBMS: PostgreSQL 16+ with pgvector extension
-- Standards: 3NF Relational Integrity, Foreign Keys, Check Constraints, Vector
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 2. DROP TABLES IN REVERSE FOREIGN KEY DEPENDENCY ORDER
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS student_utility_debts CASCADE;
DROP TABLE IF EXISTS utility_bills CASCADE;
DROP TABLE IF EXISTS room_assignments CASCADE;
DROP TABLE IF EXISTS student_wallets CASCADE;
DROP TABLE IF EXISTS dorm_access_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS dorm_buildings CASCADE;

-- ----------------------------------------------------------------------------
-- 3. CORE TABLE DEFINITIONS (10 TABLES)
-- ----------------------------------------------------------------------------

-- Table 1: dorm_buildings (Dormitory Buildings Directory)
CREATE TABLE dorm_buildings (
    building_id     VARCHAR(10)     PRIMARY KEY,
    building_name   VARCHAR(100)    NOT NULL,
    gender_zone     VARCHAR(10)     NOT NULL CHECK (gender_zone IN ('MALE', 'FEMALE', 'MIXED')),
    total_floors    INT             NOT NULL CHECK (total_floors > 0)
);

-- Table 2: rooms (Room Directory with pgvector for Semantic Search)
CREATE TABLE rooms (
    room_id             SERIAL          PRIMARY KEY,
    building_id         VARCHAR(10)     NOT NULL REFERENCES dorm_buildings(building_id) ON DELETE CASCADE,
    room_number         VARCHAR(20)     NOT NULL UNIQUE,
    capacity            INT             NOT NULL DEFAULT 4 CHECK (capacity > 0),
    current_occupancy   INT             NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0 AND current_occupancy <= capacity),
    base_price          NUMERIC(12, 2)  NOT NULL CHECK (base_price >= 0),
    description         TEXT,
    embedding           vector(384),
    status              VARCHAR(20)     NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'FULL', 'MAINTENANCE'))
);

-- Table 3: students (Student Profile Directory)
CREATE TABLE students (
    student_id  VARCHAR(20)     PRIMARY KEY,
    full_name   VARCHAR(100)    NOT NULL,
    email       VARCHAR(100)    NOT NULL UNIQUE,
    phone       VARCHAR(15),
    major       VARCHAR(50),
    status      VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRADUATED', 'SUSPENDED'))
);

-- Table 4: student_wallets (Student Campus Wallet for Internal Payments)
CREATE TABLE student_wallets (
    wallet_id   SERIAL          PRIMARY KEY,
    student_id  VARCHAR(20)     NOT NULL UNIQUE REFERENCES students(student_id) ON DELETE CASCADE,
    balance     NUMERIC(12, 2)  NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: room_assignments (Room Residency Contracts & Bed Occupancy)
CREATE TABLE room_assignments (
    assignment_id   SERIAL          PRIMARY KEY,
    room_id         INT             NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    student_id      VARCHAR(20)     NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    bed_number      INT             NOT NULL CHECK (bed_number > 0),
    start_date      DATE            NOT NULL,
    end_date        DATE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE
);

-- Conditional Unique Index: A bed in a room can only have ONE active resident at a time
CREATE UNIQUE INDEX idx_unique_active_bed 
ON room_assignments (room_id, bed_number) 
WHERE is_active = TRUE;

-- Conditional Unique Index: A student can only have ONE active bed assignment at a time
CREATE UNIQUE INDEX idx_unique_active_student
ON room_assignments (student_id)
WHERE is_active = TRUE;

-- Table 6: utility_bills (Monthly Room Utility Bills: Water & Electricity)
CREATE TABLE utility_bills (
    bill_id         SERIAL          PRIMARY KEY,
    room_id         INT             NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    month_year      VARCHAR(7)      NOT NULL, -- Format: YYYY-MM
    prev_electric   INT             NOT NULL CHECK (prev_electric >= 0),
    curr_electric   INT             NOT NULL CHECK (curr_electric >= 0),
    prev_water      INT             NOT NULL CHECK (prev_water >= 0),
    curr_water      INT             NOT NULL CHECK (curr_water >= 0),
    total_amount    NUMERIC(12, 2)  NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    paid_amount     NUMERIC(12, 2)  NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    bill_status     VARCHAR(20)     NOT NULL DEFAULT 'UNPAID' CHECK (bill_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    CONSTRAINT uq_room_month_year UNIQUE (room_id, month_year)
);

-- Table 7: student_utility_debts (Per-student Allocated Utility Debts)
CREATE TABLE student_utility_debts (
    debt_id         SERIAL          PRIMARY KEY,
    bill_id         INT             NOT NULL REFERENCES utility_bills(bill_id) ON DELETE CASCADE,
    student_id      VARCHAR(20)     NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    assigned_amount NUMERIC(12, 2)  NOT NULL CHECK (assigned_amount >= 0),
    paid_amount     NUMERIC(12, 2)  NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    debt_status     VARCHAR(20)     NOT NULL DEFAULT 'UNPAID' CHECK (debt_status IN ('UNPAID', 'PAID')),
    CONSTRAINT uq_bill_student UNIQUE (bill_id, student_id)
);

-- Table 8: payment_transactions (Financial Payment Receipts / Ledger)
CREATE TABLE payment_transactions (
    tx_id           SERIAL          PRIMARY KEY,
    debt_id         INT             REFERENCES student_utility_debts(debt_id) ON DELETE SET NULL,
    bill_id         INT             REFERENCES utility_bills(bill_id) ON DELETE SET NULL,
    student_id      VARCHAR(20)     NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    amount          NUMERIC(12, 2)  NOT NULL CHECK (amount > 0),
    tx_time         TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_code  VARCHAR(50)     NOT NULL UNIQUE,
    status          VARCHAR(20)     NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED'))
);

-- Table 9: audit_logs (Security & Accounting Audit Trail Captured by Triggers)
CREATE TABLE audit_logs (
    log_id      BIGSERIAL       PRIMARY KEY,
    table_name  VARCHAR(50)     NOT NULL,
    action_type VARCHAR(10)     NOT NULL,
    record_id   VARCHAR(50)     NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    changed_by  VARCHAR(100)    NOT NULL DEFAULT SESSION_USER,
    changed_at  TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason      TEXT
);

-- Table 10: dorm_access_logs (Security Turnstile Turn-gate Access Logs)
CREATE TABLE dorm_access_logs (
    log_id      BIGSERIAL                   PRIMARY KEY,
    student_id  VARCHAR(20)                 NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    gate_name   VARCHAR(50)                 NOT NULL,
    check_time  TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    is_late     BOOLEAN                     NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------------------
-- 4. INITIAL SEED DATA
-- ----------------------------------------------------------------------------

-- Seed 1: Buildings (3 buildings)
INSERT INTO dorm_buildings (building_id, building_name, gender_zone, total_floors) VALUES
('B1', 'Tòa B1 - Nam', 'MALE', 5),
('B2', 'Tòa B2 - Nữ', 'FEMALE', 5),
('B3', 'Tòa B3 - Hỗn hợp', 'MIXED', 4);

-- Seed 2: Rooms (6 rooms across 3 buildings with semantic descriptions and normalized dummy embeddings)
-- Note: Dummy 384-dimensional vectors initialized via pure SQL array generation
INSERT INTO rooms (building_id, room_number, capacity, current_occupancy, base_price, description, embedding, status)
SELECT 
    b.building_id,
    r.room_number,
    4,
    2,
    r.base_price,
    r.description,
    (
        SELECT ('[' || string_agg((round(((sin(i * r.seed_val) * 0.1))::numeric, 6))::text, ',') || ']')::vector
        FROM generate_series(1, 384) AS i
    ),
    'AVAILABLE'
FROM (
    VALUES
    ('B1', 'B1-101', 1200000.00, 'Phòng nam tầng 1, ban công thoáng mát, gần căng-tin và nhà xe', 1.1),
    ('B1', 'B1-102', 1200000.00, 'Phòng nam tầng 1, yên tĩnh, view sân bóng rổ, có wifi tốc độ cao', 1.2),
    ('B2', 'B2-201', 1300000.00, 'Phòng nữ tầng 2, thoáng mát đón gió tự nhiên, gần thư viện ký túc xá', 2.1),
    ('B2', 'B2-202', 1300000.00, 'Phòng nữ tầng 2, phòng góc có cửa sổ lớn hướng đông, view vườn hoa', 2.2),
    ('B3', 'B3-301', 1500000.00, 'Phòng dịch vụ tầng 3 chất lượng cao, có điều hòa và bình nóng lạnh', 3.1),
    ('B3', 'B3-302', 1500000.00, 'Phòng dịch vụ tầng 3 khép kín, tiện nghi hiện đại, không gian yên tĩnh', 3.2)
) AS r(b_id, room_number, base_price, description, seed_val)
JOIN dorm_buildings b ON b.building_id = SUBSTRING(r.room_number, 1, 2)
ORDER BY r.room_number;

-- Seed 3: Students (12 students)
INSERT INTO students (student_id, full_name, email, phone, major, status) VALUES
('B2100001', 'Nguyễn Văn An', 'an.b2100001@student.ctu.edu.vn', '0912345601', 'Kỹ thuật Phần mềm', 'ACTIVE'),
('B2100002', 'Trần Hoàng Bình', 'binh.b2100002@student.ctu.edu.vn', '0912345602', 'Kỹ thuật Phần mềm', 'ACTIVE'),
('B2100003', 'Lê Quốc Cường', 'cuong.b2100003@student.ctu.edu.vn', '0912345603', 'Khoa học Máy tính', 'ACTIVE'),
('B2100004', 'Phạm Minh Dũng', 'dung.b2100004@student.ctu.edu.vn', '0912345604', 'Hệ thống Thông tin', 'ACTIVE'),
('B2100005', 'Huỳnh Ngọc Dung', 'dung.b2100005@student.ctu.edu.vn', '0912345605', 'Mạng máy tính & TTTT', 'ACTIVE'),
('B2100006', 'Đặng Thùy Dương', 'duong.b2100006@student.ctu.edu.vn', '0912345606', 'An toàn Thông tin', 'ACTIVE'),
('B2100007', 'Võ Hoàng Giang', 'giang.b2100007@student.ctu.edu.vn', '0912345607', 'Công nghệ Thông tin', 'ACTIVE'),
('B2100008', 'Bùi Ngọc Hạnh', 'hanh.b2100008@student.ctu.edu.vn', '0912345608', 'Kỹ thuật Dữ liệu', 'ACTIVE'),
('B2100009', 'Ngô Minh Khoa', 'khoa.b2100009@student.ctu.edu.vn', '0912345609', 'Trí tuệ Nhân tạo', 'ACTIVE'),
('B2100010', 'Trịnh Công Long', 'long.b2100010@student.ctu.edu.vn', '0912345610', 'Kỹ thuật Phần mềm', 'ACTIVE'),
('B2100011', 'Lý Phương Mai', 'mai.b2100011@student.ctu.edu.vn', '0912345611', 'Hệ thống Thông tin', 'ACTIVE'),
('B2100012', 'Đoàn Bảo Nam', 'nam.b2100012@student.ctu.edu.vn', '0912345612', 'Khoa học Máy tính', 'ACTIVE');

-- Seed 4: Student Wallets (12 wallets with initial funded balances between 500,000 and 2,000,000 VND)
INSERT INTO student_wallets (student_id, balance) VALUES
('B2100001', 1500000.00),
('B2100002',  800000.00),
('B2100003', 2000000.00),
('B2100004',  500000.00),
('B2100005', 1200000.00),
('B2100006',  950000.00),
('B2100007', 1800000.00),
('B2100008',  750000.00),
('B2100009', 1400000.00),
('B2100010',  600000.00),
('B2100011', 1100000.00),
('B2100012', 1650000.00);

-- Seed 5: Room Assignments (2 active students per room across 6 rooms)
INSERT INTO room_assignments (room_id, student_id, bed_number, start_date, end_date, is_active)
SELECT 
    r.room_id,
    s.student_id,
    s.bed_number,
    '2026-09-01'::DATE,
    '2027-06-30'::DATE,
    TRUE
FROM (
    VALUES
    ('B1-101', 'B2100001', 1),
    ('B1-101', 'B2100002', 2),
    ('B1-102', 'B2100003', 1),
    ('B1-102', 'B2100004', 2),
    ('B2-201', 'B2100005', 1),
    ('B2-201', 'B2100006', 2),
    ('B2-202', 'B2100007', 1),
    ('B2-202', 'B2100008', 2),
    ('B3-301', 'B2100009', 1),
    ('B3-301', 'B2100010', 2),
    ('B3-302', 'B2100011', 1),
    ('B3-302', 'B2100012', 2)
) AS s(room_number, student_id, bed_number)
JOIN rooms r ON r.room_number = s.room_number;
