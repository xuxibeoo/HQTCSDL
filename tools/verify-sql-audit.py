"""Rollback-only regression checks against the running CINEMA demo schema.

Run from the project root:
  Get-Content -Raw .\tools\verify-sql-audit.py | docker compose exec -T web python -

No reset, seed load, DDL or COMMIT is performed. Identity sequences may advance
even when Oracle rolls back rows. TC-03 (committed winner) is intentionally not
run here; the two additional concurrency checks release session A by rollback.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Event
import json
import time
from uuid import uuid4

import oracledb
import db
import main  # Initialize route modules in their normal import order.
from diagnostics import benchmark, fixture, hold, ordinary, pay


results = []


def record(name, action):
    try:
        detail = action()
        results.append({"case": name, "passed": True, "detail": detail})
    except Exception as exc:
        results.append({"case": name, "passed": False, "error": str(exc)})


def voucher_date(start_days, end_days, expected):
    with db.connection("SQL_AUDIT_ROLLBACK") as con, con.cursor() as cur:
        try:
            code = "AUDIT_" + uuid4().hex[:12].upper()
            cur.execute(f"""insert into khuyen_mai(ma_code,loai_giam,gia_tri,
                ngay_bat_dau,ngay_ket_thuc,so_luot_toi_da)
                values(:code,'SO_TIEN',1000,trunc({db.NOW})+:starts,
                trunc({db.NOW})+:ends,1)""", code=code, starts=start_days, ends=end_days)
            try:
                discount = cur.callfunc("pkg_dat_ve.fn_tinh_giam", int, [code, 100000])
            except oracledb.Error as exc:
                if expected is None and exc.args[0].code == 20026:
                    return {"start_day_offset": start_days, "end_day_offset": end_days,
                            "oracle_code": 20026}
                raise
            assert expected is not None and discount == expected, (expected, discount)
            return {"start_day_offset": start_days, "end_day_offset": end_days,
                    "discount": discount}
        finally:
            con.rollback()


def refund_rounding_and_points():
    with db.connection("SQL_AUDIT_ROLLBACK") as con, con.cursor() as cur:
        try:
            f = fixture(cur, db.local_now().replace(microsecond=0) + timedelta(days=14))
            code = "AUDIT_" + uuid4().hex[:12].upper()
            cur.execute(f"""insert into khuyen_mai(ma_code,loai_giam,gia_tri,
                ngay_bat_dau,ngay_ket_thuc,so_luot_toi_da)
                values(:code,'SO_TIEN',1,trunc({db.NOW})-1,trunc({db.NOW})+1,1)""", code=code)
            cur.execute("select diem_tich_luy from khach_hang where ma_kh=:id", id=f["customer"])
            points_before = cur.fetchone()[0]
            order = hold(cur, f, ("A", "B"), code)
            cur.execute("select min(ma_combo) from combo")
            cur.execute("""insert into don_combo(ma_don,ma_combo,so_luong,don_gia)
                values(:order_id,:combo_id,1,65000)""", order_id=order, combo_id=cur.fetchone()[0])
            pay(cur, order)
            cur.execute("select so_tien from thanh_toan where ma_don=:id and trang_thai='THANH_CONG'", id=order)
            paid = cur.fetchone()[0]
            cur.execute("select ma_ve from ve where ma_don=:id order by ma_ve", id=order)
            ticket_ids = [row[0] for row in cur]
            refunds = []
            for ticket_id in ticket_ids:
                value = cur.var(int)
                cur.callproc("pkg_dat_ve.sp_huy_ve", [ticket_id, value])
                refunds.append(db.out_value(value))
            cur.execute("select diem_tich_luy from khach_hang where ma_kh=:id", id=f["customer"])
            points_retained = cur.fetchone()[0] - points_before
            assert paid - sum(refunds) == 65000, (paid, refunds)
            assert points_retained == 6, points_retained
            return {"paid": paid, "refunds": refunds, "retained_combo": 65000,
                    "points_retained": points_retained}
        finally:
            con.rollback()


def rollback_lock_handoff(kind):
    """B waits on A; after A rolls back B succeeds, then also rolls back."""
    attempted, finished = Event(), Event()
    with db.connection("SQL_AUDIT_SESSION_A") as first, first.cursor() as cur:
        try:
            if kind == "schedule":
                cur.execute("select min(ma_phong),min(ma_phim) from suat_chieu where dinh_dang='2D'")
                room, film = cur.fetchone()
                start = datetime(2037, 1, 1, 12, 0, 0)
                sql = """insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,
                    gio_ket_thuc,dinh_dang,gia_co_ban)
                    values(:film,:room,:starts,:starts+interval '1' hour,'2D',100000)"""
                # Use the room's actual format rather than assuming its numeric ID.
                cur.execute("select ma_phong from phong_chieu where loai_phong='2D' order by ma_phong fetch first 1 row only")
                room = cur.fetchone()[0]
                cur.execute(sql, film=film, room=room, starts=start)
                def second_action(other):
                    other.execute(sql, film=film, room=room, starts=start + timedelta(minutes=30))
            else:
                cur.execute(f"""select s.ma_suat,g.ma_ghe,(select min(ma_kh) from khach_hang)
                    from suat_chieu s join ghe g on g.ma_phong=s.ma_phong
                    where s.trang_thai='MO_BAN' and s.gio_bat_dau>{db.NOW}+interval '3' hour
                      and not exists(select 1 from ve v where v.ma_suat=s.ma_suat
                        and v.ma_ghe=g.ma_ghe and v.trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG'))
                    order by s.gio_bat_dau desc,g.ma_ghe fetch first 1 row only""")
                found = cur.fetchone()
                assert found, "No future available demo seat; prepare demo showtimes first."
                show, seat, customer = found
                args = [customer, show, json.dumps([seat]), None]
                cur.callproc("pkg_dat_ve.sp_giu_cho", args + [cur.var(int)])
                def second_action(other):
                    other.callproc("pkg_dat_ve.sp_giu_cho", args + [other.var(int)])

            def session_b():
                with db.connection("SQL_AUDIT_SESSION_B") as second, second.cursor() as other:
                    second.call_timeout = 8000
                    try:
                        attempted.set()
                        second_action(other)
                        return "success_after_A_rollback"
                    finally:
                        second.rollback()
                        finished.set()

            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(session_b)
                assert attempted.wait(3), "Session B did not start."
                time.sleep(0.35)
                blocked = not finished.is_set()
                first.rollback()
                outcome = future.result(timeout=10)
                assert blocked, "Session B did not wait for session A's uncommitted lock."
                return {"kind": kind, "B_waited": blocked, "B_result": outcome,
                        "commit_used": False}
        finally:
            first.rollback()


def plans():
    output = benchmark({"role": "ROLE_IT_ADMIN", "email": "SQL_AUDIT_READONLY"})
    concise = {}
    for key, data in output.items():
        assert data["result_match"], f"Query {key} results differ."
        assert "TABLE ACCESS FULL" in data["plans"][0]["plan"]
        assert "INDEX RANGE SCAN" in data["plans"][1]["plan"]
        concise[key] = {"result_match": True, "bind_id": data["bind_id"],
                        "buffer_gets": [plan["buffer_gets"] for plan in data["plans"]]}
    return concise


db.init()
try:
    for case in (1, 2, 4, 5, 6, 7, 8, 9):
        record(f"TC-{case:02}", lambda case=case: ordinary(case, "SQL_AUDIT_ROLLBACK"))
    for label, starts, ends, expected in (
        ("VOUCHER_EXPIRED_YESTERDAY", -2, -1, None),
        ("VOUCHER_EXPIRES_TODAY", -1, 0, 1000),
        ("VOUCHER_TODAY_ONLY", 0, 0, 1000),
        ("VOUCHER_STARTS_TOMORROW", 1, 2, None),
        ("VOUCHER_EXPIRES_TOMORROW", -1, 1, 1000),
    ):
        record(label, lambda starts=starts, ends=ends, expected=expected: voucher_date(starts, ends, expected))
    record("CUMULATIVE_REFUND_AND_POINTS", refund_rounding_and_points)
    record("SCHEDULE_LOCK_ROLLBACK_HANDOFF", lambda: rollback_lock_handoff("schedule"))
    record("SEAT_UNIQUE_LOCK_ROLLBACK_HANDOFF", lambda: rollback_lock_handoff("seat"))
    record("TWO_QUERY_PLANS_READONLY", plans)
finally:
    db.pool.close(force=True)

print(json.dumps({"mode": "rollback_only", "passed": sum(row["passed"] for row in results),
                  "total": len(results), "results": results}, ensure_ascii=False, indent=2))
if any(not row["passed"] for row in results):
    raise SystemExit(1)
