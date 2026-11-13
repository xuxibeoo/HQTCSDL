"""Run from PowerShell: Get-Content -Raw .\tools\verify-schema.py | docker compose exec -T web python -"""
from collections import defaultdict
import os

import oracledb

expected = {
    "rap": "ma_rap ten_rap dia_chi",
    "phong_chieu": "ma_phong ma_rap ten_phong loai_phong",
    "loai_ghe": "ma_loai_ghe ten_loai phu_thu",
    "ghe": "ma_ghe ma_phong hang so_ghe ma_loai_ghe",
    "the_loai": "ma_the_loai ten_the_loai",
    "phim": "ma_phim ten_phim thoi_luong_phut do_tuoi ngay_khoi_chieu",
    "phim_the_loai": "ma_phim ma_the_loai",
    "suat_chieu": "ma_suat ma_phim ma_phong gio_bat_dau gio_ket_thuc dinh_dang gia_co_ban trang_thai",
    "khach_hang": "ma_kh ho_ten email so_dien_thoai mat_khau_hash hang_thanh_vien diem_tich_luy ngay_tao",
    "khuyen_mai": "ma_km ma_code loai_giam gia_tri giam_toi_da ngay_bat_dau ngay_ket_thuc so_luot_toi_da so_luot_da_dung",
    "don_dat_ve": "ma_don ma_kh ma_km thoi_gian_dat han_thanh_toan tong_tien tien_giam trang_thai",
    "ve": "ma_ve ma_don ma_suat ma_ghe gia_ve trang_thai ma_qr",
    "thanh_toan": "ma_tt ma_don ma_ve phuong_thuc so_tien trang_thai ma_giao_dich_ngoai thoi_gian_tt",
    "combo": "ma_combo ten_combo gia",
    "don_combo": "ma_don ma_combo so_luong don_gia",
    "nhat_ky_ve": "ma_nk ma_ve trang_thai_cu trang_thai_moi nguoi_thuc_hien thoi_gian",
}
members = {
    "FN_TINH_GIA_VE", "FN_TINH_GIAM", "FN_DUOC_HUY_VE", "SP_GIU_CHO",
    "SP_THANH_TOAN", "SP_HUY_VE", "SP_SOAT_VE", "SP_GIAI_PHONG_HET_HAN",
}
required = {
    ("PACKAGE", "PKG_DAT_VE"), ("PACKAGE BODY", "PKG_DAT_VE"),
    ("TRIGGER", "TRG_SUAT_CHIEU_KHONG_TRUNG"), ("TRIGGER", "TRG_VE_CHUYEN_TRANG_THAI"),
    ("TRIGGER", "TRG_VE_NHAT_KY"), ("VIEW", "V_LICH_CHIEU"), ("VIEW", "V_SO_DO_GHE"),
}
with oracledb.connect(user="cinema", password=os.environ["CINEMA_DB_PASSWORD"], dsn=os.environ["DB_DSN"]) as conn, conn.cursor() as cur:
    cur.execute("""select lower(c.table_name), lower(c.column_name) from user_tab_columns c
                   join user_tables t on t.table_name=c.table_name order by c.table_name,c.column_id""")
    cols = defaultdict(set)
    for table, column in cur:
        cols[table].add(column)
    assert set(cols) == set(expected), (set(cols) - set(expected), set(expected) - set(cols))
    for table, columns in expected.items():
        assert cols[table] == set(columns.split()), (table, cols[table], columns)
    cur.execute("select procedure_name from user_procedures where object_name='PKG_DAT_VE' and procedure_name is not null")
    assert {r[0] for r in cur} == members
    cur.execute("select object_type,object_name from user_objects where status='VALID'")
    assert required.issubset(set(cur))
    cur.execute("select index_name,uniqueness from user_indexes")
    ix = dict(cur)
    assert ix["UQ_VE_SUAT_GHE_HIEU_LUC"] == "UNIQUE"
    assert all(k in ix for k in ("IX_VE_DON", "IX_SUAT_PHONG_TG", "IX_SUAT_PHIM_TG", "IX_TT_DON", "IX_NK_VE", "IX_VE_SUAT_TT_GHE", "IX_DON_KH_TG"))
    cur.execute("select enabled,repeat_interval from user_scheduler_jobs where job_name='JOB_GIAI_PHONG_GHE'")
    enabled, interval = cur.fetchone()
    assert enabled == "TRUE" and "FREQ=MINUTELY" in interval.upper()
    cur.execute("select l.ten_loai,l.phu_thu,count(*) from ghe g join loai_ghe l on l.ma_loai_ghe=g.ma_loai_ghe group by l.ten_loai,l.phu_thu")
    assert set(cur) == {("THUONG", 0, 900), ("VIP", 20000, 450), ("COUPLE", 40000, 150)}
    print(f"Oracle {conn.version}: exact 16 tables, 8 package members, 3 triggers, 2 views, 1 scheduler job, indexes and 1,500 seats verified.")
