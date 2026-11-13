#!/bin/bash
set -eo pipefail
export NLS_LANG=AMERICAN_AMERICA.AL32UTF8
if bash /cinema-db/bootstrap/health.sh; then exit 0; fi
# Executed after FREEPDB1 has been opened.
if [[ ! "$CINEMA_DB_PASSWORD" =~ ^[A-Za-z][A-Za-z0-9_]{11,63}$ ]]; then
  echo "CINEMA_DB_PASSWORD must start with a letter and use 12–64 letters, digits or underscores." >&2
  exit 1
fi
printf '%s\n' exit | sqlplus -L -s / as sysdba @/sql/00_users.sql "$CINEMA_DB_PASSWORD"
schema_state="$(sqlplus -L -s "cinema/${CINEMA_DB_PASSWORD}@//localhost:1521/FREEPDB1" <<'SQL'
whenever sqlerror exit failure rollback
set heading off feedback off
select case when count(*)=0 then 'CINEMA_EMPTY' else 'CINEMA_NONEMPTY' end from user_tables;
exit
SQL
)"
if [[ "$schema_state" != *CINEMA_EMPTY* ]]; then
  echo 'CINEMA schema is not empty and does not match the current install. Use a fresh demo volume; startup will not reset existing data.' >&2
  exit 1
fi
cd /cinema-db
sqlplus -L -s "cinema/${CINEMA_DB_PASSWORD}@//localhost:1521/FREEPDB1" @install.sql
