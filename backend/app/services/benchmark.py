from typing import Any

from app.db import get_connection
from app.errors import ApiError


def _accumulate_buffers(plan_node: dict[str, Any]) -> tuple[int, int]:
    hits = int(plan_node.get("Shared Hit Blocks", 0))
    reads = int(plan_node.get("Shared Read Blocks", 0))
    for child in plan_node.get("Plans", []):
        ch_hits, ch_reads = _accumulate_buffers(child)
        hits += ch_hits
        reads += ch_reads
    return hits, reads


async def run_index_benchmark(
    mode: str = "natural",
    from_time: str = "2026-09-01 00:00:00",
    to_time: str = "2026-10-01 23:59:59",
) -> dict[str, Any]:
    norm_mode = mode.strip().lower()
    if norm_mode not in ["seq", "index", "natural"]:
        raise ApiError(
            422,
            "INVALID_BENCHMARK_MODE",
            f"Chế độ '{mode}' không hợp lệ. Chọn 'seq', 'index' hoặc 'natural'.",
        )

    async with get_connection() as conn, conn.cursor() as cur:
        if norm_mode == "seq":
            await cur.execute("SET LOCAL enable_indexscan = off;")
            await cur.execute("SET LOCAL enable_bitmapscan = off;")
            await cur.execute("SET LOCAL enable_indexonlyscan = off;")
        elif norm_mode == "index":
            await cur.execute("SET LOCAL enable_seqscan = off;")
            await cur.execute("SET LOCAL random_page_cost = 1.1;")

        await cur.execute(
            """
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT student_id, check_time, gate_name
            FROM dorm_access_logs
            WHERE is_late = TRUE 
              AND check_time >= %s::timestamp AND check_time <= %s::timestamp;
            """,
            (from_time, to_time),
        )
        row = await cur.fetchone()

    plan_wrapper = row["QUERY PLAN"][0]
    plan_root = plan_wrapper["Plan"]
    hits, reads = _accumulate_buffers(plan_root)

    return {
        "mode": norm_mode,
        "execution_time_ms": float(plan_wrapper.get("Execution Time", 0.0)),
        "planning_time_ms": float(plan_wrapper.get("Planning Time", 0.0)),
        "node_type": plan_root.get("Node Type", "Unknown"),
        "shared_hit_blocks": hits,
        "shared_read_blocks": reads,
        "total_buffers": hits + reads,
        "rows_returned": int(plan_root.get("Actual Rows", 0)),
        "plan": plan_wrapper,
    }
