#!/usr/bin/env node
/**
 * scripts/gen-hub-for-hubs-page.mjs — HUB-FOR-HUBS-1 (2026-09-21 humanize
 * pass, split out of INFRA-PAGE-1).
 *
 * Generates repo/hub-for-hubs.html from data/infra-registry.json: every
 * `ain:category="guide"` row (domain hubs and integration guides) on one
 * page, clustered by the work the reader is doing rather than dumped as one
 * alphabetical wall. infrastructure.html keeps a pointer section; this page
 * is the catalog.
 *
 * The clusters are AUTHORED (a curated grouping is the point of the page —
 * the registry stays the derived SSOT of what exists, this file only decides
 * what sits next to what). Coverage is enforced: every guide row must sit in
 * exactly one cluster, and every cluster path must be a live guide row.
 * Either invariant breaks → hard error, so a new hub page can never ship
 * unlisted and a deleted one can never leave a dangling cluster entry.
 *
 * Display copy (titles, descriptions, the recomputed hub-count phrases) goes
 * through scripts/lib/infra-map.mjs, exactly like infrastructure.html — one
 * shared pipeline, no page-specific quirk for the copy-hallmarks gate to
 * trip over.
 *
 * Deterministic: pure function of the registry + overrides + chrome sources
 * (no wall-clock), so --check byte-compares.
 *
 * Count sentinel: the hero carries data-count="guide_pages" (key derived in
 * counts.mjs from the same registry). Registered in verify-counts.mjs's file
 * list and the derived-artifacts 'counts' entry — undeclared, the main-side
 * regen's anti-escape guard rejects the write (SO #47 precedent).
 *
 * Usage:
 *   node scripts/gen-hub-for-hubs-page.mjs           # write
 *   node scripts/gen-hub-for-hubs-page.mjs --check   # byte-compare, exit 1 on drift
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REPO, readRegistry, loadOverrides, validateOverrides,
  renderCard, renderTitle, esc, jumpBar, readStartChrome,
} from './lib/infra-map.mjs';

const CHECK = process.argv.includes('--check');
const OUT_REL = 'hub-for-hubs.html';

const FACT_LABELS = {
  webmcp: 'WebMCP', deeplink: 'Deep-link', policy_mandate_export: 'Mandate export', jsonld: 'JSON-LD',
};

/**
 * The clusters. Order is page order: the desks most visitors arrive with
 * first. `blurb` is the one human sentence under each cluster heading; keep
 * it a sentence, not a keyword list.
 */
