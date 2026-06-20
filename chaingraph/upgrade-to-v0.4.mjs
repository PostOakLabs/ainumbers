#!/usr/bin/env node
/**
 * upgrade-to-v0.4.mjs — bump the client-side artifact envelope version of every
 * ChainGraph tool page to OpenChainGraph v0.4.0.
 *
 * WHY: the server kernels (kernels/*.kernel.mjs) and the catalog (chaingraph.json,
 * spec_version 0.4.0) already emit chaingraph_version "0.4.0". The browser tool
 * pages (repo/chaingraph/**.html) still stamp "0.3.1", so a tool run in-browser
 * produces a v0.3.1 artifact while the same tool run via /mcp produces a v0.4.0
 * one. This harmonizes the browser pages to 0.4.0 so both surfaces agree.
 *
 * SAFETY (verified against art-42.html, 2026-06-19): the execution_hash preimage
 * is SHA-256(JCS({policy_parameters, output_payload})) ONLY. chaingraph_version,
 * ap2_version, @context, dct:conformsTo, semantic_profile are all in the envelope,
 * OUTSIDE the preimage. This bump CANNOT change any execution_hash. A v0.3 verifier
 * that ignores unknown fields still validates a v0.4 artifact (additive).
 *
 * SCOPE: *.html under repo/chaingraph/ only (recursive; includes chains/).
 *   - Kernels (.mjs) are already 0.4.0 — not touched.
 *   - Exporters (.mjs), fixtures (.json), chaingraph.json — NOT touched (separate
 *     lane / already 0.4.0). This script never edits the MCP-worker surface.
 *   - @context URLs stay at /context/v0.3/ by design (not version-locked to the
 *     spec number; export/profile fields are hash-excluded — see OCG spec §A).
 *   - ap2_version is left as-is. (The full-migrate-v0.3.1 header flagged retiring
 *     this legacy alias "in v0.4"; that is a separate, reviewed decision — not done
 *     here to keep this a pure, reversible version bump.)
 *
 * Exact-string, idempotent: only the 0.3.0/0.3.1 chaingraph_version forms match.
 * Changelog/prose mentions of "0.3.1" do NOT match (anchored on `chaingraph_version`).
 *
 * Usage:
 *   node chaingraph/upgrade-to-v0.4.mjs            # dry-run report (default)
 *   node chaingraph/upgrade-to-v0.4.mjs --apply    # write in place
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));   // repo/chaingraph
const APPLY = process.argv.includes('--apply');
const TARGET = 'chaingraph_version';
const NEW = '0.4.0';

// Every form chaingraph_version appears in across the tool pages, old -> new.
// Order matters only in that all are exact, non-overlapping substrings.
const REPLACEMENTS = [
  // JS object literal, single-quoted (the emission code)
  [`${TARGET}: '0.3.1'`, `${TARGET}: '${NEW}'`],
  [`${TARGET}: '0.3.0'`, `${TARGET}: '${NEW}'`],
  // JS object literal, double-quoted
  [`${TARGET}: "0.3.1"`, `${TARGET}: "${NEW}"`],
  [`${TARGET}: "0.3.0"`, `${TARGET}: "${NEW}"`],
  // JSON form (embedded sample artifacts / fixtures) — spaced AND minified no-space (e.g. art-38/39/40)
  [`"${TARGET}": "0.3.1"`, `"${TARGET}": "${NEW}"`],
  [`"${TARGET}": "0.3.0"`, `"${TARGET}": "${NEW}"`],
  [`"${TARGET}":"0.3.1"`, `"${TARGET}":"${NEW}"`],
  [`"${TARGET}":"0.3.0"`, `"${TARGET}":"${NEW}"`],
  // Unquoted display badge, e.g. `chaingraph_version: 0.3.1 · execution_hash`
  [`${TARGET}: 0.3.1`, `${TARGET}: ${NEW}`],
  [`${TARGET}: 0.3.0`, `${TARGET}: ${NEW}`],
];

const SKIP_DIRS = new Set(['okf', 'node_modules', '.git', 'kernels', 'exporters', 'fixtures', 'taxonomies']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (extname(name) === '.html') out.push(full);
  }
  return out;
}

const targets = walk(HERE);
const log = [];
let filesChanged = 0, totalReplacements = 0;

for (const f of targets) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const orig = text;
  let fileCount = 0;
  for (const [from, to] of REPLACEMENTS) {
    if (text.includes(from)) {
      const n = text.split(from).length - 1;
      text = text.split(from).join(to);
      fileCount += n;
    }
  }
  // Guard: leave no 0.3.0/0.3.1 chaingraph_version form behind in a touched file.
  const residue = /chaingraph_version["']?\s*[:=]\s*["']?0\.3\.[01]/.test(text);
  if (text !== orig) {
    filesChanged++; totalReplacements += fileCount;
    log.push(`  ${f.replace(HERE, 'chaingraph')}  (${fileCount} replaced${residue ? ' — ⚠ 0.3.x RESIDUE REMAINS, inspect' : ''})`);
    if (APPLY) writeFileSync(f, text, 'utf8');
  } else if (residue) {
    log.push(`  ${f.replace(HERE, 'chaingraph')}  ⚠ has a 0.3.x chaingraph_version in an UNRECOGNIZED form — inspect manually`);
  }
}

console.log(`OpenChainGraph chaingraph_version → ${NEW}${APPLY ? ' [APPLYING]' : ' [dry-run]'}`);
console.log(`Scanned ${targets.length} .html files under repo/chaingraph/`);
for (const line of log) console.log(line);
console.log(`\nSummary: ${filesChanged} files, ${totalReplacements} replacements.`);
console.log('SAFETY: chaingraph_version is outside the hash preimage — no execution_hash changes.');
if (!APPLY) {
  console.log('\nDry-run only. Review the file list (and any ⚠ residue), then re-run with --apply.');
} else {
  console.log('\nApplied. Next (site only, no worker touch):');
  console.log('  node chaingraph/generate-okf.mjs   # if OKF bundle stamps the version');
  console.log('  python regen_catalog.py            # if catalog mirrors page versions');
  console.log('  python verify_repo.py              # REQUIRED — confirms hash gates still pass');
  console.log('  then git add/commit/push (DreamHost auto-deploys the site).');
}
