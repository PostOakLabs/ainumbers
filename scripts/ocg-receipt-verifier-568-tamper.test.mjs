#!/usr/bin/env node
/**
 * scripts/ocg-receipt-verifier-568-tamper.test.mjs
 * AV-REJECT-FIX-1: tamper-negative gate for tools/568-ocg-receipt-verifier.html
 * (AV-VERIFY-1) — the airgapped OCG receipt verifier (hash + eddsa-jcs-2022
 * Ed25519 + RFC 6962 Merkle inclusion, entirely offline). A verifier never
 * observed to reject isn't known to verify.
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1, audit finding E-3).
 * This gate carries NO copy of the verifier. It brace-extracts the REAL
 * `OCG` canonicalizer/hash/signature bundle plus `verifyMerkleInclusion` and
 * `verifyReceipt` out of `tools/568-ocg-receipt-verifier.html` — and the page's OWN
 * `FIXTURES.golden` / `FIXTURES.tampered` receipts with them — via the shared
 * extract-and-diff helper `scripts/lib-extract-shipped.mjs` (the AUD-C3-2 extractor
 * from chaingraph/kernels/inline-hash-equality.test.mjs). Before this change the
 * gate ran a ~150-line reimplementation over copy-pasted fixtures and never opened
 * tools/568 at all: the shipped verifier could stop rejecting anything and every
 * assertion below stayed green.
 *
 * SELF-PROVING (SO #34c / SO #40b): every run also TAMPERS the shipped source in
 * memory (forcing `verifyReceipt`'s overall verdict to PASS) and requires the suite
 * to go red on it — the row's RED condition re-proven on every run, not once in a
 * PR body. If the mutation point moves, `mutateSource` throws rather than quietly
 * disarming the self-proof.
 *
 * Tests (all now executed against the SHIPPED verifier and the SHIPPED fixtures):
 *   1. Golden receipt (real Ed25519 signature + real 4-leaf Merkle inclusion) → PASS.
 *   2. Shipped tampered receipt (output_payload.decision mutated post-signing) → FAIL.
 *   3. Flipped signature bytes → signature check FAILS, verdict FAIL.
 *   4. Corrupted Merkle inclusion path → anchor check FAILS, verdict FAIL.
 *   5. Structurally broken receipt (no execution_hash) → FAIL, not a throw.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildShipped, mutateSource } from './lib-extract-shipped.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SHIPPED_REL = 'tools/568-ocg-receipt-verifier.html';

// The extraction contract: exactly the shipped symbols the AV-VERIFY-1 verify path is
// made of, plus the page's own demo fixtures. `window` is shimmed because the page
// publishes its crypto bundle as `window.OCG`; nothing else from the page is executed.
const EXTRACT_SPEC = {
  file: SHIPPED_REL,
  prelude: 'var window = {};',
  decls: ['B58', 'FIXTURES'],
  fns: [
    'assertIJson', 'cgCanon', 'canonicalPreimage', 'executionHash', 'jcsBytes', 'sha256',
    'hexToBytes', 'bytesToHex', 'b58decode', 'didKeyToPublicKey', 'proofOptions', 'hashData',
    'securedArtifact', 'verifyOneProof', 'verifyArtifactProofs',
    'concatBytes', 'leafHash', 'nodeHash', 'rootFromInclusion', 'verifyMerkleInclusion',
    'verifyReceipt',
  ],
  assigns: [{ re: /window\.OCG\s*=/, label: 'window.OCG crypto namespace' }],
  tail: 'var OCG = window.OCG;',
  expose: ['verifyReceipt', 'verifyMerkleInclusion', 'executionHash', 'cgCanon', 'FIXTURES', 'OCG'],
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// ── The tamper suite, run against whichever verifier it is handed ──────────────
// Returns a list of failure messages (empty = suite passed for that verifier).
async function runReceiptSuite(V) {
  const fails = [];
  const check = async (name, fn) => {
    try { await fn(); } catch (e) { fails.push(name + ': ' + e.message); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  const GOLDEN = V.FIXTURES.golden;
  const TAMPERED = V.FIXTURES.tampered;

  await check('golden receipt (real Ed25519 sig + real Merkle inclusion): verdict PASS', async () => {
    const r = await V.verifyReceipt(GOLDEN, {});
    assert(r.verdict === 'PASS', 'Expected PASS, got ' + r.verdict + ' — checks: ' + JSON.stringify(r.checks));
    assert(r.hash_match === true, 'Expected hash_match=true on the golden receipt');
    assert(r.signature.present && r.signature.allValid, 'Expected the golden receipt signature to verify');
  });

  await check("shipped tampered fixture (output_payload.decision mutated post-signing): verdict FAILS", async () => {
    const r = await V.verifyReceipt(TAMPERED, {});
    assert(r.verdict === 'FAIL', 'Expected FAIL, got ' + r.verdict);
    assert(r.hash_match === false, 'Expected hash_match=false after tamper');
  });

  await check('flipped signature bytes: signature check FAILS', async () => {
    const bad = clone(GOLDEN);
    bad.audit_signature.proof.proofValue = bad.audit_signature.proof.proofValue.slice(0, -4) + 'AAAA';
    const r = await V.verifyReceipt(bad, {});
    assert(r.signature.allValid === false, 'Expected signature.allValid=false after flipping proofValue bytes');
    assert(r.verdict === 'FAIL', 'Expected overall verdict FAIL with a bad signature');
  });

  await check('corrupted Merkle inclusion path: anchor check FAILS', async () => {
    const bad = clone(GOLDEN);
    bad.anchor_bindings[0].merkle_inclusion.path[0] = 'sha256:' + '00'.repeat(32);
    const r = await V.verifyReceipt(bad, {});
    assert(r.anchors[0].pass === false, 'Expected anchor pass=false with corrupted path');
    assert(r.verdict === 'FAIL', 'Expected overall verdict FAIL with a corrupted Merkle path');
  });

  await check('structurally broken receipt (execution_hash removed): verdict FAILS', async () => {
    const bad = clone(GOLDEN);
    delete bad.execution_hash;
    const r = await V.verifyReceipt(bad, {});
    assert(r.verdict === 'FAIL', 'Expected FAIL for a receipt with no execution_hash, got ' + r.verdict);
  });

  await check('trustedRootHex pin: a root the caller does not trust FAILS the anchor', async () => {
    const r = await V.verifyReceipt(GOLDEN, { trustedRootHex: 'ff'.repeat(32) });
    assert(r.anchors[0].pass === false, 'Expected anchor pass=false against an untrusted checkpoint root');
    assert(r.verdict === 'FAIL', 'Expected overall verdict FAIL against an untrusted checkpoint root');
  });

  return fails;
}

// ── Runner ─────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function report(name, failures) {
  if (failures.length === 0) { console.log('  ✓ ' + name); passed++; return; }
  console.error('  ✗ ' + name);
  for (const f of failures) console.error('    ' + f);
  failed++;
}
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

console.log('ocg-receipt-verifier-568-tamper.test.mjs (SHIPPED source: ' + SHIPPED_REL + ')');

// ── 1. Build the verifier from the SHIPPED page and run the tamper suite ───────
const shippedSrc = readFileSync(join(REPO, SHIPPED_REL), 'utf8');
const V = buildShipped(shippedSrc, EXTRACT_SPEC);   // throws (red) if a symbol is gone
test('extraction: shipped verifier + shipped fixtures located in ' + SHIPPED_REL, () => {
  if (typeof V.verifyReceipt !== 'function') throw new Error('shipped `verifyReceipt` did not extract as a function');
  if (typeof V.verifyMerkleInclusion !== 'function') throw new Error('shipped `verifyMerkleInclusion` did not extract as a function');
  if (typeof V.OCG?.executionHash !== 'function') throw new Error('shipped `window.OCG` namespace did not assemble');
  if (!V.FIXTURES?.golden || !V.FIXTURES?.tampered) throw new Error('shipped FIXTURES.golden/.tampered did not extract');
  if (JSON.stringify(V.FIXTURES.golden) === JSON.stringify(V.FIXTURES.tampered))
    throw new Error('shipped golden and tampered fixtures are identical — the negative case is vacuous');
});

report('shipped AV-VERIFY-1 receipt verifier: full tamper suite (6 assertions)', await runReceiptSuite(V));

// ── 2. Self-proving: TAMPER THE SHIPPED SOURCE, in process, and require the RED ──
const TAMPER_NEEDLE = 'var overall = hashMatch && (!sigRes.present || sigRes.allValid) && anchorsOk && (!opts.requireAnchor || anchorBindings.length>0);';
const tamperedSrc = mutateSource(shippedSrc, SHIPPED_REL, TAMPER_NEEDLE,
  'var overall = true; /* TAMPERED IN MEMORY: verdict can no longer be FAIL */');
const tamperedFails = await runReceiptSuite(buildShipped(tamperedSrc, { ...EXTRACT_SPEC, file: SHIPPED_REL + ' <tampered-in-memory>' }));
test(`self-test: tampering the SHIPPED verdict reds the suite (${tamperedFails.length} assertion failures caught)`, () => {
  if (tamperedFails.length === 0)
    throw new Error('suite stayed green with the shipped verdict forced to PASS — it is not reading shipped source, or the assertions do not discriminate');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
