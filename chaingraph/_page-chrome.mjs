/**
 * chaingraph/_page-chrome.mjs
 * Canonical nav + footer + CSS for all art-*.html node pages.
 * Derived verbatim from chaingraph-hub.html — single source of truth.
 * Both normalize-node-chrome.mjs and check-node-page-chrome.mjs import from here.
 */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
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
        <a href="${root}guides/webmcp-field-notes.html">WebMCP Field Notes</a>
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
        <a href="${root}errata.html">FV Errata</a>
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

/* ═══════════════════════════════════════════════════════════════════════
 * OCG-DEEPLINK v1 — fragment-only prefill-and-run deep links.
 * Contract: AGENT-REACH-BUILD-SPEC.md §3.1 (row TOOLPAGE-DEEPLINK-1).
 *   Fragment shape:  #p=v1.<base64url(gzip(JSON policy_parameters))>[&run=1]
 * Fragment-only by construction: the payload never reaches a server, a log,
 * or a query string — the zero-egress property holds with no enforcement.
 * Emitted into WebMCP-registered node pages by scripts/gen-webmcp-registrations.mjs
 * (single writer, SO #35); the bytes below are the single source of truth.
 * The size cap and error surface mirror the ledger: over-cap shows the PII
 * banner sentence + "payload too large" and never truncates or executes.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Marker injected with the emitted <script> block — the generator's freshness
 *  check and check-deeplink-contract.mjs detect presence by this string. */
export const DEEPLINK_MARKER = '/* OCG-DEEPLINK v1 */';

/** Compressed-fragment budget — same constant as the ledger's FRAGMENT_BUDGET_BYTES (ledger/index.html:435). */
export const DEEPLINK_BUDGET_BYTES = 30_000;

/**
 * Build the inline <script> body for one node page. PURE: same inputs, same bytes.
 *   prefillTable: JSON string of { manifest_property: [element_id, via], … } —
 *     the page's slice of the generator's authored propertyIdMap (WEBMCP-GEN-IDMAP-1),
 *     plus the literal-id default, via ∈ string|json|checked|boolstring (same
 *     semantics as the emitted execute() mapping lines). The reader additionally
 *     JSON-stringifies non-primitive values bound via 'string', so an object-valued
 *     parameter always lands in its control as parseable JSON text.
 *   runTarget: the page-verified zero-arg wrapper (G3b) — same target execute() awaits.
 * The codec functions (b64uDec/gunzip) are copied VERBATIM from ledger/index.html
 * lines 812-857 (the "#a=v1." FRAGMENT CODEC), per the row's copy-don't-rederive
 * order; only decodeFragment's prefix changes (#a= → #p=) and decode-only halves
 * are carried (b64uEnc/encodeArtifactFragment stay ledger-side).
 */
