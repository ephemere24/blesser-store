# Copias de seguridad y recuperación — Blesser Store

Este documento explica **qué se respalda, dónde se guarda y cómo recuperarlo todo**
en caso de que el VPS se caiga o se quiera migrar a otro servidor.

---

## 1. Qué está respaldado

| Elemento | Cómo | Dónde |
|---|---|---|
| **Código de la web** | Cada `git push` | Repo `ephemere24/blesser-store` (GitHub) |
| **Base de datos** (catálogo, clientes, códigos, pedidos, ajustes) | `pg_dump` cifrado, diario | Repo privado `blesser-backups` (GitHub) |
| **Fotos de productos** | `tar` del volumen, cifrado, **solo cuando cambian** | Repo privado `blesser-backups` (GitHub) |

- **Frecuencia:** diaria (cron a las 04:00 del VPS).
- **Retención:** 30 días (las copias más antiguas se borran solas).
- **Cifrado:** AES-256-CBC + PBKDF2 con `openssl`. Los datos llevan nombres y
  teléfonos de clientes, por eso **nunca** se suben sin cifrar.

> ⚠️ **La contraseña de cifrado (`BACKUP_PASSPHRASE`) NO está en ningún repo.**
> Se guarda en el gestor de contraseñas del dueño. **Sin ella las copias son
> irrecuperables.** Guárdala en sitio seguro y aparte del VPS.

---

## 2. Datos del entorno (referencia)

- Contenedor PostgreSQL: `xjla4ookhz2wfjdbpi4jbmkh` (usuario y BD: `postgres`)
- Volumen de fotos: `t2tz9ncwni6acm2hc4j6yfj1-blesser-uploads`
- Repo de backups: `git@github.com:ephemere24/blesser-backups.git` (privado)
- Ficheros en el repo de backups: `backups/blesser-<fecha>.sql.enc` y
  `backups/uploads-<fecha>.tar.gz.enc`

El repo de backups guarda **solo el último estado** (commit único, force-push) para
no inflar el historial; los 30 días de copias conviven como ficheros con la fecha
en el nombre.

---

## 3. Cómo está montado (en el VPS)

1. Repo de backups clonado en `/home/ubuntu/blesser-backups` (con deploy key de escritura).
2. Configuración en `/home/ubuntu/blesser-backup/.env` (permisos 600), con:

   ```env
   PG_CONTAINER=xjla4ookhz2wfjdbpi4jbmkh
   PG_USER=postgres
   PG_DB=postgres
   UPLOADS_VOLUME=t2tz9ncwni6acm2hc4j6yfj1-blesser-uploads
   BACKUP_PASSPHRASE=********   # la contraseña de cifrado
   REPO_DIR=/home/ubuntu/blesser-backups
   RETENTION_DAYS=30
   ```

3. Cron del usuario `ubuntu`:

   ```cron
   0 4 * * * /home/ubuntu/blesser-store/scripts/backup.sh >> /home/ubuntu/blesser-backup/backup.log 2>&1
   ```

   (los scripts `backup.sh` / `restore.sh` viven en este repo, en `scripts/`).

---

## 4. Recuperar TODO en un VPS nuevo (de cero)

Requisitos: la `BACKUP_PASSPHRASE`, acceso a los dos repos de GitHub, y Docker +
Coolify instalados en el nuevo servidor.

### Paso 1 — Volver a desplegar la web (código)
Desplegar `ephemere24/blesser-store` en Coolify como hasta ahora (mismo Dockerfile/
nixpacks). Configurar las variables de entorno (Telegram, JWT, `DATABASE_URL`, etc.)
y la base de datos PostgreSQL. **No** hace falta `prisma db push`: el dump ya trae el
esquema completo.

### Paso 2 — Recuperar la última copia
```bash
# Clonar el repo de backups
git clone git@github.com:ephemere24/blesser-backups.git
cd blesser-backups/backups
ls -1   # localizar el par más reciente: blesser-<fecha>.sql.enc y uploads-<fecha>.tar.gz.enc
```

### Paso 3 — Restaurar base de datos y fotos
```bash
export BACKUP_PASSPHRASE='la-contraseña-guardada'
export PG_CONTAINER=<contenedor-postgres-nuevo>
export UPLOADS_VOLUME=<volumen-uploads-nuevo>

/ruta/blesser-store/scripts/restore.sh \
  blesser-<fecha>.sql.enc \
  uploads-<fecha>.tar.gz.enc
```

Esto desencripta y carga la BD (con DROP/CREATE) y restaura las fotos en el volumen.

### Paso 4 — Comprobar
Entrar en la web, revisar que el catálogo, los clientes y el historial de pedidos
están, y que las fotos se ven.

---

## 5. Restaurar solo la base de datos (sin tocar fotos)
```bash
export BACKUP_PASSPHRASE='...'
export PG_CONTAINER=xjla4ookhz2wfjdbpi4jbmkh
/home/ubuntu/blesser-store/scripts/restore.sh /ruta/blesser-<fecha>.sql.enc
```

## 6. Probar una copia (recomendado de vez en cuando)
Descifrar un dump y revisar que no está vacío:
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$BACKUP_PASSPHRASE" \
  -in blesser-<fecha>.sql.enc | head -40
```

## 7. Lanzar una copia manual (fuera del cron)
```bash
/home/ubuntu/blesser-store/scripts/backup.sh
```
