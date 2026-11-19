from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from psycopg import errors as pg_errors


def _extract_pg_message(exc: Exception) -> str:
    diag = getattr(exc, "diag", None)
    if diag and getattr(diag, "message_primary", None):
        return str(diag.message_primary)
    return str(exc).split("\n")[0]


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(pg_errors.RaiseException)
    async def handle_raise_exception(_request: Request, exc: pg_errors.RaiseException):
        return JSONResponse(
            status_code=400,
            content={"detail": _extract_pg_message(exc)},
        )

    @app.exception_handler(pg_errors.UniqueViolation)
    async def handle_unique_violation(_request: Request, exc: pg_errors.UniqueViolation):
        constraint = getattr(getattr(exc, "diag", None), "constraint_name", "") or ""
        messages = {
            "uq_doi_phong_dang_cho": "Bạn đang có một yêu cầu đổi phòng chờ xử lý. Không thể gửi thêm yêu cầu mới.",
            "uq_hop_dong_hieu_luc": "Phòng này đã có hợp đồng hiệu lực trong kỳ học hiện tại.",
            "luu_tru_pkey": "Sinh viên này đã được xếp phòng trong kỳ học hiện tại.",
            "sinh_vien_pkey": "MSSV đã tồn tại trong hệ thống.",
            "sinh_vien_email_key": "Email CTU này đã tồn tại trong hệ thống.",
            "phong_ten_phong_key": "Tên phòng này đã tồn tại.",
            "khu_pkey": "Mã khu này đã tồn tại.",
            "khu_ten_khu_key": "Tên khu này đã tồn tại.",
            "tai_khoan_ten_dang_nhap_key": "Tên đăng nhập đã tồn tại.",
            "thanh_toan_ma_hoa_don_key": "Hóa đơn này đã được thanh toán trước đó.",
            "uq_hoa_don_phong_ky_thang_loai": "Hóa đơn cho phòng và kỳ/tháng này đã tồn tại.",
        }
        msg = messages.get(constraint, f"Dữ liệu bị trùng lặp ({constraint or 'vi phạm duy nhất'}).")
        return JSONResponse(status_code=409, content={"detail": msg})

    @app.exception_handler(pg_errors.CheckViolation)
    async def handle_check_violation(_request: Request, exc: pg_errors.CheckViolation):
        constraint = getattr(getattr(exc, "diag", None), "constraint_name", "") or ""
        return JSONResponse(
            status_code=400,
            content={"detail": f"Dữ liệu không hợp lệ theo ràng buộc toàn vẹn ({constraint})."},
        )

    @app.exception_handler(pg_errors.ForeignKeyViolation)
    async def handle_fk_violation(_request: Request, exc: pg_errors.ForeignKeyViolation):
        return JSONResponse(
            status_code=400,
            content={"detail": "Dữ liệu tham chiếu không tồn tại hoặc đang được sử dụng bởi bản ghi khác."},
        )
