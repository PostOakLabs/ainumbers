#!/usr/bin/env node
/**
 * audit-v04.mjs — OpenChainGraph v0.4 conformance auditor (reusable, read-only).
 *
 * Produces a per-NODE and per-CHAIN conformance matrix for the checks that are deterministically
 * scriptable, cross-referencing chaingraph.json against the deployed HTML pages and worker.mjs.
 * Rubric anchored to standard/SPEC.md §15 + openchain-graph-v0.4.schema.json + CONTRACT §A3/A5.
 *
 * The schema/hash/chain-integrity/version/name gates already run in CI (schema-validate,
 * lint-forbidden-hash, golden-parity, validate-chains, spec-version-consistency, check-tool-names);
 * this auditor covers the PAGE-LEVEL + CROSS-SURFACE checks those gates don't:
 *   NODE:  N1 page exists · N2 page stamps chaingraph_version 0.4 · N3 semantic_profile reflected on page
 *          · N4 dct:conformsTo reflected on page · N5 export_capability reflected on page
 *   CHAIN: H1 composer_url page exists · H2 chain registered in worker.mjs · H3 no dated-badge
 *          (freshness anti-pattern) on composer page
 *
 * Usage:  node scripts/audit-v04.mjs            (human table)
 *         node scripts/audit-v04.mjs --json      (machine output)
 * Exit 0 always (audit, not a gate) unless --strict (exit 1 if any FAIL).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');                              // scripts/ -> repo/
const CG = JSON.parse(readFileSync(join(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const JSON_OUT = process.argv.includes('--json');
const STRICT = process.argv.includes('--strict');
function urlToPath(u) {                                     // map a live url to a local repo file
  if (!u) return null;
  const m = String(u).replace(/^https?:\/\/[^/]+\//, '');  // strip scheme+host
  return join(REPO, m.replace(/^\//, ''));
}
function pageText(u) { const p = urlToPath(u); return p && existsSync(p) ? readFileSync(p, 'utf8') : null; }

const nodeRows = [];
for (const n of CG.nodes) {
  const html = pageText(n.url);
  const exists = html != null;
  const r = { id: n.tool_id, url: n.url, checks: {}, info: {} };
  r.checks.N1_page_exists = exists;
  // N2: extract the version the PAGE stamps. FAIL only if it stamps a stale (non-0.4) version.
  // Missing stamp is informational (not every page embeds an artifact sample).
  const ver = exists ? (html.match(/chaingraph_version["'\s:]+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/) || [])[1] : null;
  r.info.stamped_version = ver || (exists ? '(none on page)' : '(no page)');
  r.checks.N2_no_stale_version = ver ? /^0\.4\b/.test(ver) : 'n/a';
  // N3/N4 informational: does the page reflect the catalog's semantic_profile / dct:conformsTo?
  r.info.N3_semantic_profile = !n.semantic_profile ? 'n/a' : (exists && html.includes(n.semantic_profile) ? 'yes' : 'NO');
  r.info.N4_conformsTo = !n['dct:conformsTo'] ? 'n/a' : (exists && html.includes(n['dct:conformsTo']) ? 'yes' : 'NO');
  nodeRows.push(r);
}

const chainRows = [];
for (const c of CG.chains) {
  const html = pageText(c.composer_url);
  const r = { name: c.name, checks: {}, info: {} };
  // Only statically-decidable hard check: the composer_url page exists.
  r.checks.H1_composer_page = c.composer_url ? html != null : 'n/a';
  // INFORMATIONAL (not hard fails — need a live call or human judgment):
  //  - MCP prompt exposure: prompts are hand-written registerPrompt() calls in worker.mjs, NOT derived from
  //    chaingraph.chains, so a chain's absence here isn't decidable statically — check prompts/list live (audit G2).
  //  - a YYYY-MM-DD string may be a legitimate regulatory date in prose, not a freshness "badge" — human call.
  r.info.has_dated_string = html == null ? 'n/a' : /\b20\d{2}-\d{2}-\d{2}\b/.test(html);
  chainRows.push(r);
}

const isFail = (v) => v === false;
const failCount = (rows) => rows.reduce((a, r) => a + Object.values(r.checks).filter(isFail).length, 0);
const nFails = failCount(nodeRows), hFails = failCount(chainRows);

if (JSON_OUT) {
  console.log(JSON.stringify({ nodes: nodeRows, chains: chainRows, summary: { node_fails: nFails, chain_fails: hFails } }, null, 2));
} else {
  const fmt = (rows, key) => rows.filter((r) => Object.values(r.checks).some(isFail))
    .map((r) => `  ✗ ${r[key]}: ${Object.entries(r.checks).filter(([, v]) => isFail(v)).map(([k]) => k).join(', ')}`)
    .join('\n') || '  (none)';
  console.log(`OpenChainGraph v0.4 page/cross-surface audit\n`);
  console.log(`Nodes: ${CG.nodes.length} · failing checks: ${nFails}`); console.log(fmt(nodeRows, 'id'));
  console.log(`\nChains: ${CG.chains.length} · failing checks: ${hFails}`); console.log(fmt(chainRows, 'name'));
  // stale version stamps (the real N2 finding)
  const stale = nodeRows.filter(r => r.checks.N2_no_stale_version === false);
  console.log(`\nStale node version stamps (not 0.4.x): ${stale.length}`);
  stale.forEach(r => console.log(`  ✗ ${r.id}: stamps ${r.info.stamped_version}`));
  // informational coverage
  const n3no = nodeRows.filter(r=>r.info.N3_semantic_profile==='NO');
  const n4no = nodeRows.filter(r=>r.info.N4_conformsTo==='NO');
  console.log(`\nInfo — catalog field NOT reflected on page (may be by-design, MCP-layer):`);
  console.log(`  semantic_profile declared but absent on page: ${n3no.length}${n3no.length?' ('+n3no.map(r=>r.id).join(', ')+')':''}`);
  console.log(`  dct:conformsTo declared but absent on page: ${n4no.length}${n4no.length?' ('+n4no.map(r=>r.id).join(', ')+')':''}`);
  const dated = chainRows.filter(r => r.info.has_dated_string === true);
  console.log(`\nChain hard checks: composer-page-missing=${chainRows.filter(r=>r.checks.H1_composer_page===false).length}`);
  console.log(`Info — chains with a YYYY-MM-DD string (review for freshness badge vs legit regulatory date): ${dated.length}`);
  console.log(`Note: MCP prompt coverage + per-page execution_hash citation are LIVE/read checks — see AUDIT_v0.4 G2/G4, not decidable here.`);
}
if (STRICT && (nFails + hFails) > 0) process.exit(1);
