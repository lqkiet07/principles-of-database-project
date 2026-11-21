from typing import Any

import numpy as np

from app.ai.embeddings import embed_texts
from app.db import fetch_all


async def search_rooms_semantic(
    query: str,
    limit: int = 8,
    include_full: bool = True,
    ma_khu: str | None = None,
) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []

    query_vec = np.array(embed_texts([q])[0], dtype=np.float32)

    where_extra = "" if include_full else "AND v.trang_thai_phong IN ('TRONG', 'CON_CHO')"
    params: list[Any] = []
    khu_clause = ""
    if ma_khu and ma_khu.strip().upper() in ("A", "B"):
        khu_clause = "AND v.ma_khu = %s"
        params.append(ma_khu.strip().upper())

    rows = await fetch_all(
        f"""
        SELECT v.ma_phong, v.ten_phong, v.ma_khu, v.ten_khu, v.suc_chua, v.co_nau_an,
               v.gioi_tinh, v.gia_phong, v.trang_thai_phong, v.so_nguoi_o,
               p.mo_ta, p.embedding
        FROM v_phong_chi_tiet v
        JOIN phong p ON p.ma_phong = v.ma_phong
        WHERE v.trang_thai_phong <> 'BAO_TRI'
          AND v.ma_khu IN ('A', 'B')
          AND p.embedding IS NOT NULL
          {where_extra}
          {khu_clause}
        """,
        params,
    )

    scored: list[dict[str, Any]] = []
    for r in rows:
        emb = r.get("embedding")
        if not emb:
            continue
        room_vec = np.array(emb, dtype=np.float32)
        denom = float(np.linalg.norm(room_vec) * np.linalg.norm(query_vec))
        sim = float(np.dot(room_vec, query_vec) / denom) if denom > 0 else 0.0
        scored.append(
            {
                "ma_phong": r["ma_phong"],
                "ten_phong": r["ten_phong"],
                "ma_khu": r["ma_khu"],
                "ten_khu": r["ten_khu"],
                "suc_chua": r["suc_chua"],
                "co_nau_an": r["co_nau_an"],
                "gioi_tinh": r["gioi_tinh"],
                "gia_phong": int(r["gia_phong"]),
                "trang_thai_phong": r["trang_thai_phong"],
                "so_nguoi_o": r["so_nguoi_o"],
                "mo_ta": r["mo_ta"],
                "similarity": round(max(0.0, sim), 4),
            }
        )

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:limit]
