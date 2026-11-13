-- Run as SYSDBA on the local Oracle container: @00_users.sql <demo_app_password>
-- Bootstrap validates the supplied password before invoking this file.
whenever sqlerror exit failure rollback
set verify off
alter session set container=FREEPDB1;
create user if not exists cinema identified by "&1" quota unlimited on users;
grant create session, create table, create sequence, create procedure, create trigger, create job, create view to cinema;
grant select on sys.v_$sql to cinema;
grant select on sys.v_$sql_plan to cinema;
grant select on sys.v_$session to cinema;
grant select on sys.v_$sql_plan_statistics_all to cinema;
undefine 1
