#!/usr/bin/env python3
"""
retire_mcp_panel.py
Remove the legacy .mcp-panel / #mcpPanel section from guide hub pages
and the orphaned #mcp-panel CSS + toggleMcp() function from tool pages.

Guide hubs: strips the button + div block and associated CSS/JS.
Tool files: strips the orphaned #mcp-panel style and toggleMcp() function.

Run from repo root: python scripts/retire_mcp_panel.py
"""

import re
from pathlib import Path

REPO   = Path(__file__).resolve().parent.parent
GUIDES = REPO / 'guides'
TOOLS  = REPO / 'tools'

GUIDE_FILES = [
    'counterparty-credit-risk-hub.html',
    'rbe-deterministic-suite-hub.html',
    'b2b-payments-hub.html',
    'fraud-risk-hub.html',
    'fx-payments-intelligence-hub.html',
    'sme-financial-health-hub.html',
    'treasury-liquidity-hub.html',
    'core-infrastructure-hub.html',
    'payment-ops-monitoring-hub.html',
    'open-wealth-architecture-hub.html',
    'payment-scheme-network-hub.html',
    'dlt-tokenization-hub.html',
    'eu-ai-act-financial-services-hub.html',
    'dora-operational-resilience-hub.html',
    'fca-consumer-duty-hub.html',
    'genius-act-stablecoin-hub.html',
    'psp-payment-safeguarding-hub.html',
    'payment-reference-library-hub.html',
    'fida-open-finance-hub.html',
    'basel-iv-frtb-model-risk-hub.html',
    'eu-regulatory-pipeline-hub.html',
    'mica-crypto-asset-regulation-hub.html',
    'card-economics-hub.html',
    'psp-payment-compliance-hub.html',
    'tradetech-hub.html',
    'wealthtech-hub.html',
    'realtime-payments-ops-hub.html',
    'embedded-finance-baas-hub.html',
    'einvoicing-vat-vida-hub.html',
    'regulatory-compliance-consent-hub.html',
    'bnpl-consumer-credit-hub.html',
    'aml-kyc-compliance-hub.html',
    'open-banking-integration-hub.html',
    'lendtech-hub.html',
    'mcp-agent-demo.html',
]

TOOL_FILES = [
    'rbe-10-velocity-rule-simulator.html',
    'pf-134-three-fund-portfolio-builder.html',
    '308-dora-nca-submission-tracker.html',
    '307-dora-proportionality-assessment.html',
    '304-dora-resilience-testing-designer.html',
    '157-settlement-orchestration-simulator.html',
    '419-sca-exemption-classifier.html',
    'pf-136-roth-vs-traditional-estimator.html',
]

# ─────────────────────────────────────────────────────────────────────────────
# CSS strippers
# ─────────────────────────────────────────────────────────────────────────────

CSS_PREFIXES_GUIDE = (
    '.mcp-panel',
    '.mcp-table',
)

CSS_PREFIXES_TOOL = (
    '#mcp-panel',
)

def strip_css_lines(text: str, prefixes: tuple) -> str:
    """Remove CSS lines whose content starts with any of the given prefixes."""
    lines = text.split('\n')
    out = []
    for line in lines:
        stripped = line.strip()
        if any(stripped.startswith(p) for p in prefixes):
            continue
        out.append(line)
    return '\n'.join(out)

# ─────────────────────────────────────────────────────────────────────────────
# HTML block stripper
# ─────────────────────────────────────────────────────────────────────────────

def strip_html_blocks(text: str) -> str:
    """
    For guide hubs: remove
      1. The <button … onclick="toggleMfst(this)" …>…</button> block
      2. The <div … id="mcpPanel" …>…</div> block
    Handles multi-line buttons and tables-inside-divs (no nested divs expected).
    """
    lines = text.split('\n')
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # ── Button: <button ... onclick="toggleMfst(this)" ...>
        if 'onclick="toggleMfst(this)"' in line:
            # Consume until we pass the closing </button>
            while i < len(lines):
                if '</button>' in lines[i]:
                    i += 1
                    break
                i += 1
            continue

        # ── Div: id="mcpPanel"
        if 'id="mcpPanel"' in line:
            depth = 0
            while i < len(lines):
                depth += lines[i].count('<div')
                depth -= lines[i].count('</div>')
                i += 1
                if depth <= 0:
                    break
            continue

        out.append(line)
        i += 1

    return '\n'.join(out)

# ─────────────────────────────────────────────────────────────────────────────
# JS strippers
# ─────────────────────────────────────────────────────────────────────────────

# Guide: toggleMfst(btn) — the version that opens mcpPanel, NOT the tool version
# Identified by having a 'btn' parameter and referencing 'mcpPanel'
# Pattern handles both one-liners and multi-line blocks
_TOGGLE_MFST_BTN = re.compile(
    r'\n?[ \t]*function\s+toggleMfst\s*\(\s*btn\s*\)\s*\{.*?\}',
    re.DOTALL,
)

# Tool: toggleMcp() — simple orphaned one-liner
_TOGGLE_MCP = re.compile(
    r'\n?[ \t]*function\s+toggleMcp\s*\(\s*\)\s*\{[^}]*\}\s*',
)

def strip_js_guide(text: str) -> str:
    return _TOGGLE_MFST_BTN.sub('', text)

def strip_js_tool(text: str) -> str:
    return _TOGGLE_MCP.sub('\n', text)

# ─────────────────────────────────────────────────────────────────────────────
# Per-file processors
# ─────────────────────────────────────────────────────────────────────────────

def process_guide(path: Path) -> str:
    original = path.read_text(encoding='utf-8')
    text = original
    text = strip_css_lines(text, CSS_PREFIXES_GUIDE)
    text = strip_html_blocks(text)
    text = strip_js_guide(text)
    if text != original:
        path.write_text(text, encoding='utf-8')
        delta = len(original.splitlines()) - len(text.splitlines())
        return f'✓  -{delta} lines'
    return '–  no change'

def process_tool(path: Path) -> str:
    original = path.read_text(encoding='utf-8')
    text = original
    text = strip_css_lines(text, CSS_PREFIXES_TOOL)
    text = strip_js_tool(text)
    if text != original:
        path.write_text(text, encoding='utf-8')
        delta = len(original.splitlines()) - len(text.splitlines())
        return f'✓  -{delta} lines'
    return '–  no change'

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print('=== GUIDE HUB FILES ===')
    guide_changed = 0
    for name in GUIDE_FILES:
        p = GUIDES / name
        if not p.exists():
            print(f'  SKIP  {name}')
            continue
        result = process_guide(p)
        print(f'  {result}  {name}')
        if result.startswith('✓'):
            guide_changed += 1

    print(f'\n=== TOOL FILES ===')
    tool_changed = 0
    for name in TOOL_FILES:
        p = TOOLS / name
        if not p.exists():
            print(f'  SKIP  {name}')
            continue
        result = process_tool(p)
        print(f'  {result}  {name}')
        if result.startswith('✓'):
            tool_changed += 1

    total = guide_changed + tool_changed
    print(f'\nDone — {guide_changed} guides + {tool_changed} tools modified ({total} total).')

if __name__ == '__main__':
    main()
