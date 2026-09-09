#!/usr/bin/env python3
"""Replace __SITE_ORIGIN__ in sitemap, robots, and HTML head tags."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET_GLOBS = [
    "sitemap.xml",
    "robots.txt",
    "index.html",
    "*/index.html",
    "*/*/index.html",
    "404.html",
]


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].startswith("http"):
        print("Usage: python3 scripts/apply-site-origin.py https://www.example.com")
        return 1
    origin = sys.argv[1].rstrip("/")
    seen: set[Path] = set()
    for pattern in TARGET_GLOBS:
        for path in ROOT.glob(pattern):
            if path in seen or not path.is_file():
                continue
            seen.add(path)
            text = path.read_text(encoding="utf-8")
            if "__SITE_ORIGIN__" not in text:
                continue
            path.write_text(text.replace("__SITE_ORIGIN__", origin), encoding="utf-8")
            print(f"Updated {path.relative_to(ROOT)}")
    (ROOT / "site-origin.txt").write_text(
        "# Active production origin\n" + origin + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
