#!/usr/bin/env python3
"""Extract the official Buenos Aires Province line table from its HTML page."""

from __future__ import annotations

import argparse
import html.parser
import json


class FirstTable(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_table = False
        self.in_cell = False
        self.current_cell: list[str] = []
        self.current_row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table" and not self.rows:
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.current_row = []
        elif self.in_table and tag in {"td", "th"}:
            self.in_cell = True
            self.current_cell = []

    def handle_endtag(self, tag: str) -> None:
        if not self.in_table:
            return
        if tag in {"td", "th"} and self.in_cell:
            self.current_row.append(" ".join("".join(self.current_cell).split()))
            self.in_cell = False
        elif tag == "tr" and self.current_row:
            self.rows.append(self.current_row)
        elif tag == "table":
            self.in_table = False

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.current_cell.append(data)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("html")
    args = parser.parse_args()
    table = FirstTable()
    with open(args.html, encoding="utf-8") as source:
        table.feed(source.read())
    records = [
        {"line": row[0].replace(" ", ""), "operator": row[1], "serviceType": row[2].strip()}
        for row in table.rows[1:]
        if len(row) >= 3 and row[0].strip()
    ]
    print(json.dumps(records, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