const CLUSTERS = [
  {
    id: 'payments', label: 'Payments and rails',
    blurb: 'Build and operate payment flows: message formats, rail selection, card and account economics, and the ops that keep them moving.',
    paths: [
      'guides/core-infrastructure-hub.html',
      'guides/b2b-payments-hub.html',
      'guides/realtime-payments-ops-hub.html',
      'guides/payment-ops-monitoring-hub.html',
      'guides/payment-scheme-network-hub.html',
      'guides/payment-reference-library-hub.html',
      'guides/fx-payments-intelligence-hub.html',
      'guides/open-banking-integration-hub.html',
      'guides/embedded-finance-baas-hub.html',
      'guides/card-economics-hub.html',
      'guides/rbe-deterministic-suite-hub.html',
      'chaingraph/guide-remittance-corridors.html',
      'guides/fedwire-chips-address-migration-guide.html',
      'guides/baas-programme-scenario.html',
      'guides/government-payments-rfp-hub.html',
    ],
  },
  {
    id: 'regulation', label: 'Regulation and compliance',
    blurb: 'The rulebooks, by regime: what each one demands and the tools that compute the answers.',
    paths: [
      'guides/aml-kyc-compliance-hub.html',
      'guides/regulatory-compliance-consent-hub.html',
      'guides/dora-operational-resilience-hub.html',
      'guides/eu-ai-act-financial-services-hub.html',
      'guides/eu-regulatory-pipeline-hub.html',
      'guides/fca-consumer-duty-hub.html',
      'guides/bnpl-consumer-credit-hub.html',
      'guides/us-banking-consumer-reg-hub.html',
      'guides/psp-payment-compliance-hub.html',
      'guides/psp-payment-safeguarding-hub.html',
      'guides/mica-crypto-asset-regulation-hub.html',
      'guides/genius-act-stablecoin-hub.html',
      'guides/fida-open-finance-hub.html',
      'guides/einvoicing-vat-vida-hub.html',
      'guides/esg-climate-finance-hub.html',
      'guides/eu-sustainable-finance-hub.html',
      'guides/sec16b-early-warning-pack.html',
      'guides/ai-act-evidence-cron.html',
      'chaingraph/guide-fair-lending.html',
      'chaingraph/guide-mortgage-compliance.html',
      'chaingraph/guide-sanctions-screening.html',
      'chaingraph/guide-mica-casp.html',
      'chaingraph/guide-ai-governance.html',
      'chaingraph/guide-carbon-compliance.html',
    ],
  },
  {
    id: 'markets', label: 'Markets, settlement and treasury',
    blurb: 'Settlement cycles, reserve and reconciliation arithmetic, and the treasury desk\u2019s daily work.',
    paths: [
      'guides/capital-markets-settlement-hub.html',
      'chaingraph/guide-settlement-discipline.html',
      'chaingraph/guide-treasury-clearing.html',
      'guides/broker-dealer-ops-hub.html',
      'guides/camt053-parallel-run-recon-pack.html',
      'guides/tmpg-fails-charge-claim-pack.html',
      'guides/pe-waterfall-true-up-pack.html',
      'guides/muni-spending-exception-tracker-pack.html',
      'guides/nav-verification-pack.html',
      'chaingraph/guide-corporate-treasury-stp.html',
      'chaingraph/guide-revenue-operations.html',
      'guides/treasury-liquidity-hub.html',
      'guides/wealthtech-hub.html',
      'guides/lendtech-hub.html',
      'guides/open-wealth-architecture-hub.html',
      'guides/sme-financial-health-hub.html',
    ],
  },
  {
    id: 'risk', label: 'Risk, capital and insurance',
    blurb: 'Capital treatment, credit and fraud risk, and the insurance desk\u2019s equivalents.',
    paths: [
      'guides/basel-iv-frtb-model-risk-hub.html',
      'guides/counterparty-credit-risk-hub.html',
      'guides/fraud-risk-hub.html',
      'guides/basel-take2-impact-assessment-guide.html',
      'guides/sr262-model-risk-monitoring-hub.html',
      'guides/fr2052a-liquidity-report-reference.html',
      'guides/quantized-credit-model.html',
      'chaingraph/guide-insurance-stp.html',
      'chaingraph/guide-conditional-relief-evidence.html',
      'guides/insurance-insurtech-hub.html',
      'guides/aiuc-insurance-evidence.html',
    ],
  },
  {
    id: 'tokenization', label: 'Tokenization, DLT and stablecoins',
    blurb: 'Tokenized assets and the chains they settle on, from Canton and shared ledgers to the payments-first L1s.',
    paths: [
      'guides/dlt-tokenization-hub.html',
      'guides/canton-tmf-hub.html',
      'guides/token-standards-hub.html',
      'guides/ledger-consensus-finality-hub.html',
      'guides/swift-ledger-hub.html',
      'guides/reserve-watch-continuous-verification.html',
      'chaingraph/guide-avalanche.html',
      'chaingraph/guide-arc.html',
      'chaingraph/guide-tempo.html',
      'chaingraph/guide-robinhood.html',
      'chaingraph/guide-wholesale-settlement.html',
    ],
  },
  {
    id: 'trade', label: 'Trade and supply chain',
    blurb: 'Letters of credit, electronic bills of lading, and the MLETR rulebook for trade documents.',
    paths: [
      'guides/tradetech-hub.html',
      'chaingraph/guide-digital-trade.html',
      'guides/ebl-control-evidence-guide.html',
    ],
  },
  {
    id: 'agents', label: 'Agents and developer integration',
    blurb: 'Wire an agent or an MCP client into the suite: the protocols, worked demos, and agreements an agent can sign.',
    paths: [
      'guides/agentic-commerce-mcp-hub.html',
      'guides/agent-observability-hub.html',
      'guides/agent-payment-dispute-evidence-hub.html',
      'chaingraph/agentcore-x402-hub.html',
      'chaingraph/guide-agent-economy-runtime.html',
      'guides/agentic-rail-scenario.html',
      'guides/hypermap-catalog-projection.html',
      'guides/mcp-clone-guide.html',
      'guides/mcp-agent-demo.html',
      'guides/webmcp-demo-2.html',
      'guides/webmcp-field-notes.html',
      'guides/division-swarm-demo.html',
      'guides/regression-replayer.html',
      'guides/authzen-pdp-provable-decisions.html',
      'guides/accept-api-court-checkable-agreements.html',
      'guides/agreement-standards-directory.html',
      'chaingraph/guide-agreement-templates.html',
      'guides/credential-workbench-hub.html',
      'guides/intoto-attestations-hub.html',
    ],
  },
  {
    id: 'platform', label: 'OpenChainGraph platform guides',
    blurb: 'Integrate the standard itself: signatures, exports, telemetry, profiles, and the artifact envelope.',
    paths: [
      'chaingraph/ocg-integration-guide.html',
      'chaingraph/ocg-guide-export.html',
      'chaingraph/guide-intoto.html',
      'chaingraph/guide-ed25519.html',
      'chaingraph/guide-iso20022.html',
      'chaingraph/guide-otel.html',
      'chaingraph/guide-okf.html',
      'chaingraph/guide-prov-dm.html',
      'chaingraph/guide-buildtype.html',
      'chaingraph/guide-pqc.html',
      'chaingraph/guide-profiles.html',
      'chaingraph/guide-decision-receipt-crosswalk.html',
      'chaingraph/guide-allocation-evidence.html',
      'chaingraph/guide-kya-os-checkpoint-interop.html',
      'guides/evidence-profile-catalog.html',
      'guides/lei-kyb-worksheet-guide.html',
    ],
  },
  {
    id: 'evidence', label: 'Evidence and assurance',
    blurb: 'What each receipt, benchmark, and evidence pack actually proves, for the reviewer on the other side of it.',
    paths: [
      'guides/audit-trail-crosswalk-hub.html',
      'guides/audit-ai-evidence-review.html',
      'guides/benchmark-series-methodology.html',
      'guides/benchmark-series-ccp-margin-monitor-issue-2026-q4.html',
      'guides/benchmark-series-reserve-scorecard-issue-2026-06.html',
      'guides/exchange-assurance-hub.html',
      'guides/data-room-disclosure-manifest-guide.html',
      'guides/trust-audit-closeout-pack.html',
      'guides/collections-compliance-pack.html',
      'guides/vop-liability-evidence.html',
      'guides/idv-session-evidence-guide.html',
      'guides/pqc-migration-evidence.html',
      'guides/recomputation-evidence-pack-guide.html',
      'guides/bilateral-head-commit-cosign-guide.html',
      'guides/formal-verification-evidence.html',
    ],
  },
];

