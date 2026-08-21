# Letterbondi

Archivo social de viajes en colectivos y trenes argentinos. Cualquiera puede explorar y armar un registro; la cuenta se solicita recién al guardarlo en el diario.

El seed incluye un catálogo auditable de 983 servicios: colectivos de CABA/AMBA y Buenos Aires, sistemas de Rosario y Mendoza, subtes, trolebuses y trenes metropolitanos, regionales, de larga distancia y provinciales de baja frecuencia. Las fuentes, el criterio de color y los límites de cobertura están documentados en [docs/CATALOGO_TRANSPORTE.md](docs/CATALOGO_TRANSPORTE.md).

## Stack

React 19 + Vite, Express 5, TypeScript y SQLite/libSQL en un único contenedor Docker.

## Ejecutar

```bash
docker compose up --build -d
```

Abrir [http://localhost:3000](http://localhost:3000). La base persiste en el volumen `letterbondi_data`.

Para desarrollo sin Docker:

```bash
npm install
npm run dev
```

Para desarrollo con Docker y hot reload —recomendado en Windows/WSL—:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

Abrir [http://localhost:5173](http://localhost:5173). Vite sirve el frontend con HMR y redirige `/api` al servidor del mismo contenedor en el puerto 3000. El Compose normal queda reservado para producción y no tiene hot reload.

## Verificar

```bash
npm run check
```

La API OpenAPI está disponible en `/api/openapi.json`. El alcance y las decisiones del MVP están en [docs/MVP.md](docs/MVP.md).

## Producción

Desplegar el `Dockerfile`, montar un volumen en `/app/data` y definir:

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/app/data/letterbondi.db
```

Sin volumen persistente se pierden cuentas y viajes al recrear el contenedor.
