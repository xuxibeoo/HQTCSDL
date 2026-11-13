-- Non-mutating checks against the active schema. Run the nine transactional
-- cases (including two separate Oracle sessions for TC-03) with tools/verify.ps1.
whenever sqlerror exit failure rollback
set serveroutput on
declare
  n number;
  procedure verify(p_count number,p_expected number,p_label varchar2) is
  begin
    if p_count<>p_expected then
      raise_application_error(-20990,p_label||': expected '||p_expected||', got '||p_count);
    end if;
    dbms_output.put_line('PASS '||p_label);
  end;
begin
  select count(*) into n from user_tables;
  verify(n,16,'16 tables');
  select count(*) into n from user_objects where status='VALID'
    and ((object_name='PKG_DAT_VE' and object_type in ('PACKAGE','PACKAGE BODY'))
      or (object_type='TRIGGER' and object_name in
          ('TRG_SUAT_CHIEU_KHONG_TRUNG','TRG_VE_CHUYEN_TRANG_THAI','TRG_VE_NHAT_KY'))
      or (object_type='VIEW' and object_name in ('V_LICH_CHIEU','V_SO_DO_GHE')));
  verify(n,7,'package, triggers, views');
  select count(*) into n from user_scheduler_jobs where job_name='JOB_GIAI_PHONG_GHE'
    and enabled='TRUE' and repeat_interval like 'FREQ=MINUTELY%';
  verify(n,1,'minute scheduler');
  select count(*) into n from loai_ghe where (ten_loai='THUONG' and phu_thu=0)
    or (ten_loai='VIP' and phu_thu=20000) or (ten_loai='COUPLE' and phu_thu=40000);
  verify(n,3,'seat tiers and surcharges');
end;
/
