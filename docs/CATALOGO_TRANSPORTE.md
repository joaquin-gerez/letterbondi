# Catálogo de transporte

Snapshot auditado al **21 de agosto de 2026**. El archivo canónico que consume el seed es `src/shared/data/transportLines.generated.json`; no contiene viajes ni usuarios ficticios.

## Cobertura actual

El catálogo contiene **983 servicios**: 942 colectivos, 32 trenes, 7 servicios de subte/Premetro y 2 trolebuses. Hay presencia en 13 provincias o jurisdicciones.

| Área o sistema | Servicios | Alcance |
| --- | ---: | --- |
| Colectivos 1–199 de CABA/AMBA | 133 | Inventario oficial vigente completo: 29 líneas de jurisdicción CABA y 104 nacionales |
| Colectivos provinciales bonaerenses | 194 | Filas urbanas, de media y larga distancia del padrón provincial; se excluyen los servicios fluviales porque el modelo no admite ese modo |
| Colectivos municipales bonaerenses | 184 | Líneas con identificador explícito en fuentes provinciales y nacionales, incluidas las denominaciones LIN y RZ de Mercedes y Zárate |
| MendoTran | 377 | Todos los recorridos distintos publicados por la página oficial; 376 números porque la 738 tiene dos servicios escolares distintos |
| Transporte urbano de Rosario | 52 | Inventario público completo de MOVI/Rosario Bus, incluidas K y Q como trolebús |
| Transporte urbano de Córdoba | 4 | Primera extensión verificada; todavía parcial |
| Subte y Premetro | 7 | A, B, C, D, E, H y Premetro |
| Ferrocarriles | 32 | 8 metropolitanos, 8 de larga distancia, 10 regionales/internacional y 6 provinciales o turísticos con operación publicada |

En Buenos Aires se cargan las 133 líneas vigentes del universo 1–199, además de 194 líneas provinciales y 184 municipales. La planilla aportada también contiene datos históricos: las líneas 5 y 90 no se cargan como vigentes, mientras que la 197 —presente en el padrón oficial y ausente de la planilla— sí se incorpora.

## Regla de colores