export function buildDeeplinkScript(prefillTable, runTarget) {
  return `${DEEPLINK_MARKER}
/* Fragment-only prefill-and-run deep link: #p=v1.<b64url(gzip(JSON policy_parameters))>[&run=1]
   Contract: AGENT-REACH-BUILD-SPEC.md section 3.1 (TOOLPAGE-DEEPLINK-1). Zero egress
   by construction — a URL fragment is never sent to any server. Codec copied verbatim
   from ledger/index.html lines 812-857 (gzip/gunzip/b64uEnc/b64uDec). DO NOT
   hand-edit; emitted by scripts/gen-webmcp-registrations.mjs from chaingraph/_page-chrome.mjs. */
(function () {
  'use strict';
  var BUDGET = ${DEEPLINK_BUDGET_BYTES};
  var RUN_TARGET = ${JSON.stringify(runTarget)};
  var PREFILL = ${prefillTable};
  var PII_BANNER = 'All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';

  function b64uDec(s) {
    const p = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - p.length % 4) % 4;
    const b64 = p + '='.repeat(pad);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function gunzip(bytes) {
    const cs = new DecompressionStream('gzip');
    const w = cs.writable.getWriter();
    w.write(bytes); w.close();
    const chunks = [];
    const reader = cs.readable.getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return new TextDecoder().decode(out);
  }

  function fail(msg) {
    try {
      var el = document.createElement('div');
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;border:2px solid #b45309;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:.72rem;background:#1a1206;color:#f4e8d4;max-height:40vh;overflow:auto';
      el.textContent = PII_BANNER + ' Deep link rejected: ' + msg + ' Nothing was truncated, prefilled, or executed.';
      document.body.appendChild(el);
      if (typeof console !== 'undefined' && console.warn) console.warn('[deeplink]', msg);
    } catch (e) { /* never let the banner path throw */ }
  }

  function typeOk(v, t) {
    switch (t) {
      case 'string': return typeof v === 'string';
      case 'number': return typeof v === 'number' && Number.isFinite(v);
      case 'boolean': return typeof v === 'boolean';
      case 'array': return Array.isArray(v);
      case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
      default: return true; /* 'unknown' or undeclared — value-shape handled at prefill */
    }
  }

  async function run() {
    var done;
    window.__ocgDeeplinkDone = new Promise(function (res) { done = res; });
    try {
      if (!location.hash || location.hash.indexOf('#p=v1.') !== 0) return;
      var parts = location.hash.slice(1).split('&');
      var payload = null, doRun = false;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf('p=v1.') === 0) payload = parts[i].slice(5);
        else if (parts[i] === 'run=1') doRun = true;
      }
      if (!payload) return;
      var compressed;
      try { compressed = b64uDec(payload); }
      catch (e) { fail('payload is not valid base64url'); return; }
      if (compressed.length > BUDGET) { fail('payload too large (' + compressed.length + ' bytes compressed; cap is ' + BUDGET + ')'); return; }
      var json;
      try { json = await gunzip(compressed); }
      catch (e) { fail('payload failed gzip decompression'); return; }
      var params;
      try { params = JSON.parse(json); }
      catch (e) { fail('payload is not valid JSON'); return; }
      if (!params || typeof params !== 'object' || Array.isArray(params)) { fail('payload must be a JSON object of policy_parameters'); return; }
      var schema = (typeof MANIFEST !== 'undefined' && MANIFEST.mcp_tool_definition && MANIFEST.mcp_tool_definition.inputSchema) || null;
      if (schema) {
        var required = Array.isArray(schema.required) ? schema.required : [];
        for (var r = 0; r < required.length; r++) {
          if (!(required[r] in params)) { fail('missing required parameter "' + required[r] + '"'); return; }
        }
        var props = schema.properties || {};
        for (var name in params) {
          if (!(name in props)) { fail('unknown parameter "' + name + '" is not declared in the tool inputSchema'); return; }
          var t = props[name] && props[name].type;
          /* A declared 'string' carrying a JSON object/array is prefilled as JSON
             text — several pages' controls are JSON-text areas whose kernels read
             the parsed value, so serializing is the faithful binding. Hard type
             mismatches that cannot be serialized faithfully still reject. */
          if ((t === 'number' || t === 'boolean') && !typeOk(params[name], t)) { fail('parameter "' + name + '" does not match the declared type "' + t + '"'); return; }
          if ((t === 'object' || t === 'array') && params[name] !== null && typeof params[name] !== 'object') { fail('parameter "' + name + '" must be a JSON ' + t); return; }
        }
      }
      var prefilled = 0, paramCount = 0;
      for (var prop in PREFILL) {
        if (!(prop in params)) continue;
        paramCount++;
        var ent = PREFILL[prop];
        var el = document.getElementById(ent[0]);
        if (!el) continue;
        var v = params[prop];
        if (ent[1] === 'checked') el.checked = (v === true);
        else if (ent[1] === 'boolstring') el.value = String(v === true);
        else if (ent[1] === 'json' || (v !== null && typeof v === 'object')) el.value = JSON.stringify(v);
        else el.value = String(v);
        prefilled++;
      }
      /* A parameter-free tool (empty policy_parameters) is legitimate — prefill
         is a no-op and run=1 still executes the declared compute. */
      if (prefilled === 0 && paramCount > 0) { fail('no form control matched any parameter'); return; }
      if (!doRun) return;
      var fn = null;
      try { fn = (typeof MANIFEST !== 'undefined' && MANIFEST.execution && MANIFEST.execution.function_name) || null; } catch (e) {}
      var target = (fn && typeof window[fn] === 'function') ? fn : (typeof window[RUN_TARGET] === 'function' ? RUN_TARGET : null);
      if (!target) { fail('execution function not found on page'); return; }
      await window[target]();
      /* Expose the produced artifact on window for programmatic consumers (the
         deep-link contract gate). _lastArtifact/_lastResult are page globals —
         top-level let/const bindings are visible here lexically but not as
         window properties, so re-read them by name. */
      try {
        if (typeof _lastArtifact !== 'undefined') window.__ocgDeeplinkArtifact = _lastArtifact;
        else if (typeof _lastResult !== 'undefined') window.__ocgDeeplinkArtifact = _lastResult;
      } catch (e2) { /* pages without either global simply expose nothing */ }
    } catch (e) {
      fail('execution failed: ' + ((e && e.message) || e));
    } finally {
      done();
    }
  }

  window.__ocgDeeplinkRun = run;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { run(); });
  else run();
})();`;
}

