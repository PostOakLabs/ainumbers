#!/usr/bin/env python3
"""
migrate_catalog.py — Split index.html into lean hub (index.html) + catalog spoke (tools.html).
Run from repo root: python scripts/migrate_catalog.py

Creates / overwrites:
  tools.html  — full 31-category grid, sidebar, filter JS, #cat-N anchors
  index.html  — lean hub: nav, hero, featured tools, OCG suite, guides, devmcp, footer

Does NOT touch mcp-apps-poc/ or any worker/MCP file.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# ── helpers ──────────────────────────────────────────────────────────────────

def slurp(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def spew(path, content):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    lines = content.count('\n') + 1
    print(f"  wrote {path} ({lines} lines, {len(content)} bytes)")

def at(text, marker, start=0):
    """Index where marker begins."""
    p = text.find(marker, start)
    if p == -1:
        raise ValueError(f"Marker not found: {marker[:80]!r}")
    return p

def after(text, marker, start=0):
    """Index immediately after marker ends."""
    p = at(text, marker, start)
    return p + len(marker)

# ── read source ───────────────────────────────────────────────────────────────

print("Reading index.html …")
src = slurp('index.html')

# ── boundary markers ─────────────────────────────────────────────────────────

HEAD_END      = after(src, '</head>\n')

LANG_START    = at(src,    '<!-- LANG BAR')
NAV_START     = at(src,    '<!-- NAV -->')
NAV_END       = after(src, '</nav>\n')

ATTR_START    = at(src,    '<!-- ATTRIBUTION BAR')
SHELL_MARK    = at(src,    '<!-- MAIN SHELL -->')

SB_START      = at(src,    '  <!-- SIDEBAR -->')
SB_END        = after(src, '  </aside>\n')

HERO_START    = at(src,    '    <!-- HERO STRIP -->')
QJ_START      = at(src,    '    <!-- QUICK-JUMP RIBBON -->')
RM_START      = at(src,    '    <!-- RESULTS META -->')
OCG_START     = at(src,    '    <!-- ═══════════════════════════════\n         CHAINGRAPH SUITE')
OCG_END       = after(src, '    </div><!-- /chaingraph-suite -->\n')
GRIDS_END     = after(src, '    </div><!-- /cat-30 tool-grid -->\n')

PD_START      = at(src,    '    <!-- ═══ POL DEMOS SHOWCASE ═══ -->')
PD_END        = after(src, '    </div><!-- /pol-demos -->\n')

SC_START      = at(src,    '    <!-- ═══ SCENARIO GUIDES')
SC_END        = after(src, '    </div><!-- /scenarios-workflows -->\n')

DM_START      = at(src,    '    <!-- ═══ DEVELOPER & AGENT INTEGRATION ═══ -->')
DM_END        = after(src, '    </div><!-- /developer-mcp -->\n')

FT_START      = at(src,    '\n<footer>')
FT_END        = after(src, '</footer>\n')

JS_START      = at(src,    '\n<script>\n/* -- AINumbers.co - Filter')
JS_END        = after(src, '</script>\n\n</body>\n</html>')

# ── extract chunks ────────────────────────────────────────────────────────────

head_orig  = src[:HEAD_END]                    # <!DOCTYPE...></head>\n
lang_bar   = src[LANG_START:NAV_START]         # <!-- LANG BAR ... -->\n
nav_orig   = src[NAV_START:NAV_END]            # <!-- NAV -->...\n</nav>\n
attr_bar   = src[ATTR_START:SHELL_MARK]        # attribution bar (trailing \n\n included)
sidebar    = src[SB_START:SB_END]              # <!-- SIDEBAR -->...</aside>\n
hero       = src[HERO_START:QJ_START]          # hero strip (trailing \n\n included)
qj         = src[QJ_START:RM_START]            # quick-jump ribbon
resmeta    = src[RM_START:OCG_START]           # results-meta (trailing \n\n included)
ocg_suite  = src[OCG_START:OCG_END]            # chaingraph suite block
grids      = src[OCG_END:GRIDS_END]            # all 31 category grids
pol_demos  = src[PD_START:PD_END]              # pol-demos showcase
scenarios  = src[SC_START:SC_END]              # scenario guides (hidden)
devmcp     = src[DM_START:DM_END]              # developer-mcp section
footer     = src[FT_START:FT_END]              # \n<footer>...</footer>\n
filter_js  = src[JS_START:JS_END]              # \n<script>...</script>\n\n</body>\n</html>

# ── filter JS: add missing clearAll() ────────────────────────────────────────
# The sidebar "Clear all filters" button calls clearAll() which was never defined.
# Add it alongside setFilter() for correctness.
filter_js_tools = filter_js.replace(
    '  /* -- setFilter',
    '  /* -- clearAll (sidebar Clear button) */\n  window.clearAll = function () { setFilter(\'all\'); };\n\n  /* -- setFilter'
)

# ── CSS + fonts block shared by both pages ───────────────────────────────────
# Slice from the font preconnect links through </head>
css_start = at(head_orig, '<link rel="preconnect"')
fonts_and_styles = head_orig[css_start:]  # <link rel="preconnect">...<style>...</style>\n</head>\n

# ── tools.html: NEW head (title / meta / schema) + shared CSS ────────────────
tools_new_head = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All 484 Fintech Tools — AINumbers.co</title>
<meta name="description" content="Browse all 484 free, open-source fintech tools by Post Oak Labs — filter by 31 categories including A2A payments, ISO 20022, AML/KYC, DORA, card economics, DLT, ESG, and more. All client-side. Zero PII. No install.">
<meta property="og:title" content="All 484 Fintech Tools — AINumbers.co">
<meta property="og:description" content="484 free browser-based fintech tools by Post Oak Labs. 31 categories with live search and filters. Zero PII. No install.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@PostOakLabs">
<meta name="twitter:title" content="All 484 Fintech Tools — AINumbers.co">
<meta name="twitter:description" content="484 free browser-based fintech tools by Post Oak Labs. 31 categories with live search. Zero PII. No install.">
<meta property="og:url" content="https://ainumbers.co/tools.html">
<meta property="og:image" content="https://ainumbers.co/og-image.png">
<link rel="canonical" href="https://ainumbers.co/tools.html">
<meta name="robots" content="index, follow">
<meta name="author" content="Post Oak Labs">

<!-- Schema.org structured data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "All 484 Fintech Tools — AINumbers.co",
  "url": "https://ainumbers.co/tools.html",
  "description": "484 free, open-source fintech tools by Post Oak Labs. 31 categories including A2A payments, ISO 20022, AML/KYC, fraud scoring, CBDC, DLT, card economics, ESG, and compliance. All client-side. Zero PII.",
  "author": {
    "@type": "Organization",
    "name": "Post Oak Labs",
    "url": "https://postoaklabs.com"
  },
  "mainEntity": {
    "@type": "ItemList",
    "name": "AINumbers.co Tool Catalog",
    "numberOfItems": 484,
    "itemListElement": []
  }
}
</script>

""" + fonts_and_styles

