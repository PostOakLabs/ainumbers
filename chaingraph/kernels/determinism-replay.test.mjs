// @ts-nocheck — plain CLI gate script, never meant to be type-checked; only swept into
// tsc --checkJs's program because it lives under chaingraph/kernels/ and touching it makes
// it "touched" (JSDOC-CHECKJS-PREFLIGHT-1's path filter watches the whole directory, not
// just *.kernel.mjs). Without this it fails on bare node:fs/process usage — a directory-wide
// @types/node gap that would block ANY future edit to this file, not something specific to
// its own logic. Same line, same reason, as its sibling golden-parity.test.mjs line 1.
// determinism-replay.test.mjs — Suite B (audit 2026-07-09): same-input idempotency (N=3) +
// JCS key-order canonicalization stability, over every pinned golden-parity vector.
//
// golden-parity.test.mjs already proves executionHash(pp, op) == a PINNED hash (drift
// detection). This gate proves two properties golden-parity does NOT check on its own:
//   1. Same-input idempotency — calling executionHash on the identical {pp, op} N=3 times
//      in a row yields the byte-identical hash every time (no hidden per-call entropy:
//      Date.now(), Math.random(), object key insertion order, Map/Set iteration order).
//   2. JCS canonicalization stability — recursively reversing every object's key order in
//      pp and op (same semantic value, different literal key order) still produces the
//      SAME hash, proving _hash.mjs's cgCanon step actually canonicalizes (RFC 8785) rather
//      than depending on JS object insertion order.
//
// Fixture source: kernels/fixtures/<tool_id>.fixtures.json (the golden-parity vectors) —
// no new fixtures needed; this is a property check layered on data that already exists.
//
// Usage: node chaingraph/kernels/determinism-replay.test.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { assertDenominatorOrExit, fixtureClaimants, parityVectorsOfOrExit } from '../../scripts/denominator-sentinel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const N = 3;

// DENOMINATOR-SENTINEL-1 (gate-integrity findings F-06, F-08) — identical treatment to the sibling
// golden-parity gate, because this file carries the identical `doc.vectors ?? []` loop over the identical
// corpus. A present fixtures file contributing zero usable vectors is an ERROR, not a silent skip; the one
// exemption (a file carrying no `vectors` array at all) is DERIVED each run from whichever
// chaingraph/kernels/*.test.mjs actually names it, never from a pinned allowlist that could outlive its
// consumer. See scripts/denominator-sentinel.mjs for the full statement of the hole.
const CLAIMANTS = fixtureClaimants(HERE);
const SENTINEL_OPTS = {
  claimants: CLAIMANTS,
  label: 'determinism-replay',
  remedy: 'a fixtures file lost its vectors, or its consuming gate was renamed — restore with: git checkout origin/main -- chaingraph/kernels/fixtures',
};

/** Recursively reverse key order of every plain object (arrays/primitives untouched). */
function reverseKeys(v) {
  if (Array.isArray(v)) return v.map(reverseKeys);
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).reverse();
    const out = {};
    for (const k of keys) out[k] = reverseKeys(v[k]);
    return out;
  }
  return v;
}

if (!existsSync(FIXDIR)) { console.error('No fixtures dir — run golden-parity.test.mjs --update first.'); process.exit(1); }
const fixtureFiles = readdirSync(FIXDIR).filter((f) => f.endsWith('.fixtures.json'));
if (fixtureFiles.length === 0) { console.error('No fixtures found.'); process.exit(1); }

let vectors = 0, idempotencyFail = 0, jcsFail = 0;
for (const ff of fixtureFiles) {
  const doc = JSON.parse(readFileSync(resolve(FIXDIR, ff), 'utf8'));
  const docVectors = parityVectorsOfOrExit(doc, ff, SENTINEL_OPTS);
  if (docVectors === null) continue;   // derived-exempt: a different schema, consumed by a named sibling gate
  for (const v of docVectors) {
    vectors++;

    // 1. Idempotency: N=3 identical calls.
    const hashes = [];
    for (let i = 0; i < N; i++) hashes.push(await executionHash(v.policy_parameters, v.output_payload));
    if (new Set(hashes).size !== 1) {
      console.error(`✗ ${doc.tool_id}/${v.name}: NOT idempotent across N=${N} calls: ${hashes.join(' | ')}`);
      idempotencyFail++;
    }

    // 2. JCS key-order stability: reverse every object's key order, hash must match.
    const reorderedPP = reverseKeys(v.policy_parameters);
    const reorderedOP = reverseKeys(v.output_payload);
    const reorderedHash = await executionHash(reorderedPP, reorderedOP);
    if (reorderedHash !== hashes[0]) {
      console.error(`✗ ${doc.tool_id}/${v.name}: key-reorder hash MISMATCH (JCS not stable): original ${hashes[0]} reordered ${reorderedHash}`);
      jcsFail++;
    }
  }
}

const fail = idempotencyFail + jcsFail;
if (fail === 0) {
  // DENOMINATOR SENTINEL, at the point the green verdict is issued. `vectors` is the number actually
  // replayed; with zero of them this line read "✓ determinism-replay clean — 0 vector(s)". Asserted
  // only on the clean path so a corpus that is present but genuinely non-deterministic still reports
  // the idempotency/JCS failures, which say more than an empty-scope message would.
  assertDenominatorOrExit(vectors, 1, {
    label: 'determinism-replay',
    unit: 'replayed vector(s)',
    scope: `${FIXDIR} — ${fixtureFiles.length} *.fixtures.json file(s); ${CLAIMANTS.size} fixture name(s) are claimed by a sibling chaingraph/kernels/*.test.mjs gate`,
    remedy: 'the fixture corpus is present but nothing in it was replayable — check that vectors carry policy_parameters/output_payload',
  });
  console.log(`✓ determinism-replay clean — ${vectors} vector(s): idempotent across N=${N} AND key-order-stable (JCS).`);
  process.exit(0);
}
console.error(`\n✗ determinism-replay: ${idempotencyFail} idempotency failure(s), ${jcsFail} JCS-stability failure(s) across ${vectors} vector(s).`);
process.exit(1);
