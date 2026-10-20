#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${BACKUP_CONFIRM:?Set BACKUP_CONFIRM=YES after reviewing the target}"

if [[ "${BACKUP_CONFIRM}" != "YES" ]]; then
  echo "Backup stopped: BACKUP_CONFIRM must equal YES" >&2
  exit 2
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "${temporary_directory}"' EXIT
archive="${temporary_directory}/techstage-${timestamp}.dump"
encrypted="${archive}.enc"

pg_dump "${SUPABASE_DB_URL}" --format=custom --no-owner --no-privileges --file="${archive}"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "${archive}" -out "${encrypted}" -pass env:BACKUP_ENCRYPTION_KEY
shasum -a 256 "${encrypted}" > "${encrypted}.sha256"
aws s3 cp "${encrypted}" "s3://${R2_BUCKET}/database/$(basename "${encrypted}")" --endpoint-url "${R2_ENDPOINT}" --only-show-errors
aws s3 cp "${encrypted}.sha256" "s3://${R2_BUCKET}/database/$(basename "${encrypted}.sha256")" --endpoint-url "${R2_ENDPOINT}" --only-show-errors
echo "Encrypted backup uploaded: $(basename "${encrypted}")"

