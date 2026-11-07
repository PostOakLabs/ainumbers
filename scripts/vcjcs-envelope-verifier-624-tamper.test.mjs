#!/usr/bin/env node
/**
 * scripts/vcjcs-envelope-verifier-624-tamper.test.mjs
 * TSURF-VC-INSPECTOR-1: tamper-negative + regression gate for
 * tools/624-vcjcs-envelope-verifier.html — the VC-JCS envelope verifier
 * (eddsa-jcs-2022 Ed25519 and, since this row, ecdsa-jcs-2019 P-256 over
 * did:key, entirely offline). A verifier never observed to reject isn't
 * known to verify.
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1, audit finding E-3),
 * cloned from the T568 pattern (scripts/ocg-receipt-verifier-568-tamper.test.mjs).
 * This gate carries NO copy of the verifier. It brace-extracts the REAL VCJCS
 * canonicalizer/hash/did:key/proof-verify bundle plus `verifyDocument` and the
 * page's OWN five shipped fixtures via scripts/lib-extract-shipped.mjs.
 *
 * SELF-PROVING (SO #34c / SO #40b): every run also TAMPERS the shipped source in
 * memory (forcing verifyDocument's overall verdict to PASS) and requires the suite
 * to go red on it. If the mutation point moves, mutateSource throws rather than
 * quietly disarming the self-proof.
 *
 * REGRESSION FENCE (drift report TSURF-UPGRADE-DRIFT-SCOPE-2026-10-22 §3):
 * the pre-upgrade outputs of the three ORIGINAL shipped fixtures are frozen in
 * scripts/vcjcs-envelope-verifier-624-frozen-fixtures.json (committed BEFORE the
 * functional edit). The suite re-runs those fixtures through the SHIPPED verifier
 * and asserts zero change on verdict and every check row; the only intended flip
 * class is ecdsa-jcs-2019 / P-256 inputs, which were declared-FAIL before this
 * row and are covered by the new ecdsaGolden PASS / ecdsaTampered FAIL fixtures.
 *
 * Tests (against the SHIPPED verifier and the SHIPPED fixtures):
 *   1. Ed25519 golden → PASS; frozen JSON zero-change on all three original fixtures.
 *   2. ecdsa-jcs-2019 golden (P-256 did:key 0x1200) → PASS.
 *   3. Flipped Ed25519 proofValue → signature check FAILS, verdict FAIL.
 *   4. Flipped P-256 proofValue → signature check FAILS, verdict FAIL.
 *   5. Mutated output_payload (hash stale) → hash-recompute FAILS, verdict FAIL.
 *   6. Unsupported cryptosuite → declared FAIL branch with its error string.
 *   7. Non-Ed25519/non-P-256 did:key → declared FAIL branch with its error string.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildShipped, mutateSource } from './lib-extract-shipped.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SHIPPED_REL = 'tools/624-vcjcs-envelope-verifier.html';
const FROZEN_REL = 'scripts/vcjcs-envelope-verifier-624-frozen-fixtures.json';

const EXTRACT_SPEC = {
  file: SHIPPED_REL,
  prelude: 'var window = {};',
  decls: ['B58', 'FIXTURES'],
  fns: [
    '__ocgJcs', 'assertIJson', 'cgCanon', 'executionHash', 'jcsBytes', 'sha256',
    'b58decode', 'didKeyCurve', 'didKeyToPublicKey', 'vcjcsHexDigest',
    'verifyEnvelopeProof', 'findReceipts', 'recomputeAllHashes', 'verifyDocument',
  ],
  assigns: [{ re: /window\.VCJCS\s*=/, label: 'window.VCJCS namespace' }],
  tail: 'var VCJCS = window.VCJCS;',
  expose: ['verifyDocument', 'verifyEnvelopeProof', 'FIXTURES', 'VCJCS'],
};

const clone = (o) => JSON.parse(JSON.stringify(o));

const B58A='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) {
  const digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let j = 0; j < digits.length; j++) { carry += digits[j] * 256; digits[j] = carry % 58; carry = (carry - (carry % 58)) / 58; }
    while (carry) { digits.push(carry % 58); carry = (carry - (carry % 58)) / 58; }
  }
  let out = '1'.repeat(bytes.length - [...bytes].findIndex((b) => b !== 0));
  for (let i = digits.length - 1; i >= 0; i--) out += B58A[digits[i]];
  return out;
}


async function runSuite(V) {
  const fails = [];
  const check = async (name, fn) => {
    try { await fn(); } catch (e) { fails.push(name + ': ' + e.message); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  await check('Ed25519 golden fixture: verdict PASS', async () => {
    const r = await V.verifyDocument(clone(V.FIXTURES.golden));
    assert(r.verdict === 'PASS', 'Expected PASS, got ' + r.verdict + ' — checks: ' + JSON.stringify(r.checks));
    assert(r.sig && r.sig.valid === true, 'Expected the Ed25519 signature to verify');
  });

  await check('ecdsa-jcs-2019 golden fixture (P-256 did:key): verdict PASS with the ecdsa check row', async () => {
    const r = await V.verifyDocument(clone(V.FIXTURES.ecdsaGolden));
    assert(r.verdict === 'PASS', 'Expected PASS, got ' + r.verdict + ' — checks: ' + JSON.stringify(r.checks));
    const row = r.checks.find((c) => c.check === 'ecdsa_jcs_2019_signature');
    assert(row && row.pass === true, 'Expected a PASSing ecdsa_jcs_2019_signature check row');
    assert(r.sig && r.sig.cryptosuite === 'ecdsa-jcs-2019', 'Expected the reported cryptosuite to be ecdsa-jcs-2019');
    assert(typeof r.sig.canonical_document === 'string' && r.sig.canonical_document.length > 0, 'Expected the canonical-bytes view payload to be present');
  });

  await check('shipped tamperedProof fixture (flipped Ed25519 proofValue): FAILS on the signature row', async () => {
    const r = await V.verifyDocument(clone(V.FIXTURES.tamperedProof));
    assert(r.verdict === 'FAIL', 'Expected FAIL, got ' + r.verdict);
    const row = r.checks.find((c) => c.check === 'eddsa_jcs_2022_signature');
    assert(row && row.pass === false, 'Expected the eddsa_jcs_2022_signature row to fail');
    assert(r.hashResults.every((h) => h.match), 'Expected every execution_hash still to recompute (signature-only tamper)');
  });

  await check('shipped ecdsaTampered fixture (flipped P-256 proofValue): FAILS on the ecdsa row', async () => {
    const r = await V.verifyDocument(clone(V.FIXTURES.ecdsaTampered));
    assert(r.verdict === 'FAIL', 'Expected FAIL, got ' + r.verdict);
    const row = r.checks.find((c) => c.check === 'ecdsa_jcs_2019_signature');
    assert(row && row.pass === false, 'Expected the ecdsa_jcs_2019_signature row to fail');
  });

  await check('shipped tamperedPayload fixture (stale execution_hash): FAILS on the hash-recompute row', async () => {
    const r = await V.verifyDocument(clone(V.FIXTURES.tamperedPayload));
    assert(r.verdict === 'FAIL', 'Expected FAIL, got ' + r.verdict);
    const bad = r.hashResults.filter((h) => !h.match);
    assert(bad.length > 0, 'Expected at least one execution_hash recompute mismatch');
  });

  await check('unsupported cryptosuite: declared FAIL branch carrying its error string', async () => {
    const bad = clone(V.FIXTURES.golden);
    bad.proof.cryptosuite = 'eddsa-rdfc-2022';
    const r = await V.verifyDocument(bad);
    assert(r.verdict === 'FAIL', 'Expected FAIL for an unsupported cryptosuite');
    const row = r.checks.find((c) => c.pass === false && /unsupported proof type\/cryptosuite/.test(c.detail));
    assert(row, 'Expected the declared unsupported-cryptosuite error string');
  });

  await check('did:key of an unsupported key type: declared FAIL branch carrying its error string', async () => {
    const bad = clone(V.FIXTURES.ecdsaGolden);
    // a well-formed z-multibase whose multicodec prefix (0x00 0x01) is neither 0xed01 nor 0x1200
    bad.proof.verificationMethod = 'did:key:z' + b58([0x00, 0x01, ...new Uint8Array(32).fill(7)]);
    const r = await V.verifyDocument(bad);
    assert(r.verdict === 'FAIL', 'Expected FAIL for an unsupported did:key key type');
    const row = r.checks.find((c) => c.pass === false && /unsupported key type/.test(c.detail));
    assert(row, 'Expected the declared unsupported-key-type error string');
  });

  return fails;
}

// Regression: zero change on the frozen pre-upgrade outputs (verdict + every check row).
async function checkFrozen(V) {
  const frozen = JSON.parse(readFileSync(join(REPO, FROZEN_REL), 'utf8'));
  const fails = [];
  for (const name of Object.keys(frozen.fixtures)) {
    const f = frozen.fixtures[name];
    const r = await V.verifyDocument(clone(V.FIXTURES[name]));
    if (r.verdict !== f.verdict) fails.push(`${name}: verdict drifted — frozen ${f.verdict}, shipped ${r.verdict}`);
    const got = r.checks.map((c) => ({ check: c.check, pass: c.pass, detail: c.detail }));
    if (JSON.stringify(got) !== JSON.stringify(f.checks))
      fails.push(`${name}: check rows drifted from the frozen pre-upgrade output — ` +
        JSON.stringify(got).slice(0, 400));
  }
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

console.log('vcjcs-envelope-verifier-624-tamper.test.mjs (SHIPPED source: ' + SHIPPED_REL + ')');

const shippedSrc = readFileSync(join(REPO, SHIPPED_REL), 'utf8');
const V = buildShipped(shippedSrc, EXTRACT_SPEC);   // throws (red) if a symbol is gone
test('extraction: shipped verifier + shipped fixtures located in ' + SHIPPED_REL, () => {
  if (typeof V.verifyDocument !== 'function') throw new Error('shipped `verifyDocument` did not extract as a function');
  if (typeof V.verifyEnvelopeProof !== 'function') throw new Error('shipped `verifyEnvelopeProof` did not extract as a function');
  if (typeof V.VCJCS?.recomputeAllHashes !== 'function') throw new Error('shipped `window.VCJCS` namespace did not assemble');
  for (const k of ['golden', 'tamperedProof', 'tamperedPayload', 'ecdsaGolden', 'ecdsaTampered'])
    if (!V.FIXTURES?.[k]) throw new Error('shipped FIXTURES.' + k + ' did not extract');
  if (JSON.stringify(V.FIXTURES.ecdsaGolden) === JSON.stringify(V.FIXTURES.ecdsaTampered))
    throw new Error('shipped ecdsaGolden and ecdsaTampered fixtures are identical — the negative case is vacuous');
});

report('frozen pre-upgrade outputs (verdict + every check row): zero change on the three original fixtures', await checkFrozen(V));
report('shipped VCJCS envelope verifier: full tamper suite (7 assertions)', await runSuite(V));

// ── Self-proving: TAMPER THE SHIPPED SOURCE, in process, and require the RED ──
const TAMPER_NEEDLE = 'var overall = structOk && sig.present && sig.valid && allHashesMatch && !!grade;';
const tamperedSrc = mutateSource(shippedSrc, SHIPPED_REL, TAMPER_NEEDLE,
  'var overall = true; /* TAMPERED IN MEMORY: verdict can no longer be FAIL */');
const tamperedFails = await runSuite(buildShipped(tamperedSrc, { ...EXTRACT_SPEC, file: SHIPPED_REL + ' <tampered-in-memory>' }));
test(`self-test: tampering the SHIPPED verdict reds the suite (${tamperedFails.length} assertion failures caught)`, () => {
  if (tamperedFails.length === 0)
    throw new Error('suite stayed green with the shipped verdict forced to PASS — it is not reading shipped source, or the assertions do not discriminate');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
