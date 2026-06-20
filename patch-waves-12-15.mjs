#!/usr/bin/env node
/**
 * patch-waves-12-15.mjs
 *
 * Adds waves 12–15 to:
 *   1. repo/chaingraph/chaingraph-hub.html   (tool cards + wave headers)
 *   2. repo/sitemap.xml                       (wave 12/13/15 URLs; 14 already present)
 *   3. repo/mcp.html                          (tool/chain table rows)
 *
 * Run from repo root:
 *   node patch-waves-12-15.mjs
 *
 * Idempotent: checks for a sentinel string before inserting.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const REPO   = __dir;   // script lives at repo root

// ─────────────────────────────────────────────────────────
// 1. chaingraph-hub.html
// ─────────────────────────────────────────────────────────
const HUB = join(REPO, 'chaingraph', 'chaingraph-hub.html');
let hub = readFileSync(HUB, 'utf8');

const HUB_SENTINEL = 'WAVE 12: DIGITAL TRADE CORRIDOR';
if (hub.includes(HUB_SENTINEL)) {
  console.log('chaingraph-hub.html — already patched, skipping');
} else {
  const HUB_INSERT = `
  <!-- WAVE 12: DIGITAL TRADE CORRIDOR (MLETR / eBL / eUCP / eURC) -->
  <div class="cat-heading" style="margin-top:36px">
    <span class="cat-tag-label" style="border-color:rgba(20,184,166,.3);color:var(--teal)">Wave 12</span>
    <h2 class="cat-name">Digital Trade Corridor (MLETR)</h2>
    <span class="cat-n">4 tools</span>
  </div>
  <p class="cat-sub">OpenChainGraph tools for the electronic trade-document ecosystem (UNCITRAL MLETR, ICC eUCP v2.1, eURC v1.1, URDTT v1.0): eBL/ETR enforceability, digital-LC/collection/open-account rules compliance, trade-document consistency &amp; Merkle provenance, and TBML surveillance. <a href="guide-digital-trade.html" style="color:var(--teal);border-bottom:1px solid rgba(20,184,166,.25)">→ Digital Trade guide hub</a></p>
  <div class="tool-grid">

    <a href="art-52-digital-trade-fit-diagnostic.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-52 · D0</span><div class="deadline-flag dl-live">Start here</div><span class="card-arrow">→</span></div>
        <div class="card-name">Digital Trade Corridor Fit Diagnostic</div>
        <div class="card-desc">12-question A–F readiness diagnostic for digital trade / MLETR. Grades corridor legality, document digitisation, platform connectivity, trade-rule basis, financing, and AML/TBML; routes to the right Wave-12 dtc-* chain.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">run_digital_trade_fit</span><span class="ctag ctag-body">agent_guardrail</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-53-mletr-ebl-conformance-validator.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-53 · W-A</span><span class="card-arrow">→</span></div>
        <div class="card-name">MLETR / eBL Conformance Validator</div>
        <div class="card-desc">Validates an electronic transferable record (eBL or ETR) against MLETR functional-equivalence tests (Arts. 10–12) and scores cross-corridor legal enforceability. Will this eBL hold up at both ends?</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">validate_mletr_record</span><span class="ctag ctag-body">trade_finance</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-54-digital-trade-rules-checker.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-54 · W-B</span><span class="card-arrow">→</span></div>
        <div class="card-name">Digital Trade Rules Compliance Checker</div>
        <div class="card-desc">Machine-checks a digital trade presentation against ICC eUCP v2.1, eURC v1.1, or URDTT v1.0. Produces a discrepancy list with article citations and remediation for digital-LC, collection, or open-account transactions.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">check_digital_trade_rules</span><span class="ctag ctag-body">trade_rules</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-55-trade-document-provenance-verifier.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-55 · W-C</span><span class="card-arrow">→</span></div>
        <div class="card-name">Trade Document Provenance Verifier</div>
        <div class="card-desc">Cross-validates a trade-document set (eBL, invoice, packing list, cert of origin, insurance) for internal consistency and computes a Merkle provenance root. Flags TBML red flags — over/under-invoicing, phantom shipments, mismatched values.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">verify_trade_document_set</span><span class="ctag ctag-body">aml_surveillance</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

  </div>

  <!-- WAVE 13: WHOLESALE TOKENIZED SETTLEMENT (WTS) -->
  <div class="cat-heading" style="margin-top:36px">
    <span class="cat-tag-label" style="border-color:rgba(212,168,71,.3);color:var(--gold)">Wave 13</span>
    <h2 class="cat-name">Wholesale Tokenized Settlement (WTS)</h2>
    <span class="cat-n">4 tools</span>
  </div>
  <p class="cat-sub">OpenChainGraph tools for the wholesale tokenized settlement layer: deposit-token compliance (JPMD/RLN model vs MiCA EMT), settlement-asset legal-finality classification (SFD/PFMI/UCC Art.12 finality tiers), and cross-network atomic DvP/PvP validation. Models BIS Agorá / ECB Pontes / DTCC Collateral AppChain. <a href="guide-wholesale-settlement.html" style="color:var(--gold);border-bottom:1px solid rgba(212,168,71,.25)">→ Wholesale Settlement guide hub</a></p>
  <div class="tool-grid">

    <a href="art-56-tokenized-settlement-fit-diagnostic.html" class="tool-card db">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-56 · D0</span><div class="deadline-flag dl-live">Start here</div><span class="card-arrow">→</span></div>
        <div class="card-name">Tokenized Settlement Fit Diagnostic</div>
        <div class="card-desc">12-question A–F readiness diagnostic for wholesale tokenized settlement. Grades settlement-asset choice, finality regime, cross-network atomicity, asset/cash-leg types, intraday liquidity, and reconciliation controls; routes to the right wts-* chain.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">run_tokenized_settlement_fit</span><span class="ctag ctag-body">agent_guardrail</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-57-deposit-token-compliance-validator.html" class="tool-card db">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-57 · W-A</span><span class="card-arrow">→</span></div>
        <div class="card-name">Deposit-Token Compliance Validator</div>
        <div class="card-desc">3-test validator: at-par redemption, on-balance-sheet liability, holder eligibility. Classifies DEPOSIT_TOKEN_CONFIRMED / CBM_TOKEN / EMT_STABLECOIN / MISCLASSIFIED with US/UK/EU jurisdiction notes. Gates the WTS settlement chain.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">validate_deposit_token_compliance</span><span class="ctag ctag-body">mica_emt</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-58-cross-network-settlement-validator.html" class="tool-card db">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-58 · W-B</span><span class="card-arrow">→</span></div>
        <div class="card-name">Cross-Network Atomic Settlement Validator</div>
        <div class="card-desc">Validates atomic settlement across 2+ networks: cash-leg finality, asset-leg delivery, FX-leg PvP. Detects finality mismatch, non-atomic cross-network risk, and PvP gaps. BIS Agorá / ECB Pontes / DTCC. CPMI-IOSCO PFMI P.8 + P.12.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">validate_cross_network_settlement</span><span class="ctag ctag-body">pfmi_p12</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-59-settlement-asset-finality-classifier.html" class="tool-card db">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-59 · W-C</span><span class="card-arrow">→</span></div>
        <div class="card-name">Settlement-Asset &amp; Finality Classifier</div>
        <div class="card-desc">Classify your settlement asset (CBM token, tokenized deposit, stablecoin, e-money) against its legal-finality regime (SFD, PFMI, UCC Art.12) → finality tier 1–4 + singleness-of-money verdict. Gates the cross-network atomicity check (ART-58).</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">classify_settlement_asset_finality</span><span class="ctag ctag-body">sfd_finality</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

  </div>

  <!-- WAVE 14: AGENT ECONOMY RUNTIME (AER) -->
  <div class="cat-heading" style="margin-top:36px">
    <span class="cat-tag-label" style="border-color:rgba(20,184,166,.3);color:var(--teal)">Wave 14</span>
    <h2 class="cat-name">Agent Economy Runtime (AER)</h2>
    <span class="cat-n">4 tools · 8 chains</span>
  </div>
  <p class="cat-sub">OpenChainGraph tools for the runtime / post-trade settlement layer for autonomous agent payments. Covers x402 V2 batch-settlement reconciliation (Linux Foundation, May 2026), AP2 v0.2 Human-Not-Present PaymentReceipt verification (FIDO Alliance, Apr 2026), agent-service unit economics, and A–F runtime readiness. <a href="guide-agent-economy-runtime.html" style="color:var(--teal);border-bottom:1px solid rgba(20,184,166,.25)">→ Agent Economy Runtime guide hub with all 8 chains</a></p>
  <div class="tool-grid">

    <a href="art-60-agent-economy-runtime-fit-diagnostic.html" class="tool-card da">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-60 · D0</span><div class="deadline-flag dl-live">Start here</div><span class="card-arrow">→</span></div>
        <div class="card-name">Agent Economy Runtime Fit Diagnostic</div>
        <div class="card-desc">12-question A–F readiness diagnostic for the autonomous agent economy runtime layer (x402/AP2/ACP). Routes to the right aer-* chain. Single root of all Wave 14 workflows.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">run_agent_economy_fit</span><span class="ctag ctag-body">agent_guardrail</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-61-x402-batch-settlement-reconciler.html" class="tool-card da">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-61 · W-A</span><span class="card-arrow">→</span></div>
        <div class="card-name">x402 Batch Settlement Reconciler</div>
        <div class="card-desc">x402 V2 batch-settlement reconciler: recon verdict, risk window classification, and Merkle root over the settled batch. Detects duplicate references, currency mismatches, and settlement gaps. Linux Foundation x402 V2 (May 2026).</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">reconcile_x402_batch_settlement</span><span class="ctag ctag-body">x402_v2</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-62-ap2-payment-receipt-verifier.html" class="tool-card da">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-62 · W-B</span><span class="card-arrow">→</span></div>
        <div class="card-name">AP2 Payment Receipt Verifier</div>
        <div class="card-desc">AP2 v0.2 PaymentReceipt verifier with Human-Not-Present guardrail check. Validates receipt structure, amount/currency/payee binding, HNP flag, and mandate-chain consistency. FIDO Alliance AP2 v0.2 (Apr 2026).</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">verify_ap2_payment_receipt</span><span class="ctag ctag-body">ap2_hnp</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-63-agent-service-metering-modeler.html" class="tool-card da">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-63 · W-C</span><span class="card-arrow">→</span></div>
        <div class="card-name">Agent Service Metering Modeler</div>
        <div class="card-desc">Agent-service unit economics modeler: revenue per call, cost structure, margin at scale, and break-even volume. Educational estimator for x402/AP2 micropayment pricing decisions across agentic service tiers.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-teal">model_agent_service_metering</span><span class="ctag ctag-body">unit_economics</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

  </div>

  <!-- WAVE 15: AI GOVERNANCE & CONFORMITY (AIG) -->
  <div class="cat-heading" style="margin-top:36px">
    <span class="cat-tag-label" style="border-color:rgba(212,168,71,.3);color:var(--gold)">Wave 15</span>
    <h2 class="cat-name">AI Governance &amp; Conformity (EU AI Act)</h2>
    <span class="cat-n">4 tools · 8 chains</span>
  </div>
  <p class="cat-sub">OpenChainGraph tools for EU AI Act compliance in financial services. <strong>DO NOW:</strong> Art 5 prohibited practices (€35M/7%, in force 2 Aug 2025), Art 4 AI literacy (2 Feb 2025), GPAI Arts 53–55 (2 Aug 2025). <strong>PREPARE-AHEAD:</strong> Annex III high-risk financial AI (credit scoring, insurance pricing) — 2 Dec 2027 per Digital Omnibus (verify). <a href="guide-ai-governance.html" style="color:var(--gold);border-bottom:1px solid rgba(212,168,71,.25)">→ AI Governance guide hub with all 8 chains</a></p>
  <div class="tool-grid">

    <a href="art-64-ai-act-highrisk-fit-diagnostic.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-64 · D0</span><div class="deadline-flag dl-live">Start here</div><span class="card-arrow">→</span></div>
        <div class="card-name">EU AI Act High-Risk Fit Diagnostic</div>
        <div class="card-desc">In-force-first: screens Art 5 prohibited practices, Art 4 AI literacy, GPAI Arts 53–55, then classifies Annex III high-risk status for financial AI (credit scoring, insurance pricing). Routes to the right aig-* chain. Dual-date timeline aware.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">run_ai_act_highrisk_fit</span><span class="ctag ctag-body">agent_guardrail</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-65-ai-conformity-pack-builder.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-65 · W-A</span><div class="deadline-flag dl-soon">Dec 2027</div><span class="card-arrow">→</span></div>
        <div class="card-name">AI Act Conformity Pack Builder</div>
        <div class="card-desc">Annex IV technical documentation scoring + conformity-assessment route (internal control vs notified body) + CE-marking readiness + EU Declaration of Conformity skeleton. Flagship provider tool for high-risk financial AI. PREPARE-AHEAD: 2 Dec 2027 (verify).</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">build_ai_conformity_pack</span><span class="ctag ctag-body">eu_ai_act</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-66-fria-postmarket-monitoring-builder.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-66 · W-B</span><div class="deadline-flag dl-soon">Dec 2027</div><span class="card-arrow">→</span></div>
        <div class="card-name">FRIA &amp; Post-Market Monitoring Builder</div>
        <div class="card-desc">Art 27 FRIA + Art 72 post-market monitoring plan + Art 12 logging + Art 14 human oversight + Art 73 serious-incident path for banks and insurers deploying high-risk AI. Flagship deployer lifecycle tool. PREPARE-AHEAD: 2 Dec 2027 (verify).</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">build_fria_monitoring_plan</span><span class="ctag ctag-body">eu_ai_act</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

    <a href="art-67-agentic-ai-risk-classifier.html" class="tool-card dc">
      <div class="card-inner">
        <div class="card-top"><span class="card-num">ART-67 · W-C</span><div class="deadline-flag dl-live">GPAI in force</div><span class="card-arrow">→</span></div>
        <div class="card-name">Agentic AI Risk &amp; GPAI Classifier</div>
        <div class="card-desc">Classifies agentic AI governance tier and GPAI obligations under EU AI Act Arts 53–55 (IN FORCE 2 Aug 2025). Maps systemic-risk threshold (10²⁵ FLOP), Art 50 transparency, Art 14 HNP oversight, and downstream Annex III interaction.</div>
      </div>
      <div class="card-footer">
        <div class="card-tags"><span class="ctag ctag-gold">classify_agentic_ai_risk</span><span class="ctag ctag-body">gpai_governance</span></div>
        <span class="live-dot">Live</span>
      </div>
    </a>

  </div>

`;
  hub = hub.replace('  <!-- SCHEMA -->', HUB_INSERT + '  <!-- SCHEMA -->');
  writeFileSync(HUB, hub, 'utf8');
  console.log('✅ chaingraph-hub.html patched');
}

// ─────────────────────────────────────────────────────────
// 2. sitemap.xml
// ─────────────────────────────────────────────────────────
const SITEMAP = join(REPO, 'sitemap.xml');
let sitemap = readFileSync(SITEMAP, 'utf8');

const SITEMAP_SENTINEL = 'Wave 12 Digital Trade Corridor';
if (sitemap.includes(SITEMAP_SENTINEL)) {
  console.log('sitemap.xml — already patched, skipping');
} else {
  const SITEMAP_INSERT = `
  <!-- OCG Wave 12 Digital Trade Corridor tools + guide hub -->
  <url><loc>https://ainumbers.co/chaingraph/art-52-digital-trade-fit-diagnostic.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-53-mletr-ebl-conformance-validator.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-54-digital-trade-rules-checker.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/guide-digital-trade.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>

  <!-- OCG Wave 13 Wholesale Tokenized Settlement tools + guide hub -->
  <url><loc>https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-57-deposit-token-compliance-validator.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-58-cross-network-settlement-validator.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/guide-wholesale-settlement.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>

  <!-- OCG Wave 15 AI Governance & Conformity tools + guide hub -->
  <url><loc>https://ainumbers.co/chaingraph/art-64-ai-act-highrisk-fit-diagnostic.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-65-ai-conformity-pack-builder.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-66-fria-postmarket-monitoring-builder.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/art-67-agentic-ai-risk-classifier.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/guide-ai-governance.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>

  <!-- OCG Wave 15 AI Governance chain pages -->
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-fit.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-conformity.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-fria-monitoring.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-fairness-bias.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-gpai-agentic.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-credit-ai-conformity.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-resilience-overlap.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://ainumbers.co/chaingraph/chains/aig-audit-pack.html</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>

`;
  sitemap = sitemap.replace('\n</urlset>', SITEMAP_INSERT + '</urlset>');
  writeFileSync(SITEMAP, sitemap, 'utf8');
  console.log('✅ sitemap.xml patched');
}

// ─────────────────────────────────────────────────────────
// 3. mcp.html
// ─────────────────────────────────────────────────────────
const MCP = join(REPO, 'mcp.html');
let mcp = readFileSync(MCP, 'utf8');

const MCP_SENTINEL = 'Wave 12 Digital Trade Corridor (MLETR)';
if (mcp.includes(MCP_SENTINEL)) {
  console.log('mcp.html — already patched, skipping');
} else {
  const MCP_INSERT = `        <tr class="tool-group"><td colspan="3">ChainGraph tools — Wave 12 Digital Trade Corridor (MLETR)</td></tr>
        <tr><td>digital-trade-fit</td><td>D0. ART-52 — 12-question A–F fit diagnostic for digital trade / MLETR. Grades corridor legality, document digitisation, platform, trade-rule basis, financing, AML/TBML; routes to the right dtc-* chain</td><td><a href="chaingraph/art-52-digital-trade-fit-diagnostic.html">Open →</a></td></tr>
        <tr><td>mletr-ebl-conformance</td><td>ART-53. MLETR functional-equivalence tests (Arts 10-12) + cross-corridor legal enforceability scoring. Will this eBL hold up at both ends?</td><td><a href="chaingraph/art-53-mletr-ebl-conformance-validator.html">Open →</a></td></tr>
        <tr><td>digital-trade-rules</td><td>ART-54. Machine-checks digital trade presentation against ICC eUCP v2.1, eURC v1.1, or URDTT v1.0. Discrepancy list + article citations + remediation</td><td><a href="chaingraph/art-54-digital-trade-rules-checker.html">Open →</a></td></tr>
        <tr><td>trade-document-provenance</td><td>ART-55. Cross-validates trade-document set (eBL, invoice, packing list, cert of origin, insurance) for consistency + Merkle provenance root. TBML red-flag screen</td><td><a href="chaingraph/art-55-trade-document-provenance-verifier.html">Open →</a></td></tr>
        <tr class="tool-group"><td colspan="3">ChainGraph tools — Wave 13 Wholesale Tokenized Settlement</td></tr>
        <tr><td>tokenized-settlement-fit</td><td>D0. ART-56 — 12-question A–F fit diagnostic for wholesale tokenized settlement. Grades settlement-asset choice, finality regime, cross-network atomicity, liquidity, recon; routes to the right wts-* chain</td><td><a href="chaingraph/art-56-tokenized-settlement-fit-diagnostic.html">Open →</a></td></tr>
        <tr><td>deposit-token-compliance</td><td>ART-57. 3-test validator for tokenized deposit vs EMT stablecoin (at-par redemption, on-balance-sheet, holder eligibility). DEPOSIT_TOKEN_CONFIRMED / CBM_TOKEN / EMT_STABLECOIN / MISCLASSIFIED. US/UK/EU jurisdiction notes</td><td><a href="chaingraph/art-57-deposit-token-compliance-validator.html">Open →</a></td></tr>
        <tr><td>cross-network-settlement</td><td>ART-58. Validates atomic DvP/PvP across 2+ networks. Detects finality mismatch, non-atomic cross-network risk, PvP gaps. BIS Agorá / ECB Pontes / DTCC. PFMI P.8+P.12</td><td><a href="chaingraph/art-58-cross-network-settlement-validator.html">Open →</a></td></tr>
        <tr><td>settlement-asset-finality</td><td>ART-59. Classifies settlement asset (CBM token, tokenized deposit, stablecoin, e-money) against finality regime (SFD/PFMI/UCC Art.12) → tier 1–4 + singleness-of-money verdict. Gates ART-58</td><td><a href="chaingraph/art-59-settlement-asset-finality-classifier.html">Open →</a></td></tr>
        <tr class="tool-group"><td colspan="3">ChainGraph chain pages — Wave 14 Agent Economy Runtime</td></tr>
        <tr><td>aer-fit</td><td>D0. 12-question A–F readiness diagnostic for autonomous agent economy runtime (x402/AP2/ACP); routes to aer-* chains (ART-60)</td><td><a href="chaingraph/chains/aer-fit.html">Open →</a></td></tr>
        <tr><td>aer-batch-settlement</td><td>W-A. x402 V2 batch-settlement reconciler (ART-61) → Merkle integrity → settlement-fail anomaly monitoring. Recon verdict + risk window + Merkle root</td><td><a href="chaingraph/chains/aer-batch-settlement.html">Open →</a></td></tr>
        <tr><td>aer-payment-receipt</td><td>W-B. AP2 v0.2 PaymentReceipt verifier + HNP guardrail (ART-62) → mandate-chain validation → ZK compliance proof. FIDO Alliance AP2 v0.2 (Apr 2026)</td><td><a href="chaingraph/chains/aer-payment-receipt.html">Open →</a></td></tr>
        <tr><td>aer-autonomous-guardrail</td><td>W-C. Agent spend-policy simulation → agentic checkout protocol selector → ACP checkout conformance. Guardrail stack for autonomous agent payments</td><td><a href="chaingraph/chains/aer-autonomous-guardrail.html">Open →</a></td></tr>
        <tr><td>aer-metering</td><td>W-D. Agent service metering modeler (ART-63): unit economics at scale → break-even + margin analysis. x402/AP2 micropayment pricing for agentic service tiers</td><td><a href="chaingraph/chains/aer-metering.html">Open →</a></td></tr>
        <tr><td>aer-fraud-runtime</td><td>W-E. Transaction anomaly detection → app-fraud graph simulation → agent identity attestation check. Runtime fraud screen for autonomous agent payment flows</td><td><a href="chaingraph/chains/aer-fraud-runtime.html">Open →</a></td></tr>
        <tr><td>aer-marketplace</td><td>W-F. Agent commerce conformance → A2A x402 mandate validator → x402 payment decode → settlement model. Full stack for agentic marketplace operators</td><td><a href="chaingraph/chains/aer-marketplace.html">Open →</a></td></tr>
        <tr><td>aer-audit-pack</td><td>W-G. Aggregate execution receipts → Merkle batch → OCG artifact export. Cryptographic audit pack for agent economy runtime compliance</td><td><a href="chaingraph/chains/aer-audit-pack.html">Open →</a></td></tr>
        <tr class="tool-group"><td colspan="3">ChainGraph chain pages — Wave 15 AI Governance &amp; Conformity (EU AI Act)</td></tr>
        <tr><td>aig-fit</td><td>D0. EU AI Act high-risk fit + classification (ART-64): Art 5/4/GPAI in-force screen first, then Annex III classification + Art 9-15 readiness grade. Routes to aig-* chains</td><td><a href="chaingraph/chains/aig-fit.html">Open →</a></td></tr>
        <tr><td>aig-conformity</td><td>W-A. Conformity pack builder (ART-65): Annex IV gaps + conformity-assessment route + CE-marking readiness + EU DoC skeleton. Provider tool. PREPARE-AHEAD Dec 2027</td><td><a href="chaingraph/chains/aig-conformity.html">Open →</a></td></tr>
        <tr><td>aig-fria-monitoring</td><td>W-B. FRIA + post-market monitoring plan builder (ART-66): Art 27 FRIA + Art 72 monitoring + Art 14 oversight + Art 73 incident path. Deployer lifecycle. Dec 2027</td><td><a href="chaingraph/chains/aig-fria-monitoring.html">Open →</a></td></tr>
        <tr><td>aig-fairness-bias</td><td>W-C. Fairness &amp; bias audit for high-risk financial AI: Art 9-10 data governance, Art 13 transparency, Art 15 accuracy + robustness scoring. Provider + deployer</td><td><a href="chaingraph/chains/aig-fairness-bias.html">Open →</a></td></tr>
        <tr><td>aig-gpai-agentic</td><td>W-D. GPAI governance tier + agentic AI risk classifier (ART-67): Arts 53-55 IN FORCE 2 Aug 2025. Systemic-risk 10²⁵ FLOP threshold, Art 50 transparency, HNP oversight</td><td><a href="chaingraph/chains/aig-gpai-agentic.html">Open →</a></td></tr>
        <tr><td>aig-credit-ai-conformity</td><td>W-E. Credit-scoring AI lifecycle: Annex III §5(b) classification → Art 9-15 gap screen → conformity route → EU DoC. Full chain for credit/underwriting AI providers + deployers</td><td><a href="chaingraph/chains/aig-credit-ai-conformity.html">Open →</a></td></tr>
        <tr><td>aig-resilience-overlap</td><td>W-F. EU AI Act × DORA resilience overlap: maps Art 9 risk-management, Art 17 QMS, Art 72 monitoring to DORA ICT risk chapters. Dual-compliance efficiency</td><td><a href="chaingraph/chains/aig-resilience-overlap.html">Open →</a></td></tr>
        <tr><td>aig-audit-pack</td><td>W-G. AI Act audit pack aggregator: consolidate aig-* chain outputs → execution-receipt bundle → Merkle root → OCG export. Complete conformity evidence pack</td><td><a href="chaingraph/chains/aig-audit-pack.html">Open →</a></td></tr>
`;
  mcp = mcp.replace('      </tbody>', MCP_INSERT + '      </tbody>');
  writeFileSync(MCP, mcp, 'utf8');
  console.log('✅ mcp.html patched');
}

console.log('\nDone. Verify with:');
console.log('  grep -c "Wave 12" repo/chaingraph/chaingraph-hub.html repo/sitemap.xml repo/mcp.html');