/* ═══════════════════════════════════════════════════════════════════════
 * OCG-FILE-IMPORT v1 — drag-drop / file-picker import, zero upload.
 * Contract: AGENT-REACH-BUILD-SPEC.md §2 wave 1 (row TOOLPAGE-FILE-IMPORT-1).
 *   Accepted: .json parsed as a policy_parameters object (validated against
 *   the manifest inputSchema exactly like the deep-link reader, prefilled via
 *   the same mapping table) and .csv (ONLY when the schema declares exactly
 *   one array-of-objects input; header row supplies the keys, values stay
 *   strings). Bytes stay in memory; nothing is stored, nothing is uploaded.
 * Picker detection order copied from GoogleChromeLabs/browser-fs-access
 * (MIT) README as of main commit 686165d55fc159dae80ef95dc2a70472923aeccd:
 *   1. window.showOpenFilePicker (File System Access API) when present;
 *   2. else a transient <input type="file"> fallback. Drop path:
 *   DataTransferItem.getAsFileSystemHandle() when present, else getAsFile().
 * Emitted into WebMCP-registered node pages by scripts/gen-webmcp-registrations.mjs
 * (single writer, SO #35), in the same marked region as the deep-link reader.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Marker injected with the emitted <script> block — the generator's freshness
 *  check and check-deeplink-contract.mjs's file-import case detect presence by this string. */
export const FILE_IMPORT_MARKER = '/* OCG-FILE-IMPORT v1 */';

/** In-memory cap for an imported file's TEXT length. No storage, no upload —
 *  this only keeps a stray huge drop from wedging the tab. */
export const FILE_IMPORT_MAX_BYTES = 1_000_000;

/**
 * Build the inline <script> body for one node page. PURE: same inputs, same bytes.
 *   prefillTable / runTarget: identical semantics to buildDeeplinkScript — one
 *     mapping table, one verified zero-arg wrapper; import is a third doorway
 *     onto the SAME computation (fragment deep link, WebMCP execute(), file).
 */
