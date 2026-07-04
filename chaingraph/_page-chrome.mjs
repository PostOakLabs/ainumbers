/**
 * chaingraph/_page-chrome.mjs
 * Canonical nav + footer + CSS for all art-*.html node pages.
 * Derived verbatim from chaingraph-hub.html — single source of truth.
 * Both normalize-node-chrome.mjs and check-node-page-chrome.mjs import from here.
 */

/** Build the canonical nav for a node page. breadcrumbCurrent = "ART-NN · Title" */
export function buildNav(breadcrumbCurrent) {
  return `<nav>
  <div class="nav-inner">
    <a href="../index.html" class="logo">
      <svg width="28" height="28" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="AINumbers.co mark">
        <rect width="48" height="48" rx="9" fill="var(--bg-2)"/>
        <rect x="1" y="1" width="46" height="46" rx="8" fill="none" stroke="var(--border)" stroke-width="1"/>
        <rect x="9"  y="9"  width="8" height="8" rx="1.5" fill="var(--teal)" opacity="1"/>
        <rect x="20" y="9"  width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".45"/>
        <rect x="31" y="9"  width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".15"/>
        <rect x="9"  y="20" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".6"/>
        <rect x="20" y="20" width="8" height="8" rx="1.5" fill="var(--gold)" opacity=".9"/>
        <rect x="31" y="20" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".3"/>
        <rect x="9"  y="31" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".2"/>
        <rect x="20" y="31" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".35"/>
        <rect x="31" y="31" width="8" height="8" rx="1.5" fill="var(--teal)" opacity=".7"/>
      </svg>
      <div class="logo-name"><span class="logo-ai">AI</span>Numbers<span class="logo-co">.co</span></div>
    </a>
    <div class="nav-breadcrumb">
      <a href="../index.html">All Tools</a>
      <span>›</span>
      <a href="chaingraph-hub.html">OpenChainGraph Suite</a>
      <span>›</span>
      <span style="color:var(--gold)">${breadcrumbCurrent}</span>
    </div>
    <div class="nav-right">
      <a href="chaingraph.json" class="nav-pill" target="_blank">chaingraph.json</a>
      <a href="openchain-graph-spec.html" class="nav-pill">Spec v0.8.0 &#8594;</a>
      <a href="openchain-graph-paper.html" class="nav-pill">White Paper &#8594;</a>
      <a href="ain-bridge-explainer.html" class="nav-pill">AIN Bridge &#8594;</a>
      <a href="https://mcp.ainumbers.co/mcp" class="nav-cta" target="_blank">MCP Server &#8599;</a>
    </div>
  </div>
</nav>`;
}

/** Canonical footer — verbatim from chaingraph-hub.html */
export const FOOTER = `<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <span style="color:var(--teal)">AI</span>Numbers<span>.co</span> &middot; OpenChainGraph Suite
      <div class="footer-cc">&copy; 2024&ndash;2026 Post Oak Labs &middot; <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener" style="color:inherit">CC BY 4.0</a> &middot; Zero PII &middot; Client-side only</div>
    </div>
    <div class="footer-cols">
      <div class="footer-col">
        <div class="footer-col-label">Platform</div>
        <a href="openchain-graph-spec.html">Spec v0.8.0</a>
        <a href="openchain-graph-explainer.html">OCG Explainer</a>
        <a href="ain-bridge-explainer.html">AIN Bridge Explainer</a>
        <a href="ocg-sandbox.html">Sandbox</a>
        <a href="ocg-chain-builder.html">Chain Builder</a>
        <a href="ocg-legacy-vs-ocg.html">For Stakeholders</a>
        <a href="ocg-integration-guide.html">Integration Guide</a>
        <a href="ocg-guide-export.html">Export Profiles</a>
        <a href="ocg-industries.html">Industry Concepts</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Guides</div>
        <a href="guide-tempo.html">Tempo Network</a>
        <a href="guide-prov-dm.html">W3C PROV-DM</a>
        <a href="guide-buildtype.html">buildType / SLSA</a>
        <a href="guide-intoto.html">in-toto / DSSE</a>
        <a href="guide-ed25519.html">Ed25519 Signing</a>
        <a href="guide-otel.html">OpenTelemetry</a>
        <a href="guide-iso20022.html">ISO 20022 Profile</a>
        <a href="guide-okf.html">Open Knowledge Format</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Data &amp; Artifacts</div>
        <a href="chaingraph.json" target="_blank">chaingraph.json</a>
        <a href="okf/index.md" target="_blank">OKF bundle</a>
        <a href="../data/ap2-templates.json" target="_blank">ap2-templates.json</a>
        <a href="../llms.txt" target="_blank">llms.txt</a>
        <a href="../sitemap.html">Sitemap</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Network</div>
        <a href="../index.html">All Tools</a>
        <a href="../mcp.html">MCP Docs</a>
        <a href="https://mcp.ainumbers.co/mcp" target="_blank">MCP Server &#8599;</a>
        <a href="../about.html">About</a>
        <a href="https://postoaklabs.com" target="_blank" rel="noopener">PostOakLabs.com &#8599;</a>
      </div>
    </div>
  </div>
</footer>`;

