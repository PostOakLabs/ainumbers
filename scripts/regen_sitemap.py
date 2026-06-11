#!/usr/bin/env python3
"""
regen_sitemap.py — V4 compliance fix + S2 maintenance tool
Regenerates repo/sitemap.xml from the live filesystem.

Usage:
  python scripts/regen_sitemap.py           # dry-run: print new sitemap to stdout
  python scripts/regen_sitemap.py --apply   # write repo/sitemap.xml

Keeps the manually-maintained "Core Pages" block verbatim.
Auto-generates one <url> entry per file in tools/ and guides/,
sorted numerically (tools) / alphabetically (guides).
"""

import os
import re
import sys
from datetime import date

TODAY = date.today().isoformat()  # e.g. 2026-06-11

BASE = "https://ainumbers.co"

# Core pages block — never touched by this script
CORE_PAGES = """\
  <!-- Core Pages -->
  <url>
    <loc>https://ainumbers.co/</loc>
    <lastmod>2026-05-21</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://ainumbers.co/about.html</loc>
    <lastmod>2026-05-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://ainumbers.co/guides/tool-chains.html</loc>
    <lastmod>2026-05-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://ainumbers.co/sitemap.html</loc>
    <lastmod>2026-05-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://ainumbers.co/contact.html</loc>
    <lastmod>2026-05-21</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>https://ainumbers.co/tools.html</loc>
    <lastmod>2026-05-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://ainumbers.co/mcp.html</loc>
    <lastmod>2026-06-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>"""


def tool_sort_key(fname):
    """Sort tools numerically by leading T-number, then alphabetically."""
    m = re.match(r"^(\d+)", fname)
    return (int(m.group(1)), fname) if m else (999999, fname)


def url_entry(path, lastmod, changefreq="monthly", priority="0.8"):
    return (
        f'  <url><loc>{BASE}/{path}</loc>'
        f'<lastmod>{lastmod}</lastmod>'
        f'<changefreq>{changefreq}</changefreq>'
        f'<priority>{priority}</priority></url>'
    )


def main():
    dry_run = "--apply" not in sys.argv

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_dir = os.path.dirname(script_dir)
    tools_dir = os.path.join(repo_dir, "tools")
    guides_dir = os.path.join(repo_dir, "guides")
    sitemap_path = os.path.join(repo_dir, "sitemap.xml")

    # Collect tools (skip non-html, skip directories)
    tool_files = sorted(
        [f for f in os.listdir(tools_dir) if f.endswith(".html")],
        key=tool_sort_key,
    )

    # Collect guides — exclude tool-chains.html (it's in core pages)
    guide_files = sorted(
        [f for f in os.listdir(guides_dir) if f.endswith(".html") and f != "tool-chains.html"]
    )

    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    lines.append('        xmlns:xhtml="http://www.w3.org/1999/xhtml">')
    lines.append("")
    lines.append(CORE_PAGES)
    lines.append("")

    # Guides section
    lines.append("  <!-- Guides -->")
    for fname in guide_files:
        lines.append(url_entry(f"guides/{fname}", TODAY))
    lines.append("")

    # Tools section
    lines.append("  <!-- Tools -->")
    for fname in tool_files:
        lines.append(url_entry(f"tools/{fname}", TODAY))
    lines.append("")

    lines.append("</urlset>")
    output = "\n".join(lines) + "\n"

    tool_count = len(tool_files)
    guide_count = len(guide_files)
    total = tool_count + guide_count + 7  # 7 core pages

    if dry_run:
        print(f"=== DRY RUN — {tool_count} tools, {guide_count} guides, {total} total URLs ===")
        print(f"(pass --apply to write {sitemap_path})\n")
        print(output)
    else:
        with open(sitemap_path, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Written: {sitemap_path}")
        print(f"  {tool_count} tools, {guide_count} guides, {total} total URLs")


if __name__ == "__main__":
    main()
