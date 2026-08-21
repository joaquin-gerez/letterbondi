#!/usr/bin/env python3
"""Build Letterbondi's seed catalog from audited public-source snapshots."""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata


SHEET_URL = "https://docs.google.com/spreadsheets/d/1oaoLGxh37mhYK9k8qfH1PM6gKJpQrFrU5XtLwsED00M/edit?gid=0#gid=0"
AMBA_URL = "https://www.argentina.gob.ar/transporte/ya-podes-pagar-el-colectivo-con-tarjetas-de-debito-credito-o-qr-desde-el-celular/amba"
PBA_URL = "https://gba.gob.ar/transporte/transporte_de_pasajeros/listado_de_empresas"
PBA_MUNICIPAL_URL = "https://normas.gba.gob.ar/anexos/descargar/4xAz6adB.pdf"
PBA_INTERIOR_URL = "https://www.argentina.gob.ar/transporte/ya-podes-pagar-el-colectivo-con-tarjetas-de-debito-credito-o-qr-desde-el-celular-0"
SUBTE_URL = "https://emova.com.ar/index.php/mapas/"
TRAIN_URL = "https://www.argentina.gob.ar/cnrt/recorridos-de-las-lineas-de-trenes"
LONG_DISTANCE_URL = "https://www.argentina.gob.ar/transporte/trenes-argentinos/horarios-tarifas-y-recorridos/servicios-regionales-larga-distancia"
REGIONAL_TRAIN_URL = "https://www.argentina.gob.ar/transporte/trenes-argentinos/horarios-tarifas-y-recorridos-de-trenes/trenes-regionales-y-tren-internacional"
ROSARIO_URL = "https://emr.gov.ar/transporte-publico/sistema"
MENDOTRAN_URL = "https://mendotran.mendoza.gov.ar/site/recorridos"
CORDOBA_RENAMES_URL = "https://cordoba.gob.ar/marzo-lineas-a1-b1-c1-c2/"
CORDOBA_CORRIDOR_7_URL = "https://cordoba.gob.ar/modificaciones-corredor-siete/"
PATAGONICO_URL = "https://trenpatagonicosa.com.ar/"
PATAGONICO_TER_URL = "https://trenpatagonicosa.com.ar/tren-expreso-rionegrino/"
TROCHITA_URL = "https://chubutpatagonia.gob.ar/experiencia/viejo-expreso-patagonico/"
TREN_SOLAR_URL = "https://trensolar.com.ar/inicio/"
TREN_NUBES_URL = "https://trenalasnubes.com.ar/recorrido-es/"

CABA_LINES = set("4 7 12 23 25 26 34 39 42 44 47 50 61 62 64 65 68 76 84 99 102 106 107 108 109 115 118 132 151".split())
NATIONAL_AMBA_LINES = set("1 2 8 9 10 15 17 19 20 21 22 24 28 29 31 32 33 37 41 45 46 49 51 53 55 56 57 59 60 63 67 70 71 74 75 78 79 80 85 86 87 88 91 92 93 95 96 97 98 100 101 103 105 110 111 113 114 117 119 123 124 126 127 128 129 130 133 134 135 136 140 143 145 146 148 150 152 153 154 158 159 160 161 163 164 166 168 169 172 174 176 177 178 179 180 181 182 184 185 188 193 194 195 197".split())

