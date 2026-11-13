import hashlib
import hmac
import logging
import os
import secrets
from contextlib import contextmanager
from datetime import datetime
from zoneinfo import ZoneInfo

import oracledb
from fastapi import HTTPException

DEMO = os.getenv("CINEMA_DEMO", "0") == "1"
JWT_SECRET = os.getenv("CINEMA_JWT_SECRET") or secrets.token_hex(32)
NOW = "cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp)"
VIETNAM = ZoneInfo("Asia/Ho_Chi_Minh")
DB_USER = os.getenv("CINEMA_DB_USER", "cinema")
DB_PASSWORD = os.getenv("CINEMA_DB_PASSWORD", "")
DB_DSN = os.getenv("DB_DSN", "localhost:1521/FREEPDB1")
pool = None
logger = logging.getLogger(__name__)

MESSAGES = {
    20021: (409, "Ít nhất một ghế đã có người đặt cho suất chiếu này.", "PKG_DAT_VE.SP_GIU_CHO"),
    20022: (422, "Suất chiếu hoặc danh sách ghế không hợp lệ.", "PKG_DAT_VE.SP_GIU_CHO"),
    20023: (410, "Đơn đặt vé đã hết hạn thanh toán.", "PKG_DAT_VE.SP_THANH_TOAN"),
    20024: (409, "Đơn hoặc vé không ở trạng thái hợp lệ để xử lý.", "PKG_DAT_VE.SP_THANH_TOAN"),
    20025: (422, "Chỉ được hủy vé trước giờ chiếu tối thiểu 2 giờ.", "PKG_DAT_VE.SP_HUY_VE"),
    20026: (422, "Mã khuyến mãi không hợp lệ hoặc đã hết lượt sử dụng.", "PKG_DAT_VE.FN_TINH_GIAM"),
    20027: (409, "Mã giao dịch thanh toán đã được ghi nhận.", "PKG_DAT_VE.SP_THANH_TOAN"),
    20028: (404, "Không tìm thấy dữ liệu trong hệ thống.", "DATABASE_QUERY"),
    20031: (409, "Lịch chiếu trùng hoặc khoảng cách dọn phòng dưới 15 phút.", "TRG_SUAT_CHIEU_KHONG_TRUNG"),
    20032: (422, "Chuyển đổi trạng thái vé không hợp lệ.", "TRG_VE_CHUYEN_TRANG_THAI"),
}


def local_now():
    return datetime.now(VIETNAM).replace(tzinfo=None)


def init():
    global pool
    pool = oracledb.create_pool(
        user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN, min=2, max=20, increment=2,
    )
    with pool.acquire() as con:
        if not con.version.startswith("23."):
            raise RuntimeError(f"Yêu cầu Oracle Database 23ai; phiên bản hiện tại: {con.version}.")


def business_error(code, source=None):
    status, message, default_source = MESSAGES[code]
    return HTTPException(status, error_detail(code, status, message, source or default_source))


def error_detail(code, status, message, source):
    return {
        "ora_code": -abs(code) if code else None,
        "code": f"ORA-{abs(code):05d}" if code else None,
        "http_status": status,
        "message": message,
        "plsql_source": source,
        "plsql_object": source,
    }


@contextmanager
def connection(actor=None, source=None):
    if pool is None:
        raise HTTPException(503, error_detail(None, 503, "Chưa kết nối Oracle.", "ORACLE_CONNECTION"))
    try:
        with pool.acquire() as con:
            con.client_identifier = (actor or "anonymous")[:64]
            con.call_timeout = 45000
            try:
                yield con
            except Exception:
                try:
                    con.rollback()
                except oracledb.Error:
                    logger.warning("Oracle rollback failed after the original error")
                raise
    except oracledb.Error as exc:
        err = exc.args[0]
        code = getattr(err, "code", 0)
        if code in MESSAGES:
            obj = MESSAGES[code][2] if code in (20031, 20032) else source
            raise business_error(code, obj) from exc
        if code in (1, 1400, 1438, 2290, 2291, 2292, 12899):
            status, message, obj = 422, "Dữ liệu không đáp ứng ràng buộc toàn vẹn Oracle.", "DATABASE_CONSTRAINT"
        else:
            logger.warning("Oracle request failed: %s", getattr(err, "full_code", "unavailable"))
            status, message, obj = 503, "Oracle chưa xử lý được yêu cầu.", "ORACLE_INTERNAL"
        raise HTTPException(status, error_detail(code, status, message, source or obj)) from exc


def rows(cursor, sql, **params):
    cursor.execute(sql, params)
    names = [d.name.lower() for d in cursor.description]
    return [dict(zip(names, row)) for row in cursor]


def one(cursor, sql, **params):
    cursor.execute(sql, params)
    row = cursor.fetchone()
    if row is None:
        raise business_error(20028)
    return dict(zip((d.name.lower() for d in cursor.description), row))


def out_value(value):
    data = value.getvalue()
    return data[0] if isinstance(data, list) else data


def verify(password, encoded):
    try:
        salt, expected = encoded.split(":")
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, AttributeError):
        return False
