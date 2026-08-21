# Despliegue en un VPS

Este despliegue ejecuta una sola app con SQLite persistente. Solo Caddy publica
puertos; la app queda en una red Docker interna. Caddy obtiene y renueva TLS y
reenvía HTTP y WebSocket automáticamente.

## 1. Preparar DNS

El VPS necesita una IP pública y los puertos TCP 80 y 443 accesibles. Si se
publica IPv6, el puerto 443/UDP habilita HTTP/3.

### DuckDNS

1. Iniciar sesión en <https://www.duckdns.org/>, crear el subdominio y poner la
   IPv4 pública del VPS en `current ip`.
2. Si la IP cambia, instalar el actualizador que muestra DuckDNS en la pestaña
   `install` para Linux cron. Con una IP fija no hace falta.
3. Usar como `DOMAIN` el nombre completo, por ejemplo
   `letterbondi.duckdns.org`, sin `https://` ni ruta.

### Dominio normal

1. En el proveedor DNS, crear un registro `A` para el nombre elegido apuntando
   a la IPv4 del VPS. Para el dominio raíz, normalmente el host es `@`; para un
   subdominio puede ser `letterbondi`.
2. Crear un registro `AAAA` solo si el VPS tiene IPv6 pública correctamente
   enrutada. Eliminar un `AAAA` incorrecto, porque impediría validar TLS para
   algunos clientes.
3. Esperar hasta que `dig +short DOMINIO` muestre la IP del VPS.

## 2. Preparar el VPS

Instalar Docker Engine con el repositorio oficial de la distribución y el
plugin Docker Compose. Copiar o clonar el repositorio y entrar en su raíz.

Antes de activar el firewall, mantener abierta la sesión SSH y permitir SSH:

```sh
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

Aplicar las mismas reglas al firewall del proveedor del VPS si existe. No
abrir el puerto 3000. Docker publica únicamente 80/443 en este Compose.

## 3. Configurar y arrancar

Crear `.env` con exactamente estas dos variables. Generar un token distinto y
no registrarlo en Git:

```sh
umask 077
printf 'DOMAIN=%s\nADMIN_TOKEN=%s\n' 'letterbondi.example.com' "$(openssl rand -hex 32)" > .env
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 caddy app
```

`DOMAIN` y `ADMIN_TOKEN` son obligatorias; el token debe tener al menos 32
caracteres. `COOKIE_SECURE=true`, el origen HTTPS y la confianza exclusiva en
el proxy Caddy están fijados en Compose.

Caddy puede tardar uno o dos minutos en emitir el primer certificado. Si falla,
comprobar DNS, reloj del VPS y acceso público a los puertos 80/443.

El token permite retirar inmediatamente una reseña denunciada sin entrar a la
base. Copiar su `id` desde la respuesta de `/api/trips` y ejecutar:

```sh
set -a; . ./.env; set +a
curl --fail --request DELETE "https://$DOMAIN/api/trips/ID" \
  --header "Authorization: Bearer $ADMIN_TOKEN"
```

## 4. Smoke tests

Ejecutar desde otro equipo para comprobar también DNS y firewall:

```sh
DOMAIN=letterbondi.example.com
curl -I "http://$DOMAIN"
curl --fail --show-error "https://$DOMAIN/api/health"
curl --http1.1 --include --no-buffer --max-time 2 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: SGV0dGVyYm9uZGk=' \
  "https://$DOMAIN/api/live"
```

El primer comando debe redirigir a HTTPS, el segundo devolver
`{"status":"ok"}` y el tercero mostrar `HTTP/1.1 101 Switching Protocols`.
El timeout final del WebSocket es esperado porque queda abierto.

Comprobar que no hay puerto de app publicado:

```sh
docker compose -f docker-compose.prod.yml ps
curl --max-time 2 http://127.0.0.1:3000/api/health && exit 1 || true
```

## 5. Backup consistente

El breve corte evita copiar SQLite mientras escribe. Caddy seguirá levantado y
responderá 502 hasta reiniciar la app.

```sh
COMPOSE='docker compose -f docker-compose.prod.yml'
mkdir -p backups
$COMPOSE stop app
APP_ID=$($COMPOSE ps --all --quiet app)
DATA_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$APP_ID")
docker run --rm -v "$DATA_VOLUME:/data:ro" -v "$PWD/backups:/backup" alpine:3.22 \
  tar -C /data -czf "/backup/letterbondi-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" .
$COMPOSE start app
$COMPOSE ps
```

Copiar el archivo resultante fuera del VPS. Los volúmenes de Caddy no necesitan
backup: contienen certificados y estado regenerable, no datos de la app.

## 6. Restore

Elegir el backup, detener la app, vaciar el volumen y extraerlo. Esto reemplaza
todos los datos actuales:

```sh
COMPOSE='docker compose -f docker-compose.prod.yml'
BACKUP="$PWD/backups/letterbondi-20260821T120000Z.tar.gz"
test -f "$BACKUP"
$COMPOSE stop app
APP_ID=$($COMPOSE ps --all --quiet app)
DATA_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$APP_ID")
docker run --rm -v "$DATA_VOLUME:/data" -v "$BACKUP:/backup.tar.gz:ro" alpine:3.22 \
  sh -c 'rm -rf /data/* /data/.[!.]* /data/..?*; tar -C /data -xzf /backup.tar.gz'
$COMPOSE start app
$COMPOSE ps
curl --fail --show-error "https://$(awk -F= '$1 == "DOMAIN" {print $2}' .env)/api/health"
```

## 7. Actualizar y volver atrás

Crear primero un backup. Conservar la imagen anterior bajo una etiqueta local,
actualizar el código y reconstruir:

```sh
COMPOSE='docker compose -f docker-compose.prod.yml'
docker image inspect letterbondi:prod >/dev/null && docker tag letterbondi:prod letterbondi:rollback
git pull --ff-only
$COMPOSE build --pull app
$COMPOSE up -d --no-deps app
$COMPOSE up -d caddy
$COMPOSE ps
```

Ejecutar los smoke tests. Si la actualización falla, restaurar la imagen previa:

```sh
COMPOSE='docker compose -f docker-compose.prod.yml'
$COMPOSE stop app
docker tag letterbondi:rollback letterbondi:prod
$COMPOSE up -d --no-build app
$COMPOSE up -d caddy
$COMPOSE ps
```

Si la nueva versión migró SQLite de forma incompatible, restaurar además el
backup previo siguiendo la sección de restore. No ejecutar dos réplicas contra
este volumen SQLite.
