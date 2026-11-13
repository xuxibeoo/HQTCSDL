-- Supplemental report indexes. Leave them enabled when running the app.
-- A/B diagnostics compare explicit FULL and INDEX plans without dropping indexes.
create index if not exists ix_ve_suat_tt_ghe on ve(ma_suat,trang_thai,ma_ghe);
create index if not exists ix_don_kh_tg on don_dat_ve(ma_kh,thoi_gian_dat desc);
begin
  dbms_stats.gather_table_stats(user,'VE',cascade=>true);
  dbms_stats.gather_table_stats(user,'DON_DAT_VE',cascade=>true);
end;
/
