-- Read-only review in DBeaver, connected as CINEMA to FREEPDB1.
-- Execute one SELECT at a time. No DROP, schema reset or COMMIT is required.
select sys_context('USERENV','SESSION_USER') schema_name,
       sys_context('USERENV','SERVICE_NAME') service_name,
       sys_context('USERENV','SID') session_id from dual;
select banner_full from v$version;
select table_name from user_tables order by table_name;
select object_name,object_type,status from user_objects
 where object_type in ('PACKAGE','PACKAGE BODY','TRIGGER','VIEW')
 order by object_type,object_name;
select name,type,line,position,text from user_errors order by name,sequence;
select procedure_name from user_procedures
 where object_name='PKG_DAT_VE' and procedure_name is not null
 order by procedure_name;
select type,line,text from user_source
 where name='PKG_DAT_VE' order by type,line;
select line,text from user_source
 where name='TRG_SUAT_CHIEU_KHONG_TRUNG' order by line;
select index_name,uniqueness,status from user_indexes
 where table_name in ('VE','DON_DAT_VE') order by table_name,index_name;
select index_name,column_position,column_expression from user_ind_expressions
 where index_name='UQ_VE_SUAT_GHE_HIEU_LUC' order by column_position;
select job_name,enabled,state,repeat_interval,job_action from user_scheduler_jobs;
select status,to_char(actual_start_date,'YYYY-MM-DD HH24:MI:SS TZH:TZM') actual_start,
       run_duration,error#,additional_info
 from user_scheduler_job_run_details where job_name='JOB_GIAI_PHONG_GHE'
 order by log_date desc fetch first 5 rows only;

-- Distinguish the whole database from the fixed historical performance seed.
select (select count(*) from ve) total_tickets,
       (select count(*) from don_dat_ve) total_orders,
       (select count(*) from ghe) seats from dual;
select count(*) performance_tickets from ve v
 join suat_chieu s on s.ma_suat=v.ma_suat
 where s.gio_bat_dau>=timestamp '2023-01-01 08:00:00'
   and s.gio_bat_dau<timestamp '2023-04-01 08:00:00';
select count(*) performance_marker from thanh_toan
 where ma_giao_dich_ngoai='PERF-V2-300000';

-- Select an available seat for a manual two-session test; do not hard-code seed IDs.
select s.ma_suat,s.ten_phim,s.gio_bat_dau,g.ma_ghe,g.hang,g.so_ghe
 from v_lich_chieu s join ghe g on g.ma_phong=s.ma_phong
 where s.gio_bat_dau>cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp)+interval '3' hour
   and not exists (select 1 from ve v where v.ma_suat=s.ma_suat and v.ma_ghe=g.ma_ghe
                   and v.trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG'))
 order by s.gio_bat_dau,g.ma_ghe fetch first 10 rows only;

-- Observe the most recent business data after the web transaction commits.
select ma_don,ma_kh,tong_tien,tien_giam,trang_thai,han_thanh_toan
 from don_dat_ve order by ma_don desc fetch first 5 rows only;
select ma_ve,ma_don,ma_suat,ma_ghe,gia_ve,trang_thai,ma_qr
 from ve order by ma_ve desc fetch first 10 rows only;
select ma_don,ma_ve,so_tien,trang_thai,ma_giao_dich_ngoai
 from thanh_toan order by ma_tt desc fetch first 10 rows only;
select ma_ve,trang_thai_cu,trang_thai_moi,nguoi_thuc_hien,thoi_gian
 from nhat_ky_ve order by ma_nk desc fetch first 10 rows only;