MUNICIPAL_LINES = {
    "Almirante Brown": "501 505 506 510 514 515 521",
    "Avellaneda": "570",
    "Berazategui": "603 619",
    "Esteban Echeverría": "501",
    "Escobar": "503 504B 505 506 507 508 509 511 513",
    "Florencio Varela": "500 501 503 504 505 506 507 508 509 511 512",
    "General San Martín": "670",
    "Ituzaingó": "504",
    "José C. Paz": "741A 749",
    "La Matanza": "620 621 622 624 628 630",
    "Lanús": "520 521 522 523 524 526 527",
    "Lomas de Zamora": "540 541 542 543 544 548 549 550 551 552 553 561 562 564",
    "Malvinas Argentinas": "501",
    "Merlo": "500 503 504",
    "Moreno": "501",
    "Morón": "634 635",
    "Presidente Perón": "504",
    "Quilmes": "580 582 583 584 585",
    "San Fernando": "710",
    "San Isidro": "707",
    "San Miguel": "740",
    "Brandsen": "500",
    "Campana": "501 502 505",
    "Cañuelas": "502",
    "Exaltación de la Cruz": "501",
    "Ezeiza": "518",
    "General Rodríguez": "500",
    "Mercedes": "LIN1 LIN2",
    "Lobos": "501 502",
    "La Plata": "501 502 504 506 508 518 520 53A 53B 561",
    "Luján": "500 501 502 503",
    "Pilar": "501 503 506 509 510 511 520",
    "San Vicente": "503",
    "Tigre": "720 721 722 723",
    "Zárate": "RZ-1 RZ-2 RZ-3 RZ-4 RZ-5 RZ-6 RZ-7 RZ-8 RZ-9 RZ-10 RZ-11",
}

INTERIOR_PBA_LINES = {
    "Olavarría": "500 501 502 503 504 505 509 510 514A 514B",
    "Coronel Rosales": "501 502 503 503BIS 504 504BIS 505 510",
    "Bahía Blanca": "500 502 503 504 505 506 507 509 512 513 514 516 517 518 519 519A 520",
    "Balcarce": "501 502 503 504",
    "Villa Gesell": "507ABC 507D 507E 507F",
    "Necochea": "502 503 510 511 512 513 514 515 517 518",
    "Partido de La Costa": "501 502 503",
    "Punta Indio": "600",
}

MUNICIPAL_COLOR_OVERRIDES = {
    ("Luján", "501"), ("Lobos", "501"), ("Malvinas Argentinas", "501"),
    ("Esteban Echeverría", "501"), ("Exaltación de la Cruz", "501"),
    ("Luján", "502"), ("Lobos", "502"), ("Florencio Varela", "503"),
    ("Escobar", "503"), ("Luján", "503"), ("Merlo", "503"),
    ("Florencio Varela", "505"), ("Escobar", "505"), ("Escobar", "506"),
    ("Florencio Varela", "506"), ("Florencio Varela", "507"),
    ("Florencio Varela", "508"), ("Escobar", "508"), ("Escobar", "510"),
    ("Escobar", "511"), ("Escobar", "512"), ("Escobar", "513"),
    ("Escobar", "514"), ("Lanús", "522"), ("Lomas de Zamora", "542"),
    ("Lomas de Zamora", "544"), ("Tigre", "722"), ("José C. Paz", "741A"),
}


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value))


def line_record(identifier: str, short_name: str, **values: object) -> dict[str, object]:
    return {
        "id": identifier,
        "slug": values.pop("slug", identifier),
        "name": values.pop("name", f"Línea {short_name}"),
        "shortName": short_name,
        "mode": values.pop("mode", "colectivo"),
        "operator": values.pop("operator", None),
        "color": values.pop("color", "#ffffff"),
        "textColor": values.pop("textColor", "#000000"),
        "origin": values.pop("origin", None),
        "destination": values.pop("destination", None),
        "city": values.pop("city"),
        "province": values.pop("province"),
        "sourceName": values.pop("sourceName"),
        "sourceUrl": values.pop("sourceUrl"),
        "sourceUpdatedAt": values.pop("sourceUpdatedAt", None),
        **values,
    }


