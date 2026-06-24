#!/usr/bin/env bash
#
# Restauración de una copia de seguridad de Blesser Store.
# Uso:
#   BACKUP_PASSPHRASE='...' ./restore.sh <fichero.sql.enc> [fichero.uploads.tar.gz.enc]
#
# Requiere las variables PG_CONTAINER, PG_USER, PG_DB, UPLOADS_VOLUME
# (o un .env como el de backup.sh). Ver BACKUP.md.
#
set -euo pipefail

ENV_FILE="${BACKUP_ENV:-/home/ubuntu/blesser-backup/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

: "${PG_CONTAINER:?Falta PG_CONTAINER}"
: "${PG_USER:=postgres}"
: "${PG_DB:=postgres}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"

DB_ENC="${1:?Indica el fichero .sql.enc a restaurar}"
UP_ENC="${2:-}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Restaurando base de datos desde $DB_ENC ..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$BACKUP_PASSPHRASE" \
  -in "$DB_ENC" -out "$TMP/db.sql"
docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" < "$TMP/db.sql"
echo "Base de datos restaurada."

if [ -n "$UP_ENC" ]; then
  : "${UPLOADS_VOLUME:?Falta UPLOADS_VOLUME para restaurar fotos}"
  echo "Restaurando fotos desde $UP_ENC ..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$BACKUP_PASSPHRASE" \
    -in "$UP_ENC" -out "$TMP/uploads.tar.gz"
  docker run --rm -v "$UPLOADS_VOLUME":/data -v "$TMP":/in alpine \
    sh -c "tar xzf /in/uploads.tar.gz -C /data"
  echo "Fotos restauradas."
fi

echo "Restauración completada."
