#!/usr/bin/env node
/**
 * scripts/gen-infrastructure-page.mjs — INFRA-PAGE-1 (INFRA-MAP-COPY-1 rework,
 * 2026-09-21 humanize pass).
 *
 * Generates repo/infrastructure.html from data/infra-registry.json (the
 * derived registry written by gen-infra-registry.mjs — never hand-listed):
 * canonical chrome copied byte-style from start.html (head CSS, nav, canonical
 * footer), one section per `ain:category` enum value in enum order, a card per
 * registry entry (title, description, Open link, fact chips), a
 * data-count="infra_pages" sentinel, and JSON-LD CollectionPage whose
 * mainEntity is an ItemList of the cards this page renders.
 *
 * What the humanize pass changed (why this file no longer renders the
 * registry verbatim):
 *   · GUIDE ROWS SPLIT OUT. 130 of the registry rows are domain hubs and
 *     integration guides; rendering them inline buried the seven working
 *     sections under a two-hundred-card wall. They render on
 *     hub-for-hubs.html (gen-hub-for-hubs-page.mjs, same registry), and this
 *     page carries a pointer section (id="hubs") with three start-here cards
 *     so the split costs one click, not a dead end.
 *   · DISPLAY COPY. Titles/descriptions render through scripts/lib/infra-map.mjs:
 *     authored overrides (data/infra-copy-overrides.json) for the rows whose
 *     source meta is truncated or empty, deterministic suffix cleanup for the
 *     SEO-stuffed titles, and a hard error if any card would render without a
 *     description. The registry file itself is never mutated.
 *   · HUMAN NAVIGATION. A persona-bar jump strip under the hero (anchor to
 *     each section), section counts computed at render (this page is derived,
 *     so render-time numbers regenerate with the registry — they are not
 *     hand-typed), and section headings that say what the section is for.
 *
 * Deterministic: pure function of the registry + overrides + chrome sources
 * (no wall-clock), so --check byte-compares and the idempotency proof is a
 * two-run byte comparison.
 *
 * Usage:
 *   node scripts/gen-infrastructure-page.mjs           # write
 *   node scripts/gen-infrastructure-page.mjs --check   # byte-compare, exit 1 on drift
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from './gen-infra-registry.mjs';
import {
  REPO, readRegistry, loadOverrides, validateOverrides,
  renderCard, renderTitle, esc, jumpBar, readStartChrome,
} from './lib/infra-map.mjs';

const CHECK = process.argv.includes('--check');
const OUT_REL = 'infrastructure.html';

const CATEGORY_LABELS = {
  run: 'Run', verify: 'Verify', anchor: 'Anchor', convert: 'Convert',
  agents: 'Agents', learn: 'Learn', helm: 'Helm', guide: 'Guide',
};
// Section headings say what the section is for, in plain sentences. The old
// rule-of-three headings ("Execute tools, workflows, and agent automations")
// were exactly the catalog copy this page exists to replace.
const CATEGORY_BLURBS = {
  run: 'Tools and workflows you can run',
  verify: 'Places to verify an artifact, a receipt, or a conformance claim',
  anchor: 'Timestamping, signing, and keeping the record',
  convert: 'Turning documents into verifiable artifacts',
  agents: 'Connecting agents: MCP, WebMCP, prompts, and kits',
  learn: 'Explainers, specs, and the evidence model',
  helm: 'Helm, the air-gapped control plane',
  guide: 'Domain integration guides and hubs',
};
const FACT_LABELS = {
  webmcp: 'WebMCP', deeplink: 'Deep-link', policy_mandate_export: 'Mandate export', jsonld: 'JSON-LD',
};

// The start-here cards in the hubs pointer section. Registry paths of GUIDE
// rows, so every card below links a real hub; the first card points at the
// full split-out catalog. Keep this list short — the point of the split is
// that this page stops being the hub catalog.
const HUB_STARTERS = [
  'guides/agentic-commerce-mcp-hub.html',
  'guides/aml-kyc-compliance-hub.html',
  'guides/core-infrastructure-hub.html',
];

function renderPage(registry, overrides, chrome) {
  const total = registry.length;
  const guideRows = registry.filter(r => r.category === 'guide');

  // Every card this page renders, section by section. Featured rows surface
  // first (the registry scrapes ain:featured; almost nothing sets it today),
  // then display-title order so the cleanup actually drives the sort.
  const sections = CATEGORIES.filter(c => c !== 'guide').map(cat => {
    const rows = registry
      .filter(r => r.category === cat)
      .sort((a, b) =>
        ((a.featured ? 0 : 1) - (b.featured ? 0 : 1))
        || renderTitle(a, overrides).localeCompare(renderTitle(b, overrides))
        || a.path.localeCompare(b.path));
    return { cat, rows };
  }).filter(s => s.rows.length);

  const cardsJsonLd = [];
  let body = '';
  for (const { cat, rows } of sections) {
    body += `<section class="section" id="${cat}" aria-label="${CATEGORY_LABELS[cat]} surfaces">\n  <div class="container">\n`;
    body += `    <div class="sec-label">${CATEGORY_LABELS[cat]} · ${rows.length}</div>\n`;
    body += `    <h2 class="sec-heading">${esc(CATEGORY_BLURBS[cat])}</h2>\n`;
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

  // Hubs & guides pointer: the guide rows live on hub-for-hubs.html; this
  // section is the bridge, not a second catalog.
  const starters = HUB_STARTERS.map(p => {
    const row = registry.find(r => r.path === p);
    if (!row || row.category !== 'guide') {
      throw new Error(`HUB_STARTERS names ${p}, which is not a guide-category registry row`);
    }
    return renderCard(row, overrides, FACT_LABELS);
  }).join('');
  body += `<section class="section" id="hubs" aria-label="Hubs and guides">
  <div class="container">
    <div class="sec-label">Guide · ${guideRows.length}</div>
    <h2 class="sec-heading">Hubs and guides have their own map</h2>
    <p class="hero-sub">Domain hubs collect the tools and chains for one desk or one rulebook; single-purpose guides answer one question apiece. All <span data-count="guide_pages">${guideRows.length}</span> of them are grouped by desk on <a href="hub-for-hubs.html">the hubs and guides map</a>. Three to start with:</p>
    <div class="recipe-grid">
      <a class="recipe-card" href="hub-for-hubs.html">
        <div class="recipe-title">All hubs and guides, on one map</div>
        <div class="recipe-outcome">The full catalog of domain hubs and integration guides, clustered by the work they support: payments, regulation, markets and treasury, risk, tokenization, trade, agents, the OpenChainGraph platform, and evidence.</div>
        <div class="recipe-go">Browse</div>
      </a>
${starters}    </div>
  </div>
</section>
`;

  const jumpLinks = sections.map(s => ({ id: s.cat, label: CATEGORY_LABELS[s.cat] }));
  jumpLinks.push({ id: 'hubs', label: 'Hubs & guides' });

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AINumbers.co Infrastructure Map',
    description: `The generated map of AINumbers.co: ${total} pages across ${CATEGORIES.length} categories, grouped by the job each page does. Domain hubs and integration guides have their own map.`,
    url: 'https://ainumbers.co/infrastructure.html',
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
<meta name="description" content="The generated map of AINumbers.co: ${total} pages across ${CATEGORIES.length} categories, grouped by the job each page does. Domain hubs and integration guides live on their own map at hub-for-hubs.html.">
<meta name="ain:category" content="learn">
<title>Infrastructure Map | AINumbers.co</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${chrome.css}
${chrome.footerCss}
/* INFRA-PAGE-1 page-local additions */
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
    <div class="hero-eyebrow">Site map</div>
    <h1>Every page on this site, grouped by the job it does</h1>
    <p class="hero-sub">This map is generated from the page registry, so a shipped page cannot quietly go missing: a page exists, therefore it is listed here. <span data-count="infra_pages">${total}</span> pages across ${CATEGORIES.length} categories, each declared by a category tag in the page's own head. The <span data-count="guide_pages">${guideRows.length}</span> domain hubs and guides are a map of their own, so the sections below stay browsable. Surfaces with dedicated catalogs keep them: <a href="tools.html">tools</a>, the <a href="chaingraph/chaingraph-hub.html">workflow hub</a>, and <a href="sitemap.html">sitemap</a>.</p>
  </div>
