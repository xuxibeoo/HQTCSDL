#!/bin/bash
set -eo pipefail
sqlplus -L -s "cinema/${CINEMA_DB_PASSWORD}@//localhost:1521/FREEPDB1" <<'SQL' | grep -q CINEMA_READY
whenever sqlerror exit failure
set heading off feedback off
select 'CINEMA_READY' from user_scheduler_jobs
 where job_name='JOB_GIAI_PHONG_GHE' and enabled='TRUE'
   and (select count(*) from user_tables)=16
   and (select count(*) from user_objects where object_name in ('V_LICH_CHIEU','V_SO_DO_GHE') and status='VALID')=2
   and (select count(*) from user_errors where attribute='ERROR')=0;
exit
SQL
