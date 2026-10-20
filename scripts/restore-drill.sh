#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${RESTORE_DRILL_DB_URL:?RESTORE_DRILL_DB_URL must point to an isolated disposable database}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${ENCRYPTED_BACKUP_FILE:?ENCRYPTED_BACKUP_FILE is required}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=ISOLATED after verifying the target}"

if [[ "${RESTORE_CONFIRM}" != "ISOLATED" ]]; then
  echo "Restore stopped: RESTORE_CONFIRM must equal ISOLATED" >&2
  exit 2
fi

temporary_directory="$(mktemp -d)"
trap 'rm -rf "${temporary_directory}"' EXIT
archive="${temporary_directory}/restore.dump"

openssl enc -d -aes-256-cbc -pbkdf2 -in "${ENCRYPTED_BACKUP_FILE}" -out "${archive}" -pass env:BACKUP_ENCRYPTION_KEY
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${RESTORE_DRILL_DB_URL}" "${archive}"
psql "${RESTORE_DRILL_DB_URL}" --set=ON_ERROR_STOP=1 --command="select 'appearances' as table_name, count(*) from public.appearances union all select 'jobs', count(*) from public.jobs union all select 'audit_log', count(*) from public.audit_log;"
echo "Restore drill completed against the explicitly isolated target."

