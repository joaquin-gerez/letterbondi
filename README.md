# Letterbondi

Archivo social de viajes en colectivos y trenes argentinos. Cualquiera puede explorar y armar un registro; la cuenta se solicita recién al guardarlo en el diario.

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
