# Smart Dormitory & Campus Utility Billing System

> **A high-concurrency, ACID-compliant campus utility billing engine and dormitory management system powered by PostgreSQL 16, `pgvector`, and FastAPI.**

[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16.15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-0.8.7-blue)](https://github.com/pgvector/pgvector)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.162.0-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12.7-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/Tests-56%2F56%20Passed-brightgreen)](backend/tests/)
[![Ruff](https://img.shields.io/badge/Code%20Style-Ruff-000000?logo=ruff&logoColor=white)](https://astral.sh/ruff)
[![License](https://img.shields.io/badge/License-MIT-gray)](LICENSE)

An end-to-end academic capstone project for **Principles of Database Management Systems (CT221H)** at Can Tho University (CTU). Designed to solve real-world student accommodation challenges through strict 3NF database normalization, transactional financial operations, audit trails, big-data query optimization, and embedded vector search.

---

## Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│              Frontend Web Client (Next.js 16 + React 19)               │
│             Role Switcher • Student Portal • Admin Dashboard           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / JSON Envelope
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                FastAPI Backend API Gateway (Python 3.12)               │
│        psycopg3 Async Pool • SentenceTransformers • Scikit-learn       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ TCP 5432 (pgvector, Dual SPs, CDC)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 16.15 Enterprise Engine                   │
│   • 10 Normalized 3NF Tables       • Dual Stored Procedures (ACID)    │
│   • Pessimistic Row Locks          • Fraud-Prevention Triggers        │
│   • JSONB Audit Logging (CDC)      • Composite B-Tree Index (1M Logs) │
│   • Vector Embeddings (384-dim)    • Docker Compose Clean-room Env    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Technical Pillars

### 1. Dual Stored Procedure Financial Engine (PL/pgSQL)
- **`sp_generate_and_split_utility_bill`:** Automatically calculates tiered progressive electricity costs (Tier 1: 0–100 kWh, Tier 2: 101–200 kWh, Tier 3: >200 kWh) and water tariffs. Dynamically counts active occupants (`is_active = TRUE`) in the room, splits debt evenly, and reconciles IEEE 754 decimal rounding remainders to the final student to guarantee zero-loss parent-child balance.
- **`sp_pay_student_utility_bill`:** Executes atomic wallet settlement. Deducts student wallet balances, gags personal debt records, atomically aggregates room-level totals (`PARTIALLY_PAID` $\to$ `PAID`), and issues collision-resistant audit receipt codes (`TX-YYYYMMDD-HHMMSS-XXXXXX`).

### 2. ACID Concurrency Control & Double-Spending Prevention
- Employs **Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)** on wallet balances, personal debts, and parent bills.
- Eliminates race conditions and lost updates under concurrent checkout attempts (e.g., rapid double-clicking or network retries) without incurring the severe throughput degradation of `SERIALIZABLE` isolation.

### 3. Change Data Capture & Fraud Prevention Triggers
- **`trg_validate_utility_meter_fraud`:** Intercepts `BEFORE INSERT OR UPDATE` events on `utility_bills` to strictly reject fraudulent reverse meter readings (`curr_electric < prev_electric`) and block modifications on settled (`PAID`) invoices.
- **`trg_audit_utility_meter_update`:** Automated audit trail capturing full pre- and post-mutation states as structured `JSONB` snapshots (`to_jsonb(OLD)` and `to_jsonb(NEW)`) for regulatory compliance and forensics.

### 4. Big Data Query Optimization (1,000,000 Access Logs)
- Synthetic benchmark dataset of **1,000,000 access log records** evaluating late-night curfew violations after 23:00.
- Evaluated via `EXPLAIN (ANALYZE, BUFFERS)`:
  - **Sequential Scan (Unindexed):** ~45.4 ms execution time, 19,066 shared buffer hits.
  - **Composite B-Tree Index `(is_late, check_time)`:** **3.7–5.4 ms execution time**, 4,655 shared buffer hits (**~16x performance speedup, >75% I/O buffer reduction**).

### 5. In-Database AI & Machine Learning Integration
- **Semantic Room Search:** Natural language Vietnamese query processing using `paraphrase-multilingual-MiniLM-L12-v2` embeddings mapped into PostgreSQL `vector(384)` columns via Cosine Distance operator (`<=>`).
- **Load Forecasting:** `RandomForestRegressor` predicting utility consumption 3 months ahead based on 24 months of historical room billing data.
- **Student Behavioral Segmentation:** `K-Means` clustering categorizing students into 3 actionable profiles (Exemplary, Financial Risk, Security Alert) paired with 2D Principal Component Analysis (PCA) projections.

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.12+ (with virtual environment support)

### 1. Launch Database Infrastructure
```bash
docker compose up -d
docker compose ps
```
The database container automatically bootstraps all 10 normalized tables, Stored Procedures, Triggers, and pgvector extensions.

### 2. Set Up Backend API
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Start Development Server
```powershell
uvicorn app.main:app --reload --port 8000
```
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`
- **ReDoc Specification:** `http://127.0.0.1:8000/redoc`
- **Health Check:** `http://127.0.0.1:8000/health`

### 4. Run Frontend Client
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with the Student Mobile Portal and Admin Dashboard.

### 5. Run Isolated Verification Test Suite (56 Tests)
```powershell
# Executes full hermetic test harness on an isolated test database
cd backend
.\scripts\run_tests.ps1 -v
```

### 6. Run Live Smoke Check
```powershell
cd backend
python -m scripts.smoke_check
```

---

## Repository Structure

```text
principles-of-database/
├── docker-compose.yml              # PostgreSQL 16 + pgvector container
├── database/                       # SQL DDL, Procedures, and Triggers
│   ├── 01_schema.sql               # 10-table 3NF schema & vector types
│   ├── 02_procedures.sql           # Dual SPs (SP1 split, SP2 payment)
│   ├── 03_triggers.sql             # Anti-fraud trigger & JSONB audit log
│   ├── 04_seed_1m_logs.sql         # 1M log generator & composite index
│   └── 05_test_cases.sql           # Clean-room SQL verification harness
├── backend/                        # FastAPI REST API & AI Engine
│   ├── app/                        # Routers, schemas, DB pool, AI models
│   ├── scripts/                    # Seeding, evidence capture, smoke check
│   ├── tests/                      # 56 hermetic pytest cases
│   └── requirements.txt            # Python dependencies
├── docs/                           # Documentation & Evidence
│   ├── api/openapi.json            # Frozen OpenAPI 3.1.0 contract (22 paths)
│   ├── evidence/backend/           # 11 empirical benchmark JSON artifacts
│   └── specs/                      # System technical specifications
└── frontend/                       # SaaS Web Client (Next.js 16 + React 19)
```

---

## Contributors & Academic Attribution

Developed as a Course Capstone Project for **Principles of Database Management Systems (CT221H)** — Department of Information Technology, College of Information & Communication Technology (CICT), Can Tho University (CTU).

- **Database Architect & Indexing:** Schema 3NF, Dual Stored Procedures, Triggers, 1M Access Log Benchmark.
- **Backend & AI Lead:** FastAPI Async Connection Pool, 22 Endpoints, 3 ML/Vector Models, 56 Hermetic Tests.
- **Frontend SaaS & Reporting:** Next.js 16 App Router UI, Demo Checkpoints, Technical Report & Presentation.
