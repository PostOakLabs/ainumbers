#!/usr/bin/env python3
"""
strip_lang_toggle.py — remove the deferred multilingual toggle from every
tool/guide/root HTML file, bringing the repo into line with CONTRACT §0/§1.1
(zero client storage; no lang-bar / setLang / ain_lang).

Mirrors EXACTLY the edits applied by hand to the canonical template
tools/152-baas-provider-comparator.html on 2026-06-09:
  1. .lang-bar / .lang-inner / .lang-btn CSS rules         -> removed
  2. <div class="lang-bar">…</div></div> toggle UI          -> removed
  3. const TRANSLATIONS {…} + setLang() + auto-apply IIFE   -> removed
  4. <!-- ainumbers-universal-chrome-i18n … --> <script>…   -> removed
  5. <!-- ainumbers-per-tool-hero-i18n … --> <script>…      -> removed
  6. AIN-bridge t() reading ain_lang                        -> English-only
  7. AIN-bridge L = { en, es, fr, ar, pt, zh }              -> { en } only

English chrome text is the default content of every data-i18n span, so the
pages render in English with none of this machinery.

SAFETY: dry-run by default. Pass --write to apply. A file is only written if
the transformed output contains ZERO residual sessionStorage / setLang( /
class="lang-bar" / data-lang=. Anything still dirty is reported as
NEEDS MANUAL REVIEW and left untouched, so a structurally-different file can
never ship half-broken. Original line endings are preserved (CRLF-safe).

Usage (from repo/):
    python scripts/strip_lang_toggle.py            # dry-run report
    python scripts/strip_lang_toggle.py --write    # apply

After --write, re-verify and run the existing validators before pushing:
    rg -l "sessionStorage|setLang|class=\"lang-bar\"" tools guides *.html   # expect: nothing
    npm run lint:manifests && npm run test:ap2-exports
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv

# ── Transforms (each idempotent; order does not matter) ──────────────────────
# (compiled_regex, replacement, name)
TRANSFORMS = [
    # 1. lang-bar CSS rules (contiguous block ending at the .active,:hover rule)
    (re.compile(r"\.lang-bar\{.*?\.lang-btn\.active,\.lang-btn:hover\{[^}]*\}\n?", re.S),
     "/* lang toggle removed — CONTRACT §1.1 */\n", "css"),

    # 2. lang-bar toggle UI (buttons contain no nested <div>, so first </div></div> closes it)
    (re.compile(r'<div class="lang-bar">.*?</div>\s*</div>\n?', re.S),
     "<!-- lang toggle removed — CONTRACT §1.1 -->\n", "html"),

    # 3. TRANSLATIONS const + setLang() + auto-apply IIFE
    #    Anchored: const TRANSLATIONS = { … } through the closing })(); of the IIFE.
    #    Handles both old minified anonymous IIFE and newer named formatted initLang IIFE.
    (re.compile(r"const TRANSLATIONS = \{.*?\}\)\(\);\n?", re.S),
     "/* lang toggle (TRANSLATIONS/setLang) removed — CONTRACT §1.1 */\n", "translations"),

    # 4. universal-chrome-i18n injector block (stamped marker -> its closing </script>)
    (re.compile(r"<!-- ainumbers-universal-chrome-i18n.*?</script>\n?", re.S),
     "<!-- chrome-i18n injector removed — CONTRACT §1.1 -->\n", "chrome-i18n"),

    # 5. per-tool hero-i18n block (stamped marker -> its closing </script>)
    (re.compile(r"<!-- ainumbers-per-tool-hero-i18n.*?</script>\n?", re.S),
     "<!-- hero-i18n removed — CONTRACT §1.1 -->\n", "hero-i18n"),

    # 6. AIN-bridge t(): drop the ain_lang lookup, pin to English
    (re.compile(r"function t\(k\)\{var lg='en';try\{lg=sessionStorage\.getItem\('ain_lang'\)"
                r"\|\|'en';\}catch\(e\)\{\}return \(L\[lg\]&&L\[lg\]\[k\]\)\|\|L\.en\[k\];\}"),
     "function t(k){return (L.en&&L.en[k])||k;}", "bridge-t"),

    # 7. AIN-bridge L: keep only en{…}, drop es/fr/ar/pt/zh (anchored en{…} -> zh{…}\n};)
    (re.compile(r"(var L=\{\r?\n en:\{.*?\},)\r?\n es:\{.*?\r?\n zh:\{.*?\}\r?\n\};", re.S),
     r"\1\n};", "bridge-L"),
]

# Anything matching this after transforms means the file is NOT clean.
# NOTE: match only REAL sessionStorage USAGE (.getItem/.setItem/.removeItem/[..]),
# not the bare word — several tools have a legit code comment like
# "session state lives here, never in real sessionStorage", which is not toggle
# machinery and must not block an otherwise-clean strip. The lang-bar UI markers
# (class="lang-bar", data-lang=) are still hard residuals that must be gone.
RESIDUAL = re.compile(r'sessionStorage\s*\.\s*(?:get|set|remove)Item|sessionStorage\s*\[|class="lang-bar"|data-lang=')


def html_files():
    files = []
    for sub in ("tools", "guides", "chaingraph", "chaingraph/chains"):
        d = REPO / sub
        if d.is_dir():
            files += sorted(p for p in d.glob("*.html"))
    files += sorted(p for p in REPO.glob("*.html") if p.is_file())
    return files


def main():
    clean = dirty = untouched = wrote = 0
    review = []

    for path in html_files():
        # newline="" preserves original CRLF/LF; utf-8 for the non-ASCII dictionaries
        src = path.read_text(encoding="utf-8", newline="")
        out = src
        hits = []
        for regex, repl, name in TRANSFORMS:
            new = regex.sub(repl, out)
            if new != out:
                hits.append(name)
                out = new

        if out == src:
            untouched += 1
            continue

        rel = path.relative_to(REPO)
        if RESIDUAL.search(out):
            dirty += 1
            review.append(str(rel))
            print(f"x {rel}  [{', '.join(hits)}]  — RESIDUAL toggle remains, NOT written")
            continue

        clean += 1
        print(f"{'wrote   ' if WRITE else 'would clean'} {rel}  [{', '.join(hits)}]")
        if WRITE:
            path.write_text(out, encoding="utf-8", newline="")
            wrote += 1

    mode = "WROTE" if WRITE else "DRY-RUN"
    print(f"\n{mode} — clean: {clean}, needs-review: {dirty}, unchanged: {untouched}")
    if review:
        print("\nNEEDS MANUAL REVIEW (structurally different — handle by hand):")
        for r in review:
            print("  " + r)
    if not WRITE:
        print("\nRe-run with --write to apply.")
    sys.exit(1 if dirty else 0)


if __name__ == "__main__":
    main()