export function buildFileImportScript(prefillTable, runTarget) {
  return `${FILE_IMPORT_MARKER}
/* Drag-drop / file-picker import of policy inputs, zero upload: .json is
   parsed as policy_parameters and validated against the manifest inputSchema;
   .csv is accepted only when the schema declares exactly one array-of-objects
   input. Bytes stay in memory — no storage, no network. Picker detection
   order per GoogleChromeLabs/browser-fs-access (MIT) README as of main
   commit 686165d55fc159dae80ef95dc2a70472923aeccd. DO NOT hand-edit; emitted
   by scripts/gen-webmcp-registrations.mjs from chaingraph/_page-chrome.mjs. */
(function () {
  'use strict';
  var MAX = ${FILE_IMPORT_MAX_BYTES};
  var RUN_TARGET = ${JSON.stringify(runTarget)};
  var PREFILL = ${prefillTable};
  var PII_BANNER = 'All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';

  function fail(msg) {
    try {
      var el = document.createElement('div');
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;border:2px solid #b45309;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:.72rem;background:#1a1206;color:#f4e8d4;max-height:40vh;overflow:auto';
      el.textContent = PII_BANNER + ' File import rejected: ' + msg + ' Nothing was truncated, prefilled, or executed.';
      document.body.appendChild(el);
      if (typeof console !== 'undefined' && console.warn) console.warn('[file-import]', msg);
    } catch (e) { /* never let the banner path throw */ }
  }

  /* Minimal RFC 4180 CSV reader: quoted fields, escaped quotes, CRLF/CR/LF. */
  function csvParse(text) {
    var rows = [[]], field = '', inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { rows[rows.length - 1].push(field); field = ''; }
      else if (c === '\\n' || c === '\\r') {
        if (c === '\\r' && text[i + 1] === '\\n') i++;
        rows[rows.length - 1].push(field); field = '';
        rows.push([]);
      } else field += c;
    }
    rows[rows.length - 1].push(field);
    while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    return rows;
  }

  function typeOk(v, t) {
    switch (t) {
      case 'string': return typeof v === 'string';
      case 'number': return typeof v === 'number' && Number.isFinite(v);
      case 'boolean': return typeof v === 'boolean';
      case 'array': return Array.isArray(v);
      case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
      default: return true;
    }
  }

  function schema() {
    return (typeof MANIFEST !== 'undefined' && MANIFEST.mcp_tool_definition && MANIFEST.mcp_tool_definition.inputSchema) || null;
  }

  /* Same validation + binding semantics as the deep-link reader: required
     members, faithful type checks, PREFILL-table mapping ('string'|'json'|
     'checked'|'boolstring'; object values bound via 'string' are JSON-
     stringified). Returns the number of controls actually prefilled. */
  function validateAndPrefill(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('payload must be a JSON object of policy_parameters');
    var s = schema();
    if (s) {
      var required = Array.isArray(s.required) ? s.required : [];
      for (var r = 0; r < required.length; r++) {
        if (!(required[r] in params)) throw new Error('missing required parameter "' + required[r] + '"');
      }
      var props = s.properties || {};
      for (var name in params) {
        if (!(name in props)) throw new Error('unknown parameter "' + name + '" is not declared in the tool inputSchema');
        var t = props[name] && props[name].type;
        if ((t === 'number' || t === 'boolean') && !typeOk(params[name], t)) throw new Error('parameter "' + name + '" does not match the declared type "' + t + '"');
        if ((t === 'object' || t === 'array') && params[name] !== null && typeof params[name] !== 'object') throw new Error('parameter "' + name + '" must be a JSON ' + t);
      }
    }
    var prefilled = 0, paramCount = 0;
    for (var prop in PREFILL) {
      if (!(prop in params)) continue;
      paramCount++;
      var ent = PREFILL[prop];
      var el = document.getElementById(ent[0]);
      if (!el) continue;
      var v = params[prop];
      if (ent[1] === 'checked') el.checked = (v === true);
      else if (ent[1] === 'boolstring') el.value = String(v === true);
      else if (ent[1] === 'json' || (v !== null && typeof v === 'object')) el.value = JSON.stringify(v);
      else el.value = String(v);
      prefilled++;
    }
    if (prefilled === 0 && paramCount > 0) throw new Error('no form control matched any parameter');
    return prefilled;
  }

  /* The schema's single array-of-objects input, or null when the count is not exactly one. */
  function singleArrayObjectProp() {
    var s = schema();
    if (!s || !s.properties) return null;
    var hit = null, n = 0;
    for (var name in s.properties) {
      var p = s.properties[name];
      if (p && p.type === 'array' && p.items && p.items.type === 'object') { hit = name; n++; }
    }
    return n === 1 ? hit : null;
  }

  function runCompute() {
    var fn = null;
    try { fn = (typeof MANIFEST !== 'undefined' && MANIFEST.execution && MANIFEST.execution.function_name) || null; } catch (e) {}
    var target = (fn && typeof window[fn] === 'function') ? fn : (typeof window[RUN_TARGET] === 'function' ? RUN_TARGET : null);
    if (!target) throw new Error('execution function not found on page');
    return window.__ocgComputeGate = window.__ocgComputeGate.then(function () { return window[target](); });
  }

  function capture() {
    try {
      if (typeof _lastArtifact !== 'undefined') window.__ocgDeeplinkArtifact = _lastArtifact;
      else if (typeof _lastResult !== 'undefined') window.__ocgDeeplinkArtifact = _lastResult;
    } catch (e2) { /* pages without either global simply expose nothing */ }
  }

  /* files: [{ name, text }] — the harness and both UI paths (picker, drop) feed the same entry point. */
  async function importFiles(files) {
    try {
      if (!files || !files.length || !files[0] || typeof files[0].name !== 'string') return { ok: false, error: 'no file handed to the page' };
      var f = files[0];
      var text = typeof f.text === 'string' ? f.text : await f.text();
      if (text.length > MAX) { fail('file too large (' + text.length + ' characters; cap is ' + MAX + ')'); return { ok: false, error: 'file too large' }; }
      var lower = f.name.toLowerCase(), params, prop, rows, header, r, row, c;
      if (lower.endsWith('.json')) {
        try { params = JSON.parse(text); }
        catch (e) { fail('file is not valid JSON'); return { ok: false, error: 'invalid JSON' }; }
        if (params && typeof params === 'object' && !Array.isArray(params)
          && Object.keys(params).length === 1 && params.policy_parameters
          && typeof params.policy_parameters === 'object' && !Array.isArray(params.policy_parameters)) {
          params = params.policy_parameters; /* accept the {policy_parameters:{…}} wrapper too */
        }
      } else if (lower.endsWith('.csv')) {
        prop = singleArrayObjectProp();
        if (!prop) { fail('.csv is accepted only when the tool declares exactly one array-of-objects input'); return { ok: false, error: 'no single array-of-objects input' }; }
        rows = csvParse(text);
        if (rows.length < 2) { fail('.csv needs a header row and at least one data row'); return { ok: false, error: 'csv missing data rows' }; }
        header = rows[0];
        params = {};
        params[prop] = [];
        for (r = 1; r < rows.length; r++) {
          row = {};
          for (c = 0; c < header.length; c++) row[header[c]] = rows[r][c] === undefined ? '' : rows[r][c];
          params[prop].push(row);
        }
      } else {
        fail('unsupported file type — named .json or .csv files are accepted');
        return { ok: false, error: 'unsupported extension' };
      }
      var prefilled;
      try { prefilled = validateAndPrefill(params); }
      catch (e) { fail(e.message); return { ok: false, error: e.message }; }
      try { await runCompute(); capture(); } catch (e3) { fail('execution failed: ' + ((e3 && e3.message) || e3)); return { ok: false, error: 'execution failed' }; }
      return { ok: true, prefilled: prefilled, artifact: window.__ocgDeeplinkArtifact || null };
    } catch (e) {
      fail('import failed: ' + ((e && e.message) || e));
      return { ok: false, error: 'import failed' };
    }
  }

  window.__ocgFileImport = importFiles;
  /* Serialize computes so a second drop cannot interleave with a running one. */
  window.__ocgComputeGate = (typeof window.__ocgComputeGate !== 'undefined') ? window.__ocgComputeGate : Promise.resolve();

  /* ── UI: a "Load file" control + a whole-page drop zone ─────────────────── */
  function handleFiles(fileList) {
    var files = [];
    var pending = 0, left = fileList.length;
    if (!left) return;
    var step = function (f) {
      if (f && typeof f.text === 'function') return f.text().then(function (t) { return { name: f.name, text: t }; });
      return Promise.resolve({ name: f.name, text: String(f.text || '') });
    };
    for (var i = 0; i < fileList.length; i++) {
      (function (f) {
        pending++;
        step(f).then(function (rec) { files.push(rec); })
          .catch(function () { /* unreadable file: skip it */ })
          .then(function () { if (--pending === 0) importFiles(files); });
      })(fileList[i]);
    }
  }

  /* Detection order (browser-fs-access README, commit 686165d5): the File
     System Access picker when the browser has it, else <input type=file>. */
  function pickAndImport() {
    if (typeof window.showOpenFilePicker === 'function') {
      window.showOpenFilePicker({ multiple: false, types: [{ description: 'Policy inputs', accept: { 'application/json': ['.json'], 'text/csv': ['.csv'] } }] })
        .then(function (handles) { return handles[0].getFile(); })
        .then(function (file) { handleFiles([file]); })
        .catch(function (e) { if (e && e.name !== 'AbortError') fail('picker failed: ' + e.message); });
    } else {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.csv';
      input.style.display = 'none';
      input.addEventListener('change', function () {
        var list = input.files || [];
        var arr = []; for (var i = 0; i < list.length; i++) arr.push(list[i]);
        handleFiles(arr);
      });
      document.body.appendChild(input);
      input.click();
    }
  }

  function wire() {
    try {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Load file (.json / .csv — stays in this tab)';
      btn.setAttribute('aria-label', 'Load policy inputs from a local JSON or CSV file; the file never leaves your browser');
      btn.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9998;border:1px solid var(--border-2,#3b4a66);border-radius:8px;padding:8px 12px;font-family:monospace;font-size:.68rem;background:var(--bg-2,#101a2e);color:var(--body,#c7d3e8);cursor:pointer';
      btn.addEventListener('click', pickAndImport);
      document.body.appendChild(btn);

      /* Drop zone over the whole page: the overlay lights up on dragover so a
         drop anywhere lands on the import path, never on browser defaults. */
      var zone = document.createElement('div');
      zone.setAttribute('aria-hidden', 'true');
      zone.textContent = 'Drop a .json or .csv file to prefill this tool — processed locally, nothing is uploaded';
      zone.style.cssText = 'position:fixed;inset:0;z-index:9997;display:none;align-items:center;justify-content:center;border:3px dashed rgba(20,184,166,.6);background:rgba(8,14,26,.72);color:#e6eefc;font-family:monospace;font-size:.85rem;text-align:center;padding:24px';
      var depth = 0;
      var show = function () { depth++; zone.style.display = 'flex'; };
      var hide = function () { depth = Math.max(0, depth - 1); if (!depth) zone.style.display = 'none'; };
      document.addEventListener('dragenter', function (e) { e.preventDefault(); show(); });
      document.addEventListener('dragover', function (e) { e.preventDefault(); });
      document.addEventListener('dragleave', function (e) { e.preventDefault(); hide(); });
      document.addEventListener('drop', function (e) {
        e.preventDefault(); depth = 0; zone.style.display = 'none';
        var items = (e.dataTransfer && e.dataTransfer.items) || null;
        var files = [];
        if (items && items.length) {
          var pending = 0, left = items.length, collected = [];
          for (var i = 0; i < items.length; i++) {
            (function (item) {
              if (item.kind !== 'file') { left--; return; }
              if (typeof item.getAsFileSystemHandle === 'function') {
                pending++;
                item.getAsFileSystemHandle().then(function (h) { return h.getFile(); })
                  .then(function (f) { collected.push(f); })
                  .catch(function () { /* undrop-able entry: skip */ })
                  .then(function () { if (--pending === 0) handleFiles(collected); });
              } else {
                var f = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
                if (f) files.push(f);
              }
            })(items[i]);
          }
          if (files.length && pending === 0) handleFiles(files);
        } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          var arr = []; for (var j = 0; j < e.dataTransfer.files.length; j++) arr.push(e.dataTransfer.files[j]);
          handleFiles(arr);
        }
      });
      document.body.appendChild(zone);
    } catch (e) { /* a chrome-less harness must never break the tool itself */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();`;
}