# ── index.html: modify the original head ────────────────────────────────────
head_index = head_orig
# Update stale "440+" counts in meta descriptions
head_index = head_index.replace(
    'content="440+ free, open-source fintech tools designed by Post Oak Labs',
    'content="484 free, open-source fintech tools designed by Post Oak Labs'
)
head_index = head_index.replace(
    'content="440+ free browser-based fintech tools designed by Post Oak Labs',
    'content="484 free browser-based fintech tools designed by Post Oak Labs'
)
head_index = head_index.replace(
    'content="440+ free browser-based fintech tools for A2A',
    'content="484 free browser-based fintech tools for A2A'
)
# Update Schema.org description
head_index = head_index.replace(
    '"description": "440+ free, open-source browser-based fintech tools',
    '"description": "484 free, open-source browser-based fintech tools'
)
# Update SearchAction target to point at tools.html (the page that can actually search)
head_index = head_index.replace(
    '"target": "https://ainumbers.co/?q={search_term_string}"',
    '"target": "https://ainumbers.co/tools.html?q={search_term_string}"'
)

# ── nav: index.html variant ─────────────────────────────────────────────────
# Replace real search input with a click-to-search-page link
OLD_SEARCH_DIV = (
    '    <div class="nav-search">\n'
    '      <span class="nav-search-icon">⌕</span>\n'
    '      <input type="search" class="nav-search-input" id="globalSearch"\n'
    '        placeholder="Search 440+ tools…" autocomplete="off" spellcheck="false"\n'
    '        aria-label="Search tools">\n'
    '      <span class="search-shortcut" id="kbdHint"><kbd>/</kbd></span>\n'
    '      <span class="search-count" id="searchCount"></span>\n'
    '    </div>'
)
NEW_SEARCH_LINK = (
    '    <a href="tools.html" class="nav-search" style="text-decoration:none;cursor:pointer" '
    'aria-label="Search all tools">\n'
    '      <span class="nav-search-icon">⌕</span>\n'
    '      <span class="nav-search-input" style="color:var(--muted);font-size:.82rem;'
    'pointer-events:none">Search 484 tools…</span>\n'
    '    </a>'
)
nav_index = nav_orig.replace(OLD_SEARCH_DIV, NEW_SEARCH_LINK)
nav_index = nav_index.replace(
    '      <a href="#all-tools" class="nav-cta">Browse all tools</a>',
    '      <a href="tools.html" class="nav-cta">Browse all tools</a>'
)

