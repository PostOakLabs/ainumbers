#!/usr/bin/env python3
"""
rewrite_tool_links.py — Targeted inbound-link rewrite for tools/*.html.

Rewrites only the catalog-intent links:
  1. ../index.html#cat-N  →  ../tools.html#cat-N  (deep links into category sections)
  2. href="../index.html">All Tools<  →  href="../tools.html">All Tools<  (footer "All Tools")

Does NOT blanket-replace all ../index.html references — brand/home links stay intact.

Run from repo root: python scripts/rewrite_tool_links.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(ROOT, 'tools')
os.chdir(ROOT)

changed = 0
unchanged = 0

for fname in sorted(os.listdir(TOOLS_DIR)):
    if not fname.endswith('.html'):
        continue
    path = os.path.join(TOOLS_DIR, fname)
    with open(path, encoding='utf-8') as f:
        src = f.read()

    # 1. Rewrite #cat-N deep links: ../index.html#cat-N → ../tools.html#cat-N
    #    Also catches ../index.html#ai-suite, #cat-mcp etc.
    new = re.sub(r'\.\./index\.html(#(?:cat-\w+|ai-suite|cat-mcp))', r'../tools.html\1', src)

    # 2. Rewrite footer "All Tools" link only (keyed on anchor text patterns)
    #    Pattern A: href="../index.html">All Tools<  (direct text)
    new = re.sub(r'href="\.\./index\.html"(>All Tools<)', r'href="../tools.html"\1', new)
    #    Pattern B: href="../index.html"><span data-i18n="footer.alltools">All Tools</span>
    new = re.sub(
        r'href="\.\./index\.html"(><span data-i18n="footer\.alltools">All Tools</span>)',
        r'href="../tools.html"\1', new
    )

    if new != src:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        changed += 1
    else:
        unchanged += 1

print(f"Rewrote {changed} files, {unchanged} unchanged.")
