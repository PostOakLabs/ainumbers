#!/usr/bin/env node
/**
 * scripts/gen-infra-registry.mjs — INFRA-PAGE-1.
 *
 * Derives the non-tool page registry (data/infra-registry.json) from the pages
 * themselves. The registry is DERIVED, never hand-listed (anchor:
 * research/INFRA-UTILITY-ENHANCEMENTS-2026-09-05.md §5.1): a page exists ⇒ it
 * is on the map, by construction.
 *
 * Scope (walks scripts/published-dirs.json, the same scope manifest
 * regen-sitemap.mjs and verify_repo.py read, so generator and scope cannot
 * drift): every published .html OUTSIDE the page families that already have
 * their own catalogs — node pages (chaingraph.json urls), tools/*.html,
 * chaingraph/chains/*.html — and OUTSIDE the redirect-shim class
 * check-nav-reachability.mjs auto-exempts (<meta http-equiv="refresh"> or
 * robots noindex).
 *
 * DELIBERATELY EXEMPT pages (each with the reason; kept here so the omission
 * reads as a decision):
 *   start.html                       — the fence of INFRA-PAGE-1 forbids editing it
 *                                      (START-AGENTS-ROW-1 owns it); tagged there by that row.
 *   tools.html / sitemap.html /
 *   chaingraph/chaingraph-hub.html /
 *   guides/index.html                — catalog surfaces (single-writer derived artifacts
 *                                      whose generators own the whole file; a PR cannot
 *                                      carry a hand meta tag through regen).
 *   euc-register.html /
 *   chaingraph/integrator-profile.html /
 *   chaingraph/conformance-roster.html /
 *   chaingraph/clause-edge-report.html /
 *   chaingraph/kernel-vm-explainer.html /
 *   docs/index.html                  — whole-file derived artifacts of single-writer
 *                                      generators outside this row's fence; their
 *                                      meta tags belong to those generators.
 *
 * Per page: { path, title, description, category, featured,
 *             facts: { webmcp, deeplink, policy_mandate_export, jsonld } },
 * sorted by category (enum order) then title.
 *
 * Idempotency proof: --check regenerates in memory and byte-compares; the
 * generator is a pure function of committed sources (no wall-clock field).
 *
 * Usage:
 *   node scripts/gen-infra-registry.mjs           # write
 *   node scripts/gen-infra-registry.mjs --check   # byte-compare, exit 1 on drift
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHECK = process.argv.includes('--check');
const OUT_REL = 'data/infra-registry.json';

export const CATEGORIES = ['run', 'verify', 'anchor', 'convert', 'agents', 'learn', 'helm', 'guide'];

const EXEMPT = new Map([
  ['start.html', 'START-AGENTS-ROW-1 owns start.html; INFRA-PAGE-1 fence forbids editing it'],
  ['tools.html', 'catalog surface; single-writer derived (regen_catalog.py)'],
  ['sitemap.html', 'catalog surface; single-writer derived (gen-sitemap-html.mjs)'],
  ['chaingraph/chaingraph-hub.html', 'node/chain catalog; single-writer derived (gen-chaingraph-hub.mjs)'],
  ['guides/index.html', 'guides directory index; single-writer derived (gen-guides-index.mjs)'],
  ['euc-register.html', 'whole-file derived artifact (gen-euc-register-page.mjs)'],
  ['chaingraph/integrator-profile.html', 'whole-file derived artifact (gen-integrator-profile.mjs)'],
  ['chaingraph/conformance-roster.html', 'whole-file derived artifact (gen-ocg-conformance-roster.mjs)'],
  ['chaingraph/clause-edge-report.html', 'whole-file derived artifact (gen-clause-edge-report-page.mjs)'],
  ['chaingraph/kernel-vm-explainer.html', 'whole-file derived artifact (gen-kernel-vm-explainer.mjs)'],
  ['chaingraph/agentic-payments-map.html', 'whole-file derived artifact (gen-agentic-payments-map.mjs: --check byte-compares the whole page against its ROWS source table; a hand meta tag drifts it)'],
  ['chaingraph/kernel-vm.html', 'whole-file derived artifact (chaingraph/vm/scripts/gen-kernel-vm-html.mjs: --check byte-compares the whole page; a hand meta tag drifts it)'],
  // infrastructure.html: gen-infrastructure-page.mjs renders the registry's own
  // row count INTO the page's meta description ("...${total} pages across..."),
  // so scanning the page back here made the main-side regen a two-pass cascade
  // the moment the row set changed (#1864 added prompts.html, 201→202; Derived
  // Artifacts Regen run 34679819552 failed "the regen pass is NOT a fixpoint —
  // infra-registry was stale after pass 1 and fresh after pass 2", and no
  // COVERED ordering can close a read-back cycle: the registry row is scanned
  // from the page while the page is rendered from the registry). Same class as
  // the whole-file exemptions above: the page's meta tags belong to its
  // generator. (MAIN-REGEN-INFRA-REGISTRY-FIXPOINT-1)
  ['infrastructure.html', 'whole-file derived artifact (gen-infrastructure-page.mjs)'],
  ['docs/index.html', 'whole-file derived artifact (gen-openapi.mjs)'],
]);

function collect(dir, rel, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      collect(join(dir, e.name), r, out);
    } else if (/\.html?$/i.test(e.name)) {
      out.push(r);
    }
  }
}

function titleOf(html, fallback) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return fallback;
  return m[1].replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).split('|')[0].trim() || fallback;
}
function descOf(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
    || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  if (!m) return '';
  return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function isShim(html) {
  const t = html.replace(/\s+/g, '');
  return /http-equiv=["']?refresh/i.test(t) || /name=["']?robots["']?content=["'][^"']*noindex/i.test(t);
}

export function buildRegistry(repo = REPO) {
  // node pages: chaingraph.json urls
  let nodeUrls = new Set();
  try {
    const cg = JSON.parse(readFileSync(join(repo, 'chaingraph', 'chaingraph.json'), 'utf8'));
    nodeUrls = new Set((cg.nodes || []).map(n => (n.url || '').replace('https://ainumbers.co/', '')));
  } catch { /* no graph — scope stays page-derived */ }

  const dirs = ['guides', 'disclosures', 'docs', 'ledger', 'trust', 'chaingraph', 'attestations'];
  const all = [];
  collect(repo, '', all);

  const inScope = all.filter(p => {
    if (EXEMPT.has(p)) return false;
    if (p.startsWith('tools/') || p.startsWith('chaingraph/chains/')) return false;
    if (p.startsWith('scripts/')) return false; // not a published directory
    if (nodeUrls.has(p)) return false;
    return true;
  });

  const rows = [];
  for (const rel of inScope) {
    const full = join(repo, rel);
    let html = '';
    try { html = readFileSync(full, 'utf8'); } catch { continue; }
    if (isShim(html)) continue;
    const m = html.match(/<meta\s+name=["']ain:category["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']ain:category["']/i);
    if (!m) continue; // the gate (check-infra-registry.mjs) reds this; the registry lists only tagged pages
    const featM = html.match(/<meta\s+name=["']ain:featured["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']ain:featured["']/i);
    rows.push({
      path: rel,
      title: titleOf(html, rel),
      description: descOf(html),
      category: m[1],
      featured: featM ? featM[1] : null,
      facts: {
        webmcp: html.includes('registerTool('),
        deeplink: html.includes('AIN_BRIDGE_CFG'),
        policy_mandate_export: html.includes('ap2ExportBtn'),
        jsonld: html.includes('application/ld+json'),
      },
    });
  }
  rows.sort((a, b) =>
    (CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category))
    || a.title.localeCompare(b.title)
    || a.path.localeCompare(b.path));
  return rows;
}

export function renderRegistry(repo = REPO) {
  return JSON.stringify(buildRegistry(repo), null, 2) + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const out = renderRegistry();
  const target = resolve(REPO, OUT_REL);
  const exists = existsSync(target);
  const current = exists ? readFileSync(target, 'utf8') : '';
  if (CHECK) {
    if (!exists) {
      console.error(`gen-infra-registry --check: ${OUT_REL} is missing. Run \`node scripts/gen-infra-registry.mjs\`.`);
      process.exit(1);
    }
    if (current !== out) {
      console.error(`gen-infra-registry --check: ${OUT_REL} is stale. Run \`node scripts/gen-infra-registry.mjs\`.`);
      process.exit(1);
    }
    console.log(`gen-infra-registry --check: OK (${buildRegistry().length} entries, byte-exact).`);
    process.exit(0);
  }
  writeFileSync(target, out, 'utf8');
  console.log(`gen-infra-registry: wrote ${OUT_REL} (${buildRegistry().length} entries, sorted by category then title).`);
}
