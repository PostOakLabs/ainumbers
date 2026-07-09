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

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const N = 3;

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
  for (const v of (doc.vectors ?? [])) {
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
  console.log(`✓ determinism-replay clean — ${vectors} vector(s): idempotent across N=${N} AND key-order-stable (JCS).`);
  process.exit(0);
}
console.error(`\n✗ determinism-replay: ${idempotencyFail} idempotency failure(s), ${jcsFail} JCS-stability failure(s) across ${vectors} vector(s).`);
process.exit(1);