/** A refresh/noindex forwarder page: gen-infra-registry.mjs excludes these from
 *  the registry, so a registry row for one is stale until the main-side regen
 *  drops it. Such a row is not an unlisted guide; it is a retired URL. */
function isShimPage(relPath) {
  try {
    const html = readFileSync(resolve(REPO, relPath), 'utf8');
    return /http-equiv=["']?refresh/i.test(html) || /name=["']?robots["']?content=["'][^"']*noindex/i.test(html);
  } catch {
    return false;
  }
}

/** Coverage proof: clusters partition the guide rows, exactly. */
function validateClusters(registry) {
  const guideRows = registry.filter(r => r.category === 'guide');
  const guidePaths = new Set(guideRows.map(r => r.path));
  const seen = new Map();
  const problems = [];
  for (const c of CLUSTERS) {
    for (const p of c.paths) {
      if (seen.has(p)) problems.push(`${p} sits in both "${seen.get(p)}" and "${c.label}"`);
      seen.set(p, c.label);
      if (!guidePaths.has(p)) problems.push(`cluster "${c.label}" names ${p}, which is not a guide-category registry row`);
    }
  }
  const unassigned = guideRows.filter(r => !seen.has(r.path)).map(r => r.path)
    .filter(p => !isShimPage(p));
  if (unassigned.length) {
    problems.push(`guide rows not in any cluster (a new hub page would ship unlisted): ${unassigned.join(', ')}`);
  }
  if (problems.length) {
    throw new Error(`cluster coverage broken:\n  - ${problems.join('\n  - ')}`);
  }
}

function renderPage(registry, overrides, chrome) {
  const guideRows = registry.filter(r => r.category === 'guide');

  let body = '';
  const cardsJsonLd = [];
  for (let i = 0; i < CLUSTERS.length; i++) {
    const c = CLUSTERS[i];
    const rows = c.paths
      .map(p => registry.find(r => r.path === p))
      .sort((a, b) => renderTitle(a, overrides).localeCompare(renderTitle(b, overrides)));
    body += `<section class="section" id="${c.id}" aria-label="${esc(c.label)}">\n  <div class="container">\n`;
    body += `    <div class="sec-label">${String(i + 1).padStart(2, '0')} · ${rows.length} pages</div>\n`;
    body += `    <h2 class="sec-heading">${esc(c.label)}</h2>\n`;
    body += `    <p class="hero-sub">${esc(c.blurb)}</p>\n`;
    body += `    <div class="recipe-grid">\n`;
    for (const r of rows) {
      body += renderCard(r, overrides, FACT_LABELS);
      cardsJsonLd.push({
        '@type': 'ListItem',
        position: cardsJsonLd.length + 1,
        name: renderTitle(r, overrides),
        url: `https://ainumbers.co/${r.path}`,
      });
    }
    body += `    </div>\n  </div>\n</section>\n`;
  }

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AINumbers.co Hubs and Guides',
    description: `Every domain hub and integration guide on AINumbers.co (${guideRows.length} pages), clustered by the work it supports.`,
    url: 'https://ainumbers.co/hub-for-hubs.html',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cardsJsonLd.length,
      itemListElement: cardsJsonLd,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Every domain hub and integration guide on AINumbers.co, clustered by the work it supports: payments, regulation, markets, risk, tokenization, trade, agents, the OpenChainGraph platform, and evidence.">
<meta name="ain:category" content="guide">
<title>Hubs and Guides | AINumbers.co</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${chrome.css}
${chrome.footerCss}
/* HUB-FOR-HUBS-1 page-local additions (same card system as infrastructure.html) */
.fact-row{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.1rem}
.fact-chip{font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-lt);background:rgba(20,184,166,.08);border:1px solid rgba(20,184,166,.25);border-radius:999px;padding:.15rem .55rem}
</style>
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body>

<!-- lang toggle removed — CONTRACT §1.1 -->

${chrome.nav}

<main>

<!-- Hero -->
<section class="hero">
  <div class="container">
    <div class="hero-eyebrow">Hubs &amp; guides</div>
    <h1>Every hub and integration guide, clustered by the work it supports</h1>
    <p class="hero-sub">Domain hubs collect the tools and chains for one desk or one rulebook; single-purpose guides answer one question apiece. <span data-count="guide_pages">${guideRows.length}</span> of them live here, in ${CLUSTERS.length} clusters. The working surfaces of the site stay on the <a href="infrastructure.html">infrastructure map</a>.</p>
  </div>
</section>

${jumpBar('Clusters', CLUSTERS.map(c => ({ id: c.id, label: c.label })))}

${body}

</main>

<!-- ROOT-FOOTER:START -->
${chrome.footer}
<!-- ROOT-FOOTER:END -->

</body>
</html>
`;
}

const registryPath = resolve(REPO, 'data', 'infra-registry.json');
if (!existsSync(registryPath)) {
  console.error('gen-hub-for-hubs-page: data/infra-registry.json missing. Run `node scripts/gen-infra-registry.mjs` first.');
  process.exit(1);
}
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const overrides = loadOverrides();
validateOverrides(overrides, registry);
validateClusters(registry);
const chrome = readStartChrome();
const out = renderPage(registry, overrides, chrome);
const target = resolve(REPO, OUT_REL);
const exists = existsSync(target);
const current = exists ? readFileSync(target, 'utf8') : '';

if (CHECK) {
  if (!exists) {
    console.error(`gen-hub-for-hubs-page --check: ${OUT_REL} is missing. Run \`node scripts/gen-hub-for-hubs-page.mjs\`.`);
    process.exit(1);
  }
  if (current !== out) {
    console.error(`gen-hub-for-hubs-page --check: ${OUT_REL} is stale. Run \`node scripts/gen-hub-for-hubs-page.mjs\`.`);
    process.exit(1);
  }
  console.log(`gen-hub-for-hubs-page --check: OK (${registry.filter(r => r.category === 'guide').length} guide rows in ${CLUSTERS.length} clusters, byte-exact).`);
  process.exit(0);
}
writeFileSync(target, out, 'utf8');
console.log(`gen-hub-for-hubs-page: wrote ${OUT_REL} (${registry.filter(r => r.category === 'guide').length} guide rows across ${CLUSTERS.length} clusters).`);