# ── hero: index.html variant ─────────────────────────────────────────────────
hero_index = hero.replace(
    'href="#all-tools"', 'href="tools.html"'
).replace(
    '455+ browser-based tools', '484 browser-based tools'
).replace(
    '<div class="stat-n">455</div><div class="stat-l">Total Tools</div>',
    '<div class="stat-n">484</div><div class="stat-l">Total Tools</div>'
)

# ── footer variants ───────────────────────────────────────────────────────────
# Both pages: "All Tools" link in footer → tools.html
footer_tools = footer.replace(
    '<a href="index.html">All Tools</a>',
    '<a href="tools.html">All Tools</a>'
)
footer_index = footer_tools  # same change on index.html footer

# ── featured tools strip (static, 12 representative cards) ──────────────────
FEATURED_STRIP = """\
    <!-- FEATURED TOOLS -->
    <div id="featured-tools" style="margin:2rem 0 1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.25rem">
        <div>
          <div class="mcp-section-title">Featured Tools</div>
          <p style="font-size:.78rem;color:var(--body);margin-top:.25rem;max-width:480px">Representative picks from 31 categories — all client-side, zero PII.</p>
        </div>
        <a href="tools.html" id="browse-cta" style="display:inline-flex;align-items:center;gap:.5rem;background:var(--teal);color:#04141a;font-weight:600;font-size:.82rem;padding:.6rem 1.1rem;border-radius:var(--radius);transition:background .15s;text-decoration:none;white-space:nowrap" onmouseover="this.style.background='var(--teal-lt)'" onmouseout="this.style.background='var(--teal)'">Browse all 484 tools →</a>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.65rem">

        <a href="tools/01-a2a-fee-route-optimizer.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--teal);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderTopColor='var(--teal)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--teal)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:.3rem">Core Infrastructure · T1</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">A2A Fee Route Optimizer</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Model and compare fee structures across A2A payment corridors — instant vs ACH vs RTP vs FedNow.</p>
        </a>

        <a href="tools/04-fraud-score-simulator.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--red);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderTopColor='var(--red)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--red)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin-bottom:.3rem">Fraud &amp; Risk · T4</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">Fraud Score Simulator</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Simulate multi-signal fraud scoring across velocity, device, behavioural, and network risk dimensions.</p>
        </a>

        <a href="tools/03-consent-compliance-auditor.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--purple);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--purple)'" onmouseout="this.style.borderTopColor='var(--purple)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--purple)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--purple);margin-bottom:.3rem">Compliance · T3</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">Consent Compliance Auditor</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Audit open-banking consent flows against PSD2, GDPR, and CCPA — generate a structured gap report.</p>
        </a>

        <a href="tools/105-fx-netting-simulator.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--green);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderTopColor='var(--green)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--green)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--green);margin-bottom:.3rem">Treasury · T105</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">FX Netting Simulator</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Model multilateral FX netting savings across multi-currency treasury positions.</p>
        </a>

        <a href="tools/10-open-banking-api-explorer.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--teal);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderTopColor='var(--teal)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--teal)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:.3rem">Open Banking · T10</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">Open Banking API Explorer</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Explore PSD2/UK Open Banking API structures — scope mapping, data flows, and consent payloads.</p>
        </a>

        <a href="tools/152-baas-provider-comparator.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--purple);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--purple)'" onmouseout="this.style.borderTopColor='var(--purple)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--purple)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--purple);margin-bottom:.3rem">Embedded Finance · T152</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">BaaS Provider Comparator</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Score and compare BaaS providers across 10 capability dimensions with adjustable weighting.</p>
        </a>

        <a href="tools/100-dora-resilience-auditor.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--red);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderTopColor='var(--red)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--red)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin-bottom:.3rem">DORA &amp; Resilience · T100</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">DORA Resilience Auditor</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Audit ICT risk management, incident response, and third-party resilience against DORA Article 11–13.</p>
        </a>

        <a href="tools/109-cdd-edd-checklist.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--gold);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderTopColor='var(--gold)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--gold)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:.3rem">AML / KYC · T109</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">CDD / EDD Checklist</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Build a CDD/EDD checklist tailored to customer risk tier, entity type, and jurisdiction.</p>
        </a>

        <a href="tools/02-iso20022-builder.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--teal);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderTopColor='var(--teal)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--teal)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:.3rem">Core Infrastructure · T2</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">ISO 20022 Message Builder</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Compose and validate ISO 20022 payment messages — pacs.008, pacs.009, camt.054 with schema checks.</p>
        </a>

        <a href="tools/07-ach-nacha-validator.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--teal);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--teal)'" onmouseout="this.style.borderTopColor='var(--teal)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--teal)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:.3rem">Core Infrastructure · T7</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">ACH / NACHA Validator</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Validate ACH NACHA file format, SEC code rules, and ODFI/RDFI routing number checks.</p>
        </a>

        <a href="tools/102-ap2-payments-checker.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--gold);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderTopColor='var(--gold)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--gold)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:.3rem">Payment Scheme · T102</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">AP2 Payments Checker</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Validate AP2 agentic payment mandate payloads against the Unified Build Contract schema.</p>
        </a>

        <a href="tools/104-receivables-dso-optimizer.html" style="display:block;background:var(--bg-2);border:1px solid var(--border);border-top:2px solid var(--green);border-radius:var(--radius-lg);padding:1rem 1.1rem;transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderTopColor='var(--green)';this.style.borderColor='var(--border)';this.style.borderTopColor='var(--green)'">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:var(--green);margin-bottom:.3rem">Ops &amp; Monitoring · T104</div>
          <div style="font-family:'Sora',sans-serif;font-size:.85rem;font-weight:500;color:var(--white);margin-bottom:.3rem">Receivables DSO Optimizer</div>
          <p style="font-size:.72rem;color:var(--body);line-height:1.5;margin:0">Model DSO reduction scenarios — dynamic discounting, factoring, and payment term optimisation.</p>
        </a>

      </div>
    </div>
"""

