#!/usr/bin/env node
// spec-version-consistency.mjs — GATE (NEW, conformance-by-construction §4)
// The single-version-of-record enforcer. Reads chaingraph.json.spec_version (the source of
// record) and asserts EVERY public surface declares the same OpenChainGraph spec version:
//   - standard/SPEC.md frontmatter  (spec_version: X)
//   - standard/openchain-graph-v0.4.schema.json  ("spec_version": "X")
//   - openchain-graph-spec.html  <meta name="ocg-spec-version" content="X">
//   - chaingraph-hub.html        <meta name="ocg-spec-version" content="X">
//   - the GitHub Pages mirror (if present locally)  <meta …>
// This is the gate that would have caught the v0.1 / v0.3.1 / v0.4 three-way skew at PR time.
//
// IMPORTANT: it checks the DECLARED version markers, not every "v0.3" string in prose —
// the JSON-LD @context legitimately stays at .../context/v0.3/... (not version-locked).
// A separate --remnants pass flags stale version strings OUTSIDE an allowlist (use to find
// the §1-prose / hub-showcase leftovers during migration; warn-only by default).
//
// Usage:  node spec-version-consistency.mjs            (strict: marker mismatch => exit 1)
//         node spec-version-consistency.mjs --remnants (also scan prose for stray vX.Y, warn)
// Placement: SITE repo (repo/) CI — it greps the site's spec/hub HTML. Override paths via env.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.env.SITE_CHAINGRAPH_DIR || firstDir([
  join(HERE, '..'),                      // landed: standard/ → chaingraph/
  join(HERE, '..', 'repo', 'chaingraph'),// staging: ssot-rollout/
  join(HERE, '..', 'chaingraph'),
  HERE,
]);
function firstDir(ds) { return ds.find((d) => existsSync(d)) || ds[0]; }
const P = (f) => join(base, f);

const CHAINGRAPH = process.env.CHAINGRAPH || P('chaingraph.json');
// JSON-LD context version is intentionally NOT spec-locked — allowlist it.
const ALLOWLIST = [/context\/v0\.3\//, /\/v0\.2#/, /new in v0\.3(\.\d+)?/i, /\(new in v0\.\d/i];

const recordVersion = JSON.parse(readFileSync(CHAINGRAPH, 'utf8')).spec_version;
if (!recordVersion) fail(`chaingraph.json has no spec_version (the source of record)`);
console.log(`version-of-record: spec_version = ${recordVersion}  (from ${rel(CHAINGRAPH)})\n`);

const SURFACES = [
  { file: P('standard/SPEC.md'), label: 'SPEC.md frontmatter', re: /^spec_version:\s*["']?([0-9.]+)/m },
  { file: P('standard/openchain-graph-v0.4.schema.json'), label: 'JSON Schema spec_version', re: /"spec_version"\s*:\s*"([0-9.]+)"/ },
  { file: P('openchain-graph-spec.html'), label: 'spec page <meta>', re: /name=["']ocg-spec-version["']\s+content=["']([0-9.]+)["']/ },
  { file: P('chaingraph-hub.html'), label: 'hub <meta>', re: /name=["']ocg-spec-version["']\s+content=["']([0-9.]+)["']/ },
  { file: process.env.GHPAGES_INDEX || P('../../chaingraph-ghpages/index.html'), label: 'GitHub Pages mirror <meta>', re: /name=["']ocg-spec-version["']\s+content=["']([0-9.]+)["']/, optional: true },
];

let failed = 0;
for (const s of SURFACES) {
  if (!existsSync(s.file)) {
    if (s.optional) { console.log(`· ${s.label}: (not present locally — skipped)`); continue; }
    console.error(`✗ ${s.label}: file missing (${rel(s.file)}) — add the <meta name="ocg-spec-version"> marker`); failed++; continue;
  }
  const m = readFileSync(s.file, 'utf8').match(s.re);
  if (!m) { console.error(`✗ ${s.label}: no version marker found in ${rel(s.file)}`); failed++; continue; }
  if (m[1] !== recordVersion) { console.error(`✗ ${s.label}: declares ${m[1]}, record is ${recordVersion}`); failed++; }
  else console.log(`✓ ${s.label}: ${m[1]}`);
}

if (process.argv.includes('--remnants')) {
  console.log('\n--remnants (warn-only): stray spec-version strings outside the allowlist');
  for (const f of ['openchain-graph-spec.html', 'chaingraph-hub.html']) {
    const fp = P(f); if (!existsSync(fp)) continue;
    readFileSync(fp, 'utf8').split('\n').forEach((line, i) => {
      const hits = line.match(/v0\.[123](\.\d+)?/g);
      if (hits && !ALLOWLIST.some((r) => r.test(line)))
        console.warn(`  ⚠ ${f}:${i + 1}  ${hits.join(', ')}  | ${line.trim().slice(0, 90)}`);
    });
  }
}

function rel(p) { return p.replace(join(HERE, '..'), '.'); }
function fail(m) { console.error('FATAL: ' + m); process.exit(2); }
console.log(`\n${failed} surface(s) out of sync.`);
process.exit(failed ? 1 : 0);
