#!/usr/bin/env python3
"""
check_index_sync.py — AINumbers.co homepage sync validator
===========================================================
Compares tools/*.html against index.html tool cards.

Usage:
  python scripts/check_index_sync.py            # report only
  python scripts/check_index_sync.py --strict   # exit 1 if any missing (for CI)

What it checks:
  1. Every .html file in tools/ is referenced somewhere in index.html
  2. Every href in index.html that points to tools/*.html actually exists on disk
  3. Reports a count summary

Exit codes:
  0 — all clean (or only warnings in non-strict mode)
  1 — missing tools found AND --strict flag set (CI failure)
"""

import os
import re
import sys
import argparse

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(REPO_ROOT, "tools")
INDEX_PATH = os.path.join(REPO_ROOT, "index.html")

# Tools that are intentionally omitted from index.html (duplicates / aliases)
# Edit this list if you deliberately exclude a tool from the homepage.
INTENTIONAL_OMISSIONS = {
    "tool-01-smb-treasury-tax.html",         # duplicate of rbe-01
    "tool-02-a2a-exception-triage.html",     # duplicate of rbe-02
    "tool-03-ma-due-diligence.html",         # duplicate of rbe-03
    "tool-04-agent-policy-guardrail.html",   # duplicate of rbe-04
    "tool-05-regulatory-doc-intelligence.html",  # duplicate of rbe-05
    "tool-06-agentic-mandate-sandbox.html",  # duplicate of rbe-06
}

ANSI_RED    = "\033[91m"
ANSI_GREEN  = "\033[92m"
ANSI_YELLOW = "\033[93m"
ANSI_BOLD   = "\033[1m"
ANSI_RESET  = "\033[0m"

def main():
    parser = argparse.ArgumentParser(description="AINumbers index sync checker")
    parser.add_argument("--strict", action="store_true",
                        help="Exit 1 if any unintentional omissions found (for CI)")
    parser.add_argument("--no-color", action="store_true",
                        help="Disable ANSI colour output")
    args = parser.parse_args()

    if args.no_color:
        for v in ["ANSI_RED", "ANSI_GREEN", "ANSI_YELLOW", "ANSI_BOLD", "ANSI_RESET"]:
            globals()[v] = ""

    print(f"{ANSI_BOLD}AINumbers — index.html sync check{ANSI_RESET}")
    print(f"Tools dir : {TOOLS_DIR}")
    print(f"Index file: {INDEX_PATH}\n")

    # ── 1. Collect all tool files ──────────────────────────────────────────
    all_tools = sorted(
        f for f in os.listdir(TOOLS_DIR) if f.endswith(".html")
    )

    # ── 2. Read index.html ─────────────────────────────────────────────────
    with open(INDEX_PATH, encoding="utf-8", errors="replace") as fh:
        index_html = fh.read()

    # ── 3. Find tools referenced in index.html ────────────────────────────
    # Match href="tools/<filename>" patterns
    referenced = set(re.findall(r'href="tools/([^"]+\.html)"', index_html))

    # ── 4. Find href targets that don't exist on disk ─────────────────────
    dead_links = sorted(
        f for f in referenced
        if not os.path.exists(os.path.join(TOOLS_DIR, f))
    )

    # ── 5. Find tools not referenced in index.html ────────────────────────
    not_referenced = sorted(
        f for f in all_tools
        if f not in index_html  # broader check catches data-name matches too
    )
    unintentional = [f for f in not_referenced if f not in INTENTIONAL_OMISSIONS]
    intentional   = [f for f in not_referenced if f in INTENTIONAL_OMISSIONS]

    # ── Report ────────────────────────────────────────────────────────────
    print(f"  Tools on disk   : {len(all_tools)}")
    print(f"  Cards in index  : {len(referenced)}")

    if dead_links:
        print(f"\n{ANSI_RED}{ANSI_BOLD}  ✗ Dead links in index.html ({len(dead_links)}) — file not on disk:{ANSI_RESET}")
        for f in dead_links:
            print(f"    tools/{f}")
    else:
        print(f"\n{ANSI_GREEN}  ✓ No dead links in index.html{ANSI_RESET}")

    if unintentional:
        print(f"\n{ANSI_RED}{ANSI_BOLD}  ✗ Tools missing from index.html ({len(unintentional)}):{ANSI_RESET}")
        for f in unintentional:
            print(f"    tools/{f}")
        print(f"\n  Add a card for each missing tool, or add its filename to")
        print(f"  INTENTIONAL_OMISSIONS in scripts/check_index_sync.py.")
    else:
        print(f"{ANSI_GREEN}  ✓ All tools are represented on the homepage{ANSI_RESET}")

    if intentional:
        print(f"\n{ANSI_YELLOW}  ⚠ Intentionally omitted ({len(intentional)} known duplicates):{ANSI_RESET}")
        for f in intentional:
            print(f"    tools/{f}")

    # ── Summary ───────────────────────────────────────────────────────────
    print()
    if not unintentional and not dead_links:
        print(f"{ANSI_GREEN}{ANSI_BOLD}  All clear.{ANSI_RESET}")
        return 0
    else:
        issues = len(unintentional) + len(dead_links)
        print(f"{ANSI_RED}{ANSI_BOLD}  {issues} issue(s) found.{ANSI_RESET}")
        return 1 if args.strict else 0

if __name__ == "__main__":
    sys.exit(main())
