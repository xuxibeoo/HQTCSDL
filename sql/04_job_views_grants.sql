create or replace view v_lich_chieu as
select s.ma_suat,s.ma_phim,p.ten_phim,p.thoi_luong_phut,p.do_tuoi,
       s.ma_phong,pc.ten_phong,pc.ma_rap,r.ten_rap,r.dia_chi,
       s.gio_bat_dau,s.gio_ket_thuc,s.dinh_dang,s.gia_co_ban,s.trang_thai,
       case when trunc(cast(s.gio_bat_dau as date))-trunc(cast(s.gio_bat_dau as date),'IW')>=5
            then 1 else 0 end as la_cuoi_tuan,
       case when trunc(cast(s.gio_bat_dau as date))-trunc(cast(s.gio_bat_dau as date),'IW')>=5
            then 1 else 0 end as is_cuoi_tuan
  from suat_chieu s join phim p on p.ma_phim=s.ma_phim
  join phong_chieu pc on pc.ma_phong=s.ma_phong join rap r on r.ma_rap=pc.ma_rap
 where s.trang_thai='MO_BAN'
   and s.gio_bat_dau>cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp);

create or replace view v_so_do_ghe as
select s.ma_suat,g.ma_phong,g.ma_ghe,g.hang,g.so_ghe,lg.ma_loai_ghe,lg.ten_loai,lg.phu_thu,
       pkg_dat_ve.fn_tinh_gia_ve(s.ma_suat,g.ma_ghe) as gia_ve,
       coalesce(v.trang_thai,'TRONG') as trang_thai,
       case when v.ma_ve is null then 'TRONG' else 'DA_CHIEM' end as tinh_trang
  from suat_chieu s join ghe g on g.ma_phong=s.ma_phong
  join loai_ghe lg on lg.ma_loai_ghe=g.ma_loai_ghe
  left join ve v on v.ma_suat=s.ma_suat and v.ma_ghe=g.ma_ghe
                 and v.trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG');

-- No PUBLIC grants. The local app uses its dedicated CINEMA schema.
declare
  v_job number;
begin
  select count(*) into v_job from user_scheduler_jobs where job_name='JOB_GIAI_PHONG_GHE';
  if v_job>0 then dbms_scheduler.drop_job('JOB_GIAI_PHONG_GHE',force=>true); end if;
  dbms_scheduler.create_job(
    job_name=>'JOB_GIAI_PHONG_GHE',
    job_type=>'PLSQL_BLOCK',
    job_action=>'begin pkg_dat_ve.sp_giai_phong_het_han; commit; end;',
    repeat_interval=>'FREQ=MINUTELY;INTERVAL=1',
    enabled=>true,
    comments=>'Giải phóng ghế khi đơn hết thời hạn thanh toán.');
end;
/
