// golden-parity.test.mjs — CI golden-snapshot gate for execution_hash.
// Best-practice pattern from the research: pin a canonical hash per fixture,
// recompute on every run, fail on drift. Provider-independent (operates on
// artifact data, not the tool kernel) so it covers ANY node that ships fixtures.
//
// Workflow:
//   1. After remediation, capture goldens once:  node golden-parity.test.mjs --update
//   2. CI runs (no flag) on every change:         node golden-parity.test.mjs
//      -> exit 1 if any recomputed hash != pinned golden, or a golden is missing.
//
// Fixture file: kernels/fixtures/<tool_id>.fixtures.json
//   { "tool_id": "...", "vectors": [ { "name": "...", "policy_parameters": {...},
//     "output_payload": {...}, "golden_hash": "<filled by --update>" } ] }

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const UPDATE = process.argv.includes('--update');

if (!existsSync(FIXDIR)) { mkdirSync(FIXDIR, { recursive: true }); }
const fixtureFiles = existsSync(FIXDIR) ? readdirSync(FIXDIR).filter((f) => f.endsWith('.fixtures.json')) : [];

if (fixtureFiles.length === 0) {
  console.error('No fixtures found in kernels/fixtures/. Add <tool_id>.fixtures.json files, then run --update.');
  process.exit(1);
}

let fail = 0, checked = 0, updated = 0;
for (const ff of fixtureFiles) {
  const path = resolve(FIXDIR, ff);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  let dirty = false;
  for (const v of (doc.vectors ?? [])) {
    const got = await executionHash(v.policy_parameters, v.output_payload);
    if (UPDATE) {
      if (v.golden_hash !== got) { v.golden_hash = got; dirty = true; updated++; }
    } else if (!v.golden_hash) {
      console.error(`✗ ${doc.tool_id}/${v.name}: no golden_hash pinned — run --update`); fail++;
    } else if (v.golden_hash !== got) {
      console.error(`✗ ${doc.tool_id}/${v.name}: HASH DRIFT\n    golden ${v.golden_hash}\n    got    ${got}`); fail++;
    } else { checked++; }
  }
  if (UPDATE && dirty) writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}

if (UPDATE) { console.log(`✓ updated ${updated} golden hash(es) across ${fixtureFiles.length} fixture file(s).`); process.exit(0); }
if (fail === 0) { console.log(`✓ golden parity clean — ${checked} vector(s) across ${fixtureFiles.length} node(s) match pinned hashes.`); process.exit(0); }
console.error(`\n✗ ${fail} golden-parity failure(s).`);
process.exit(1);