/* ==========================================================================
 * OCG-ASK-AGENT v1 — the "Ask your agent" copyable block on node pages.
 * Contract: AGENT-REACH-BUILD-SPEC.md section 3.6 (row TOOLPAGE-ASK-AGENT-1).
 * Emitted from the node's manifest by scripts/check-ask-agent-block.mjs
 * (generator + freshness gate, SO #35 shape); the bytes below are the single
 * source of truth. Pure: same inputs, same bytes (two renders are byte-equal).
 * ========================================================================== */

/** End marker of the emitted ask-agent region — the gate detects the region by
 *  BEGIN(manifest-pathed) + this END pair. */
export const ASK_AGENT_END = '<!-- ASK-AGENT:END -->';

/** Begin marker line for one node page (manifest-pathed for provenance). */
export function askAgentBeginLine(manifestPath) {
  return `<!-- ASK-AGENT:BEGIN generator=scripts/check-ask-agent-block.mjs manifest=${manifestPath} -->`;
}

/**
 * The FIXED verb table — the whole description transform, no LLM (row fence).
 * First word of the manifest description's first sentence, third-person
 * singular to imperative. A first word not in this table keeps the sentence
 * verbatim (measured 2026-09-05 over all 579 live-node manifests: the table
 * covers every verb-led description; noun-led ones like "Basel III…", "TRID…"
 * pass through unchanged by design).
 */
