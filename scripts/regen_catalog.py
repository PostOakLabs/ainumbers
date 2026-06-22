#!/usr/bin/env python3
"""
regen_catalog.py — Regenerate mcp/catalog.json from the per-tool manifests and
sync every machine/human count file. SSOT = manifests/*.manifest.json.

Run from the repo root:  python scripts/regen_catalog.py
Idempotent. Never hand-edit mcp/catalog.json — edit a manifest and re-run this.

What it writes:
  mcp/catalog.json          — full regen (1 entry per manifest)
  mcp/server.json           — tool_count + description + last_updated
  .well-known/mcp.json      — tool_count + description
  llms.txt                  — tool/hub counts + date line
  index.html                — suite-wide registry header + "All Tools" filter count

Reference: BUILD_PROMPT_new-tools_2026-05-31.md Section 5 (catalog generator spec).
"""
import json, glob, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

BASE_URL = "https://ainumbers.co"
TODAY = datetime.date.today().isoformat()   # e.g. 2026-06-02

# ── natural sort key so 01 < 02 < 10 < 100 and named/rbe/pf slugs group sensibly ──
def natkey(slug):
    return [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', slug)]

def derive_name(tool_id):
    n = re.sub(r'[^a-z0-9]+', '_', tool_id.lower()).strip('_')
    return n or 'tool'

def main():
    man_files = sorted(
        [f for f in glob.glob('manifests/*.manifest.json') if 'DELETE' not in f],
        key=lambda f: natkey(os.path.basename(f)[:-len('.manifest.json')])
    )

    entries = []
    seen_names = {}
    derived = []      # slugs whose mcp_tool_definition.name was missing (short-form manifests)
    missing_html = [] # slugs whose tool HTML is absent
    parse_fail = []

    for f in man_files:
        slug = os.path.basename(f)[:-len('.manifest.json')]   # e.g. 274-mcp-tool-definition-linter
        try:
            man = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            parse_fail.append((slug, str(e))); continue

        mtd = man.get('mcp_tool_definition') or {}
        name = mtd.get('name')
        if not name:
            name = derive_name(man.get('tool_id', slug))
            derived.append(slug)

        # guarantee global uniqueness of the catalog `name`
        if name in seen_names:
            base = name; i = 2
            while f"{base}_{i}" in seen_names:
                i += 1
            name = f"{base}_{i}"
        seen_names[name] = slug

        description = mtd.get('description') or man.get('description', '')
        input_schema = mtd.get('inputSchema') or man.get('input_schema') or {"type": "object"}

        if not os.path.exists(os.path.join('tools', slug + '.html')):
            missing_html.append(slug)

        entries.append({
            "name": name,
            "description": description,
            "inputSchema": input_schema,
            "metadata": {
                "tool_id": man.get('tool_id', slug),
                "category": man.get('category', ''),
                "url": f"{BASE_URL}/tools/{slug}.html",
                "ap2_export": bool(man.get('ap2_export', False)),
                "execution_type": "browser-reference",
                "version": man.get('version', '1.0.0'),
                # AIN Bridge v1.0 (2026-06-06): prefill deep-link capability signal.
                # Prefill tools accept {url}#in=<base64url(JSON of {element_id: value})>[&run=1]
                "prefill": bool(man.get('prefill', False)),
            }
        })

    n = len(entries)
    n_tools = len(glob.glob('tools/*.html'))
    n_hubs  = len(glob.glob('guides/*-hub.html'))

    cat_desc = (f"{n} client-side fintech tools covering ISO 20022, A2A payments, "
                f"CFPB §1033, EU AI Act, DORA, AML/KYC, BaaS, DLT, agentic payments "
                f"(AP2, ACP, x402, Visa TAP, Mastercard Agent Pay), and MCP developer tooling. "
                f"All tools run in the browser — execution_type is browser-reference: "
                f"provide the URL and inputs to the user for interactive use.")

    catalog = {
        "schema_version": "mcp-catalog-v1",
        "server_id": "ainumbers-fintech-suite",
        "name": "AINumbers Fintech Intelligence Suite",
        "description": cat_desc,
        "base_url": BASE_URL,
        "generated": TODAY,
        "tool_count": n,
        "tools": entries,
    }
    json.dump(catalog, open('mcp/catalog.json', 'w', encoding='utf-8'),
              indent=2, ensure_ascii=True)
    open('mcp/catalog.json', 'a', encoding='utf-8').write('\n')

    # ── mcp/server.json ──
    sj = json.load(open('mcp/server.json', encoding='utf-8'))
    sj['tool_count'] = n
    sj['last_updated'] = TODAY
    sj['description'] = (f"{n}+ browser-based fintech intelligence tools built by Post Oak Labs. "
                         f"Covers ISO 20022, A2A payments, open banking (CFPB §1033 / PSD3), "
                         f"EU AI Act, DORA, AML/KYC, BaaS, DLT/tokenization, cross-border FX, "
                         f"real-time payments, e-invoicing (Peppol/ViDA), agentic payment protocols "
                         f"(AP2, ACP, x402, Visa TAP, Mastercard Agent Pay), and MCP developer tooling. "
                         f"All tools are client-side — zero PII, zero server calls.")
    json.dump(sj, open('mcp/server.json', 'w', encoding='utf-8'),
              indent=2, ensure_ascii=True)
    open('mcp/server.json', 'a', encoding='utf-8').write('\n')

    # ── .well-known/mcp.json ──
    wk = json.load(open('.well-known/mcp.json', encoding='utf-8'))
    for s in wk.get('servers', []):
        if s.get('id') == 'ainumbers-fintech-suite':
            s['tool_count'] = n
            s['description'] = (f"{n}+ browser-based fintech tools — ISO 20022, A2A, CFPB §1033, "
                                f"EU AI Act, DORA, AML/KYC, BaaS, DLT, agentic payments (AP2, ACP, x402, "
                                f"Visa TAP, Mastercard Agent Pay), and MCP developer tooling.")
    json.dump(wk, open('.well-known/mcp.json', 'w', encoding='utf-8'),
              indent=2, ensure_ascii=True)
    open('.well-known/mcp.json', 'a', encoding='utf-8').write('\n')

    # ── llms.txt (text — targeted replacements) ──
    llms = open('llms.txt', encoding='utf-8').read()
    # regex-based so the script works regardless of the previous counts
    llms = re.sub(r"suite of \d+ browser-based fintech tools", f"suite of {n_tools} browser-based fintech tools", llms)
    llms = re.sub(r"tool grid \(\d+ tools\)", f"tool grid ({n_tools} tools)", llms)
    llms = re.sub(r"→ \d+ integration hubs", f"→ {n_hubs} integration hubs", llms)
    llms = re.sub(r"`/guides/\*` → \d+ integration hubs", f"`/guides/*` → {n_hubs} integration hubs", llms)
    llms = re.sub(r"→ \d+ individual standalone fintech utilities", f"→ {n_tools} individual standalone fintech utilities", llms)
    llms = re.sub(r"Tool count as of [0-9-]+: \d+ tools in `/tools/`, \d+ hubs in `/guides/`[^\n]*",
                  f"Tool count as of {TODAY}: {n_tools} tools in `/tools/`, {n_hubs} hubs in `/guides/` "
                  f"({n} with MCP manifests in `/mcp/catalog.json`).", llms)
    repl = []
    for a, b in repl:
        llms = llms.replace(a, b)
    open('llms.txt', 'w', encoding='utf-8').write(llms)

    # ── tools.html (catalog spoke — registry header + filter count) ──
    import re as _re
    thtml = open('tools.html', encoding='utf-8').read()
    thtml = thtml.replace("Suite-Wide Tool Manifest Registry · 265 tools",
                          f"Suite-Wide Tool Manifest Registry · {n} tools")
    thtml = _re.sub(r'<span class="filter-count" id="fc-all">\d+</span>',
                    f'<span class="filter-count" id="fc-all">{n_tools}</span>', thtml)
    open('tools.html', 'w', encoding='utf-8').write(thtml)

    # ── index.html (hub spoke — "Browse all N tools" CTA count) ──
    ihtml = open('index.html', encoding='utf-8').read()
    ihtml = _re.sub(r'Browse all \d+ tools →', f'Browse all {n_tools} tools →', ihtml)
    open('index.html', 'w', encoding='utf-8').write(ihtml)

    # ── report ──
    print(f"catalog.json regenerated: {n} entries (tool_count={n})")
    print(f"unique names: {len(seen_names)}  ->  {'OK' if len(seen_names)==n else 'MISMATCH'}")
    print(f"actual tool HTMLs: {n_tools} | hub pages: {n_hubs} | manifest-backed (catalog): {n}")
    print(f"server.json / .well-known/mcp.json tool_count -> {n}; llms.txt + tools.html + index.html counts synced")
    if parse_fail:
        print(f"\n!! PARSE FAILURES ({len(parse_fail)}):")
        for s, e in parse_fail: print(f"   {s}: {e}")
    if derived:
        print(f"\n!! SHORT-FORM MANIFESTS — derived a fallback name (add a proper mcp_tool_definition) ({len(derived)}):")
        for s in derived: print(f"   {s}")
    if missing_html:
        print(f"\n!! MANIFESTS WITHOUT A TOOL HTML ({len(missing_html)}):")
        for s in missing_html: print(f"   {s}")
    if n_tools != n:
        print(f"\n!! NOTE: {n_tools} tool HTMLs exist but only {n} have manifests "
              f"({n_tools-n} tools are not MCP-discoverable). Add manifests to close the gap.")

    # hard invariant from the build prompt
    assert len(seen_names) == n, "name uniqueness invariant failed"
    return 0

if __name__ == "__main__":
    sys.exit(main())
