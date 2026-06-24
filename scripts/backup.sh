#!/usr/bin/env bash
#
# Copia de seguridad cifrada de Blesser Store (base de datos + fotos).
# Pensado para ejecutarse por cron en el VPS cada noche.
# Sube las copias cifradas a un repo privado de GitHub (historial mínimo,
# se conserva solo el último estado para no inflar el .git).
#
# Configuración: variables en un fichero .env (ver BACKUP.md). Nunca en el repo.
#
set -euo pipefail

ENV_FILE="${BACKUP_ENV:-/home/ubuntu/blesser-backup/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

: "${PG_CONTAINER:?Falta PG_CONTAINER}"      # nombre del contenedor de PostgreSQL
: "${PG_USER:=postgres}"
: "${PG_DB:=postgres}"
: "${UPLOADS_VOLUME:?Falta UPLOADS_VOLUME}"  # nombre del volumen Docker de las fotos
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"  # contraseña de cifrado
: "${REPO_DIR:?Falta REPO_DIR}"              # ruta del repo de backups ya clonado
: "${RETENTION_DAYS:=30}"

DATE="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[$(date)] Iniciando backup $DATE"

# 1) Volcado de PostgreSQL (con DROP/CREATE para restaurar en limpio)
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" --clean --if-exists --no-owner "$PG_DB" > "$TMP/db.sql"

mkdir -p "$REPO_DIR/backups"

# 2) Cifrar el dump de la BD (siempre, es diminuto)
openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$BACKUP_PASSPHRASE" \
  -in "$TMP/db.sql"          -out "$REPO_DIR/backups/blesser-$DATE.sql.enc"

# 3) Fotos: solo crear copia nueva si el contenido ha CAMBIADO (evita duplicar 22MB cada noche).
#    Hash determinista del contenido del volumen.
UPLOADS_HASH="$(docker run --rm -v "$UPLOADS_VOLUME":/data:ro alpine \
  sh -c 'cd /data && find . -type f -exec sha256sum {} \; | sort | sha256sum' | awk '{print $1}')"
HASH_FILE="$REPO_DIR/backups/.uploads.hash"
LAST_HASH="$(cat "$HASH_FILE" 2>/dev/null || true)"
# Hay alguna copia de fotos ya guardada?
HAS_UPLOADS="$(find "$REPO_DIR/backups" -name 'uploads-*.tar.gz.enc' | head -1)"

if [ "$UPLOADS_HASH" != "$LAST_HASH" ] || [ -z "$HAS_UPLOADS" ]; then
  docker run --rm -v "$UPLOADS_VOLUME":/data:ro -v "$TMP":/out alpine \
    tar czf /out/uploads.tar.gz -C /data . 2>/dev/null
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$BACKUP_PASSPHRASE" \
    -in "$TMP/uploads.tar.gz" -out "$REPO_DIR/backups/uploads-$DATE.tar.gz.enc"
  echo "$UPLOADS_HASH" > "$HASH_FILE"
  echo "Fotos: cambiaron, nueva copia creada."
else
  echo "Fotos: sin cambios, se reutiliza la última copia."
fi

# 4) Rotación: borrar dumps de BD con más de RETENTION_DAYS días
find "$REPO_DIR/backups" -type f -name 'blesser-*.sql.enc' -mtime +"$RETENTION_DAYS" -delete
# Rotación de fotos: borrar copias antiguas pero conservar SIEMPRE la más reciente
LATEST_UP="$(ls -t "$REPO_DIR/backups"/uploads-*.tar.gz.enc 2>/dev/null | head -1 || true)"
if [ -n "$LATEST_UP" ]; then
  find "$REPO_DIR/backups" -type f -name 'uploads-*.tar.gz.enc' -mtime +"$RETENTION_DAYS" ! -samefile "$LATEST_UP" -delete
fi

# 5) Subir a GitHub como commit único (sin acumular historial binario)
cd "$REPO_DIR"
git branch -D _fresh >/dev/null 2>&1 || true
git checkout --orphan _fresh -q
git add -A
git -c user.name="blesser-backup" -c user.email="backup@blesserstore.local" \
    commit -q -m "backup $DATE"
git branch -D main >/dev/null 2>&1 || true
git branch -m main
git push -f origin main -q

COUNT="$(find "$REPO_DIR/backups" -name 'blesser-*.sql.enc' | wc -l)"
echo "[$(date)] Backup OK: $DATE · copias conservadas: $COUNT"
