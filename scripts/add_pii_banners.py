#!/usr/bin/env python3
"""
add_pii_banners.py — idempotent PII-banner enforcer (originally a V3 one-shot
compliance fix; converted to a safe-to-re-run generator per SSOT-GATES-1 §G2.4).
Ensures every target tool has the exact CONTRACT §1.3 PII banner.

CONTRACT §1.3 canonical text:
  🔒 All inputs are processed locally in your browser. No data is transmitted.
     Do not enter real personal data — use synthetic or anonymised inputs only.

Idempotency contract (verified by running twice against the full TARGETS corpus
and diffing repo state — the second run must be a true no-op):
  - has_correct_banner() guards every file: if the canonical text is already
    present, fix_file() returns "skip" and never touches the file (no write,
    no mtime bump, no duplicate CSS/div injection).
  - A file whose pii-notice div exists but carries drifted text is fixed
    IN PLACE (text swapped for the canonical block, nothing else touched).
  - Do NOT change CANON_TEXT / CANON_DIV — the banner text itself is frozen
    by CONTRACT §1.3; this script's re-run safety is about write avoidance,
    never about the text it enforces.

Usage:
  python scripts/add_pii_banners.py           # dry-run (print changes, no writes)
  python scripts/add_pii_banners.py --apply   # apply changes (idempotent: safe to re-run)
"""

import re
import sys
import os

# ---------------------------------------------------------------------------
# Contract constants
# ---------------------------------------------------------------------------

CANON_TEXT = (
    "\U0001f512 All inputs are processed locally in your browser. "
    "No data is transmitted. "
    "Do not enter real personal data — use synthetic or anonymised inputs only."
)
CANON_DIV = f'<div class="pii-notice">{CANON_TEXT}</div>'
CANON_TEXT_PREFIX = "\U0001f512 All inputs are processed locally in your browser. No data is transmitted."

CANON_CSS = (
    ".pii-notice{font-family:'JetBrains Mono',monospace;"
    "font-size:.62rem;color:var(--muted);background:var(--bg-3);"
    "border:1px solid var(--border);border-left:3px solid var(--teal);"
    "border-radius:4px;padding:.5rem .85rem;line-height:1.5;margin-bottom:1rem}"
)

# ---------------------------------------------------------------------------
# Target files (relative to repo/tools/)
# ---------------------------------------------------------------------------

TARGETS = [
    # Group A: completely missing pii-notice div
    "419-sca-exemption-classifier.html",
    "421-supply-chain-finance-pricing.html",
    "422-incoterms-2020-risk-mapper.html",
    "423-dc-vs-lc-analyzer.html",
    "424-trade-credit-country-risk.html",
    "425-forfaiting-factoring-economics.html",
    "426-trade-sanctions-compliance-checker.html",
    "427-bank-guarantee-structuring-tool.html",
    "432-portfolio-drift-rebalancing.html",
    "433-tax-wrapper-optimizer.html",
    "434-fiduciary-duty-gap-assessor.html",
    "453-account-takeover-detection-policy-builder.html",
    "454-first-party-fraud-mule-detection-framework.html",
    "478-kya-compliance-firewall.html",
    "479-b2b-micro-clearinghouse.html",
    "480-baas-orchestrator.html",
    "495-agentic-checkout-protocol-selector.html",
    "497-x402-micropayment-pricing-modeler.html",
    "498-agent-traffic-acceptance-policy-builder.html",
    # Group B: has pii-notice div with wrong text
    "477-fatf-customer-risk-rating.html",
    # Group B round-2 (caught by verify_repo.py 2026-06-11)
    "375-visa-agentic-ready-issuer-readiness-scorer.html",
    "380-physical-climate-risk-assessor.html",
    "385-transition-plan-adequacy-checker.html",
    "415-scheme-fee-analyzer.html",
    "441-udaap-risk-assessor.html",
    "442-reg-e-dispute-workflow-builder.html",
    "445-bsa-sar-filing-adequacy-checker.html",
    "451-sr11-7-model-risk-management-gap-assessor.html",
    "459-insurance-ratemaking-adequacy.html",
    # Group C: pii text embedded elsewhere (scope-note span, hero p, etc.)
    "20-failure-analyser.html",
    "21-emerging-corridor-sheet.html",
    "22-decline-code-decoder.html",
    "23-corridor-savings-calc.html",
    "157-settlement-orchestration-simulator.html",
    "285-google-ap2-mandate-builder.html",
    "288-mcp-developer-readiness-scorecard.html",
    "320-ap2-mcp-policy-validator.html",
]

