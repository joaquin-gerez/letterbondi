#!/usr/bin/env python3
"""Extract values and cell colors from a Google Sheets XLSX export.

Uses only the Python standard library so the source spreadsheet can be audited
without adding a production dependency to Letterbondi.
"""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
import zipfile


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS = {"x": MAIN_NS}
CELL_REF = re.compile(r"([A-Z]+)(\d+)")


def rgb(color: ET.Element | None) -> str | None:
    if color is None:
        return None
    value = color.get("rgb")
    if not value:
        return None
    return f"#{value[-6:].lower()}"


def text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return "".join(part.text or "" for part in node.findall(".//x:t", NS))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("xlsx")
    parser.add_argument("--column", default="B")
    args = parser.parse_args()

    with zipfile.ZipFile(args.xlsx) as archive:
        shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = [text(item) for item in shared_root.findall("x:si", NS)]

        styles = ET.fromstring(archive.read("xl/styles.xml"))
        fills = []
        fills_node = styles.find("x:fills", NS)
        for fill in fills_node if fills_node is not None else []:
            fills.append(rgb(fill.find("x:patternFill/x:fgColor", NS)))
        fonts = []
        fonts_node = styles.find("x:fonts", NS)
        for font in fonts_node if fonts_node is not None else []:
            fonts.append(rgb(font.find("x:color", NS)))
        cell_xfs = styles.find("x:cellXfs", NS)
        xfs = [
            (int(xf.get("fillId", "0")), int(xf.get("fontId", "0")))
            for xf in cell_xfs if cell_xfs is not None
        ]

        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        result = []
        for cell in sheet.findall(".//x:c", NS):
            match = CELL_REF.fullmatch(cell.get("r", ""))
            if not match or match.group(1) != args.column.upper():
                continue

            value_node = cell.find("x:v", NS)
            raw_value = value_node.text if value_node is not None else ""
            if cell.get("t") == "s" and raw_value:
                value = shared[int(raw_value)]
            elif cell.get("t") == "inlineStr":
                value = text(cell.find("x:is", NS))
            elif raw_value.endswith(".0"):
                value = raw_value[:-2]
            else:
                value = raw_value

            if not value.strip():
                continue
            style = int(cell.get("s", "0"))
            fill_id, font_id = xfs[style]
            result.append(
                {
                    "cell": cell.get("r"),
                    "row": int(match.group(2)),
                    "value": value.strip(),
                    "fillColor": fills[fill_id],
                    "fontColor": fonts[font_id],
                }
            )

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
