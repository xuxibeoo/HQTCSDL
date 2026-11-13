#!/bin/bash
set -eo pipefail
export NLS_LANG=AMERICAN_AMERICA.AL32UTF8
if ! bash /cinema-db/bootstrap/health.sh; then
  echo 'Oracle CINEMA is not ready. Start KHOI_DONG.bat first; no data was changed.' >&2
  exit 1
fi
state="$(sqlplus -L -s "cinema/${CINEMA_DB_PASSWORD}@//localhost:1521/FREEPDB1" <<'SQL'
whenever sqlerror exit failure rollback
set heading off feedback off pagesize 0
select 'PERF_LOADED='||case when exists
  (select 1 from thanh_toan where ma_giao_dich_ngoai='PERF-V2-300000') then '1' else '0' end
  ||';ORDERS='||(select count(*) from don_dat_ve)
  ||';TICKETS='||(select count(*) from ve) from dual;
exit
SQL
)"
echo "$state"
if [[ "${1:-}" == '--check-only' ]]; then exit 0; fi
if [[ "$state" == *'PERF_LOADED=1'* ]]; then
  echo 'Performance workload already exists; nothing was added or reset.'
  exit 0
fi
if [[ "${1:-}" != '--load-confirmed' ]]; then
  echo 'Loading requires explicit confirmation from tools/load-performance.ps1.' >&2
  exit 2
fi
printf '%s\n' exit | sqlplus -L -s "cinema/${CINEMA_DB_PASSWORD}@//localhost:1521/FREEPDB1" @/sql/06_seed_perf.sql