# ── assemble tools.html ───────────────────────────────────────────────────────
tools_html = (
    tools_new_head +
    '<body>\n\n' +
    lang_bar +
    nav_orig +
    '\n\n' +
    attr_bar +
    '<!-- MAIN SHELL -->\n<div class="shell">\n\n' +
    sidebar +
    '\n  <!-- MAIN CONTENT -->\n  <main class="main">\n\n' +
    qj +
    resmeta +
    grids +
    '\n  </main>\n</div><!-- /shell -->\n' +
    footer_tools +
    filter_js_tools
)

# ── assemble index.html ───────────────────────────────────────────────────────
index_html = (
    head_index +
    '<body>\n\n' +
    lang_bar +
    nav_index +
    '\n\n' +
    attr_bar +
    '<!-- MAIN SHELL -->\n<div class="shell">\n\n' +
    '  <!-- MAIN CONTENT -->\n  <main class="main">\n\n' +
    hero_index +
    FEATURED_STRIP +
    '\n' +
    ocg_suite +
    '\n\n' +
    pol_demos +
    '\n' +
    scenarios +
    '\n' +
    devmcp +
    '\n  </main>\n</div><!-- /shell -->\n' +
    footer_index +
    '\n\n</body>\n</html>'
)

# ── write output ─────────────────────────────────────────────────────────────
print("Writing tools.html …")
spew('tools.html', tools_html)
print("Writing index.html …")
spew('index.html', index_html)
print("Done.")
