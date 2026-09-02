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


# ── GENERATOR-NOOP-STABILITY-1 ────────────────────────────────────────────────
# The single write path for every file this script emits. It closes two churn
# classes that made an SO #28 regen conflict with every concurrent PR:
#
#   1. LINE ENDINGS. `open(path, 'w')` is TEXT mode, so on Windows Python
#      translates every '\n' to '\r\n'. This repo pins LF (.gitattributes:
#      `* text=auto eol=lf`), so a clean checkout has zero CR bytes and a single
#      regen from a Windows session rewrote all 7 files this script owns —
#      index.html, tools.html, llms.txt, sitemap-adjacent MCP descriptors —
#      end to end, CRLF. Whole-file rewrites of exactly the shared, high-traffic
#      derived surfaces SO #35 is about. `newline=''` disables the translation,
#      so output is LF on Windows and Linux alike.
#
#   2. DATE STAMPS. Three fields here carry date.today(): catalog.json
#      "generated", server.json "last_updated", and llms.txt's "Tool count as
#      of" line. They change once per DAY by construction, so two PRs
#      regenerated on different days conflicted on files whose substantive
#      content was identical. `prior_date` preserves the stamp already on disk
#      when the candidate output is otherwise byte-identical to it — the stamp
#      then means "when these counts last changed", which is a fact, instead of
#      "when someone last ran the generator", which was not one.
#
# Returns True if it actually wrote. An unchanged file is left ALONE (mtime
# included), never rewritten with its own bytes.
def write_stable(path, new_text, prior_date=None):
    try:
        with open(path, encoding='utf-8', newline='') as f:
            old = f.read()
    except FileNotFoundError:
        old = None
    if old is not None:
        if old == new_text:
            return False
        # Substituting the on-disk date back into the candidate and getting the
        # on-disk file byte-for-byte proves the date was the ONLY difference.
        if prior_date and prior_date != TODAY and new_text.replace(TODAY, prior_date) == old:
            return False
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(new_text)
    return True


def dump_json_stable(path, obj, prior_date=None):
    return write_stable(path, json.dumps(obj, indent=2, ensure_ascii=True) + '\n', prior_date)


def read_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


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
                "tags": man.get('tags', []),
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
    try:
        _prior_generated = read_json('mcp/catalog.json').get('generated')
    except Exception:
        _prior_generated = None
    dump_json_stable('mcp/catalog.json', catalog, prior_date=_prior_generated)

    # ── get mcp.live from counts.mjs (SSOT) via subprocess ──
    import subprocess as _sp
    _counts_result = _sp.run(['node', 'scripts/counts.mjs'], capture_output=True, text=True, cwd=ROOT)
    _counts = json.loads(_counts_result.stdout) if _counts_result.returncode == 0 else {}
    mcp_live = _counts.get('mcp.live', n)   # fallback to n if counts.mjs fails

    # ── mcp/server.json ──
    sj = read_json('mcp/server.json')
    _prior_last_updated = sj.get('last_updated')
    # tool_count = n_tools (count of tools/*.html = browser tools), NOT n (manifest count). The MCP
    # registry descriptor + every public meta/og/schema tag advertise the browser-tool count; the
    # extra manifests are derived/short-form with no page. verify-counts.mjs gates this field against
    # tools.browser, so writing n here re-introduced count drift on every catalog regen (the per-wave
    # "--fix server.json/mcp.json" churn). Keep regen and verify-counts in agreement = no drift.
    sj['tool_count'] = n_tools
    sj['last_updated'] = TODAY
    sj['description'] = (f"{n_tools} browser-based fintech intelligence tools built by Post Oak Labs. "
                         f"Covers ISO 20022, A2A payments, open banking (CFPB §1033 / PSD3), "
                         f"EU AI Act, DORA, AML/KYC, BaaS, DLT/tokenization, cross-border FX, "
                         f"real-time payments, e-invoicing (Peppol/ViDA), agentic payment protocols "
                         f"(AP2, ACP, x402, Visa TAP, Mastercard Agent Pay), and MCP developer tooling. "
                         f"All tools are client-side — zero PII, zero server calls.")
    dump_json_stable('mcp/server.json', sj, prior_date=_prior_last_updated)

    # ── .well-known/mcp.json ──
    wk = read_json('.well-known/mcp.json')
    for s in wk.get('servers', []):
        if s.get('id') == 'ainumbers-fintech-suite':
            s['tool_count'] = n_tools   # browser-tool count, not manifest count — see server.json note above
            s['description'] = (f"{n_tools} browser-based fintech tools — ISO 20022, A2A, CFPB §1033, "
                                f"EU AI Act, DORA, AML/KYC, BaaS, DLT, agentic payments (AP2, ACP, x402, "
                                f"Visa TAP, Mastercard Agent Pay), and MCP developer tooling.")
        elif s.get('id') == 'ainumbers-apps':
            s['tool_count'] = mcp_live
            s['description'] = (f"Live MCP endpoint ({mcp_live} tools) — chainable OCG compute nodes, "
                                f"flagship browser tool widgets, and catalog search. "
                                f"Streamable HTTP at https://mcp.ainumbers.co/mcp, no auth.")
    dump_json_stable('.well-known/mcp.json', wk)

    # ── llms.txt (text — targeted replacements) ──
    with open('llms.txt', encoding='utf-8', newline='') as _f:
        llms = _f.read()
    _m = re.search(r"Tool count as of ([0-9-]+):", llms)
    _prior_llms_date = _m.group(1) if _m else None
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
    write_stable('llms.txt', llms, prior_date=_prior_llms_date)

    # ── tools.html (catalog spoke — registry header + filter count) ──
    import re as _re
    with open('tools.html', encoding='utf-8', newline='') as _f:
        thtml = _f.read()
    thtml = thtml.replace("Suite-Wide Tool Manifest Registry · 265 tools",
                          f"Suite-Wide Tool Manifest Registry · {n} tools")
    thtml = _re.sub(r'<span class="filter-count" id="fc-all">\d+</span>',
                    f'<span class="filter-count" id="fc-all">{n_tools}</span>', thtml)
    # COPYROT-SWEEP-1 (ROOT-9): the search box's static placeholder carried a fossil
    # "Search 440+ tools…" that only runtime JS corrected; crawlers/no-JS saw the stale
    # value. Derive it from the count at generation like every other tools.html count.
    thtml = _re.sub(r'placeholder="Search \d+\+ tools',
                    f'placeholder="Search {n_tools}+ tools', thtml)
    write_stable('tools.html', thtml)

    # ── index.html (hub spoke — preserve sentinel format in "Browse all N tools" CTA) ──
    with open('index.html', encoding='utf-8', newline='') as _f:
        ihtml = _f.read()
    ihtml = _re.sub(r'Browse all (?:<!--COUNT:tools\.browser-->\d+<!--/COUNT-->|\d+) tools →',
                    f'Browse all <!--COUNT:tools.browser-->{n_tools}<!--/COUNT--> tools →', ihtml)
    write_stable('index.html', ihtml)

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
