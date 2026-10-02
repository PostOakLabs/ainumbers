#!/usr/bin/env node
/**
 * scripts/ledger-legacy-order.test.mjs
 * Gate: JCS-PREFIX-ARTIFACT-NOTE-1. An artifact minted through the pre-2026-09-30
 * legacy enumeration order (JSON.stringify over the cgCanon-sorted preimage: JavaScript
 * enumerates array-index member names first in numeric order, so the wrap emits
 * {"9":...,"10":...} where RFC 8785 requires {"10":...,"9":...}) must get its own
 * verdict on the Ledger page, never a silent fail and never a pass:
 *
 *   strict match            -> 'pass'          (retry never fires)
 *   legacy-only match       -> 'legacy-order'  (aggregated 'partial', never 'verified')
 *   neither matches         -> 'fail'          (the retry cannot rescue a tamper)
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1 discipline): this gate
 * carries NO copy of the verifier. It brace-extracts the REAL `__ocgJcs` / `cgCanon` /
 * `recomputeExecutionHash` / `_runVerify` / `_aggregate` (plus `_verifyExecutionHash`
 * once the page carries it, and the two helpers `_runVerify` always executes,
 * `isComposite` and `_verifyInputAttestations`) out of `ledger/index.html` via the
 * shared extract-and-diff helper `scripts/lib-extract-shipped.mjs`.
 *
 * SELF-PROVING (SO #34c): every run also TAMPERS the shipped source in memory (the
 * legacy retry call is dropped) and requires case (b) to go red on the mutated copy,
 * so a green result can never come from assertions that no longer discriminate.
 *
 * CANARY (row discipline): this test was written and run against the UNMODIFIED page
 * BEFORE the Ledger edit; case (b) went red there because the page had no legacy-order
 * verdict yet, while cases (a), (c) and (d) behaved as they do today. That red run is
 * quoted in the PR body.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildShipped, mutateSource, assertSourceContains } from './lib-extract-shipped.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SHIPPED_REL = 'ledger/index.html';

const shippedSrc = readFileSync(join(REPO, SHIPPED_REL), 'utf8');

// The factored §4 block (JCS-PREFIX-ARTIFACT-NOTE-1) is extracted and pinned once it
// exists; the driver below works against both the inline pre-row block and the
// factored function, which is what made the canary run possible pre-edit.
const HAS_FACTORED = /(?:async\s+)?function\s+_verifyExecutionHash\s*\(/.test(shippedSrc);
const BASE_FNS = ['__ocgJcs', 'cgCanon', 'recomputeExecutionHash', '_runVerify', '_aggregate', 'isComposite', '_verifyInputAttestations'];
const DRIVER_FNS = HAS_FACTORED ? BASE_FNS.concat(['_verifyExecutionHash']) : BASE_FNS;
const DRIVER_SPEC = { file: SHIPPED_REL, fns: DRIVER_FNS };

// ── Hash helpers over the extracted serializers ────────────────────────────────
async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const strictHashOf = (V, obj) => sha256Hex(V.__ocgJcs(obj));
// The legacy order: plain JSON.stringify over the cgCanon-sorted preimage. JavaScript
// re-enumerates array-index member names first in numeric order whatever the insertion
// order, so this differs from __ocgJcs exactly where such names exist.
const legacyHashOf = (V, obj) => sha256Hex(JSON.stringify(V.cgCanon(obj)));

// ── Fixtures: a fresh artifact whose output_payload carries {"9":1,"10":2} ─────
const POLICY = { input: 'legacy-order-probe', mode: 'demo' };
const INDEXED_PAYLOAD = { buckets: { '9': 1, '10': 2 } };

function artifactWith(recordedHash, payload) {
  return {
    '@context': 'https://openchaingraph.org/context/v0.3',
    chaingraph_version: '0.4.0',
    execution_hash: recordedHash,
    chain: 'legacy-order-probe',
    policy_parameters: POLICY,
    output_payload: payload,
    audit_signature: {}
  };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); passed++; }
  catch (e) { console.error('  \u2717 ' + name + '\n    ' + e.message); failed++; }
}
async function atest(name, fn) {
  try { await fn(); console.log('  \u2713 ' + name); passed++; }
  catch (e) { console.error('  \u2717 ' + name + '\n    ' + e.message); failed++; }
}

console.log('ledger-legacy-order.test.mjs (SHIPPED source: ' + SHIPPED_REL + ')');

// ── 1. Build the verifier from the SHIPPED page and run the four cases ─────────
const V = buildShipped(shippedSrc, DRIVER_SPEC);   // throws (red) if a symbol is gone
test('extraction: all \u00a74 verifier symbols located in ' + SHIPPED_REL, () => {
  for (const n of DRIVER_FNS) {
    if (typeof V[n] !== 'function') throw new Error('shipped `' + n + '` did not extract as a function');
  }
});

await atest('fixture sanity: the two orders place {"9","10"} differently', async () => {
  const strict = await strictHashOf(V, { policy_parameters: POLICY, output_payload: INDEXED_PAYLOAD });
  const legacy = await legacyHashOf(V, { policy_parameters: POLICY, output_payload: INDEXED_PAYLOAD });
  if (strict === legacy) throw new Error('fixture does not discriminate: both orders hash identically');
});

await atest('(a) fresh artifact hashed with __ocgJcs: verdict pass', async () => {
  const obj = { policy_parameters: POLICY, output_payload: INDEXED_PAYLOAD };
  const a = artifactWith(await strictHashOf(V, obj), INDEXED_PAYLOAD);
  const vr = await V._runVerify(a);
  if (vr.hash !== 'pass') throw new Error('expected pass, got ' + vr.hash);
  if (vr.overall !== 'verified') throw new Error('expected overall verified, got ' + vr.overall);
});

await atest('(b) recorded hash in legacy order: verdict legacy-order, overall partial', async () => {
  const obj = { policy_parameters: POLICY, output_payload: INDEXED_PAYLOAD };
  const a = artifactWith(await legacyHashOf(V, obj), INDEXED_PAYLOAD);
  const vr = await V._runVerify(a);
  if (vr.hash !== 'legacy-order') throw new Error('expected legacy-order, got ' + vr.hash);
  if (vr.overall !== 'partial') throw new Error('expected overall partial, got ' + vr.overall);
  if (vr.details.hash?.match !== false) throw new Error('expected details.hash.match=false');
  if (vr.details.hash?.legacy_match !== true) throw new Error('expected details.hash.legacy_match=true');
});

await atest('(c) legacy artifact with one value mutated: verdict fail', async () => {
  const obj = { policy_parameters: POLICY, output_payload: INDEXED_PAYLOAD };
  const tamperedPayload = { buckets: { '9': 1, '10': 3 } };
  const a = artifactWith(await legacyHashOf(V, obj), tamperedPayload);
  const vr = await V._runVerify(a);
  if (vr.hash !== 'fail') throw new Error('expected fail, got ' + vr.hash);
});

await atest('(d) tampered payload with no array-index names: verdict fail (retry cannot rescue)', async () => {
  const payload = { alpha: 1, beta: 'x' };
  const other = { alpha: 2, beta: 'x' };
  const a = artifactWith(await strictHashOf(V, { policy_parameters: POLICY, output_payload: payload }), other);
  const vr = await V._runVerify(a);
  if (vr.hash !== 'fail') throw new Error('expected fail, got ' + vr.hash);
});

// ── 2. Pin the factored retry (post-refactor page only) ────────────────────────
if (HAS_FACTORED) {
  test('shipped _verifyExecutionHash retries the legacy order only on a strict mismatch', () => {
    const missing = assertSourceContains(shippedSrc, '_verifyExecutionHash', [
      "await recomputeExecutionHash(artifact, 'legacy')",
      'legacy_match: true',
      'match: false'
    ]);
    if (missing.length) throw new Error('the legacy retry drifted:\n  ' + missing.join('\n  '));
  });

  // ── 3. Self-proving (SO #34c): drop the retry IN MEMORY, require case (b) red ─
  const TAMPER_NEEDLE = "await recomputeExecutionHash(artifact, 'legacy')";
  const tamperedSrc = mutateSource(shippedSrc, SHIPPED_REL, TAMPER_NEEDLE,
    'null /* TAMPERED IN MEMORY: legacy retry dropped */;');
  const VT = buildShipped(tamperedSrc, { file: SHIPPED_REL + ' <tampered-in-memory>', fns: DRIVER_FNS });
  await atest('self-test: with the legacy retry dropped, case (b) can no longer reach legacy-order', async () => {
    const obj = { policy_parameters: POLICY, output_payload: INDEXED_PAYLOAD };
    const a = artifactWith(await legacyHashOf(V, obj), INDEXED_PAYLOAD);
    const vr = await VT._runVerify(a);
    if (vr.hash === 'legacy-order') throw new Error('suite stayed green with the legacy retry removed: the assertions do not discriminate');
    if (vr.hash !== 'fail') throw new Error('expected fail on the tampered copy, got ' + vr.hash);
  });
} else {
  console.log('  - pre-refactor page: _verifyExecutionHash not found yet; the retry pin and the self-proof arm after the Ledger edit');
}

test('the shipped page carries the factored legacy-order verdict', () => {
  if (!HAS_FACTORED) throw new Error('shipped ' + SHIPPED_REL + ' has no _verifyExecutionHash: the legacy-order verdict does not exist yet (pre-refactor canary state)');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
