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
    // Null-prototype accumulator (same shape as _hash.mjs's cgCanon): a plain `const out = {}`
    // routes a key named "__proto__" through the inherited setter, dropping the key from the
    // clone; on a null-prototype object the same assignment writes an ordinary own key, so
    // every own key of the input survives the reversal.
    const out = Object.create(null);
    for (const k of keys) out[k] = reverseKeys(v[k]);
    return out;
  }
  return v;
}

if (!existsSync(FIXDIR)) { console.error('No fixtures dir — run golden-parity.test.mjs --update first.'); process.exit(1); }
const fixtureFiles = readdirSync(FIXDIR).filter((f) => f.endsWith('.fixtures.json'));
if (fixtureFiles.length === 0) { console.error('No fixtures found.'); process.exit(1); }

let vectors = 0, idempotencyFail = 0, jcsFail = 0, protoFail = 0;

// DETERMINISM-REPLAY-REVERSEKEYS-PROTO-1 unit cases. reverseKeys must keep every own key of a
// plain object as an own key of its clone. A plain `const out = {}` accumulator routes a key
// named "__proto__" through the inherited setter instead of writing an own key, so a
// JSON.parse input carrying one (fixtures are JSON.parse products) loses that key before the
// JCS comparison further down runs. Object.hasOwn is the discriminator: a dropped "__proto__"
// stays readable through the getter, because the failed assignment set the clone's prototype
// to the value, so value equality alone cannot see the drop. "constructor" and "toString" are
// the other two names a clone must write as own keys rather than resolve as inherited
// properties.
const PROTO_KEY_CASES = [
  ['flat __proto__ key', JSON.parse('{"a":1,"__proto__":{"x":2}}')],
  ['nested __proto__ key', JSON.parse('{"outer":{"__proto__":{"x":2}},"b":3}')],
  ['reserved-name keys', JSON.parse('{"__proto__":{"x":2},"constructor":{"y":3},"toString":{"z":4}}')],
];
function collectOwnKeyPaths(v, prefix, acc) {
  if (Array.isArray(v)) {
    v.forEach((e, i) => collectOwnKeyPaths(e, `${prefix}[${i}]`, acc));
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const p = prefix ? `${prefix}.${k}` : k;
      acc.push(p);
      collectOwnKeyPaths(v[k], p, acc);
    }
  }
  return acc;
}
function ownKeysLost(out, paths, label) {
  let lost = 0;
  for (const p of paths) {
    const segs = p.split('.');
    let node = out;
    for (let i = 0; i < segs.length; i++) {
      if (node === null || typeof node !== 'object' || !Object.hasOwn(node, segs[i])) {
        console.error(`✗ ${label}: reverseKeys dropped own key "${p}" (own keys at ${segs.slice(0, i).join('.') || '<root>'}: ${JSON.stringify(Object.keys(node && typeof node === 'object' ? node : {}))})`);
        lost++;
        break;
      }
      node = node[segs[i]];
    }
  }
  return lost;
}
async function runProtoKeyCases() {
  for (const [label, input] of PROTO_KEY_CASES) {
    const paths = collectOwnKeyPaths(input, '', []);
    const out = reverseKeys(input);
    protoFail += ownKeysLost(out, paths, label);
    // With every own key preserved, reversing key order must not move the execution_hash.
    const hOrig = await executionHash(input, input);
    const hRev = await executionHash(out, out);
    if (hOrig !== hRev) {
      console.error(`✗ ${label}: key-reversed clone changed the execution_hash: original ${hOrig} reversed ${hRev}`);
      protoFail++;
    }
  }
}
await runProtoKeyCases();

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

const fail = idempotencyFail + jcsFail + protoFail;
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
console.error(`\n✗ determinism-replay: ${idempotencyFail} idempotency failure(s), ${jcsFail} JCS-stability failure(s), ${protoFail} proto-own-key failure(s) across ${vectors} vector(s).`);
process.exit(1);
