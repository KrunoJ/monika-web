#!/usr/bin/env python3
"""Inject canonical + Open Graph + Twitter tags into public HTML pages."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# path (URL), file, depth for relative asset prefixes
PAGES = [
    ("/", "index.html", 0),
    ("/biznis-okvir/", "biznis-okvir/index.html", 1),
    ("/newsletter-sustav/", "newsletter-sustav/index.html", 1),
    ("/o-meni/", "o-meni/index.html", 1),
    ("/landing-stranice/", "landing-stranice/index.html", 1),
    ("/dizajn-e-knjiga/", "dizajn-e-knjiga/index.html", 1),
    ("/case-study/dinka/", "case-study/dinka/index.html", 2),
    ("/podaci-o-poslovanju/", "podaci-o-poslovanju/index.html", 1),
    ("/privatnost/", "privatnost/index.html", 1),
]

OG_IMAGE = "__SITE_ORIGIN__/assets/images/monika-teaser.jpg"
OG_IMAGE_TYPE = "image/jpeg"
OG_W, OG_H = "1600", "900"

SITE_NAME = "Monika Jagić"


def prefix(depth: int) -> str:
    return "../" * depth


def extract_meta(html: str, prop: str | None = None, name: str | None = None) -> str:
    if prop:
        m = re.search(
            rf'<meta\s+property="{re.escape(prop)}"\s+content="([^"]*)"',
            html,
            re.I,
        )
        if m:
            return m.group(1)
    if name:
        m = re.search(
            rf'<meta\s+name="{re.escape(name)}"\s+content="([^"]*)"',
            html,
            re.I,
        )
        if m:
            return m.group(1)
    return ""


def extract_title(html: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else SITE_NAME


def strip_seo_block(html: str) -> str:
    # Remove prior injected markers / known SEO tags we manage
    patterns = [
        r'\s*<link\s+rel="canonical"[^>]*>',
        r'\s*<meta\s+property="og:url"[^>]*>',
        r'\s*<meta\s+property="og:image"[^>]*>',
        r'\s*<meta\s+property="og:image:type"[^>]*>',
        r'\s*<meta\s+property="og:image:width"[^>]*>',
        r'\s*<meta\s+property="og:image:height"[^>]*>',
        r'\s*<meta\s+property="og:site_name"[^>]*>',
        r'\s*<meta\s+name="twitter:image"[^>]*>',
        r'\s*<meta\s+name="twitter:title"[^>]*>',
        r'\s*<meta\s+name="twitter:description"[^>]*>',
        r'\s*<!-- \[SEO HEAD\] -->.*?<!-- \[/SEO HEAD\] -->',
        r'\s*<!-- \[SOCIAL IMAGE\] -->',
    ]
    out = html
    for pat in patterns:
        out = re.sub(pat, "", out, flags=re.I | re.S)
    return out


def build_block(path: str, title: str, description: str, og_title: str) -> str:
    desc = description or title
    return f"""    <!-- [SEO HEAD] -->
    <link rel="canonical" href="{path}" />
    <meta property="og:url" content="__SITE_ORIGIN__{path}" />
    <meta property="og:site_name" content="{SITE_NAME}" />
    <meta property="og:title" content="{og_title}" />
    <meta property="og:description" content="{desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="{OG_IMAGE}" />
    <meta property="og:image:type" content="{OG_IMAGE_TYPE}" />
    <meta property="og:image:width" content="{OG_W}" />
    <meta property="og:image:height" content="{OG_H}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{og_title}" />
    <meta name="twitter:description" content="{desc}" />
    <meta name="twitter:image" content="{OG_IMAGE}" />
    <!-- [/SEO HEAD] -->"""


def ensure_og_title_desc(html: str, og_title: str, description: str) -> str:
    """Keep page-specific og:title/description if already present; else leave to block."""
    # Remove duplicate og:title / og:description / og:type / twitter:card before our block
    for prop in ("og:title", "og:description", "og:type"):
        html = re.sub(
            rf'\s*<meta\s+property="{prop}"\s+content="[^"]*"\s*/?>',
            "",
            html,
            flags=re.I,
        )
    html = re.sub(
        r'\s*<meta\s+name="twitter:card"\s+content="[^"]*"\s*/?>',
        "",
        html,
        flags=re.I,
    )
    return html


def inject_analytics(html: str, depth: int) -> str:
    privacy = f"{prefix(depth)}privatnost/"
    analytics_src = f"{prefix(depth)}js/analytics.js"
    tag = (
        f'<script src="{analytics_src}" defer data-privacy-href="{privacy}"></script>'
    )
    # Remove existing analytics includes
    html = re.sub(
        r'\s*<script[^>]*js/analytics\.js[^>]*></script>',
        "",
        html,
        flags=re.I,
    )
    if "js/main.js" in html:
        html = re.sub(
            r'(<script[^>]*js/main\.js[^>]*></script>)',
            rf"\1\n    {tag}",
            html,
            count=1,
            flags=re.I,
        )
    else:
        html = html.replace("</body>", f"    {tag}\n  </body>")
    return html


def main() -> int:
    for path, rel, depth in PAGES:
        file_path = ROOT / rel
        html = file_path.read_text(encoding="utf-8")
        title = extract_title(html)
        description = extract_meta(html, name="description")
        existing_og_title = extract_meta(html, prop="og:title")
        og_title = existing_og_title or title
        html = strip_seo_block(html)
        html = ensure_og_title_desc(html, og_title, description)
        block = build_block(path, title, description, og_title)
        # Insert after description meta if present, else after <title>
        if re.search(r'<meta\s+name="description"', html, re.I):
            html = re.sub(
                r'(<meta\s+name="description"\s+content="[^"]*"\s*/?>)',
                rf"\1\n{block}",
                html,
                count=1,
                flags=re.I,
            )
        else:
            html = re.sub(
                r"(</title>)",
                rf"\1\n{block}",
                html,
                count=1,
                flags=re.I,
            )
        html = inject_analytics(html, depth)
        file_path.write_text(html, encoding="utf-8")
        print(f"updated {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
