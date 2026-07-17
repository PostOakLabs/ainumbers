#!/usr/bin/env node
/**
 * scripts/gen-sitemap-html.mjs
 *
 * Regenerates sitemap.html's category/link content from the same sources every
 * other section of the site already trusts: tools.html (tool-card grid, the
 * live tool taxonomy), chaingraph.json (live OCG nodes), and filesystem scans
 * of guides/ + chaingraph/ for content that isn't tracked in either SSOT.
 *
 * Fixes the drift documented in SITEMAP-1-BUILD-SPEC.md §M1: sitemap.html was
 * hand-maintained and hadn't been regenerated since 2026-07-09 — missing all
 * 85 guides, 272/313 chaingraph nodes, all 28 chaingraph topic guides, and 11
 * chaingraph infra pages, while carrying a stale 21-category taxonomy that no
 * longer matches tools.html's 32.
 *
 * Usage:
 *   node scripts/gen-sitemap-html.mjs          # regenerate
 *   node scripts/gen-sitemap-html.mjs --check  # freshness gate (exit 1 if stale)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveCounts } from './counts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const TARGET = resolve(REPO, 'sitemap.html');
const CHECK = process.argv.includes('--check');

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return fallback;
  return m[1].split('|')[0].trim();
}

function extractDesc(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? m[1].trim() : '';
}

// Source copy (tools.html card-desc, chaingraph.json node descriptions, page
// <title>/<meta description>) was authored for other contexts and can carry
// CONTRACT §1.4 copy-hallmarks (em-dash) that the sitemap gate disallows in
// newly-rendered visible text — scrub before display, same pattern as
// gen-chain-index.mjs's sanitizeCopy (source files are left untouched).
function sanitizeCopy(s) {
  return String(s)
    .replace(/—/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function truncate(s, n) {
  const clean = String(s).trim();
  return clean.length > n ? clean.slice(0, n).trim() + '…' : clean;
}

function slug(filename) {
  return filename.replace(/\.html$/, '');
}

// ---------------------------------------------------------------------------
// 1. Tool categories — sourced from tools.html, the live tool-card grid.
// ---------------------------------------------------------------------------
const toolsHtml = readFileSync(resolve(REPO, 'tools.html'), 'utf8');

const headingNames = new Map();
{
  const re = /<div class="cat-heading"[^>]*id="([^"]+)"[^>]*>[\s\S]*?<h2 class="cat-name">([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = re.exec(toolsHtml))) {
    headingNames.set(m[1], m[2].replace(/&amp;/g, '&').trim());
  }
  const rbeTitleM = toolsHtml.match(/<h2 class="ai-title">([\s\S]*?)<\/h2>/);
  headingNames.set('rbe', rbeTitleM ? rbeTitleM[1].trim() : 'RBE Suite: Rule-Based Engine');
}

const catOrder = [];
const catTools = new Map();
{
  const re = /<a\s+href="(tools\/[^"]+\.html)"\s+class="tool-card"([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(toolsHtml))) {
    const [, href, attrs, body] = m;
    const catM = attrs.match(/data-cat="([^"]+)"/);
    const nameM = attrs.match(/data-name="([^"]+)"/);
    if (!catM || !nameM) continue;
    const cat = catM[1];
    const name = nameM[1].replace(/&amp;/g, '&');
    const descM = body.match(/<div class="card-desc">([\s\S]*?)<\/div>/);
    const desc = descM ? descM[1].replace(/&amp;/g, '&').trim() : '';
    if (!catTools.has(cat)) { catTools.set(cat, []); catOrder.push(cat); }
    catTools.get(cat).push({ href, name, desc });
  }
}

// ---------------------------------------------------------------------------
// 2. Guides (integration hubs) — guides/*.html.
// ---------------------------------------------------------------------------
function scanHtmlDir(dirPath, relPrefix, filterFn) {
  let entries;
  try { entries = readdirSync(dirPath); } catch { return []; }
  return entries
    .filter(f => f.endsWith('.html') && !f.startsWith('_') && (!filterFn || filterFn(f)))
    .sort()
    .map(f => {
      const html = readFileSync(resolve(dirPath, f), 'utf8');
      const name = slug(f);
      return {
        href: relPrefix + '/' + f,
        name: extractTitle(html, name),
        desc: extractDesc(html),
      };
    });
}

const guides = scanHtmlDir(resolve(REPO, 'guides'), 'guides');

// ---------------------------------------------------------------------------
// 3. ChainGraph nodes — chaingraph.json, live nodes only (avoids orphaned art-*
//    pages leaking in — see §M2).
// ---------------------------------------------------------------------------
const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
function nodeRelHref(n) {
  return (n.url || '').replace('https://ainumbers.co/', '');
}
const ocgNodes = (cg.nodes || [])
  .slice()
  .sort((a, b) => (a.tool_id || '').localeCompare(b.tool_id || ''))
  .map(n => ({
    href: nodeRelHref(n),
    name: n.display_name || n.tool_id,
    desc: n.description || '',
  }));
// Only chaingraph/-hosted node pages are excluded from the "infra" scan below
// (tools/-hosted nodes, e.g. art-migrated pages under tools/, are covered by
// the tools.html category scan instead and would double-count here).
const nodeFilenames = new Set(
  (cg.nodes || [])
    .map(n => nodeRelHref(n))
    .filter(rel => rel.startsWith('chaingraph/'))
    .map(rel => rel.replace('chaingraph/', ''))
);

// ---------------------------------------------------------------------------
// 4. ChainGraph topic guides — chaingraph/guide-*.html.
// ---------------------------------------------------------------------------
const chaingraphGuides = scanHtmlDir(resolve(REPO, 'chaingraph'), 'chaingraph', f => f.startsWith('guide-'));

// ---------------------------------------------------------------------------
// 5. ChainGraph infrastructure — every other chaingraph/*.html not covered
//    above (not a live node, not a guide-* page, not a chains/ composer).
// ---------------------------------------------------------------------------
const chaingraphInfra = scanHtmlDir(
  resolve(REPO, 'chaingraph'),
  'chaingraph',
  f => !f.startsWith('guide-') && !nodeFilenames.has(f)
);

// ---------------------------------------------------------------------------
// 6. Root pages — fixed curated list (too much non-page noise in a root
//    directory scan; audit-check this list stays current as new root pages
//    are added). Extends the prior hand-typed list with the 2 pages the
//    2026-07-14 audit found missing (start.html, credits.html).
// ---------------------------------------------------------------------------
const rootPages = [
  { icon: '🏠', name: 'Home / Tool Suite', href: 'index.html' },
  { icon: '🧭', name: 'Start (guided entry point)', href: 'start.html' },
  { icon: 'ℹ️', name: 'About', href: 'about.html' },
  { icon: '🏅', name: 'Credits', href: 'credits.html' },
  { icon: '⚙️', name: 'Policy Composer (orchestrated)', href: 'chaingraph/chains/agentic-policy.html' },
  { icon: '⚙️', name: 'AML Programme Composer (orchestrated)', href: 'chaingraph/chains/aml-consolidation.html' },
  { icon: '🎯', name: 'Agentic Readiness Diagnostic (A–F)', href: 'chaingraph/art-27-agentic-readiness-diagnostic.html' },
  { icon: '🔌', name: 'MCP Server (docs & connect)', href: 'mcp.html' },
  { icon: '🔁', name: 'Conversion Suite', href: 'convert.html' },
  { icon: '🔌', name: 'Live MCP Apps Server ↗', href: 'https://mcp.ainumbers.co/mcp', ext: true },
  { icon: '📖', name: 'Developer Docs ↗', href: 'https://docs.ainumbers.co', ext: true },
  { icon: '🎯', name: 'MCP Server Deployability Diagnostic (A–F)', href: 'chaingraph/art-28-mcp-server-deployability-diagnostic.html' },
  { icon: '🎯', name: 'DORA Readiness Diagnostic (A–F)', href: 'chaingraph/art-29-dora-readiness-diagnostic.html' },
  { icon: '⚙️', name: 'Card Programme Composer (orchestrated)', href: 'chaingraph/chains/card-programme.html' },
  { icon: '⚙️', name: 'ISO 20022 Cutover Composer (orchestrated)', href: 'chaingraph/chains/iso20022-cutover.html' },
  { icon: '⚙️', name: 'Treasury Corridor Composer (orchestrated)', href: 'chaingraph/chains/treasury-corridor.html' },
  { icon: '🗺', name: 'Sitemap', href: 'sitemap.html', current: true },
  { icon: '💡', name: 'Suggest a Tool or Workflow', href: 'suggest.html' },
  { icon: '✉️', name: 'Contact', href: 'contact.html' },
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderToolRow(item, numLabel) {
  const name = sanitizeCopy(item.name);
  const desc = sanitizeCopy(item.desc);
  const dataName = escHtml((numLabel ? numLabel + ' ' : '') + name).toLowerCase();
  return `            <a href="${escHtml(item.href)}" class="tool-row" data-name="${dataName}">` +
    (numLabel ? `<span class="tool-num">${escHtml(numLabel)}</span>` : '<span class="tool-num">–</span>') +
    `<div class="tool-info"><div class="tool-name">${escHtml(name)}</div>` +
    `<div class="tool-desc">${escHtml(truncate(desc, 160))}</div></div>` +
    `<span class="tool-arrow" aria-hidden="true">→</span></a>`;
}

function renderSection({ id, num, name, desc, rows }) {
  return `          <section class="cat-section" id="${id}" aria-labelledby="${id}-heading">
            <div class="cat-header">
              <span class="cat-num">${escHtml(num)}</span>
              <h2 class="cat-name" id="${id}-heading">${escHtml(sanitizeCopy(name))}</h2>
              <span class="cat-count">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}</span>
            </div>` +
    (desc ? `\n            <p class="cat-desc">${escHtml(sanitizeCopy(desc))}</p>` : '') +
    `\n${rows.map(r => renderToolRow(r)).join('\n')}\n          </section>`;
}

const sections = [];

for (const cat of catOrder) {
  const items = catTools.get(cat);
  const name = headingNames.get(cat) || cat;
  sections.push({ id: cat === 'mcp' ? 'cat-mcp' : cat === 'rbe' ? 'cat-rbe' : cat, num: cat.toUpperCase(), name, desc: '', rows: items });
}
sections.push({ id: 'cat-guides', num: '–', name: 'Integration Guides & Hubs', desc: 'Deep-dive integration hubs for standards, rails, and regulatory frameworks — each links out to the relevant tool suite.', rows: guides });
sections.push({ id: 'cat-ocg-nodes', num: 'OCG', name: 'OpenChainGraph Nodes', desc: 'Every live OpenChainGraph node: single-step, chainable, MCP-callable tools. Composed into multi-step workflows on the OpenChainGraph hub.', rows: ocgNodes });
sections.push({ id: 'cat-ocg-guides', num: 'OCG', name: 'OpenChainGraph Topic Guides', desc: '', rows: chaingraphGuides });
sections.push({ id: 'cat-ocg-infra', num: 'OCG', name: 'OpenChainGraph Infrastructure', desc: 'Spec, verifier, explainer, and utility pages supporting the OpenChainGraph standard.', rows: chaingraphInfra });

const geoBlock = `          <!-- GEO / LLMEO block -->
          <div class="geo-block" aria-label="About AINumbers.co for search engines and language models">
            <p class="geo-title">About this site</p>
            <p class="geo-text">
              <strong>AINumbers.co</strong> is a free, open-source suite of browser-based fintech tools. All tools run entirely client-side using deterministic, rule-based logic, so no data is ever transmitted to a server. Ideal for <strong>payments engineers, compliance professionals, treasury analysts, and fintech product managers</strong> who need to work with payment standards and financial regulations without standing up infrastructure.
              <br><br>
              <strong>Standards covered:</strong> ISO 20022 (pain, pacs, camt, camt), SWIFT MT (MT103, MT202, MT940, MT950), NACHA ACH, FedNow, RTP, SEPA SCT/SCT Inst, IBAN (ISO 13616), BIC (ISO 9362), LEI (ISO 17442), UETR (RFC 4122), MCC (ISO 18245), Visa/Mastercard interchange, Durbin Amendment, DORA, PCI DSS v4, Basel III/IV, IFRS 9, FATF, Peppol, and more.
              <br><br>
              <strong>License:</strong> CC BY 4.0: fork, adapt, and embed freely with attribution.
            </p>
          </div>

`;

const rootPagesBlock = `          <!-- ── SITE PAGES ── -->
          <section class="cat-section" id="pages" aria-labelledby="pages-heading">
            <div class="cat-header">
              <span class="cat-num">–</span>
              <h2 class="cat-name" id="pages-heading">Site Pages</h2>
            </div>
            <div class="page-grid">
${rootPages.map(p => `              <a href="${escHtml(p.href)}" class="page-row"${p.ext ? ' target="_blank" rel="noopener"' : ''}${p.current ? ' aria-current="page"' : ''}><span class="page-icon">${p.icon}</span><span class="page-name">${escHtml(p.name)}</span></a>`).join('\n')}
            </div>
          </section>`;

const anchorBlock = `          <!-- ── ANCHOR SUITE ── -->
          <section class="cat-section" id="cat-anchor" aria-labelledby="cat-anchor-heading">
            <div class="cat-header">
              <span class="cat-num" style="color:var(--teal)">⚓</span>
              <h2 class="cat-name" id="cat-anchor-heading">Anchor Suite</h2>
              <span class="cat-count">6 pages · anchor.ainumbers.co</span>
            </div>
            <p class="cat-desc">Browser-based document timestamping at anchor.ainumbers.co. Hash any file locally with WebCrypto SHA-256, send the hash to independent RFC 3161 timestamp authorities, and verify the receipt forever. Supports OCG v0.7 §20 anchor_bindings for decision artifacts. No file leaves your browser.</p>
            <div class="page-grid">
              <a href="https://anchor.ainumbers.co/" class="page-row"><span class="page-icon">⚓</span><span class="page-name">Anchor Suite home</span></a>
              <a href="https://anchor.ainumbers.co/anchor.html" class="page-row"><span class="page-icon">🔒</span><span class="page-name">Anchor a document</span></a>
              <a href="https://anchor.ainumbers.co/verify.html" class="page-row"><span class="page-icon">✓</span><span class="page-name">Verify a receipt</span></a>
              <a href="https://anchor.ainumbers.co/artifacts.html" class="page-row"><span class="page-icon">📂</span><span class="page-name">Library</span></a>
              <a href="https://anchor.ainumbers.co/integrate.html" class="page-row"><span class="page-icon">🔗</span><span class="page-name">Integrate</span></a>
              <a href="https://anchor.ainumbers.co/docs/" class="page-row"><span class="page-icon">📄</span><span class="page-name">Docs</span></a>
            </div>
          </section>`;

const noResultsBlock = `          <div class="no-results" id="noResults" aria-live="polite">
            <p>No tools match your search. Try a different keyword: payment standard, rail name, regulation, or tool category.</p>
          </div>`;

const categoriesBody = geoBlock +
  sections.map(s => renderSection(s)).join('\n\n') + '\n\n' +
  rootPagesBlock + '\n\n' +
  anchorBlock + '\n\n' +
  noResultsBlock;

const tocLinks = sections
  .map(s => `          <a class="toc-link" href="#${s.id}" onclick="scrollToId('${s.id}',this)"><span class="toc-dot"></span>${escHtml(s.name)}</a>`)
  .concat([
    `          <a class="toc-link" href="#pages" onclick="scrollToId('pages',this)"><span class="toc-dot"></span>Site Pages</a>`,
    `          <a class="toc-link" href="#cat-anchor" onclick="scrollToId('cat-anchor',this)"><span class="toc-dot"></span>Anchor Suite</a>`,
  ])
  .join('\n');

const totalToolRows = sections.reduce((n, s) => n + s.rows.length, 0);
const counts = deriveCounts();
const categoryCount = counts.categories; // SSOT: cat-heading spans in tools.html (does not include rbe, matches counts.mjs doctrine)

// ---------------------------------------------------------------------------
// Splice into sitemap.html via sentinel markers.
// ---------------------------------------------------------------------------
let src = readFileSync(TARGET, 'utf8');
let changed = false;

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function spliceSentinel(text, startTag, endTag, body) {
  const re = new RegExp(`${reEscape(startTag)}[\\s\\S]*?${reEscape(endTag)}`);
  if (!re.test(text)) {
    console.error(`gen-sitemap-html: sentinel ${startTag} ... ${endTag} not found in sitemap.html`);
    process.exit(2);
  }
  const replacement = `${startTag}\n${body}\n          ${endTag}`;
  const next = text.replace(re, replacement);
  if (next !== text) changed = true;
  return next;
}

src = spliceSentinel(
  src,
  '<!-- GEN:SITEMAP-TOC:START (generator-owned — do not hand-edit; regenerate via node scripts/gen-sitemap-html.mjs) -->',
  '<!-- GEN:SITEMAP-TOC:END -->',
  tocLinks
);

src = spliceSentinel(
  src,
  '<!-- GEN:SITEMAP-CATEGORIES:START (generator-owned — do not hand-edit; regenerate via node scripts/gen-sitemap-html.mjs) -->',
  '<!-- GEN:SITEMAP-CATEGORIES:END -->',
  categoriesBody
);

{
  const before = src;
  src = src.replace(/id="hero-cat-n">\d+/, `id="hero-cat-n">${categoryCount}`);
  src = src.replace(/across \d+ categories/, `across ${categoryCount} categories`);
  src = src.replace(/<span id="searchCount" aria-live="polite">\d+ tools<\/span>/, `<span id="searchCount" aria-live="polite">${totalToolRows} tools</span>`);
  src = src.replace(/\/\* GEN:SITEMAP-TOTAL:START \(generator-owned\) \*\/ const TOTAL = \d+; \/\* GEN:SITEMAP-TOTAL:END \*\//, `/* GEN:SITEMAP-TOTAL:START (generator-owned) */ const TOTAL = ${totalToolRows}; /* GEN:SITEMAP-TOTAL:END */`);
  if (src !== before) changed = true;
}

if (CHECK) {
  if (changed || src !== readFileSync(TARGET, 'utf8')) {
    console.error('gen-sitemap-html --check FAIL: sitemap.html is stale. Run: node scripts/gen-sitemap-html.mjs');
    process.exit(1);
  }
  console.log(`gen-sitemap-html --check: OK (${sections.length} sections, ${totalToolRows} entries, ${categoryCount} tool categories).`);
  process.exit(0);
}

writeFileSync(TARGET, src, 'utf8');
console.log(`gen-sitemap-html: regenerated (${sections.length} sections, ${totalToolRows} entries: ${catOrder.reduce((n, c) => n + catTools.get(c).length, 0)} tools + ${guides.length} guides + ${ocgNodes.length} OCG nodes + ${chaingraphGuides.length} OCG guides + ${chaingraphInfra.length} OCG infra).`);