Para las líneas provenientes de la [planilla pública de colectivos](https://docs.google.com/spreadsheets/d/1oaoLGxh37mhYK9k8qfH1PM6gKJpQrFrU5XtLwsED00M/edit?gid=0#gid=0), `color` y `textColor` se extraen directamente del estilo XLSX de la celda de la columna B. No se infieren a partir de nombres ni fotografías.

- Una celda B sin relleno explícito representa una chapa blanca y se guarda como `#ffffff`, con texto negro.
- Cuando una línea vigente no existe en la planilla —por ejemplo, la 197— se usa blanco neutro y se conserva la fuente oficial de vigencia.
- Los colores de subte usan la identidad publicada del sistema.
- En MendoTran se usa el rojo institucional exacto `#c20000`: la fuente oficial indica que todas las unidades comparten el rojo y se diferencian además por un círculo de grupo. No se inventaron hexadecimales para esos círculos.
- Rosario, Córdoba y los servicios sin un color inequívoco verificable quedan en blanco neutro. Los trenes sin color de línea verificable usan gris ferroviario neutro.

Los tests fijan varios valores sensibles de la planilla (`1 = #f2f1a1`, `2 = #90050f`, `4 = #d70000`, `33 = #008000`, `57 = #ffffff`) para detectar regresiones.

## Fuentes principales

- [Planilla pública original](https://docs.google.com/spreadsheets/d/1oaoLGxh37mhYK9k8qfH1PM6gKJpQrFrU5XtLwsED00M/edit?gid=0#gid=0): nombres, recorridos y, de forma prioritaria, colores de la columna B.
- [Líneas de colectivo del AMBA](https://www.argentina.gob.ar/transporte/ya-podes-pagar-el-colectivo-con-tarjetas-de-debito-credito-o-qr-desde-el-celular/amba): corte vigente de líneas 1–199.
- [Padrón de empresas y líneas de la Provincia de Buenos Aires](https://gba.gob.ar/transporte/transporte_de_pasajeros/listado_de_empresas): líneas provinciales, operador y tipo de servicio.
- [Líneas municipales del AMBA](https://normas.gba.gob.ar/anexos/descargar/4xAz6adB.pdf) y [municipales del interior bonaerense](https://www.argentina.gob.ar/transporte/ya-podes-pagar-el-colectivo-con-tarjetas-de-debito-credito-o-qr-desde-el-celular-0).
- [Mapa oficial de Subte y Premetro](https://emova.com.ar/index.php/mapas/).
- [Ferrocarriles metropolitanos](https://www.argentina.gob.ar/cnrt/recorridos-de-las-lineas-de-trenes), [larga distancia](https://www.argentina.gob.ar/transporte/trenes-argentinos/horarios-tarifas-y-recorridos/servicios-regionales-larga-distancia) y [regionales/internacional](https://www.argentina.gob.ar/transporte/trenes-argentinos/horarios-tarifas-y-recorridos-de-trenes/trenes-regionales-y-tren-internacional).
- [Tren Patagónico](https://trenpatagonicosa.com.ar/), [TER Jacobacci–Bariloche](https://trenpatagonicosa.com.ar/tren-expreso-rionegrino/), [La Trochita](https://chubutpatagonia.gob.ar/experiencia/viejo-expreso-patagonico/), [Tren Solar](https://trensolar.com.ar/inicio/) y [Tren a las Nubes](https://trenalasnubes.com.ar/recorrido-es/).
- [Sistema TUP de Rosario](https://emr.gov.ar/transporte-publico/sistema), [recorridos de MendoTran](https://mendotran.mendoza.gov.ar/site/recorridos) y publicaciones vigentes de la [Municipalidad de Córdoba](https://cordoba.gob.ar/modificaciones-corredor-siete/).

Cada registro mantiene `sourceName`, `sourceUrl` y, cuando la fuente informa una fecha exacta, `sourceUpdatedAt`.

## Identidad y deduplicación

La unidad del catálogo es un servicio público identificable para una persona usuaria. No se crea una línea distinta por cada ramal interno salvo que la propia fuente lo publique como servicio separado. Los rótulos combinados de Rosario se preservan tal como los presenta el ente oficial; las variantes bonaerenses y escolares de MendoTran se separan cuando la fuente les asigna entradas diferentes.

El seed hace `UPSERT` por identificador, por lo que regenerar e inicializar la base es idempotente. Los tests verifican que no haya IDs ni slugs duplicados.

## Regeneración

Los extractores usan solo la biblioteca estándar de Python. Los insumos se descargan fuera del repositorio y el JSON resultante sí se versiona:

```bash
curl -L 'https://docs.google.com/spreadsheets/d/1oaoLGxh37mhYK9k8qfH1PM6gKJpQrFrU5XtLwsED00M/export?format=xlsx&gid=0' -o /tmp/letterbondi-source.xlsx
curl -L 'https://docs.google.com/spreadsheets/d/1oaoLGxh37mhYK9k8qfH1PM6gKJpQrFrU5XtLwsED00M/export?format=csv&gid=0' -o /tmp/letterbondi-source.csv
curl -L 'https://gba.gob.ar/transporte/transporte_de_pasajeros/listado_de_empresas' -o /tmp/gba-lines.html
curl -L 'https://mendotran.mendoza.gov.ar/site/recorridos' -o /tmp/mendotran-recorridos.html

python3 scripts/extract-xlsx-colors.py /tmp/letterbondi-source.xlsx --column B > /tmp/letterbondi-colors.json
python3 scripts/extract-gba-lines.py /tmp/gba-lines.html > /tmp/gba-lines.json
python3 scripts/extract-mendotran-lines.py /tmp/mendotran-recorridos.html > /tmp/mendotran-lines.json
python3 scripts/build-transport-catalog.py \
  --sheet-csv /tmp/letterbondi-source.csv \
  --sheet-colors /tmp/letterbondi-colors.json \
  --gba-lines /tmp/gba-lines.json \
  --mendotran-lines /tmp/mendotran-lines.json \
  > src/shared/data/transportLines.generated.json
```

Después de regenerar hay que ejecutar `npm run check` y revisar los cambios de cantidad, vigencia y color antes de publicar.

## Límites conocidos

Este es un snapshot grande y trazable, no una afirmación de completitud eterna para toda la Argentina. Los padrones cambian y no existe una única fuente nacional que enumere todos los servicios municipales.

- Falta completar Córdoba y otros sistemas urbanos provinciales fuera de Rosario y Mendoza.
- Algunas ciudades bonaerenses aparecen en fuentes SUBE sin números de línea explícitos; no se inventaron identificadores para ellas.
- No se cargan servicios fluviales, recorridos sin identificador público ni servicios expresamente suspendidos. El turístico Bariloche–Perito Moreno, por ejemplo, figura temporalmente suspendido en la fuente oficial y queda fuera del seed activo.
- Los ramales y horarios corresponden a una futura capa del modelo; este catálogo identifica líneas y servicios, no cada frecuencia individual.

La siguiente expansión debe conservar estas reglas: fuente oficial vigente, identidad estable, color verificable y prueba de regresión.
