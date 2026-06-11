#!/usr/bin/env python3
"""
strip_broken_lang_toggles.py
Remove the lang-bar UI from tools/guides that have the toggle HTML
but NO 'const TRANSLATIONS' block — i.e. buttons that click to nothing.

Files with a real TRANSLATIONS dict are left untouched (the full
strip_lang_toggle.py --write handles those when you're ready).

What gets removed:
  1. .lang-bar / .lang-inner / .lang-btn CSS
  2. <div class="lang-bar">…</div></div> HTML

Nothing else is touched — JS, bridge code, sessionStorage all stay.

Usage (from repo/):
    python scripts/strip_broken_lang_toggles.py          # dry-run
    python scripts/strip_broken_lang_toggles.py --write  # apply
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv

# ── Only run these two transforms ────────────────────────────────────────────
CSS_RE = re.compile(
    r"\.lang-bar\{.*?\.lang-btn\.active,\.lang-btn:hover\{[^}]*\}\n?", re.S
)
CSS_REPL = "/* lang toggle removed — CONTRACT §1.1 */\n"

HTML_RE = re.compile(r'<div class="lang-bar">.*?</div>\s*</div>\n?', re.S)
HTML_REPL = "<!-- lang toggle removed — CONTRACT §1.1 -->\n"

# After transforms, anything that still contains these is a warning.
RESIDUAL_RE = re.compile(r'class="lang-bar"|<div class="lang-inner"')


def html_files():
    files = []
    for sub in ("tools", "guides"):
        d = REPO / sub
        if d.is_dir():
            files += sorted(d.glob("*.html"))
    files += sorted(p for p in REPO.glob("*.html") if p.is_file())
    return files


def main():
    skipped_working = 0   # has TRANSLATIONS — leave alone
    skipped_clean = 0     # already has no lang-bar
    cleaned = 0
    warned = 0

    for path in html_files():
        src = path.read_text(encoding="utf-8", newline="")

        # Skip if it has a real translations system
        if "const TRANSLATIONS" in src:
            skipped_working += 1
            continue

        # Skip if it already has no lang-bar
        if 'class="lang-bar"' not in src:
            skipped_clean += 1
            continue

        # Apply the two CSS + HTML removals
        out = CSS_RE.sub(CSS_REPL, src)
        out = HTML_RE.sub(HTML_REPL, out)

        rel = path.relative_to(REPO)

        if RESIDUAL_RE.search(out):
            warned += 1
            print(f"  WARN (residual): {rel}")
            continue

        if out == src:
            # Neither regex matched despite having lang-bar — unusual structure
            warned += 1
            print(f"  WARN (no match):  {rel}")
            continue

        cleaned += 1
        if WRITE:
            path.write_text(out, encoding="utf-8", newline="")
            print(f"  wrote:  {rel}")
        else:
            print(f"  clean:  {rel}")

    mode = "WROTE" if WRITE else "DRY-RUN"
    print(
        f"\n{mode} — broken toggles removed: {cleaned}  |  "
        f"working (skipped): {skipped_working}  |  "
        f"already clean: {skipped_clean}  |  "
        f"warnings: {warned}"
    )
    if not WRITE and cleaned:
        print("Re-run with --write to apply.")
    sys.exit(1 if warned else 0)


if __name__ == "__main__":
    main()
