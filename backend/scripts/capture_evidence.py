import asyncio
import json
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx

from app.db import close_pool, execute, fetch_one
from app.main import app

EVIDENCE_DIR = (
    Path(__file__).resolve().parent.parent.parent / "docs" / "evidence" / "backend"
)


async def capture_all_evidence():
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Capturing evidence artifacts into: {EVIDENCE_DIR}")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. SP1 Generate Bill & Split
        await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")
        res1 = await client.post(
            "/api/admin/bills",
            json={
                "room_id": 1,
                "month_year": "2026-11",
                "prev_electric": 100,
                "curr_electric": 350,
                "prev_water": 20,
                "curr_water": 35,
            },
            headers={"X-Role": "admin"},
        )
        data1 = res1.json()
        (EVIDENCE_DIR / "01_sp1_generate_bill.json").write_text(
            json.dumps(data1, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 01_sp1_generate_bill.json saved.")

        # 2. SP2 Payment Success
        bill_id = data1["data"]["bill_id"]
        debt = await fetch_one(
            "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100001';",
            (bill_id,),
        )
        res2 = await client.post(
            "/api/payments",
            json={
                "student_id": "B2100001",
                "debt_id": debt["debt_id"],
                "amount": 375000.0,
            },
        )
        data2 = res2.json()
        (EVIDENCE_DIR / "02_sp2_payment_success.json").write_text(
            json.dumps(data2, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 02_sp2_payment_success.json saved.")

        # 3. SP2 Concurrency Race Condition
        await execute(
            """
            CALL sp_generate_and_split_utility_bill(
                5, '2026-11', 100, 350, 20, 35,
                NULL, NULL, NULL, NULL, NULL
            );
            """
        )
        b5 = await fetch_one(
            "SELECT bill_id FROM utility_bills WHERE room_id = 5 AND month_year = '2026-11';"
        )
        d5 = await fetch_one(
            "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100009';",
            (b5["bill_id"],),
        )
        p_payload = {
            "student_id": "B2100009",
            "debt_id": d5["debt_id"],
            "amount": 375000.0,
        }
        c1, c2 = await asyncio.gather(
            client.post("/api/payments", json=p_payload),
            client.post("/api/payments", json=p_payload),
        )
        data3 = {
            "description": "Thực nghiệm gửi 2 yêu cầu thanh toán đồng thời cho cùng 1 khoản nợ cá nhân để kiểm chứng khóa bi quan SELECT ... FOR UPDATE chống Double-Spending.",
            "request_1": {"http_status": c1.status_code, "response": c1.json()},
            "request_2": {"http_status": c2.status_code, "response": c2.json()},
        }
        (EVIDENCE_DIR / "03_sp2_concurrency_race.json").write_text(
            json.dumps(data3, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 03_sp2_concurrency_race.json saved.")

        # 4. SP2 Insufficient Funds Rollback
        await execute(
            """
            CALL sp_generate_and_split_utility_bill(
                2, '2026-11', 0, 500, 0, 80,
                NULL, NULL, NULL, NULL, NULL
            );
            """
        )
        b2 = await fetch_one(
            "SELECT bill_id FROM utility_bills WHERE room_id = 2 AND month_year = '2026-11';"
        )
        d4 = await fetch_one(
            "SELECT debt_id, assigned_amount FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100004';",
            (b2["bill_id"],),
        )
        bal_before = await fetch_one(
            "SELECT balance FROM student_wallets WHERE student_id = 'B2100004';"
        )
        res4 = await client.post(
            "/api/payments",
            json={
                "student_id": "B2100004",
                "debt_id": d4["debt_id"],
                "amount": float(d4["assigned_amount"]),
            },
        )
        bal_after = await fetch_one(
            "SELECT balance FROM student_wallets WHERE student_id = 'B2100004';"
        )
        data4 = {
            "description": "Kịch bản thanh toán vượt số dư ví (INSUFFICIENT_FUNDS - Code 4). Số dư và công nợ được bảo toàn nguyên tử (Rollback).",
            "wallet_balance_before": float(bal_before["balance"]),
            "wallet_balance_after": float(bal_after["balance"]),
            "payment_response": res4.json(),
        }
        (EVIDENCE_DIR / "04_sp2_insufficient_funds_rollback.json").write_text(
            json.dumps(data4, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 04_sp2_insufficient_funds_rollback.json saved.")

        # 5. Trigger Fraud Reversal
        res5 = await client.patch(
            f"/api/admin/bills/{bill_id}/meters",
            json={"curr_electric": 50, "curr_water": 35},
            headers={"X-Role": "admin"},
        )
        data5 = {
            "description": "Trigger trg_validate_utility_meter_fraud chặn số điện lùi (curr < prev) ném lỗi 422.",
            "http_status": res5.status_code,
            "response": res5.json(),
        }
        (EVIDENCE_DIR / "05_trigger_fraud_reversal.json").write_text(
            json.dumps(data5, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 05_trigger_fraud_reversal.json saved.")

        # 6. Trigger Audit Log JSONB
        await client.patch(
            f"/api/admin/bills/{bill_id}/meters",
            json={"curr_electric": 360, "curr_water": 38},
            headers={"X-Role": "admin"},
        )
        res6 = await client.get(
            f"/api/admin/audit-logs?record_id={bill_id}", headers={"X-Role": "admin"}
        )
        data6 = {
            "description": "Trigger trg_audit_utility_meter_update tự động ghi vết thay đổi trạng thái trước/sau dạng JSONB vào audit_logs.",
            "audit_trail": res6.json()["data"],
        }
        (EVIDENCE_DIR / "06_trigger_audit_log_jsonb.json").write_text(
            json.dumps(data6, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 06_trigger_audit_log_jsonb.json saved.")

        # 7. Benchmark Seq Scan
        res7 = await client.get(
            "/api/admin/benchmark?mode=seq", headers={"X-Role": "admin"}
        )
        data7 = res7.json()["data"]
        (EVIDENCE_DIR / "07_benchmark_seq_scan.json").write_text(
            json.dumps(data7, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 07_benchmark_seq_scan.json saved.")

        # 8. Benchmark Index Scan
        res8 = await client.get(
            "/api/admin/benchmark?mode=index", headers={"X-Role": "admin"}
        )
        data8 = res8.json()["data"]
        (EVIDENCE_DIR / "08_benchmark_index_scan.json").write_text(
            json.dumps(data8, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 08_benchmark_index_scan.json saved.")

        # 9. AI Semantic Search
        res9 = await client.get(
            "/api/ai/semantic-search?q=phòng nữ thoáng mát yên tĩnh gần thư viện"
        )
        data9 = {
            "query": "phòng nữ thoáng mát yên tĩnh gần thư viện",
            "results": res9.json()["data"],
        }
        (EVIDENCE_DIR / "09_ai_semantic_search.json").write_text(
            json.dumps(data9, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 09_ai_semantic_search.json saved.")

        # 10. AI Forecasting kWh
        res10 = await client.get("/api/ai/forecast?building_id=B1")
        data10 = res10.json()["data"]
        (EVIDENCE_DIR / "10_ai_forecasting_kwh.json").write_text(
            json.dumps(data10, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 10_ai_forecasting_kwh.json saved.")

        # 11. AI Student Clusters
        res11 = await client.get("/api/ai/clusters")
        data11 = res11.json()["data"]
        (EVIDENCE_DIR / "11_ai_student_clusters.json").write_text(
            json.dumps(data11, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("-> 11_ai_student_clusters.json saved.")

        # Clean up test 2026-11 bills
        await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")

    print("\nAll 11 evidence artifacts generated successfully!")


if __name__ == "__main__":

    async def main():
        await capture_all_evidence()
        await close_pool()

    asyncio.run(main())
