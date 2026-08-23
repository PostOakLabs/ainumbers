// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only
// swept into tsc --checkJs's program because it lives under chaingraph/kernels/
// and touching it makes it "touched" (JSDOC-CHECKJS-PREFLIGHT-1's own path
// filter watches the whole directory, not just *.kernel.mjs). Without this it
// fails on bare node:fs/process usage — a directory-wide @types/node gap
// (SO #47's exemption only reaches chaingraph/kernels/__proptests__/) that
// would block ANY future edit to this file, not something specific to its
// own logic. Same precedent as vm-parity-gate.mjs's line 1.
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
import { assertDenominatorOrExit, fixtureClaimants, parityVectorsOfOrExit } from '../../scripts/denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const UPDATE = process.argv.includes('--update');

// DENOMINATOR-SENTINEL-1 (gate-integrity findings F-06, F-08). The `doc.vectors ?? []` below used to
// make a present corpus file that contributes zero vectors an invisible SKIP — it stayed in the
// directory, it was counted in the "N node(s)" headline, and it hashed nothing. parityVectorsOf()
// turns that into an ERROR, with ONE derived exemption: a fixtures file carrying no `vectors` array at
// all is legal while some sibling chaingraph/kernels/*.test.mjs consumes it BY NAME (ha-records and
// seed-replay are a different schema by design and belong to validate-ha-records / seed-replay). The
// exemption is recomputed from those gate sources on every run rather than pinned in a list, so a
// renamed fixture or a deleted consumer revokes it automatically instead of leaving a dead shield.
const CLAIMANTS = fixtureClaimants(HERE);
const SENTINEL_OPTS = {
  claimants: CLAIMANTS,
  label: 'golden-parity',
  remedy: 'a fixtures file lost its vectors, or its consuming gate was renamed — restore with: git checkout origin/main -- chaingraph/kernels/fixtures',
};

// The exact seed note bootstrap-fixtures.mjs writes before a hash is pinned
// (kept in sync with that file — FIXTURE-NOTE-TEMPLATE-1). --update rewrites
// it the moment it pins, so a freshly-generated fixture's note can never
// outlive its own truth the way FIXTURE-NOTE-SWEEP-1 found 288 files had.
const PENDING_SEED_NOTE = 'golden_hash pending — run `node golden-parity.test.mjs --update` to pin it.';
const PINNED_NOTE = 'golden_hash pinned (see vectors).';

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
  const vectors = parityVectorsOfOrExit(doc, ff, SENTINEL_OPTS);
  if (vectors === null) continue;   // derived-exempt: a different schema, consumed by a named sibling gate
  for (const v of vectors) {
    const got = await executionHash(v.policy_parameters, v.output_payload);
    if (UPDATE) {
      if (v.golden_hash !== got) { v.golden_hash = got; dirty = true; updated++; }
    } else if (!v.golden_hash) {
      console.error(`✗ ${doc.tool_id}/${v.name}: no golden_hash pinned — run --update`); fail++;
    } else if (v.golden_hash !== got) {
      console.error(`✗ ${doc.tool_id}/${v.name}: HASH DRIFT\n    golden ${v.golden_hash}\n    got    ${got}`); fail++;
    } else { checked++; }
  }
  if (UPDATE && dirty && doc.note === PENDING_SEED_NOTE) { doc.note = PINNED_NOTE; }
  if (UPDATE && dirty) writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}

if (UPDATE) { console.log(`✓ updated ${updated} golden hash(es) across ${fixtureFiles.length} fixture file(s).`); process.exit(0); }
if (fail === 0) {
  // DENOMINATOR SENTINEL, at the point the green verdict is issued: `checked` is the number of vectors
  // that were actually recomputed and matched. Zero of them and this line still printed "✓ golden parity
  // clean — 0 vector(s)". Asserted here rather than before the fail>0 branch so a corpus that is present
  // but entirely DRIFTING still reports the drift, which is the more informative failure.
  // ⛔ Not asserted on the --update path above: that is the writer, and it legitimately pins a corpus
  // it did not verify (same reasoning as ratchet-baseline.mjs's readBaselineForUpdate seam).
  assertDenominatorOrExit(checked, 1, {
    label: 'golden-parity',
    unit: 'pinned vector(s)',
    scope: `${FIXDIR} — ${fixtureFiles.length} *.fixtures.json file(s); ${CLAIMANTS.size} fixture name(s) are claimed by a sibling chaingraph/kernels/*.test.mjs gate`,
    remedy: 'the fixture corpus is present but nothing in it was verifiable — check that vectors carry policy_parameters/output_payload and a pinned golden_hash',
  });
  console.log(`✓ golden parity clean — ${checked} vector(s) across ${fixtureFiles.length} node(s) match pinned hashes.`); process.exit(0);
}
console.error(`\n✗ ${fail} golden-parity failure(s).`);
process.exit(1);
