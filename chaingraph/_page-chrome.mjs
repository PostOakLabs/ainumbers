/**
 * chaingraph/_page-chrome.mjs
 * Canonical nav + footer + CSS for all art-*.html node pages.
 * Derived verbatim from chaingraph-hub.html — single source of truth.
 * Both normalize-node-chrome.mjs and check-node-page-chrome.mjs import from here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
/** Canonical OCG spec version, derived from chaingraph.json (the version-of-record) — never hardcode this. */
export const SPEC_VERSION = JSON.parse(readFileSync(join(__dir, 'chaingraph.json'), 'utf-8')).spec_version;

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
      <a href="chaingraph-hub.html" class="nav-pill">ChainGraph Hub</a>
      <a href="../start.html" class="nav-cta">Start</a>
    </div>
  </div>
</nav>`;
}

/**
 * Canonical 4-column footer — single source of truth for node pages AND root pages.
 * Path-parameterized so the same template serves both depths:
 *   root = prefix to reach the repo root  (node pages: '../'          root pages: '')
 *   cg   = prefix to reach chaingraph/ dir (node pages: ''            root pages: 'chaingraph/')
 * The DATA & ARTIFACTS column folds in the full machine-artifact surface
 * (openapi.json, .well-known/mcp.json, mcp/server.json, mcp/catalog.json, sitemap.xml,
 * robots.txt, SPEC.md) so the agent-facing links live in one column, not a separate row.
 * Copyright line: license/promise trio only (no year, no company name).
 */
export function buildFooter({ root = '../', cg = '' } = {}) {
  return `<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="footer-brand-mark">
        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="AINumbers.co mark">
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
        <span style="color:var(--teal)">AI</span>Numbers<span>.co</span> &middot; OpenChainGraph Suite
      </div>
      <div class="footer-cc"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener" style="color:inherit">CC BY 4.0</a> &middot; Zero PII &middot; Client-side only</div>
    </div>
    <div class="footer-cols">
      <div class="footer-col">
        <div class="footer-col-label">Platform</div>
        <a href="${cg}chaingraph-hub.html">ChainGraph Hub</a>
        <a href="${cg}rfp-evidence-desk.html">RFP Evidence Desk</a>
        <a href="${cg}openchain-graph-spec.html">Spec v${SPEC_VERSION}</a>
        <a href="${cg}openchain-graph-explainer.html">OCG Explainer</a>
        <a href="${cg}ain-bridge-explainer.html">AIN Bridge Explainer</a>
        <a href="${cg}aiact-article12-record-keeping-mapping.html">AI Act Art 12 Mapping</a>
        <a href="${cg}ocg-sandbox.html">Sandbox</a>
        <a href="${cg}ocg-chain-builder.html">Chain Builder</a>
        <a href="${cg}ocg-legacy-vs-ocg.html">For Stakeholders</a>
        <a href="${cg}ocg-integration-guide.html">Integration Guide</a>
        <a href="${cg}ocg-guide-export.html">Export Profiles</a>
        <a href="${cg}ocg-industries.html">Industry Concepts</a>
        <a href="${root}helm.html">Helm (Phase 1)</a>
        <a href="${root}convert.html">Conversion Suite</a>
        <a href="${root}guides/agreement-standards-directory.html">Agreement Standards</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Guides</div>
        <a href="${cg}guide-avalanche.html">Avalanche L1 / Evergreen</a>
        <a href="${cg}guide-tempo.html">Tempo Network</a>
        <a href="${cg}guide-prov-dm.html">W3C PROV-DM</a>
        <a href="${cg}guide-buildtype.html">buildType / SLSA</a>
        <a href="${cg}guide-intoto.html">in-toto / DSSE</a>
        <a href="${cg}guide-ed25519.html">Ed25519 Signing</a>
        <a href="${cg}guide-otel.html">OpenTelemetry</a>
        <a href="${cg}guide-iso20022.html">ISO 20022 Profile</a>
        <a href="${cg}guide-okf.html">Open Knowledge Format</a>
        <a href="${root}guides/formal-verification-evidence.html">Formal-Verification Evidence</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Data &amp; Artifacts</div>
        <a href="${cg}chaingraph.json" target="_blank">chaingraph.json</a>
        <a href="${cg}okf/index.md" target="_blank">OKF bundle</a>
        <a href="${root}data/ap2-templates.json" target="_blank">ap2-templates.json</a>
        <a href="${root}openapi.json" target="_blank">openapi.json</a>
        <a href="${root}llms.txt" target="_blank">llms.txt</a>
        <a href="${root}.well-known/mcp.json" target="_blank">.well-known/mcp.json</a>
        <a href="${root}mcp/server.json" target="_blank">mcp/server.json</a>
        <a href="${root}mcp/catalog.json" target="_blank">mcp/catalog.json</a>
        <a href="${cg}standard/SPEC.md" target="_blank">OCG SPEC.md</a>
        <a href="${root}sitemap.xml" target="_blank">sitemap.xml</a>
        <a href="${root}robots.txt" target="_blank">robots.txt</a>
        <a href="${root}sitemap.html">Sitemap</a>
        <a href="${root}euc-register.html">EUC Register</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-label">Network</div>
        <a href="${root}tools.html">All Tools</a>
        <a href="${root}mcp.html">MCP Docs</a>
        <a href="https://mcp.ainumbers.co/mcp" target="_blank">MCP Server &#8599;</a>
        <a href="https://github.com/PostOakLabs/ainumbers-mcp-apps" target="_blank" rel="noopener">MCP Repo &#8599;</a>
        <a href="${root}about.html">About</a>
        <a href="${root}methods.html">Methods</a>
        <a href="${root}fv-explainer.html">FV Process Explainer</a>
        <a href="${root}suggest.html">Suggest</a>
        <a href="${root}contact.html">Contact</a>
        <a href="${root}security.html">Security</a>
        <a href="${root}disclosures/terms.html">Terms &amp; Reliance</a>
        <a href="https://postoaklabs.com" target="_blank" rel="noopener">PostOakLabs.com &#8599;</a>
      </div>
    </div>
  </div>
