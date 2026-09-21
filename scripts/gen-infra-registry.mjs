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
 * Per page: { path, title, description, description_source, category, featured,
 *             facts: { webmcp, deeplink, policy_mandate_export, jsonld } },
 * sorted by category (enum order) then title.
 *
 * description_source is "page" for an ordinary page and "attr-rule" for a page
 * whose description carries a verify-counts count sentinel: those pages stay in
 * scope, but the count digits are elided from the description the registry
 * captures, because `verify-counts --fix` rewrites them later in the same regen
 * pass (INFRA-REGISTRY-EXEMPT-SCOPE-FIX-1; see the DESCRIPTION_RULES note).
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
import { descriptionRulesByFile } from './lib/count-rules.mjs';
import { hubCountsFromHtml, hubCountPhrase, stripHubCountNumeral } from './counts.mjs';
import { isSkipDir } from './_walk-skip-dirs.mjs';

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
  // hub-for-hubs.html: same class as infrastructure.html directly above — the
  // guide-cluster catalog page HUB-FOR-HUBS-1 renders FROM this registry, so
  // scanning it back would list the map on itself and re-open the read-back
  // cycle the infrastructure.html exemption exists to prevent. Its meta tags
  // belong to its generator (gen-hub-for-hubs-page.mjs).
  ['hub-for-hubs.html', 'whole-file derived artifact (gen-hub-for-hubs-page.mjs)'],
  ['docs/index.html', 'whole-file derived artifact (gen-openapi.mjs)'],
  // mcp.html: verify-counts.mjs (the 'counts' COVERED entry, which runs AFTER
  // infra-registry) rewrites the tool/workflow counts inside the page's meta
  // description ("...N browser-based fintech tools and M MCP-callable,
  // hash-anchored OpenChainGraph workflows..."). Scanning that description back
  // here re-opened the read-back cycle the moment the chain count moved
  // (#1879 retired a chain, 369->368; Derived Artifacts Regen run 34716467766
  // failed "the regen pass is NOT a fixpoint - infra-registry was stale after
  // pass 1 and fresh after pass 2"). Same class as infrastructure.html above:
  // the page's meta tags belong to its generator.
  // (MAIN-REGEN-INFRA-REGISTRY-FIXPOINT-2)
  ['mcp.html', 'whole-file derived artifact (sync-stats.mjs counts + verify-counts.mjs meta sentinels)'],
]);

// REGEN-INFRA-REGISTRY-READBACK-CYCLE-1 (semantics corrected by
// INFRA-REGISTRY-EXEMPT-SCOPE-FIX-1) — every file carrying a *description* rule
// in scripts/lib/count-rules.mjs (the table this module and verify-counts.mjs
// share) has that description rewritten by `verify-counts --fix`: the 'counts'
// COVERED entry, which runs AFTER this generator in the regen pass
// (infra-registry → infrastructure-page → counts, an order
// check-derived-fanout-coverage.mjs enforces). Reading those count DIGITS back
// here can never agree with the end-of-pass tree — a true read-back cycle no
// COVERED ordering can close (measured on main: #1879 moved index.html's chain
// count 369→368 under the registry's captured "369 MCP-callable" description
// and every Derived Artifacts Regen since 20:13Z refused the non-fixpoint).
//
// ⛔ The cut is the DIGITS, NOT the page. The first version of this exemption
// added these files to EXEMPT, which is the SCOPE list (:inScope below) — so a
// page merely carrying a hub-count sentinel silently dropped out of the
// registry and therefore off infrastructure.html altogether (measured: the
// dora / fraud-risk / sme / tradetech hubs, 4-for-4). A page stays IN scope;
// only the count digits inside the description it publishes are neutralised,
// which makes the read a fixpoint under the later --fix rewrite, and the entry
// records description_source: "attr-rule" so the elision is legible.
// Derived, not hand-listed, so a future description sentinel extends the
// behaviour in the same diff instead of silently re-opening the cycle.
const DESCRIPTION_RULES = descriptionRulesByFile();

