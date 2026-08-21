#!/usr/bin/env python3
"""Extract the current line inventory from MendoTran's official HTML page."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
import re


DETAIL_URL = re.compile(r"/site/recorridos/detalle/\d+$")
GROUP_CLASS = re.compile(r"color-(\d+)")


class MendoTranParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.link_url: str | None = None
        self.in_heading = False
        self.heading_parts: list[str] = []
        self.group: str | None = None
        self.line: str | None = None
        self.records: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "a" and values.get("href") and DETAIL_URL.search(values["href"] or ""):
            self.link_url = values["href"]
        elif tag == "h5" and self.link_url:
            self.in_heading = True
            self.heading_parts = []
        elif tag == "strong" and self.in_heading:
            classes = values.get("class", "") or ""
            match = GROUP_CLASS.search(classes)
            self.group = match.group(1) if match else None

    def handle_data(self, data: str) -> None:
        if not self.in_heading:
            return
        cleaned = " ".join(data.split())
        if not cleaned:
            return
        self.heading_parts.append(cleaned)
        if self.group and self.line is None:
            self.line = cleaned

    def handle_endtag(self, tag: str) -> None:
        if tag == "h5" and self.in_heading:
            heading = " ".join(self.heading_parts)
            title = heading.removeprefix(self.line or "").lstrip(" -")
            if self.link_url and self.group and self.line and title:
                self.records.append({
                    "line": self.line,
                    "group": self.group,
                    "title": title,
                    "sourceUrl": self.link_url,
                })
            self.in_heading = False
            self.heading_parts = []
            self.group = None
            self.line = None
        elif tag == "a" and self.link_url and not self.in_heading:
            self.link_url = None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("html")
    args = parser.parse_args()

    extractor = MendoTranParser()
    with open(args.html, encoding="utf-8") as source:
        extractor.feed(source.read())

    seen: set[tuple[str, str]] = set()
    records: list[dict[str, str]] = []
    for record in extractor.records:
        key = (record["line"], record["title"])
        if key in seen:
            continue
        seen.add(key)
        records.append(record)
    print(json.dumps(records, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