</footer>`;
}

/** Node-page footer (depth: chaingraph/art-*.html) — the default consumers import this. */
export const FOOTER = buildFooter({ root: '../', cg: '' });

/** Root-page footer (depth: repo root, e.g. index.html / start.html). */
export const ROOT_FOOTER = buildFooter({ root: '', cg: 'chaingraph/' });

/** Unique marker injected into <style> — used by both normalizer and gate to detect presence */
export const CSS_MARKER = '/* OCG-CHROME-CSS:v1 */';

/** CSS classes required by canonical nav + footer (appended to page's <style>) */
export const CHROME_CSS = `
${CSS_MARKER}
/* Canonical nav — derived from chaingraph-hub.html */
nav{position:sticky;top:0;z-index:100;background:rgba(8,14,26,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-inner{max-width:1440px;margin:0 auto;display:flex;align-items:center;gap:16px;padding:0 24px;height:58px}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none;color:inherit}
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
.footer-brand-mark{display:flex;align-items:center;gap:8px}
.footer-brand span{color:var(--muted)}
.footer-cc{font-size:.65rem;color:var(--muted);margin-top:4px}
.footer-cols{display:grid;grid-template-columns:repeat(4,auto);gap:2rem 2.5rem}
@media(max-width:700px){.footer-cols{grid-template-columns:repeat(2,1fr)}}
.footer-col{display:flex;flex-direction:column}
.footer-col-label{font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.55rem}
.footer-col a{display:block;font-size:.68rem;color:var(--body);margin-bottom:.3rem;transition:color .12s}
.footer-col a:hover{color:var(--teal)}
.related-topics{max-width:900px;margin:0 auto}
`;

/**
 * Pages excluded from normalize-node-chrome.mjs and check-node-page-chrome.mjs,
 * each with a reason (GUIDE-CHROME-AUDIT-1, 2026-08-17).
 */
export const CHROME_EXEMPT = new Map([
  ['chaingraph-hub.html', 'SSOT source page for the nav/footer template; is its own "you are here" — cannot self-link'],
  ['ocg-verify-badge-demo.html', 'deliberately chromeless embed-fixture/demo page (no <nav> in source); suite chrome would defeat the embed demo'],
  ['checklist-definition-builder.html', 'one of a 4-page interlinked cluster (with checklist-fixtures/checklist-run-executor/checklist-run-verifier) whose bespoke nav/footer cross-links ARE its only nav-reachability path (check-nav-reachability.mjs) — canonical chrome has no "Checklist tools" footer column, and only 2 of the 4 (run-executor, run-verifier) have an external inbound link (guides/exchange-assurance-hub.html). Normalizing any subset of the cluster orphans the rest; normalizing all 4 orphans checklist-definition-builder.html and checklist-fixtures.html outright. Needs a hub link to those two (or a footer column) before any of the 4 can join canonical chrome.'],
  ['checklist-fixtures.html', 'same 4-page cluster reachability gap as checklist-definition-builder.html — see that entry.'],
  ['checklist-run-executor.html', 'same 4-page cluster reachability gap as checklist-definition-builder.html — see that entry; this page itself has an external inbound link, but keeping it canonical while the other 2 stay bespoke would still remove their only reachability path.'],
  ['checklist-run-verifier.html', 'same 4-page cluster reachability gap as checklist-definition-builder.html — see that entry; this page itself has an external inbound link, but keeping it canonical while the other 2 stay bespoke would still remove their only reachability path.'],
  ['clause-edge-report.html', 'fully generated by scripts/gen-clause-edge-report-page.mjs (its own render() emits the page\'s bespoke nav/footer/CSS) — a direct chrome-region edit to the output file desyncs it from the generator and fails its own freshness gate (gen-clause-edge-report-page --check) on every future regen. Needs the generator\'s template updated to emit canonical chrome, not a normalizer edit to its output. Held for a follow-up row.'],
  ['kernel-vm.html', 'fully generated by chaingraph/vm/scripts/gen-kernel-vm-html.mjs — same generator-desync failure mode as clause-edge-report.html (chaingraph/vm/scripts/gen-kernel-vm-html.mjs --check goes red on a direct chrome-region edit). Needs the generator\'s template updated, not a normalizer edit to its output. Held for a follow-up row.'],
  ['kernel-vm-explainer.html', 'a SHARED DERIVED ARTIFACT under SO #35 — single writer is derived-artifacts-regen.yml on main, never a PR. Same generator-desync failure mode as clause-edge-report.html/kernel-vm.html (chaingraph/vm/scripts/gen-kernel-vm-explainer.mjs owns its nav/footer/CSS), plus the SO #35 single-writer rule means a PR must not touch this file directly at all. Needs the generator\'s template updated on main, never in a PR. Held for a follow-up row.'],
]);

/** Marker for the root-page footer CSS block (injected by gen-root-chrome.mjs). */
export const ROOT_FOOTER_CSS_MARKER = '/* OCG-ROOT-FOOTER-CSS:v1 */';

/**
 * Footer-only CSS for root-level pages (index.html, start.html).
 * Same classes as the node-page chrome footer; root pages carry their own nav CSS,
 * so only the footer subset is injected here.
 */
export const ROOT_FOOTER_CSS = `${ROOT_FOOTER_CSS_MARKER}
footer{border-top:1px solid var(--border);background:var(--bg-2);padding:24px 0}
.footer-inner{max-width:1440px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.footer-brand{font-family:'JetBrains Mono',monospace;font-size:.85rem;font-weight:500;color:var(--bright)}
.footer-brand-mark{display:flex;align-items:center;gap:8px}
.footer-brand span{color:var(--muted)}
.footer-cc{font-size:.65rem;color:var(--muted);margin-top:4px}
.footer-cols{display:grid;grid-template-columns:repeat(4,auto);gap:2rem 2.5rem}
@media(max-width:700px){.footer-cols{grid-template-columns:repeat(2,1fr)}}
.footer-col{display:flex;flex-direction:column}
.footer-col-label{font-family:'JetBrains Mono',monospace;font-size:.44rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.55rem}
.footer-col a{display:block;font-size:.68rem;color:var(--body);margin-bottom:.3rem;transition:color .12s}
.footer-col a:hover{color:var(--teal)}
.related-topics{max-width:900px;margin:0 auto}`;

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
  'class="nav-pill"',
  'chaingraph-hub.html',
  'class="nav-cta"',
  '../start.html',
];

/**
 * Structural tokens the gate checks for in each page's footer.
 * These are substrings that MUST appear in the <footer> block.
 */
export const FOOTER_REQUIRED_TOKENS = [
  'class="footer-inner"',
  'class="footer-brand"',
  'class="footer-brand-mark"',
  'class="footer-cols"',
  'class="footer-col"',
  'OpenChainGraph Suite',
];
