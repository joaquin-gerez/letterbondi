<p align="center">
  <img src="public/favicon.svg" width="150" alt="Colectivo de Letterbondi">
</p>

<h1 align="center">Letterbondi</h1>

<p align="center">
  Tu diario de viajes en el transporte público argentino.
</p>

Letterbondi es un archivo social para encontrar líneas, registrar viajes y compartir cómo estuvo el recorrido. Podés explorar sin cuenta y crear una recién cuando quieras guardar tu primer viaje.

El catálogo beta reúne **983 servicios** entre colectivos, trenes, subtes, Premetro y trolebuses de 13 provincias o jurisdicciones.

## Levantarlo con Docker

Necesitás [Docker](https://docs.docker.com/get-docker/) con Docker Compose.

```bash
git clone https://github.com/joaquin-gerez/letterbondi.git
cd letterbondi
docker compose up --build -d
```

Listo: abrí [http://localhost:3000](http://localhost:3000).

Para apagarlo:

```bash
docker compose down
```

Los usuarios y viajes quedan guardados en un volumen de Docker, incluso después de apagar la aplicación.

Para publicarlo con HTTPS en un VPS, seguí la guía de [despliegue con Caddy](docs/DEPLOY.md). No expongas directamente el puerto 3000 de la aplicación.

## Qué hay adentro

- Catálogo buscable por línea, ciudad, provincia, operador y recorrido.
- Registro y puntuación de viajes, con publicación anónima o mediante una cuenta.
- Perfiles públicos, diario de viajes y seguimiento entre usuarios.
- Actividad en tiempo real.
- API HTTP documentada en `/api/openapi.json`.

La aplicación usa React, TypeScript, Express y SQLite/libSQL. El frontend y la API viven en un único contenedor, sin servicios externos obligatorios.

## Desarrollo

Con Node.js 22 o superior:

```bash
npm install
npm run dev
```

Antes de enviar un cambio:

```bash
npm run check
```

## Datos y créditos

El catálogo combina padrones y publicaciones oficiales con una planilla pública de líneas. Los datos se normalizan en un snapshot versionado, cada servicio conserva su fuente y los colores verificables se extraen de la planilla original, no de fotografías.

La cobertura, las fuentes, el proceso de generación y sus límites están documentados en [Catálogo de transporte](docs/CATALOGO_TRANSPORTE.md). Los créditos y licencias disponibles de las fotografías están en [Créditos de imágenes](docs/CREDITOS_IMAGENES_HERO.md).

Letterbondi está en beta: el catálogo es amplio, pero no pretende representar todavía cada servicio, ramal u horario del país.

## Licencia

El código propio se publica bajo la [licencia MIT](LICENSE). Las fotografías y fuentes de datos conservan las licencias y atribuciones indicadas en sus documentos de créditos.