</section>

${jumpBar('Jump to', jumpLinks)}

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
  console.error('gen-infrastructure-page: data/infra-registry.json missing. Run `node scripts/gen-infra-registry.mjs` first.');
  process.exit(1);
}
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const overrides = loadOverrides();
validateOverrides(overrides, registry);
const chrome = readStartChrome();
const out = renderPage(registry, overrides, chrome);
const target = resolve(REPO, OUT_REL);
const exists = existsSync(target);
const current = exists ? readFileSync(target, 'utf8') : '';

if (CHECK) {
  if (!exists) {
    console.error(`gen-infrastructure-page --check: ${OUT_REL} is missing. Run \`node scripts/gen-infrastructure-page.mjs\`.`);
    process.exit(1);
  }
  if (current !== out) {
    console.error(`gen-infrastructure-page --check: ${OUT_REL} is stale. Run \`node scripts/gen-infrastructure-page.mjs\`.`);
    process.exit(1);
  }
  console.log(`gen-infrastructure-page --check: OK (${registry.length} registry rows, byte-exact).`);
  process.exit(0);
}
writeFileSync(target, out, 'utf8');
console.log(`gen-infrastructure-page: wrote ${OUT_REL} (${registry.length} registry rows; guide rows render on hub-for-hubs.html).`);
