#!/usr/bin/env python3
"""
neutralize_lang.py — batch 2 (SAFE) of the lang-toggle removal (CONTRACT §1.1).

The older toggle generation embeds `const TRANSLATIONS={};` + a named
`function setLang(){…}` inside a <script> that also holds real tool logic.
Removing those constructs needs a real JS parser (a regex brace-counter breaks
on regex/template literals — proven, ~18% breakage). So this pass does the SAFE
thing that satisfies the actual rule:

  1. remove the visible toggle: <div class="lang-bar">…</div>  (DOM-depth
     balanced — pure HTML, no JS parsing)
  2. kill client storage: sessionStorage.setItem('ain_lang', …);  -> removed
     sessionStorage.getItem('ain_lang')[||'en'] -> 'en'

Result: no visible language toggle, zero client storage, English-only (English is
already the default content). The dead TRANSLATIONS/setLang JS remains as inert
bloat (English-pinned; nothing calls it from the UI) — a later AST-based pass can
delete it. This pass CANNOT break a page: it never removes a JS construct, only
the HTML div and standalone storage statements.

SAFETY: dry-run by default; --write to apply. Writes only if the result has no
`class="lang-bar"` and no `sessionStorage…ain_lang` left. LF/CRLF preserved.
Run the JS-syntax gate after --write.
"""
import re
import sys
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv

RESIDUAL = re.compile(r'class="lang-bar"|sessionStorage\s*\.\s*\w+Item\(\s*[\'"]ain_lang')


def match_div(s, i):
    """i at a '<div' that opens a block -> index past its matching '</div>'."""
    depth = 0
    tag = re.compile(r"<div\b|</div>")
    while True:
        m = tag.search(s, i)
        if not m:
            return -1
        if m.group(0) == "</div>":
            depth -= 1
            if depth == 0:
                return m.end()
        else:
            depth += 1
        i = m.end()


def neutralize(s):
    # 1. remove the lang-bar UI div (DOM-balanced)
    while True:
        m = re.search(r'<div class="lang-bar"', s)
        if not m:
            break
        end = match_div(s, m.start())
        if end == -1:
            break
        j = end + 1 if (end < len(s) and s[end] == "\n") else end
        s = s[:m.start()] + s[j:]
    # 2. drop sessionStorage.setItem('ain_lang', …) statements
    s = re.sub(r"sessionStorage\s*\.\s*setItem\(\s*['\"]ain_lang['\"][^)]*\)\s*;?", "", s)
    # 3. neutralize reads to English
    s = re.sub(r"sessionStorage\s*\.\s*getItem\(\s*['\"]ain_lang['\"]\s*\)\s*\|\|\s*['\"]en['\"]", "'en'", s)
    s = re.sub(r"sessionStorage\s*\.\s*getItem\(\s*['\"]ain_lang['\"]\s*\)", "'en'", s)
    return s


def targets():
    out = subprocess.check_output(
        ["bash", "-c",
         "grep -rlE 'class=\"lang-bar\"|ain_lang' --include=*.html tools/ guides/ chaingraph/ chaingraph/chains/ *.html 2>/dev/null"],
        cwd=str(REPO)).decode().split()
    return [REPO / p for p in out]


def main():
    clean = dirty = wrote = 0
    review = []
    for path in targets():
        src = path.read_text(encoding="utf-8", newline="")
        out = neutralize(src)
        if out == src:
            continue
        rel = path.relative_to(REPO)
        if RESIDUAL.search(out):
            dirty += 1
            review.append(str(rel))
            continue
        clean += 1
        if WRITE:
            path.write_text(out, encoding="utf-8", newline="")
            wrote += 1
    mode = "WROTE" if WRITE else "DRY-RUN"
    print(f"{mode} — clean: {clean}, needs-review: {dirty}")
    for r in review[:40]:
        print("  review: " + r)
    sys.exit(0)


if __name__ == "__main__":
    main()