function collect(dir, rel, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      // REGEN-WT-SCOPE-POISON-1: was `.git`/`node_modules` name checks only, so
      // a regen inside the shared clone (which hosts repo/.wt/ with 195
      // worktrees) walked worktree scaffolding as published pages — infra-
      // registry 203 → 17258 rows, +240K lines. The shared skip-list (the ONE
      // place, WT-IGNORE-GATES-1) excludes every .wt//.git/dot-dir scaffold
      // while keeping .well-known visible.
      if (isSkipDir(e.name)) continue;
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
/**
 * Remove the count digits `verify-counts --fix` owns from a page's markup, so
 * whatever is read out of it afterwards is invariant under that later rewrite.
 * Only the description-labelled rules for THIS page are applied, and only to
 * the in-memory copy the description is read from — titles, facts and every
 * other page are untouched. (INFRA-REGISTRY-EXEMPT-SCOPE-FIX-1.)
 */
function maskCountDigits(html, rel) {
  const rules = DESCRIPTION_RULES.get(rel);
  if (!rules) return html;
  // ⛔ Collect every rule's span against the UNMODIFIED page, then splice.
  // The rules CHAIN: a later rule's prefix re-matches the digits an earlier
  // rule owns (index.html's `chains` rule requires
  // `content="\d+ browser-based fintech tools and `). Masking rule-by-rule
  // therefore turns every chained rule into a silent NO-MATCH and leaves its
  // digits in the captured description — which is exactly the read-back cycle
  // this function exists to cut (measured: the chain count 368 survived into
  // data/infra-registry.json, the #1879 digit).
  // group 1 = prefix, group 2 = the count, group 3 (when present) = suffix —
  // the same shape verify-counts.mjs's own --fix replacement relies on.
  const spans = [];
  for (const { regex } of rules) {
    const flags = new Set([...regex.flags, 'g', 'd']);
    const re = new RegExp(regex.source, [...flags].join(''));
    for (const m of html.matchAll(re)) {
      const at = m.indices && m.indices[2];
      if (at) spans.push(at);
    }
  }
  if (!spans.length) return html;
  spans.sort((a, b) => b[0] - a[0]);
  let out = html;
  let cutFrom = Infinity;
  for (const [start, end] of spans) {
    if (end > cutFrom) continue; // duplicate or overlapping span, already cut
    out = out.slice(0, start) + out.slice(end);
    cutFrom = start;
  }
  return out;
}

function descOf(html, rel) {
  const source = rel === undefined ? html : maskCountDigits(html, rel);
  const m = source.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
    || source.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  if (!m) return '';
  return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}
// hubDirFor — 'guides' for guides/*-hub.html, 'chaingraph' for chaingraph/guide-*.html,
// null otherwise (HUB-COUNT-DERIVE-AT-REGEN-1). Same two families deriveHubCounts()
// walks, matched off the registry's own `rel` path instead of a second directory scan.
function hubDirFor(rel) {
  if (rel.startsWith('guides/') && rel.endsWith('-hub.html')) return 'guides';
  if (rel.startsWith('chaingraph/guide-') && rel.endsWith('.html')) return 'chaingraph';
  return null;
}

// hubDescription — strips any typed "<N> tools" numeral out of a hub page's description and
// appends the computed hubCountPhrase, derived from the SAME html string already read for
// this row (never a second disk read of the real repo — buildRegistry stays a pure function
// of `repo`, so a temp-dir test fixture with no cards computes an empty phrase and is
// unaffected). A hub with 0 cards therefore renders no count phrase; a non-hub page (hubDir
// null) is returned unchanged.
function hubDescription(html, rel, description) {
  const hubDir = hubDirFor(rel);
  if (!hubDir) return description;
  const phrase = hubCountPhrase(hubCountsFromHtml(html, hubDir));
  const stripped = stripHubCountNumeral(description);
  return phrase ? `${stripped} (${phrase})`.trim() : stripped;
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
      description: hubDescription(html, rel, descOf(html, rel)),
      description_source: DESCRIPTION_RULES.has(rel) ? 'attr-rule' : 'page',
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
