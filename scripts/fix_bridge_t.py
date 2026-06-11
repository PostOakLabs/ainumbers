#!/usr/bin/env python3
"""
fix_bridge_t.py — S4 bridge sessionStorage fix
Pins the AIN Bridge t() function to English-only by removing the
sessionStorage.getItem('ain_lang') read.

Targets: files with 'const TRANSLATIONS' (working lang-toggle tools ~187)
         + scripts/ain-bridge-v1.snippet.html (master copy)

What is NOT touched:
  - TRANSLATIONS dict, setLang(), lang-bar HTML/CSS (full strip deferred to I18N-SPEC.md)
  - The auto-apply IIFE (part of lang-toggle system, not the bridge)
  - Any file without 'const TRANSLATIONS'

Usage (from repo/):
  python scripts/fix_bridge_t.py          # dry-run
  python scripts/fix_bridge_t.py --write  # apply
"""

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv

# Exact string to replace (from ain-bridge-v1.snippet.html line 43 + per-tool copies)
OLD_T = (
    "function t(k){var lg='en';try{lg=sessionStorage.getItem('ain_lang')||'en';}"
    "catch(e){}return (L[lg]&&L[lg][k])||L.en[k];}"
)
NEW_T = "function t(k){return (L.en&&L.en[k])||k;}"

# Snippet comment update
OLD_COMMENT_SNIP = "zero network, zero storage writes (reads ain_lang\n     only),"
NEW_COMMENT_SNIP = "zero network, zero storage reads or writes,"


def fix_file(path, is_snippet=False):
    src = path.read_text(encoding="utf-8", newline="")

    if OLD_T not in src:
        return "skip"

    out = src.replace(OLD_T, NEW_T, 1)

    if is_snippet and OLD_COMMENT_SNIP in out:
        out = out.replace(OLD_COMMENT_SNIP, NEW_COMMENT_SNIP, 1)

    if out == src:
        return "warn"

    if WRITE:
        path.write_text(out, encoding="utf-8", newline="")
    return "done"


def main():
    mode = "APPLYING" if WRITE else "DRY-RUN"
    print(f"=== {mode} ===\n")

    counts = {"done": 0, "skip": 0, "warn": 0}

    # Always fix the master snippet
    snippet = REPO / "scripts" / "ain-bridge-v1.snippet.html"
    r = fix_file(snippet, is_snippet=True)
    counts[r] += 1
    action = "wrote" if WRITE else "would fix"
    print(f"  {action if r == 'done' else r}: scripts/ain-bridge-v1.snippet.html")

    # Fix tools and guides that have TRANSLATIONS (working lang-toggle files)
    for sub in ("tools", "guides"):
        d = REPO / sub
        if not d.is_dir():
            continue
        for path in sorted(d.glob("*.html")):
            src = path.read_text(encoding="utf-8", errors="replace")
            if "const TRANSLATIONS" not in src:
                continue  # not a working-toggle file — skip
            r = fix_file(path)
            counts[r] += 1
            if r == "done":
                action = "wrote" if WRITE else "would fix"
                print(f"  {action}: {path.relative_to(REPO)}")
            elif r == "warn":
                print(f"  WARN (pattern not found): {path.relative_to(REPO)}")

    print(
        f"\n  fixed: {counts['done']}  already clean: {counts['skip']}  "
        f"warnings: {counts['warn']}"
    )
    if not WRITE and counts["done"]:
        print("\nRe-run with --write to apply.")
    sys.exit(1 if counts["warn"] else 0)


if __name__ == "__main__":
    main()
