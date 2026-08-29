#!/usr/bin/env node
// check-retired-ap2-version.mjs — TOMBSTONE GATE for the `ap2_version` retirement
// (CONTRACT.md §3.1 naming note + Amendment A3.2; row RETIREMENT-TOMBSTONE-GATES-1).
//
// A3.2: `ap2_version` is RETIRED as of v0.4 — it duplicated the schema version under
// an AP2-implying name and is no longer part of the canonical envelope; the sole
// envelope-version field is `chaingraph_version`. §3.1 says the same for the §4
// artifact payload. A retirement claim with nothing asserting it is a wish; this gate
// is the assertion over the canonical §4 emit-surfaces:
//   - chaingraph/kernels/*.kernel.mjs  (server-side compute — what a node emits)
//   - manifests/*.manifest.json        (the registered tool definitions)
//   - chaingraph/exporters/*.mjs       (the §13 export profiles)
//
// The pattern is the EMIT shape (`'ap2_version':` / `"ap2_version":` / bare
// `ap2_version:` as an object key), deliberately NOT the bare string: sanctioned
// validator/tolerance code legitimately READS a supplied ap2_version on pre-retirement
// artifacts (art-17's mandate validator is the named example — A3.2's back-compat
// sentence), and that code accesses properties, it does not construct the field.
//
// KNOWN BOUNDARY, named honestly (row coverage statement): ~370 legacy §3.1
// Policy-Mandate builders under tools/ still construct `ap2_version:'1.0'` inside
// their mandate objects. Those exports are §3.1 mandates from un-promoted catalog
// tools, not §4 artifacts; that population is outside this row's fence and is named
// for adjudication, not silently gated here.
//
// Boring by design: three fixed directories, one regex, one message. Zero deps.
// Self-test (paired fixture proof, GATE-SELFTEST-META-1): scripts/check-retired-ap2-version.test.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// Object-key emit shape, both JSON-quoted and bare-JS spellings.
export const EMIT_SHAPE = /['"]?ap2_version['"]?\s*:/;
const SCOPES = [
  ['chaingraph/kernels', (f) => f.endsWith('.kernel.mjs')],
  ['manifests', (f) => f.endsWith('.manifest.json')],
  ['chaingraph/exporters', (f) => f.endsWith('.mjs')],
];

// Pure line scan — exported so the paired fixture proof can drive it without touching disk.
export function lineHits(line) {
  return EMIT_SHAPE.test(line);
}

// Main-module guard (house pattern, check-gate-selftest-pairing.mjs): the paired
// fixture proof imports lineHits() — the live scan must only run as the CLI entry.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  runCli();
}

function runCli() {
  const hits = [];
  let scanned = 0;
  for (const [dir, filter] of SCOPES) {
    const full = resolve(REPO, dir);
    let names = [];
    try {
      names = readdirSync(full).filter(filter);
    } catch {
      continue; // directory absent from this checkout — nothing to scan
    }
    for (const f of names) {
      scanned++;
      const text = readFileSync(resolve(full, f), 'utf8');
      text.split('\n').forEach((line, i) => {
        if (lineHits(line)) hits.push(`${dir}/${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
      });
    }
  }

  if (hits.length) {
    console.error(`✗ check-retired-ap2-version FAILED (${hits.length} line(s) across ${new Set(hits.map((h) => h.split(':')[0])).size} file(s)) — CONTRACT.md §3.1/A3.2 retired the ap2_version envelope field:`);
    for (const h of hits) console.error('  • ' + h);
    console.error('\nA3.2: `ap2_version` is retired as of v0.4 — `chaingraph_version` is the sole');
    console.error('canonical envelope version. Remove the field from what this surface EMITS.');
    console.error('Validator/tolerance code that merely READS a supplied ap2_version on');
    console.error('pre-retirement artifacts stays lawful (A3.2 back-compat sentence).');
    console.error('(RETIREMENT-TOMBSTONE-GATES-1)');
    process.exit(1);
  }
  console.log(`✓ check-retired-ap2-version clean — ${scanned} canonical §4 surface file(s) scanned (kernels, manifests, exporters), no ap2_version emit-shape (chaingraph_version is the sole envelope version per §3.1/A3.2).`);
}
