"""Prepare current oral-defense showtimes without changing existing bookings."""
from datetime import timedelta

import db


SCENARIOS = {
    "quet_qr": ("Quét QR ngay: suất bắt đầu trong 15 phút", 3, 12, 10),
    "tu_choi_hoan": ("Từ chối hoàn: còn dưới 2 giờ", 40, 110, 80),
    "duoc_hoan": ("Được hoàn: còn trên 2 giờ", 180, 480, 300),
}


def find_scenario(cur, key, now):
    title, earliest, latest, _ = SCENARIOS[key]
    matches = db.rows(cur, """select s.ma_suat,s.ma_phim,s.ma_rap,s.ma_phong,
        s.ten_phim,s.ten_phong,s.gio_bat_dau,s.gio_ket_thuc,s.dinh_dang,s.gia_co_ban
        from v_lich_chieu s
        where s.ma_rap=1
          and s.gio_bat_dau between :earliest and :latest
          and (select count(*) from ghe g where g.ma_phong=s.ma_phong
            and not exists (select 1 from ve v where v.ma_suat=s.ma_suat
              and v.ma_ghe=g.ma_ghe and v.trang_thai in
                ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG')))>=8
        order by s.gio_bat_dau,s.ma_suat fetch first 1 row only""",
        earliest=now + timedelta(minutes=earliest), latest=now + timedelta(minutes=latest))
    return {**matches[0], "title": title} if matches else None


def summary(scenarios, created=0):
    missing = [key for key, value in scenarios.items() if value is None]
    return {
        "ok": not missing, "demo": True, "timezone": "Asia/Ho_Chi_Minh",
        "created": created, "scenarios": scenarios, "missing": missing,
        "message": ("Đã có đủ ba suất trình diễn tại rạp 1." if not missing else
            "Chưa đủ suất demo: phòng rạp 1 đang bận hoặc thiếu ghế trống. "
            "Mở vai trò Lập lịch để chọn giờ/phòng phù hợp, hoặc thử chuẩn bị lại sau. "
            "Hệ thống không dời lịch, xóa đơn hay đặt lại dữ liệu."),
    }


def read_demo_scenarios():
    """Read-only: never creates schedules from a GET request."""
    with db.connection("student-demo", "V_LICH_CHIEU") as con, con.cursor() as cur:
        now = db.one(cur, f"select {db.NOW} bay_gio from dual")["bay_gio"]
        return summary({key: find_scenario(cur, key, now) for key in SCENARIOS})


def prepare_demo_schedule():
    if not db.DEMO:
        return {"ok": False, "demo": False, "created": 0, "scenarios": {}}
    with db.connection("student-demo", "DEMO_SCHEDULE") as con, con.cursor() as cur:
        # Serialize preparation across API workers without introducing a new table.
        sites = db.rows(cur, "select ma_rap from rap where ma_rap=1 for update")
        if not sites:
            return summary({key: None for key in SCENARIOS})
        now = db.one(cur, f"select {db.NOW} bay_gio from dual")["bay_gio"].replace(microsecond=0)
        films = db.rows(cur, """select ma_phim,thoi_luong_phut from phim
            where ngay_khoi_chieu is null or ngay_khoi_chieu<=cast(:today as date)
            order by thoi_luong_phut,ma_phim fetch first 1 row only""", today=now)
        rooms = db.rows(cur, """select p.ma_phong,p.loai_phong from phong_chieu p
            where p.ma_rap=1
              and (select count(*) from ghe g where g.ma_phong=p.ma_phong)>=8
            order by p.ma_phong""")
        scenarios, created = {}, 0
        for key, (_, earliest, latest, target) in SCENARIOS.items():
            scenarios[key] = find_scenario(cur, key, now)
            if scenarios[key] or not films or not rooms:
                continue
            film = films[0]
            offsets = [target] + [minute for minute in range(earliest, latest + 1, 5) if minute != target]
            inserted = False
            for offset in offsets:
                start = now + timedelta(minutes=offset)
                end = start + timedelta(minutes=film["thoi_luong_phut"])
                for room in rooms:
                    busy = db.one(cur, """select count(*) total from suat_chieu
                        where ma_phong=:room and trang_thai<>'HUY'
                          and gio_bat_dau<:ends+interval '15' minute
                          and gio_ket_thuc>:starts-interval '15' minute""",
                        room=room["ma_phong"], starts=start, ends=end)["total"]
                    if busy:
                        continue
                    cur.execute("""insert into suat_chieu
                        (ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban)
                        values(:film,:room,:starts,:ends,:fmt,:price)""",
                        film=film["ma_phim"], room=room["ma_phong"], starts=start, ends=end,
                        fmt=room["loai_phong"], price={"2D": 80000, "3D": 105000, "IMAX": 125000}[room["loai_phong"]])
                    created += 1
                    inserted = True
                    break
                if inserted:
                    break
            scenarios[key] = find_scenario(cur, key, now)
        con.commit()
        return summary(scenarios, created)