/** Unique marker injected into <style> — used by both normalizer and gate to detect presence */
export const CSS_MARKER = '/* OCG-CHROME-CSS:v1 */';

/** CSS classes required by canonical nav + footer (appended to page's <style>) */
export const CHROME_CSS = `
${CSS_MARKER}
/* Canonical nav — derived from chaingraph-hub.html */
nav{position:sticky;top:0;z-index:100;background:rgba(8,14,26,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-inner{max-width:1440px;margin:0 auto;display:flex;align-items:center;gap:16px;padding:0 24px;height:58px}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.logo-name{font-family:'JetBrains Mono',monospace;font-size:.95rem;font-weight:500;color:var(--bright);letter-spacing:-.02em;line-height:1}
.logo-ai{color:var(--teal)}
.logo-co{color:var(--muted);font-size:.8rem}
.nav-breadcrumb{font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--muted);display:flex;align-items:center;gap:6px}
.nav-breadcrumb a{color:var(--body);transition:color .15s}
.nav-breadcrumb a:hover{color:var(--teal)}
.nav-right{display:flex;align-items:center;gap:10px;margin-left:auto;flex-shrink:0}
.nav-pill{background:none;border:1px solid var(--border-2);border-radius:var(--radius);color:var(--body);font-size:.65rem;padding:.3rem .75rem;font-family:'JetBrains Mono',monospace;letter-spacing:.04em;transition:border-color .15s,color .15s;display:inline-block}
.nav-pill:hover{border-color:var(--text);color:var(--text)}
.nav-cta{background:var(--gold);color:#080E1A;border:none;border-radius:var(--radius);font-size:.65rem;font-family:'JetBrains Mono',monospace;font-weight:600;letter-spacing:.06em;padding:.35rem .85rem;display:inline-block;transition:opacity .15s}
.nav-cta:hover{opacity:.85}
@media(max-width:768px){.nav-pill{display:none}}
/* Canonical footer — derived from chaingraph-hub.html */
footer{border-top:1px solid var(--border);background:var(--bg-2);padding:24px 0}
.footer-inner{max-width:1440px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.footer-brand{font-family:'JetBrains Mono',monospace;font-size:.85rem;font-weight:500;color:var(--bright)}
.footer-brand span{color:var(--muted)}
.footer-cc{font-size:.65rem;color:var(--muted);margin-top:4px}
.footer-cols{display:grid;grid-template-columns:repeat(4,auto);gap:2rem 2.5rem}
@media(max-width:700px){.footer-cols{grid-template-columns:repeat(2,1fr)}}
.footer-col-label{font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.55rem}
.footer-col a{display:block;font-size:.68rem;color:var(--body);margin-bottom:.3rem;transition:color .12s}
.footer-col a:hover{color:var(--teal)}
`;

/**
 * Structural tokens the gate checks for in each page's nav.
 * These are substrings that MUST appear in the <nav> block.
 */
export const NAV_REQUIRED_TOKENS = [
  'class="nav-inner"',
  'class="nav-breadcrumb"',
  'All Tools',
  'OpenChainGraph Suite',
  'class="nav-right"',
  'class="nav-cta"',
  'mcp.ainumbers.co/mcp',
];

/**
 * Structural tokens the gate checks for in each page's footer.
 * These are substrings that MUST appear in the <footer> block.
 */
export const FOOTER_REQUIRED_TOKENS = [
  'class="footer-inner"',
  'class="footer-brand"',
  'class="footer-cols"',
  'class="footer-col"',
  'OpenChainGraph Suite',
];
