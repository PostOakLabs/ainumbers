#!/usr/bin/env python3
"""Insert ChainGraph upgrade notice banners into 7 Wave A source tools.
Run from the repo root: python scripts/add_chaingraph_banners.py
"""
from pathlib import Path

BASE = Path(__file__).parent.parent / "tools"

DIV_END   = "</div></nav>"
NAV_END   = "</nav>"

def banner(art_slug, art_label, desc, chain_slug, chain_label):
    return (
        '\n<div style="background:rgba(20,184,166,.06);border:1px solid rgba(20,184,166,.25);'
        'border-left:3px solid #14B8A6;border-radius:8px;padding:.75rem 1.1rem;margin:1rem 1.5rem;'
        "font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#14B8A6;letter-spacing:.04em\">\n"
        f'  ⬡ <strong>ChainGraph upgrade available:</strong> '
        f'<a href="../chaingraph/{art_slug}.html" style="color:#2DD4BF;font-weight:600">{art_label}</a>'
        f' — {desc}. Use in the '
        f'<a href="../chaingraph/chains/{chain_slug}.html" style="color:#2DD4BF">{chain_label}</a>.\n'
        '</div>'
    )

TOOLS = [
    ("rbe-06-agentic-mandate-sandbox.html",              DIV_END,
     banner("art-15-agentic-mandate-sandbox",
            "ART-15 Agentic Mandate Sandbox",
            "§4 execution_hash + audit chain for simulated agentic payment policies",
            "agentic-policy", "Agentic Policy Chain")),

    ("285-google-ap2-mandate-builder.html",              DIV_END,
     banner("art-16-google-ap2-mandate-builder",
            "ART-16 Google AP2 Mandate Builder",
            "constructs Google AP2 Intent/Cart/Payment mandates with §4 execution_hash",
            "agentic-policy", "Agentic Policy Chain")),

    ("320-ap2-mcp-policy-validator.html",                NAV_END,
     banner("art-17-ap2-mcp-policy-validator",
            "ART-17 AP2 MCP Policy Validator",
            "validates MCP tool definitions against AP2 policy mandates with §4 execution_hash",
            "agentic-policy", "Agentic Policy Chain")),

    ("288-mcp-developer-readiness-scorecard.html",       DIV_END,
     banner("art-18-mcp-developer-readiness-scorecard",
            "ART-18 MCP Developer Readiness Scorecard",
            "scores MCP server readiness against AP2 + DORA requirements with §4 execution_hash",
            "agentic-policy", "Agentic Policy Chain")),

    ("495-agentic-checkout-protocol-selector.html",      NAV_END,
     banner("art-19-agentic-checkout-protocol-selector",
            "ART-19 Agentic Checkout Protocol Selector",
            "selects UCP/ACP/x402/Visa TAP protocol with §4 execution_hash",
            "agentic-checkout", "Agentic Checkout Chain")),

    ("496-acp-ucp-product-feed-conformance-auditor.html", NAV_END,
     banner("art-20-acp-ucp-product-feed-conformance-auditor",
            "ART-20 ACP/UCP Product-Feed Conformance Auditor",
            "validates ACP/UCP checkout payloads with §4 execution_hash",
            "agentic-checkout", "Agentic Checkout Chain")),

    ("498-agent-traffic-acceptance-policy-builder.html", NAV_END,
     banner("art-21-agent-traffic-acceptance-policy-builder",
            "ART-21 Agent-Traffic Acceptance Policy Builder",
            "builds KYA acceptance policy mandates with §4 execution_hash",
            "agentic-checkout", "Agentic Checkout Chain")),
]

for fname, nav_pattern, b in TOOLS:
    path = BASE / fname
    if not path.exists():
        print(f"MISSING  {fname}")
        continue
    content = path.read_text(encoding="utf-8")
    # idempotency: skip if already patched
    if "ChainGraph upgrade available" in content:
        print(f"SKIP     {fname} — banner already present")
        continue
    idx = content.find(nav_pattern)
    if idx == -1:
        print(f"ERROR    {fname} — pattern '{nav_pattern}' not found")
        continue
    insert_at = idx + len(nav_pattern)
    path.write_text(content[:insert_at] + b + content[insert_at:], encoding="utf-8")
    print(f"OK       {fname}")

print("Done.")
