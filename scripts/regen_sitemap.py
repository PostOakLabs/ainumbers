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


def load_existing_lastmods(sitemap_path):
    """Map {relative-path: lastmod} from the current sitemap so re-runs PRESERVE dates —
    only genuinely new pages get TODAY. Keeps --apply diffs minimal + lastmods accurate
    (without this, every run reset every lastmod to today = a 770-line churn)."""
    if not os.path.exists(sitemap_path):
        return {}
    text = open(sitemap_path, encoding="utf-8").read()
    return dict(
        re.findall(r"<loc>https://ainumbers\.co/([^<]+)</loc><lastmod>([^<]+)</lastmod>", text)
    )


def collect_chaingraph(chaingraph_dir, repo_dir):
    """Live ChainGraph pages: every *.html under chaingraph/ (node pages + chains/) EXCEPT the
    exporters/ helper artifacts (qr-preview etc. are not public pages). regen_sitemap.py historically
    skipped chaingraph/ entirely, silently dropping ~200 valid SEO URLs (fixed 2026-06-21)."""
    found = []
    for root, dirs, files in os.walk(chaingraph_dir):
        if "exporters" in dirs:
            dirs.remove("exporters")  # prune helper-artifact subdir
        for f in files:
            if f.endswith(".html"):
                rel = os.path.relpath(os.path.join(root, f), repo_dir).replace(os.sep, "/")
                found.append(rel)
    return sorted(found)


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

    # Collect live ChainGraph pages (node pages + chains/, minus exporters/ helpers).
    chaingraph_files = collect_chaingraph(os.path.join(repo_dir, "chaingraph"), repo_dir)

    # Preserve existing lastmods so re-runs only date NEW pages (minimal, accurate diffs).
    lastmods = load_existing_lastmods(sitemap_path)
    def lm(path):
        return lastmods.get(path, TODAY)

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
        lines.append(url_entry(f"guides/{fname}", lm(f"guides/{fname}")))
    lines.append("")

    # Tools section
    lines.append("  <!-- Tools -->")
    for fname in tool_files:
        lines.append(url_entry(f"tools/{fname}", lm(f"tools/{fname}")))
    lines.append("")

    # ChainGraph section (node pages + chain viewer pages + hub/spec/platform pages)
    lines.append("  <!-- OpenChainGraph (node pages, chains, hub, spec) -->")
    for path in chaingraph_files:
        lines.append(url_entry(path, lm(path)))
    lines.append("")

    lines.append("</urlset>")
    output = "\n".join(lines) + "\n"

    tool_count = len(tool_files)
    guide_count = len(guide_files)
    cg_count = len(chaingraph_files)
    total = tool_count + guide_count + cg_count + 7  # 7 core pages

    if dry_run:
        print(f"=== DRY RUN — {tool_count} tools, {guide_count} guides, {cg_count} chaingraph, {total} total URLs ===")
        print(f"(pass --apply to write {sitemap_path})\n")
        print(output)
    else:
        with open(sitemap_path, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Written: {sitemap_path}")
        print(f"  {tool_count} tools, {guide_count} guides, {cg_count} chaingraph, {total} total URLs")


if __name__ == "__main__":
    main()