export const ASK_AGENT_VERB_TABLE = {
  'Validates': 'Validate', 'Validates,': 'Validate,',
  'Recomputes': 'Recompute', 'Recomputes,': 'Recompute,',
  'Computes': 'Compute', 'Checks': 'Check', 'Classifies': 'Classify',
  'Scores': 'Score', 'Verifies': 'Verify', 'Maps': 'Map', 'Lints': 'Lint',
  'Assembles': 'Assemble', 'Models': 'Model', 'Builds': 'Build',
  'Evaluates': 'Evaluate', 'Runs': 'Run', 'Compares': 'Compare',
  'Composes': 'Compose', 'Reconciles': 'Reconcile', 'Tests': 'Test',
  'Rolls': 'Roll', 'Binds': 'Bind', 'Generates': 'Generate',
  'Publishes': 'Publish', 'Assesses': 'Assess', 'Parses': 'Parse',
  'Estimates': 'Estimate', 'Aggregates': 'Aggregate',
  'Calculates': 'Calculate', 'Turns': 'Turn', 'Attests': 'Attest',
  'Simulates': 'Simulate', 'Decodes': 'Decode', 'Resolves': 'Resolve',
  'Converts': 'Convert', 'Applies': 'Apply', 'Routes': 'Route',
  'Screens': 'Screen', 'Determines': 'Determine', 'Gives': 'Give',
  'Packages': 'Package', 'Cross-validates': 'Cross-validate',
  'Pre-checks': 'Pre-check', 'Machine-checks': 'Machine-check',
  'Cross-checks': 'Cross-check', 'Batch-verifies': 'Batch-verify',
  'Stress-tests': 'Stress-test', 'Identifies': 'Identify',
  'Analyzes': 'Analyze', 'Itemizes': 'Itemize', 'Allocates': 'Allocate',
  'Benchmarks': 'Benchmark', 'Decomposes': 'Decompose',
  'Compiles': 'Compile', 'Extends': 'Extend', 'Layers': 'Layer',
  'Solves': 'Solve', 'Tracks': 'Track', 'Constructs': 'Construct',
  'Translates': 'Translate', 'Diffs': 'Diff', 'Registers': 'Register',
  'Closes': 'Close', 'Values': 'Value', 'Derives': 'Derive',
  'Sweeps': 'Sweep', 'Recovers': 'Recover', 'Correlates': 'Correlate',
  'Reports': 'Report', 'Confirms': 'Confirm', 'Detects': 'Detect',
  'Transforms': 'Transform', 'Prices': 'Price', 'Selects': 'Select',
  'Sequences': 'Sequence', 'Walks': 'Walk', 'Renders': 'Render',
  'Re-derives': 'Re-derive', 'Ties': 'Tie', 'Hashes': 'Hash',
  'Joins': 'Join', 'Starts': 'Start', 'Counts': 'Count',
  'Answers': 'Answer', 'Decides': 'Decide', 'Takes': 'Take',
  'Sizes': 'Size', 'Rates': 'Rate', 'Shows': 'Show', 'Records': 'Record',
  'Flags': 'Flag', 'Measures': 'Measure', 'Audits': 'Audit',
};