# ---------------------------------------------------------------------------

def has_correct_banner(content):
    """True if file already contains canonical pii-notice div with exact text."""
    m = re.search(r'<div class="pii-notice">(.*?)</div>', content, re.DOTALL)
    if not m:
        return False
    return CANON_TEXT_PREFIX in m.group(1)


def fix_file(path, dry_run):
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"  MISSING FILE: {path}")
        return "missing"

    if has_correct_banner(content):
        print(f"  SKIP (already correct): {os.path.basename(path)}")
        return "skip"

    modified = content

    # Case: div exists but wrong text → replace text only
    if '<div class="pii-notice">' in content:
        modified = re.sub(
            r'<div class="pii-notice">.*?</div>',
            CANON_DIV,
            modified,
            count=1,
            flags=re.DOTALL,
        )
        action = "REPLACE-TEXT"

    # Case: div missing → add CSS (if absent) + inject div
    else:
        has_css = '.pii-notice{' in content or '.pii-notice {' in content
        if not has_css:
            # inject canonical CSS before the first </style>
            modified = modified.replace("</style>", CANON_CSS + "\n</style>", 1)

        # Injection anchor: after <div class="tool-body"> (optionally followed by
        # <div class="container"> on the same line).  Fall back to after <body>.
        TB_RE = re.compile(
            r'(<div class="tool-body">(?:<div class="container">)?)',
            re.DOTALL,
        )
        m = TB_RE.search(modified)
        if m:
            insert_at = m.end()
            modified = modified[:insert_at] + "\n  " + CANON_DIV + modified[insert_at:]
            action = "INJECT" + ("" if has_css else "+CSS")
        else:
            # fallback: right after <body>
            body_m = re.search(r'<body[^>]*>', modified)
            if body_m:
                insert_at = body_m.end()
                modified = modified[:insert_at] + "\n" + CANON_DIV + modified[insert_at:]
                action = "INJECT-FALLBACK" + ("" if has_css else "+CSS")
            else:
                print(f"  WARNING: no injection point for {os.path.basename(path)}")
                return "warn"

    print(f"  {action}: {os.path.basename(path)}")

    if not dry_run:
        with open(path, "w", encoding="utf-8") as f:
            f.write(modified)

    return action


def main():
    dry_run = "--apply" not in sys.argv

    # Resolve tools directory relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_dir = os.path.dirname(script_dir)
    tools_dir = os.path.join(repo_dir, "tools")

    if dry_run:
        print("=== DRY RUN (pass --apply to write changes) ===\n")
    else:
        print("=== APPLYING CHANGES ===\n")

    counts = {"skip": 0, "missing": 0, "warn": 0, "other": 0}
    changed = []

    for fname in TARGETS:
        path = os.path.join(tools_dir, fname)
        result = fix_file(path, dry_run)
        if result in ("skip", "missing", "warn"):
            counts[result] += 1
        else:
            counts["other"] += 1
            changed.append(fname)

    print(f"\n--- Summary ---")
    print(f"  Already correct: {counts['skip']}")
    print(f"  Fixed/would fix: {counts['other']}")
    print(f"  Missing files:   {counts['missing']}")
    print(f"  Warnings:        {counts['warn']}")
    if dry_run and changed:
        print(f"\nRe-run with --apply to write {len(changed)} file(s).")


if __name__ == "__main__":
    main()
