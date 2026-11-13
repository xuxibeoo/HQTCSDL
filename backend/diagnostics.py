from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import timedelta
import json
from threading import Event, Lock
from time import perf_counter
from uuid import uuid4

import oracledb
from fastapi import APIRouter, Depends, HTTPException
import db
from main import permit

IT = "ROLE_IT_ADMIN"
router = APIRouter(prefix="/api/admin")
test_lock = Lock()


@router.get("/analytics")
def analytics(actor=Depends(permit("ROLE_EXECUTIVE", "ROLE_ACCOUNTING", IT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        top = db.rows(cur, """with sales as (
          select trunc(s.gio_bat_dau,'MM') thang,p.ma_phim,p.ten_phim,sum(v.gia_ve) doanh_thu
          from ve v join suat_chieu s on s.ma_suat=v.ma_suat join phim p on p.ma_phim=s.ma_phim
          where v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
          group by trunc(s.gio_bat_dau,'MM'),p.ma_phim,p.ten_phim
        ), ranked as (
          select sales.*,dense_rank() over(partition by thang order by doanh_thu desc) hang from sales
        ) select * from ranked where hang<=10 order by thang desc,hang,ma_phim""")
        trend = db.rows(cur, f"""with calendar as (
          select add_months(trunc({db.NOW},'MM'),level-12) thang from dual connect by level<=12
        ), movement as (
          select trunc(thoi_gian_tt,'MM') thang,
            case trang_thai when 'HOAN_TIEN' then -so_tien else so_tien end amount
          from thanh_toan where trang_thai in ('THANH_CONG','HOAN_TIEN')
        ), totals as (
          select c.thang,nvl(sum(m.amount),0) doanh_thu from calendar c left join movement m on c.thang=m.thang group by c.thang
        ), calc as (
          select totals.*,lag(doanh_thu) over(order by thang) thang_truoc,
          sum(doanh_thu) over(order by thang rows unbounded preceding) luy_ke,
          round(avg(doanh_thu) over(order by thang rows between 2 preceding and current row)) tb_3_thang from totals
        ) select calc.*,round(100*(doanh_thu-thang_truoc)/nullif(thang_truoc,0),2) tang_truong
          from calc order by thang""")
        by_site = db.rows(cur, """select r.ten_rap,p.ten_phim,count(*) so_ve,sum(v.gia_ve) doanh_thu_ve
          from ve v join suat_chieu s on s.ma_suat=v.ma_suat join phim p on p.ma_phim=s.ma_phim
          join phong_chieu h on h.ma_phong=s.ma_phong join rap r on r.ma_rap=h.ma_rap
          where v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
          group by r.ten_rap,p.ten_phim order by doanh_thu_ve desc fetch first 30 rows only""")
        return {"top": top, "trend": trend, "theo_rap": by_site}


@router.get("/benchmark")
def benchmark(actor=Depends(permit(IT, "ROLE_CUSTOMER", "ROLE_EXECUTIVE"))):
    if not db.DEMO and actor["role"] != IT:
        raise HTTPException(404)
    queries = {
        "A": ("ve", "ix_ve_suat_tt_ghe",
              "select {hint} ma_ghe,trang_thai from ve q where ma_suat=:id and trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG')",
              "select ma_suat id from ve where trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG') group by ma_suat order by count(*) desc fetch first 1 row only"),
        "B": ("don_dat_ve", "ix_don_kh_tg",
              "select {hint} ma_don,thoi_gian_dat,tong_tien,trang_thai from don_dat_ve q where ma_kh=:id order by thoi_gian_dat desc fetch first 10 rows only",
              "select ma_kh id from don_dat_ve group by ma_kh order by count(*) desc fetch first 1 row only"),
    }
    result = {}
    with db.connection(actor["email"], "DBMS_XPLAN.DISPLAY_CURSOR") as con, con.cursor() as cur:
        for label, (table, index, query, key_sql) in queries.items():
            key = db.one(cur, key_sql)["id"]
            plans, returned = [], []
            for hint in ("FULL(q)", f"INDEX(q {index})"):
                tag = "CINEMA_PLAN_" + uuid4().hex
                sql = query.format(hint=f"/*+ GATHER_PLAN_STATISTICS {hint} */ /* {tag} */")
                cur.execute(sql, id=key)
                returned.append(cur.fetchall())
                stats = db.one(cur, """select sql_id,child_number from v$sql where sql_text like :prefix
                    order by last_active_time desc fetch first 1 row only""", prefix=f"select /*%{tag}%")
                stats.update(db.one(cur, """select nvl(last_cr_buffer_gets,0)+nvl(last_cu_buffer_gets,0) buffer_gets,
                    last_elapsed_time elapsed_time,last_output_rows rows_processed
                    from v$sql_plan_statistics_all where sql_id=:sql_id and child_number=:child and id=0""",
                    sql_id=stats["sql_id"], child=stats["child_number"]))
                plan = db.rows(cur, "select plan_table_output from table(dbms_xplan.display_cursor(:sql_id,:child,'ALLSTATS LAST'))",
                               sql_id=stats["sql_id"], child=stats["child_number"])
                stats["elapsed_ms"] = round(stats.pop("elapsed_time")/1000, 3)
                stats["plan"] = "\n".join(r["plan_table_output"] or "" for r in plan)
                stats["hint"] = hint
                plans.append(stats)
            result[label] = {"table": table, "bind_id": key, "plans": plans,
                             "result_match": sorted(returned[0]) == sorted(returned[1])}
    return result


def require(condition, note):
    if not condition:
        raise AssertionError(note)


def expect(code, action):
    try:
        action()
    except oracledb.Error as exc:
        require(exc.args[0].code == code, str(exc))
        return
    raise AssertionError(f"Thiếu ORA-{code}.")


def fixture(cur, starts):
    data = db.one(cur, """select (select min(ma_phong) from phong_chieu where loai_phong='2D') room,
       (select min(ma_phim) from phim) film,(select min(ma_kh) from khach_hang) customer from dual""")
    out = cur.var(int)
    old_room = data["room"]
    site = db.one(cur, "select ma_rap from phong_chieu where ma_phong=:id", id=old_room)["ma_rap"]
    cur.execute("""insert into phong_chieu(ma_rap,ten_phong,loai_phong)
        values(:site,:name,'2D') returning ma_phong into :id""",
        name="TC-"+uuid4().hex[:16], site=site, id=out)
    data["room"] = db.out_value(out)
    cur.execute("""insert into ghe(ma_phong,hang,so_ghe,ma_loai_ghe)
        select :new_room,hang,so_ghe,ma_loai_ghe from ghe
        where ma_phong=:old_room and so_ghe=5 and hang in ('A','B','E','F')""",
        new_room=data["room"], old_room=old_room)
    data["show"] = test_show(cur, data, starts)
    data["seats"] = {row["hang"]: row["ma_ghe"] for row in db.rows(cur,
        "select ma_ghe,hang from ghe where ma_phong=:room", room=data["room"])}
    return data


def test_show(cur, data, starts):
    out = cur.var(int)
    cur.execute("""insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban)
        values(:film,:room,:starts,:starts+interval '1' hour,'2D',100000) returning ma_suat into :id""",
        film=data["film"], room=data["room"], starts=starts, id=out)
    return db.out_value(out)


def hold(cur, f, seats=("A",), promo=None):
    out = cur.var(int)
    cur.callproc("pkg_dat_ve.sp_giu_cho", [
        f["customer"], f["show"], json.dumps([f["seats"][seat] for seat in seats]), promo, out,
    ])
    return db.out_value(out)


def pay(cur, order, ref=None):
    cur.callproc("pkg_dat_ve.sp_thanh_toan", [order, "THE", ref or uuid4().hex])


def ticket(cur, order):
    return db.one(cur, "select * from ve where ma_don=:id", id=order)


def ordinary(case, actor):
    now = db.local_now().replace(microsecond=0)
    weekend = (now + timedelta(days=14 + (5-now.weekday()) % 7)).replace(hour=11, minute=0, second=0)
    starts = now + timedelta(minutes=15 if case == 9 else 60) if case in (7, 9) else weekend
    with db.connection(actor) as con, con.cursor() as cur:
        try:
            f = fixture(cur, starts)
            if case == 1:
                order = hold(cur, f, ("E", "F"))
                data = db.one(cur, "select * from don_dat_ve where ma_don=:id", id=order)
                require(data["han_thanh_toan"]-data["thoi_gian_dat"] == timedelta(minutes=10), "Sai hạn giữ ghế.")
                require(data["trang_thai"] == "CHO_THANH_TOAN", "Sai trạng thái đơn.")
                rows = db.rows(cur, """select v.gia_ve,v.trang_thai,
                    (select count(*) from nhat_ky_ve n where n.ma_ve=v.ma_ve) logs
                    from ve v where v.ma_don=:id""", id=order)
                require(len(rows) == 2 and all(r["gia_ve"] == 140000 and r["trang_thai"] == "GIU_CHO"
                        and r["logs"] == 1 for r in rows), "Sai giá VIP cuối tuần, trạng thái hoặc nhật ký.")
                return "Hai ghế VIP giữ 10 phút; 100.000 × 1,2 + 20.000 = 140.000 đồng/ghế; đủ hai dòng nhật ký."
            if case == 2:
                order = hold(cur, f, ("F",))
                before = db.one(cur, "select count(*) n from don_dat_ve where ma_kh=:id", id=f["customer"])["n"]
                expect(20021, lambda: hold(cur, f, ("F",)))
                after = db.one(cur, "select count(*) n from don_dat_ve where ma_kh=:id", id=f["customer"])["n"]
                require(before == after and ticket(cur, order)["trang_thai"] == "GIU_CHO", "Ghi sót đơn hoặc đổi trạng thái vé.")
                return "Lần giữ F5 thứ hai trả ORA-20021, không sinh đơn dở dang."
            if case == 4:
                active = "TC_" + uuid4().hex[:14].upper()
                cur.execute(f"""insert into khuyen_mai(ma_code,loai_giam,gia_tri,giam_toi_da,
                    ngay_bat_dau,ngay_ket_thuc,so_luot_toi_da,so_luot_da_dung)
                    values(:code,'PHAN_TRAM',10,50000,trunc({db.NOW})-1,trunc({db.NOW})+1,1,0)""", code=active)
                before = db.one(cur, "select diem_tich_luy from khach_hang where ma_kh=:id", id=f["customer"])["diem_tich_luy"]
                order = hold(cur, f, promo=active)
                pay(cur, order)
                v = ticket(cur, order)
                after = db.one(cur, "select diem_tich_luy from khach_hang where ma_kh=:id", id=f["customer"])["diem_tich_luy"]
                require(v["ma_qr"] and v["trang_thai"] == "DA_THANH_TOAN" and after-before == 10, "Thiếu QR hoặc sai điểm.")
                expect(20026, lambda: hold(cur, f, ("B",), active))
                return "Mã 10% tạo vé có QR và cộng điểm; lượt khuyến mãi đã dùng bị từ chối với ORA-20026."
            if case == 5:
                order = hold(cur, f)
                cur.execute(f"""update don_dat_ve set han_thanh_toan={db.NOW}-interval '1' minute
                    where ma_don=:id""", id=order)
                expect(20023, lambda: pay(cur, order))
                cur.callproc("pkg_dat_ve.sp_giai_phong_het_han")
                require(ticket(cur, order)["trang_thai"] == "HET_HAN", "Vé chưa giải phóng.")
                require(hold(cur, f) != order, "Ghế không đặt lại được.")
                return "Thanh toán quá hạn trả ORA-20023. Thủ tục nhả ghế đổi vé thành HET_HAN, đặt lại được."
            if case == 6:
                ref = uuid4().hex
                pay(cur, hold(cur, f), ref)
                order = hold(cur, f, ("B",))
                expect(20027, lambda: pay(cur, order, ref))
                require(ticket(cur, order)["trang_thai"] == "GIU_CHO", "Giao dịch lỗi làm đổi trạng thái.")
                return "Mã giao dịch trùng bị chặn bởi ORA-20027; đơn thứ hai vẫn giữ ghế."
            if case == 7:
                order = hold(cur, f)
                pay(cur, order)
                v = ticket(cur, order)
                out = cur.var(int)
                expect(20025, lambda: cur.callproc("pkg_dat_ve.sp_huy_ve", [v["ma_ve"], out]))
                cur.execute("""update suat_chieu set gio_bat_dau=:starts,
                    gio_ket_thuc=:starts+interval '1' hour where ma_suat=:id""", starts=weekend, id=f["show"])
                cur.callproc("pkg_dat_ve.sp_huy_ve", [v["ma_ve"], out])
                refund = db.one(cur, "select so_tien from thanh_toan where ma_ve=:id and trang_thai='HOAN_TIEN'", id=v["ma_ve"])
                require(refund["so_tien"] == db.out_value(out) == v["gia_ve"], "Sai hoàn tiền.")
                return "Còn 1 giờ: ORA-20025. Còn hơn 2 giờ: vé hủy và ghi HOAN_TIEN đúng số tiền."
            if case == 8:
                expect(20031, lambda: test_show(cur, f, starts+timedelta(minutes=40)))
                expect(20031, lambda: test_show(cur, f, starts+timedelta(minutes=70)))
                test_show(cur, f, starts+timedelta(minutes=80))
                return "Trùng lịch và nghỉ 10 phút trả ORA-20031; nghỉ 20 phút thành công."
            order = hold(cur, f)
            pay(cur, order)
            v = ticket(cur, order)
            result = cur.var(str, 30)
            cur.callproc("pkg_dat_ve.sp_soat_ve", [v["ma_qr"], result])
            require(db.out_value(result) == "HOP_LE", "QR lần đầu không hợp lệ.")
            cur.callproc("pkg_dat_ve.sp_soat_ve", [v["ma_qr"], result])
            require(db.out_value(result) == "DA_SU_DUNG", "QR dùng được lần hai.")
            expect(20032, lambda: cur.execute("update ve set trang_thai='GIU_CHO' where ma_ve=:id", id=v["ma_ve"]))
            return "Lần đầu HOP_LE, lần hai DA_SU_DUNG, chuyển lùi về GIU_CHO trả ORA-20032."
        finally:
            con.rollback()


def concurrency(actor):
    attempted = Event()
    log = []
    with db.connection(actor) as setup, setup.cursor() as cur:
        f = fixture(cur, db.local_now().replace(microsecond=0)+timedelta(days=1))
        setup.commit()

        def session_b():
            with db.connection("TC-03 Session B") as con, con.cursor() as other:
                attempted.set()
                started = perf_counter()
                expect(20021, lambda: hold(other, f, ("F",)))
                return round((perf_counter()-started)*1000)

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                order = hold(cur, f, ("F",))
                log.append(f"A giữ F5 ở đơn {order}, chưa COMMIT.")
                pending = executor.submit(session_b)
                try:
                    require(attempted.wait(5), "B chưa mở được phiên Oracle.")
                    try:
                        pending.result(timeout=1)
                    except TimeoutError:
                        log.append("B gọi giữ F5 và đang chờ khóa của A.")
                    else:
                        raise AssertionError("B không chờ khóa.")
                finally:
                    setup.commit()
                log.append("A COMMIT.")
                elapsed = pending.result(timeout=15)
                log.append(f"B nhận ORA-20021 sau {elapsed} ms.")
                require(db.one(cur, "select count(*) n from ve where ma_suat=:id", id=f["show"])["n"] == 1,
                        "Có nhiều hơn một vé.")
        finally:
            # Only rows created by the private-room test fixture can be affected.
            cur.execute("delete from nhat_ky_ve where ma_ve in (select ma_ve from ve where ma_suat=:id)", id=f["show"])
            orders = db.rows(cur, "select distinct ma_don from ve where ma_suat=:id", id=f["show"])
            cur.execute("delete from ve where ma_suat=:id", id=f["show"])
            for row in orders:
                cur.execute("delete from don_dat_ve where ma_don=:id", id=row["ma_don"])
            cur.execute("delete from suat_chieu where ma_suat=:id", id=f["show"])
            cur.execute("delete from ghe where ma_phong=:id", id=f["room"])
            cur.execute("delete from phong_chieu where ma_phong=:id", id=f["room"])
            setup.commit()
    return "\n".join(log)


@router.post("/tests/{case}")
def tests(case: int, actor=Depends(permit(IT, "ROLE_CUSTOMER", "ROLE_EXECUTIVE"))):
    if not db.DEMO or not 1 <= case <= 9:
        raise HTTPException(404)
    if not test_lock.acquire(blocking=False):
        raise HTTPException(409, "Một ca kiểm thử đang chạy.")
    try:
        try:
            result = concurrency(actor["email"]) if case == 3 else ordinary(case, actor["email"])
            return {"test": f"TC-{case:02}", "passed": True, "log": result}
        except AssertionError as exc:
            return {"test": f"TC-{case:02}", "passed": False, "log": str(exc)}
        except HTTPException as exc:
            return {"test": f"TC-{case:02}", "passed": False, "log": str(exc.detail)}
    finally:
        test_lock.release()