def split_ends(value: str) -> tuple[str | None, str | None]:
    parts = [part.strip(" •\n") for part in value.split(" - ") if part.strip(" •\n")]
    return (parts[0], parts[-1]) if len(parts) >= 2 else (None, None)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet-csv", required=True)
    parser.add_argument("--sheet-colors", required=True)
    parser.add_argument("--gba-lines", required=True)
    parser.add_argument("--mendotran-lines", required=True)
    args = parser.parse_args()

    with open(args.sheet_csv, encoding="utf-8-sig") as source:
        sheet_rows = list(csv.reader(source))
    with open(args.sheet_colors, encoding="utf-8") as source:
        colors_by_row = {item["row"]: item for item in json.load(source)}
    with open(args.gba_lines, encoding="utf-8") as source:
        gba_lines = json.load(source)
    with open(args.mendotran_lines, encoding="utf-8") as source:
        mendotran_lines = json.load(source)

    def visual(row_number: int) -> tuple[str, str]:
        cell = colors_by_row.get(row_number, {})
        return cell.get("fillColor") or "#ffffff", cell.get("fontColor") or "#000000"

    def sheet_matches(start: int, end: int, value: str) -> list[int]:
        target = value.replace(" ", "").upper()
        return [
            number for number in range(start, end + 1)
            if len(sheet_rows[number - 1]) > 1
            and sheet_rows[number - 1][1].replace(" ", "").upper() == target
        ]

    catalog: list[dict[str, object]] = []
    for number in sorted(CABA_LINES | NATIONAL_AMBA_LINES, key=int):
        matches = sheet_matches(3, 154, number)
        route_row = next(
            (row for row in matches if len(sheet_rows[row - 1]) > 4 and not sheet_rows[row - 1][2].startswith("Ramal ex")),
            matches[0] if matches else None,
        )
        color_row = next((row for row in matches if visual(row)[0] != "#ffffff"), route_row)
        color, text_color = visual(color_row) if color_row else ("#ffffff", "#000000")
        origin = sheet_rows[route_row - 1][2].strip() or None if route_row else None
        destination = sheet_rows[route_row - 1][4].strip() or None if route_row else None
        is_caba = number in CABA_LINES
        catalog.append(line_record(
            f"amba-colectivo-{number}", number, slug=f"linea-{number}-amba",
            city="CABA" if is_caba else "AMBA",
            province="Ciudad Autónoma de Buenos Aires" if is_caba else "Buenos Aires",
            color=color, textColor=text_color, origin=origin, destination=destination,
            sourceName="Argentina.gob.ar — líneas de colectivo del AMBA",
            sourceUrl=AMBA_URL,
        ))

    for source_line in gba_lines:
        number = source_line["line"]
        if source_line["serviceType"] == "Fluvial" or number == "D.338/85":
            continue
        matches = sheet_matches(157, 290, number)
        if not matches:
            base = re.match(r"\d+", number)
            matches = sheet_matches(157, 290, base.group(0)) if base else []
        color_row = next((row for row in matches if visual(row)[0] != "#ffffff"), matches[0] if matches else None)
        color, text_color = visual(color_row) if color_row else ("#ffffff", "#000000")
        route = sheet_rows[matches[0] - 1][2].strip() if matches else ""
        origin, destination = split_ends(route)
        normalized = number.lower()
        catalog.append(line_record(
            f"pba-provincial-colectivo-{normalized}", number,
            slug=f"linea-{normalized}-provincia-buenos-aires",
            operator=source_line["operator"], color=color, textColor=text_color,
            origin=origin, destination=destination, city="Provincia de Buenos Aires",
            province="Buenos Aires",
            sourceName=f"Provincia de Buenos Aires — línea {source_line['serviceType'].lower()}",
            sourceUrl=PBA_URL,
        ))

    municipal_gray = "#eaecf0"
    for city, numbers in MUNICIPAL_LINES.items():
        for number in numbers.split():
            color = municipal_gray if (city, number) in MUNICIPAL_COLOR_OVERRIDES else "#ffffff"
            text_color = "#202122" if color == municipal_gray else "#000000"
            if (city, number) == ("San Isidro", "707"):
                color, text_color = "#3366cc", "#ffffff"
            key = slug(city)
            catalog.append(line_record(
                f"pba-municipal-{key}-{number.lower()}", number,
                slug=f"linea-{number.lower()}-{key}", city=city, province="Buenos Aires",
                color=color, textColor=text_color,
                sourceName="Provincia de Buenos Aires — líneas municipales del AMBA",
                sourceUrl=PBA_MUNICIPAL_URL,
            ))

    for city, numbers in INTERIOR_PBA_LINES.items():
        for number in numbers.split():
            key = slug(city)
            catalog.append(line_record(
                f"pba-municipal-{key}-{number.lower()}", number,
                slug=f"linea-{number.lower()}-{key}", city=city, province="Buenos Aires",
                sourceName="Argentina.gob.ar — líneas municipales bonaerenses",
                sourceUrl=PBA_INTERIOR_URL,
            ))

    extras = [
        ("caba-subte-a", "A", "Línea A", "subte", "Emova", "#00b2d1", "#171816", "Plaza de Mayo", "San Pedrito", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("caba-subte-b", "B", "Línea B", "subte", "Emova", "#e91e4d", "#ffffff", "Leandro N. Alem", "Juan Manuel de Rosas", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("caba-subte-c", "C", "Línea C", "subte", "Emova", "#005dab", "#ffffff", "Constitución", "Retiro", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("caba-subte-d", "D", "Línea D", "subte", "Emova", "#008f78", "#ffffff", "Catedral", "Congreso de Tucumán", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("caba-subte-e", "E", "Línea E", "subte", "Emova", "#7b2b83", "#ffffff", "Retiro", "Plaza de los Virreyes", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("caba-subte-h", "H", "Línea H", "subte", "Emova", "#f2c500", "#171816", "Facultad de Derecho", "Hospitales", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("caba-premetro", "P", "Premetro", "subte", "Emova", "#e6a900", "#171816", "Intendente Saguier", "General Savio / Centro Cívico Lugano", "CABA", "Ciudad Autónoma de Buenos Aires", SUBTE_URL),
        ("amba-tren-belgrano-norte", "Belgrano Norte", "Línea Belgrano Norte", "tren", "Ferrovías", "#9a6aa5", "#ffffff", "Retiro", "Villa Rosa", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-belgrano-sur", "Belgrano Sur", "Línea Belgrano Sur", "tren", "Trenes Argentinos", "#5a3696", "#ffffff", "Dr. Antonio Sáenz", "González Catán / Marinos del Crucero General Belgrano", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-mitre", "Mitre", "Línea Mitre", "tren", "Trenes Argentinos", "#a02582", "#ffffff", "Retiro", "Tigre / Bartolomé Mitre / José León Suárez", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-roca", "Roca", "Línea Roca", "tren", "Trenes Argentinos", "#2684c6", "#ffffff", "Plaza Constitución", "Zona Sur / La Plata / Cañuelas", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-sarmiento", "Sarmiento", "Línea Sarmiento", "tren", "Trenes Argentinos", "#e54632", "#ffffff", "Once", "Moreno / Mercedes / Lobos", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-san-martin", "San Martín", "Línea San Martín", "tren", "Trenes Argentinos", "#f4a300", "#171816", "Retiro", "Pilar / Cabred", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-urquiza", "Urquiza", "Línea Urquiza", "tren", "Metrovías", "#4c9b42", "#ffffff", "Federico Lacroze", "General Lemos", "AMBA", "Buenos Aires", TRAIN_URL),
        ("amba-tren-costa", "Tren de la Costa", "Tren de la Costa", "tren", "Trenes Argentinos", "#00a7a5", "#171816", "Avenida Maipú", "Delta", "AMBA", "Buenos Aires", TRAIN_URL),
    ]
    for item in extras:
        identifier, short_name, name, mode, operator, color, text_color, origin, destination, city, province, source_url = item
        catalog.append(line_record(identifier, short_name, name=name, mode=mode, operator=operator,
            color=color, textColor=text_color, origin=origin, destination=destination,
            city=city, province=province, sourceName="Fuente oficial del servicio", sourceUrl=source_url))

    long_distance = [
        ("Mar del Plata", "Plaza Constitución", "Mar del Plata"),
        ("Divisadero de Pinamar", "Plaza Constitución", "Divisadero de Pinamar"),
        ("Bragado", "Once", "Bragado"), ("Junín", "Retiro", "Junín"),
        ("Justo Daract", "Retiro", "Justo Daract"), ("Rosario", "Retiro", "Rosario Norte"),
        ("Córdoba", "Retiro", "Córdoba Mitre"), ("Tucumán", "Retiro", "Tucumán"),
    ]
    for short_name, origin, destination in long_distance:
        catalog.append(line_record(f"tren-larga-distancia-{slug(short_name)}", short_name,
            name=f"Buenos Aires – {short_name}", mode="tren", operator="Trenes Argentinos",
            color="#575b5c", textColor="#ffffff", origin=origin, destination=destination,
            city="Argentina", province="Buenos Aires", sourceName="Trenes Argentinos — larga distancia",
            sourceUrl=LONG_DISTANCE_URL))

    regional = [
        ("Rosario – Cañada de Gómez", "Rosario Norte", "Cañada de Gómez", "Santa Fe"),
        ("Puerto Tirol – Resistencia", "Puerto Tirol", "Resistencia", "Chaco"),
        ("Los Amores – Cacuí", "Los Amores", "Cacuí", "Chaco"),
        ("Sáenz Peña – Chorotis", "Presidencia Roque Sáenz Peña", "Chorotis", "Chaco"),
        ("Tren del Valle", "Cipolletti", "Neuquén / Plottier", "Neuquén"),
        ("Regional Salta", "Güemes", "Salta / Campo Quijano", "Salta"),
        ("Tren de las Sierras", "Córdoba", "Cosquín / Capilla del Monte", "Córdoba"),
        ("Villa María – Córdoba", "Villa María", "Córdoba", "Córdoba"),
        ("Regional Entre Ríos", "Paraná", "Enrique Berduc / Jorge Méndez", "Entre Ríos"),
        ("Internacional Posadas – Encarnación", "Posadas", "Encarnación", "Misiones"),
    ]
    for name, origin, destination, province in regional:
        catalog.append(line_record(f"tren-regional-{slug(name)}", name, name=name, mode="tren",
            operator="Trenes Argentinos", color="#575b5c", textColor="#ffffff",
            origin=origin, destination=destination, city=origin, province=province,
            sourceName="Trenes Argentinos — regionales e internacional", sourceUrl=REGIONAL_TRAIN_URL))

    provincial_trains = [
        ("tren-patagonico-viedma-bariloche", "Tren Patagónico", "Tren Patagónico Viedma – Bariloche", "Tren Patagónico S.A.", "Viedma", "San Carlos de Bariloche", "Río Negro", PATAGONICO_URL),
        ("tren-expreso-rionegrino", "TER", "Tren Expreso Rionegrino", "Tren Patagónico S.A.", "Ingeniero Jacobacci", "San Carlos de Bariloche", "Río Negro", PATAGONICO_TER_URL),
        ("chubut-trochita-esquel-nahuel-pan", "La Trochita Esquel", "La Trochita — Esquel – Nahuel Pan", "Viejo Expreso Patagónico", "Esquel", "Nahuel Pan", "Chubut", TROCHITA_URL),
        ("chubut-trochita-el-maiten-thomae", "La Trochita El Maitén", "La Trochita — El Maitén – Desvío Thomae", "Viejo Expreso Patagónico", "El Maitén", "Desvío Ingeniero Bruno Thomae", "Chubut", TROCHITA_URL),
        ("jujuy-tren-solar-quebrada", "Tren Solar", "Tren Solar de la Quebrada", "Tren Solar de la Quebrada S.E.", "Volcán", "Tilcara", "Jujuy", TREN_SOLAR_URL),
        ("salta-tren-a-las-nubes", "Tren a las Nubes", "Tren a las Nubes", "Tren a las Nubes SFTSE", "San Antonio de los Cobres", "Viaducto La Polvorilla", "Salta", TREN_NUBES_URL),
    ]
    for identifier, short_name, name, operator, origin, destination, province, source_url in provincial_trains:
        catalog.append(line_record(identifier, short_name, name=name, mode="tren", operator=operator,
            color="#575b5c", textColor="#ffffff", origin=origin, destination=destination,
            city=origin, province=province, sourceName="Sitio oficial del servicio ferroviario",
            sourceUrl=source_url))

    rosario_movi = "102 Roja|106 Negra|106 Roja|112|113|115|115 Aeropuerto|116 129|120|121|123|127|129 134 135|131|132|141|153 Negra|153 Roja|K|Q|Enlace Avellaneda Oeste|Enlace Noroeste|Enlace Santa Lucía|Ronda CUR-Sur|Línea de la Costa|Enlace Uriburu".split("|")
    rosario_bus = "101 Negra|102 Negra 144 Negra|103 Negra|103 Roja|107 Negra|107 Roja|110|122V|122R|126R|126N|128 Negra|128 Roja|130 146 Negra|130|138 139|140|146 Roja|133 Negra 125|133 Verde 125|142 Negra|142 Roja|143 Negra 136 137|143 Roja 136 137|145 Cabin 9 133|145 Soldini 133".split("|")
    for operator, services in (("MOVI Rosario", rosario_movi), ("Rosario Bus", rosario_bus)):
        for service in services:
            mode = "trolebus" if service in {"K", "Q"} else "colectivo"
            catalog.append(line_record(f"rosario-{slug(service)}", service,
                name=service if service.startswith(("Enlace", "Ronda", "Línea")) else f"Línea {service}",
                mode=mode, operator=operator, color="#ffffff", textColor="#171816",
                city="Rosario", province="Santa Fe", sourceName="Ente de la Movilidad de Rosario — sistema TUP",
                sourceUrl=ROSARIO_URL))

    cordoba_lines = [
        ("36A", "SiBus", "Barrio Congreso", "Barrio Mariano Fragueiro", CORDOBA_RENAMES_URL),
        ("70", "SolBus", "Jardín Inglés", "Colonia Lola", CORDOBA_CORRIDOR_7_URL),
        ("73", "SolBus", "Polo 52", "Red urbana de Córdoba", CORDOBA_CORRIDOR_7_URL),
        ("76", "SolBus", "Balcones del Chateau", "Ciudad Universitaria", CORDOBA_CORRIDOR_7_URL),
    ]
    for number, operator, origin, destination, source_url in cordoba_lines:
        catalog.append(line_record(f"cordoba-{number.lower()}", number, operator=operator,
            color="#ffffff", textColor="#171816", origin=origin, destination=destination,
            city="Córdoba", province="Córdoba", sourceName="Municipalidad de Córdoba — transporte urbano",
            sourceUrl=source_url))

    mendoza_counts: dict[str, int] = {}
    for item in mendotran_lines:
        number = item["line"]
        mendoza_counts[number] = mendoza_counts.get(number, 0) + 1
    for item in mendotran_lines:
        number = item["line"]
        title = item["title"]
        suffix = f"-{slug(title)}" if mendoza_counts[number] > 1 else ""
        origin, destination = split_ends(title)
        catalog.append(line_record(f"mendoza-colectivo-{number.lower()}{suffix}", number,
            name=f"Línea {number} — {title}", operator="MendoTran", color="#c20000",
            textColor="#ffffff", origin=origin, destination=destination,
            city="Gran Mendoza", province="Mendoza", sourceName="MendoTran — recorridos vigentes",
            sourceUrl=item.get("sourceUrl") or MENDOTRAN_URL))

    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()
    for record in catalog:
        if record["id"] in seen_ids or record["slug"] in seen_slugs:
            raise ValueError(f"Duplicate catalog key: {record['id']} / {record['slug']}")
        seen_ids.add(str(record["id"]))
        seen_slugs.add(str(record["slug"]))

    print(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
