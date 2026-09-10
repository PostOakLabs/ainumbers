#!/usr/bin/env node
/**
 * scripts/gen-infrastructure-page.mjs — INFRA-PAGE-1.
 *
 * Generates repo/infrastructure.html from data/infra-registry.json (the
 * derived registry written by gen-infra-registry.mjs — never hand-listed):
 * canonical chrome copied byte-style from start.html (head CSS, nav, canonical
 * footer), one section per `ain:category` enum value in enum order, a card per
 * registry entry (title, description, Open link, fact chips), a
 * data-count="infra_pages" sentinel, and JSON-LD CollectionPage whose
 * mainEntity is an ItemList of every card (position, name, url).
 *
 * Deterministic: pure function of the registry + chrome sources (no
 * wall-clock), so --check byte-compares and the idempotency proof is a
 * two-run byte comparison.
 *
 * Usage:
 *   node scripts/gen-infrastructure-page.mjs           # write
 *   node scripts/gen-infrastructure-page.mjs --check   # byte-compare, exit 1 on drift
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from './gen-infra-registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHECK = process.argv.includes('--check');
const OUT_REL = 'infrastructure.html';
const START = resolve(REPO, 'start.html');

const CATEGORY_LABELS = {
  run: 'Run', verify: 'Verify', anchor: 'Anchor', convert: 'Convert',
  agents: 'Agents', learn: 'Learn', helm: 'Helm', guide: 'Guide',
};
const CATEGORY_BLURBS = {
  run: 'Execute tools, workflows, and agent automations',
  verify: 'Check artifacts, receipts, and conformance claims',
  anchor: 'Timestamp, sign, and keep the record',
  convert: 'Convert documents and exports into verifiable artifacts',
  agents: 'Connect agents: MCP, WebMCP, prompts, and kits',
  learn: 'Understand the suite, the standard, and the evidence model',
  helm: 'The Helm air-gapped control plane',
  guide: 'Domain integration guides and hubs',
};
const FACT_LABELS = {
  webmcp: 'WebMCP', deeplink: 'Deep-link', policy_mandate_export: 'Mandate export', jsonld: 'JSON-LD',
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Copy hallmarks (CONTRACT §1.4): titles/descriptions are sourced from other
// pages' data and can carry em-dashes that gate-scan as visible text here.
// Sanitize at render, exactly like gen-start-index.mjs's sanitizeCopy for the
// same class of sourced copy (source data in the registry is left untouched).
function sanitizeCopy(s) {
  // "adjudication" is on the insider-register copy-ban list (check-copy-hallmarks);
  // sourced descriptions that carry it render as "review" here only.
  return String(s || '').replace(/—/g, ', ').replace(/\s+--\s+/g, ', ').replace(/adjudicat\w*/gi, 'review').replace(/\s{2,}/g, ' ').trim();
}

function extractChrome(startHtml) {
  // head CSS: everything inside the single <style> block
  const styleOpen = startHtml.indexOf('<style>');
  const styleClose = startHtml.indexOf('</style>');
  if (styleOpen === -1 || styleClose === -1) throw new Error('chrome: <style> not found in start.html');
  const css = startHtml.slice(styleOpen + '<style>'.length, styleClose);
  // nav: from <nav to </nav>
  const navOpen = startHtml.indexOf('<nav aria-label="Site navigation">');
  const navClose = startHtml.indexOf('</nav>');
  if (navOpen === -1 || navClose === -1) throw new Error('chrome: nav not found in start.html');
  const nav = startHtml.slice(navOpen, navClose + '</nav>'.length);
  // canonical footer: the ROOT-FOOTER sentinel region
  const fOpen = startHtml.indexOf('ROOT-FOOTER:START');
  const fClose = startHtml.indexOf('ROOT-FOOTER:END');
  if (fOpen === -1 || fClose === -1) throw new Error('chrome: ROOT-FOOTER sentinels not found in start.html');
  const footer = startHtml.slice(startHtml.indexOf('\n', fOpen) + 1, startHtml.lastIndexOf('\n', fClose));
  const footerCssOpen = startHtml.indexOf('ROOT-FOOTER-CSS:START');
  const footerCssClose = startHtml.indexOf('ROOT-FOOTER-CSS:END');
  const footerCss = startHtml.slice(startHtml.indexOf('\n', footerCssOpen) + 1, startHtml.lastIndexOf('\n', footerCssClose));
  return { css, nav, footer, footerCss };
}

function renderPage(registry, chrome) {
  const total = registry.length;
  const cardsJsonLd = registry.map((r, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: sanitizeCopy(r.title),
    url: `https://ainumbers.co/${r.path}`,
  }));
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AINumbers.co Infrastructure Map',
    description: `The generated map of every non-tool page on AINumbers.co: ${total} pages across ${CATEGORIES.length} categories. A page exists, so it is on this map.`,
    url: 'https://ainumbers.co/infrastructure.html',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: cardsJsonLd,
    },
  };

  let body = '';
  for (const cat of CATEGORIES) {
    const rows = registry.filter(r => r.category === cat);
    if (!rows.length) continue;
    body += `<section class="section" aria-label="${CATEGORY_LABELS[cat]} surfaces">\n  <div class="container">\n`;
    body += `    <div class="sec-label">${CATEGORY_LABELS[cat]}</div>\n`;
    body += `    <h2 class="sec-heading">${esc(CATEGORY_BLURBS[cat])}</h2>\n`;
    body += `    <div class="recipe-grid">\n`;
    for (const r of rows) {
      const chips = Object.entries(r.facts).filter(([, v]) => v)
        .map(([k]) => `<span class="fact-chip">${FACT_LABELS[k]}</span>`).join('');
      body += `      <a class="recipe-card" href="${esc(r.path)}">\n`;
      body += `        <div class="recipe-title">${esc(sanitizeCopy(r.title))}</div>\n`;
      if (r.description) body += `        <div class="recipe-outcome">${esc(sanitizeCopy(r.description))}</div>\n`;
      if (chips) body += `        <div class="fact-row">${chips}</div>\n`;
      body += `        <div class="recipe-go">Open</div>\n`;
      body += `      </a>\n`;
    }
    body += `    </div>\n  </div>\n</section>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'none';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="The generated infrastructure map of AINumbers.co: ${total} pages across ${CATEGORIES.length} categories, derived from the page registry so no built surface can drift off the map.">
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
    <div class="hero-eyebrow">&#9312; Run</div>
    <h1>Every page on this site, on one map</h1>
    <p class="hero-sub">This page is generated from the site page registry, so a built surface cannot drift off the map: a page exists, therefore it appears here. <span data-count="infra_pages">${total}</span> pages across ${CATEGORIES.length} categories, each declared by a category tag in its own head. The page catalogs remain separate: <a href="tools.html">tools</a>, the <a href="chaingraph/chaingraph-hub.html">workflow hub</a>, and <a href="sitemap.html">sitemap</a>.</p>
  </div>
</section>

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
const chrome = extractChrome(readFileSync(START, 'utf8'));
const out = renderPage(registry, chrome);
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
  console.log(`gen-infrastructure-page --check: OK (${registry.length} cards, byte-exact).`);
  process.exit(0);
}
writeFileSync(target, out, 'utf8');
console.log(`gen-infrastructure-page: wrote ${OUT_REL} (${registry.length} cards across ${CATEGORIES.filter(c => registry.some(r => r.category === c)).length} categories).`);
