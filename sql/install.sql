whenever sqlerror exit failure rollback
whenever oserror exit failure rollback
set define off
set serveroutput on
@@01_schema.sql
@@02_pkg_dat_ve.sql
@@03_triggers.sql
@@05_seed_small.sql
@@08_optimize.sql
@@04_job_views_grants.sql
declare
  n number;
begin
  select count(*) into n from user_errors where attribute='ERROR';
  if n>0 then raise_application_error(-20999,'Compilation failed; see USER_ERRORS.'); end if;
end;
/
exit success