/**
 * First sentence of a description + fixed verb-fronting. Deterministic:
 * sentence split on the first ". " (or the terminal "."), first word mapped
 * through ASK_AGENT_VERB_TABLE, unknown first word keeps the sentence
 * verbatim. Pure.
 */
export function askAgentImperative(description) {
  const d = String(description || '').trim();
  if (!d) return '';
  const cut = d.indexOf('. ');
  const sentence = cut === -1 ? d : d.slice(0, cut + 1);
  const sp = sentence.indexOf(' ');
  const first = sp === -1 ? sentence : sentence.slice(0, sp);
  const rest = sp === -1 ? '' : sentence.slice(sp);
  const mapped = ASK_AGENT_VERB_TABLE[first];
  return mapped ? mapped + rest : sentence;
}

/**
 * The section 3.1 deep-link fragment for a policy_parameters object, matching
 * the in-page reader byte-for-byte: `#p=v1.<base64url(gzip(JSON))>` — the same
 * shape buildDeeplinkScript's reader decodes (b64uDec + DecompressionStream
 * gunzip). Node-side twin of the ledger codec; gzipSync with default options is
 * deterministic, so two renders are byte-equal. Pure.
 */
export function encodeAskAgentFragment(params) {
  const json = JSON.stringify(params);
  const gz = gzipSync(Buffer.from(json, 'utf8'));
  return '#p=v1.' + gz.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Estate URLs from the agent kit (AIN-AGENT-KIT-1 #1740) — never hardcoded here. */
const ASK_AGENT_KIT = JSON.parse(readFileSync(join(__dir, '..', 'agent-kit', 'kit.json'), 'utf-8'));
export const ASK_AGENT_MCP_URL = ASK_AGENT_KIT.estate.mcp_url;
export const ASK_AGENT_LEDGER_URL = ASK_AGENT_KIT.estate.ledger_url;

/** The PII banner sentence — verbatim from buildDeeplinkScript's PII_BANNER. */
export const ASK_AGENT_PII_SENTENCE = 'All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';

/**
 * Build the ask-your-agent block for one node page. PURE: same inputs, same
 * bytes. Inputs are the already-adjudicated per-page facts the gate derives
 * from the manifest + chaingraph.json; this function computes the rest
 * (imperative sentence, deep link, verify sentence) and renders the bytes.
 *   manifestPath  repo-relative manifest path (provenance in the BEGIN marker)
 *   toolName      mcp_tool_definition.name (equals the node's mcp_name — gated)
 *   description   mcp_tool_definition.description (sentence + verb table applied here)
 *   sample        policy_parameters object (manifest example, else fixture 0)
 *   pageUrl       the node's canonical url from chaingraph.json (deep-link base)
 *   webmcpRegistered  true when the page carries a generated WebMCP registration
 */
export function buildAskAgentBlock({ manifestPath, toolName, description, sample, pageUrl, webmcpRegistered }) {
  const task = askAgentImperative(description);
  const deepLink = pageUrl.split('#')[0] + encodeAskAgentFragment(sample);
  const verify = webmcpRegistered
    ? `Verify before trusting: call \`verify_execution_hash\` on mcp.ainumbers.co (${ASK_AGENT_MCP_URL}) with the returned execution_hash, or re-run the in-page WebMCP tool \`${toolName}\`.`
    : `Verify before trusting: call \`verify_execution_hash\` on mcp.ainumbers.co (${ASK_AGENT_MCP_URL}) with the returned execution_hash.`;
  const copyText = [
    `Run the AINumbers MCP tool \`${toolName}\`. Task: ${task}`,
    `Synthetic sample input (policy_parameters): ${JSON.stringify(sample)}`,
    verify,
    `Return the ledger link ${ASK_AGENT_LEDGER_URL} so a human can re-verify without contacting us.`,
    `PII rule: ${ASK_AGENT_PII_SENTENCE}`,
    `Open the tool with the sample prefilled: ${deepLink}`,
  ].join('\n');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `${askAgentBeginLine(manifestPath)}
<section id="ask-agent" style="max-width:900px;margin:32px auto 0;border:1px solid var(--border);border-radius:10px;padding:14px 18px;background:var(--bg-2)">
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <h2 style="margin:0;font-size:.85rem;font-family:'JetBrains Mono',monospace;letter-spacing:.04em">Ask your agent</h2>
    <button type="button" aria-label="Copy the ask-your-agent paragraph" onclick="(function(b){var t=document.getElementById('ask-agent-copy').textContent;function d(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy';},1200);}if(navigator.clipboard&amp;&amp;navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(d,function(){});}else{var r=document.createRange();r.selectNodeContents(document.getElementById('ask-agent-copy'));var s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();d();}})(this)" style="margin-left:auto;background:none;border:1px solid var(--border-2);border-radius:6px;color:var(--body);font-family:'JetBrains Mono',monospace;font-size:.62rem;padding:.3rem .8rem;cursor:pointer">Copy</button>
  </div>
  <p style="margin:.5rem 0 .6rem;font-size:.72rem;color:var(--muted)">Copy this paragraph into Claude, OpenClaw, or any MCP-aware agent to run this exact tool, with this sample, and verify the artifact.</p>
  <pre id="ask-agent-copy" style="white-space:pre-wrap;word-break:break-word;margin:0;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);font-size:.62rem;line-height:1.5;color:var(--body)">${esc(copyText)}</pre>
</section>
${ASK_AGENT_END}`;
}
