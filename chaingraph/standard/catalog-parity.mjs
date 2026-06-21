#!/usr/bin/env node
// catalog-parity.mjs — GATE (Addendum A / SSOT §4). Hardened 2026-06-20 against the live conventions
// found by actually running it:
//   - node pages are NOT all in /chaingraph/ — the promoted Canton 500-series live in /tools/ (per node.url).
//   - chain page filename != chain.name by design — composer_url is the source of truth for the page.
//   - composer pages live in /guides/ OR /chaingraph/chains/ — resolve the real composer_url path.
// validate-chains.mjs already checks composer_url -> file existence; this gate's UNIQUE value is:
//   (A) every live node's url page exists, and (B) ORPHAN chain pages no composer_url points to.
//
// Zero-dependency. Non-zero exit blocks. Run in the SITE repo (repo/).
//   node catalog-parity.mjs            CG_DIR=… CHAINGRAPH=… to override

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CG_DIR = process.env.CG_DIR || firstDir([
  join(HERE, '..', 'repo', 'chaingraph'),
  join(HERE, '..', 'chaingraph'),
  HERE,
]);
const REPO = join(CG_DIR, '..');
const CHAINGRAPH = process.env.CHAINGRAPH || join(CG_DIR, 'chaingraph.json');
function firstDir(ds) { return ds.find((d) => existsSync(d)) || ds[0]; }

const cg = JSON.parse(readFileSync(CHAINGRAPH, 'utf8'));
const nodes = cg.nodes || [], chains = cg.chains || [];
const live = nodes.filter((n) => n.status === 'live');
const nodeIds = new Set(nodes.map((n) => n.tool_id));
let errs = 0, warns = 0;

// ---- A. every live node's url page exists on disk (chaingraph/ or tools/) ----
for (const n of live) {
  const rel = (n.url || '').replace(/^https?:\/\/[^/]+\//, '');
  if (!rel) { console.error(`✗ node "${n.tool_id}" has no url`); errs++; continue; }
  if (!existsSync(join(REPO, rel))) { console.error(`✗ node "${n.tool_id}" url page missing on disk: ${rel}`); errs++; }
}
// node-shaped chaingraph/ pages with no nodes[] entry (warn — promoted-to-tools or superseded)
const nodePageIds = readdirSync(CG_DIR).filter((f) => /\.html$/.test(f) && !/^(chaingraph-hub|guide-|openchain-graph|ocg-)/.test(f)).map((f) => f.replace(/\.html$/, ''));
for (const id of nodePageIds) if ((/^(art|cry|ml|qfa|rca|sim|pnr|mms|ptg|rbe)-/.test(id) || /^\d+-/.test(id)) && !nodeIds.has(id)) { console.warn(`⚠ chaingraph/${id}.html has no nodes[] entry (orphan/promoted)`); warns++; }

// ---- B. ORPHAN chain pages: chains/*.html that NO chain's composer_url points to ----
const chainsDir = join(CG_DIR, 'chains');
if (existsSync(chainsDir)) {
  const composerTargets = new Set(chains.map((c) => (c.composer_url || '').split('/').pop()).filter(Boolean));
  for (const f of readdirSync(chainsDir).filter((f) => /\.html$/.test(f))) {
    if (!composerTargets.has(f)) { console.error(`✗ orphan page chains/${f} — no chain composer_url references it (superseded?)`); errs++; }
  }
} else { console.warn(`⚠ chains dir not found at ${chainsDir}`); warns++; }

console.log(`\nnodes: ${nodes.length} (${live.length} live) · chains: ${chains.length} · ${warns} warning(s)`);
console.log(errs ? `✗ ${errs} catalog-parity error(s)` : '✓ catalog parity: every live node has its page; no orphan chain pages');
console.log('  (composer_url -> file existence is validated by validate-chains.mjs; not re-checked here)');
process.exitCode = errs ? 1 : 0;
