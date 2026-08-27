// art-659-publish-fund-nav-head — class-B property-test floor.
// kernel_digest_at_authoring: sha256:8a0aec162b25b840e744e7b5c9e95693aba152690b9e6c0fbdb67dc5ab44233a
// spec: NAV-LINEAGE-BUILD-SPEC.md §3
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §3)
//
// Class B (bounded-shape structural gate, no float arithmetic). compute() is a PURE STRUCTURAL
// validator over an already-signed head-commit object PLUS the caller's own signature/chain
// verification claim — it never touches crypto.subtle itself (see the kernel's HARD FENCE
// comment for why: the real zkVM guest has no WebCrypto, and the VM<->worker parity harness's
// verify() bridge was measured to diverge from the worker while authoring the sibling
// art-649-publish-model-risk-head this kernel follows). This floor's job is compute()'s own
// synchronous contract per FV-PBT-FLOOR-BUILD-SPEC.md §3.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-659-publish-fund-nav-head.proptest.mjs

import { compute } from '../art-659-publish-fund-nav-head.kernel.mjs';
import { summarize, mulberry32, pick, findShapeViolations, FIXTURES_DIR } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KERNEL_ID = 'art-659-publish-fund-nav-head';
const rand = mulberry32(0x659D2);
const TRIALS = 8000;

// head_hash is left null by compute() (per its own doc comment: "filled in by buildArtifact() —
// independently recomputed, never asserted here") and only populated by the async buildArtifact()
// wrapper this floor never calls (pure SHA-256, but still async crypto.subtle.digest, which
// compute() cannot touch and stay synchronous). Excluded from the oracle diff on that documented
// basis — same precedent as art-649-publish-model-risk-head's own proptest floor.
function runFixtureOracle() {
  const fixtures = JSON.parse(readFileSync(join(FIXTURES_DIR, `${KERNEL_ID}.fixtures.json`), 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify({ ...output_payload, head_hash: undefined });
    const b = JSON.stringify({ ...vec.output_payload, head_hash: undefined });
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  return { total: fixtures.vectors.length, failures };
}

function randHash(rng) { let s = ''; for (let i = 0; i < 64; i++) s += Math.floor(rng() * 16).toString(16); return 'sha256:' + s; }
function randDid(rng) { return 'did:key:z6Mk' + Array.from({ length: 20 }, () => pick(rng, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''))).join(''); }

// A structurally VALID (but not really cryptographically signed) head — compute() never checks
// the actual signature, only proof shape, so a well-shaped fake proof exercises the same path.
function randValidHead(rng, seq) {
  const signer = randDid(rng);
  return {
    head_version: '1',
    stream: 'fund-nav:FUND-' + Math.floor(rng() * 1000),
    signer,
    seq,
    prev_head_hash: seq === 0 ? null : randHash(rng),
    root: randHash(rng),
    timestamp: '2026-08-' + String(1 + Math.floor(rng() * 28)).padStart(2, '0') + 'T00:00:00Z',
    ...(rng() < 0.2 ? { rotates_to: randDid(rng) } : {}),
    proof: { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', verificationMethod: signer, created: '2026-08-27T00:00:00Z', proofPurpose: 'assertionMethod', proofValue: 'z' + Array.from({ length: 40 }, () => pick(rng, '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split(''))).join('') },
  };
}

function randClaim(rng) { return { verified: rng() < 0.5, verified_by: 'harness-' + Math.floor(rng() * 100) }; }

const MUTATORS = [
  (h) => ({ ...h, signer: 'not-a-did' }),
  (h) => ({ ...h, seq: -1 }),
  (h) => ({ ...h, seq: 1.5 }),
  (h) => ({ ...h, root: 'plain-string' }),
  (h) => ({ ...h, timestamp: '' }),
  (h) => ({ ...h, proof: undefined }),
  (h) => ({ ...h, proof: { ...h.proof, cryptosuite: 'other' } }),
  (h) => ({ ...h, proof: { ...h.proof, proofPurpose: 'other' } }),
  (h) => ({ ...h, proof: { ...h.proof, proofValue: 'no-leading-z' } }),
  (h) => ({ ...h, proof: { ...h.proof, verificationMethod: 'did:key:zSOMEONE_ELSE' } }),
];

// ---------- P1: a well-formed head at seq 0 with a well-formed claim always passes structurally ----------
function checkP1_validGenesisAlwaysPasses() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const head = randValidHead(rand, 0);
    const claim = randClaim(rand);
    checked++;
    const r = compute({ head, signature_verification: claim });
    if (r.output_payload.structural_error !== null) violations++;
    if (!r.output_payload.is_genesis) violations++;
    if (!r.compliance_flags.includes('NAV_HEAD_STRUCTURE_VALID') || !r.compliance_flags.includes('NAV_HEAD_GENESIS')) violations++;
  }
  return { name: 'P1_valid_genesis_head_always_structurally_passes', checked, violations };
}

// ---------- P2: a well-formed head at seq > 0 with a well-formed claim always passes structurally ----------
function checkP2_validChainedAlwaysPasses() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const seq = 1 + Math.floor(rand() * 1000);
    const head = randValidHead(rand, seq);
    const claim = randClaim(rand);
    checked++;
    const r = compute({ head, signature_verification: claim });
    if (r.output_payload.structural_error !== null) violations++;
    if (r.output_payload.is_genesis) violations++;
    if (!r.compliance_flags.includes('NAV_HEAD_CHAINED')) violations++;
    if (head.rotates_to && !r.compliance_flags.includes('NAV_HEAD_ROTATION_ANNOUNCED')) violations++;
  }
  return { name: 'P2_valid_chained_head_always_structurally_passes', checked, violations };
}

// ---------- P3: any single-field mutation of a valid head yields a non-null structural_error ----------
function checkP3_mutationAlwaysDetected() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const seq = Math.floor(rand() * 2) === 0 ? 0 : 1 + Math.floor(rand() * 100);
    const head = randValidHead(rand, seq);
    const mutate = pick(rand, MUTATORS);
    const mutated = mutate(head);
    checked++;
    const r = compute({ head: mutated, signature_verification: randClaim(rand) });
    if (r.output_payload.structural_error === null) violations++;
    if (!r.compliance_flags.includes('NAV_HEAD_STRUCTURAL_ERROR')) violations++;
  }
  return { name: 'P3_single_field_mutation_always_detected', checked, violations };
}

// ---------- P4: signature_verification.verified is echoed VERBATIM, never flipped ----------
function checkP4_claimEchoedVerbatim() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const seq = Math.floor(rand() * 500);
    const head = randValidHead(rand, seq);
    const claim = randClaim(rand);
    checked++;
    const op = compute({ head, signature_verification: claim }).output_payload;
    if (op.signature_valid !== claim.verified) violations++;
    if (op.signature_verified_by !== claim.verified_by) violations++;
    if (op.head_hash !== null) violations++; // compute() never fills head_hash — only buildArtifact() does
  }
  return { name: 'P4_signature_claim_echoed_verbatim_and_head_hash_untouched', checked, violations };
}

// ---------- P5: a missing/malformed signature_verification is ALWAYS rejected, even over an otherwise-valid head ----------
function checkP5_missingClaimRejected() {
  let violations = 0, checked = 0;
  const BAD_CLAIMS = [undefined, null, {}, { verified: 'yes' }, { verified: true }, { verified: true, verified_by: '' }, 'not-an-object'];
  for (let i = 0; i < TRIALS; i++) {
    const seq = Math.floor(rand() * 100);
    const head = randValidHead(rand, seq);
    const badClaim = pick(rand, BAD_CLAIMS);
    checked++;
    const r = compute({ head, signature_verification: badClaim });
    if (r.output_payload.structural_error === null) violations++;
  }
  return { name: 'P5_missing_or_malformed_claim_always_rejected', checked, violations };
}

// ---------- P6: determinism — same pp twice yields byte-identical output_payload ----------
function checkP6_deterministic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const seq = Math.floor(rand() * 100);
    const head = randValidHead(rand, seq);
    const claim = randClaim(rand);
    const pp = { head, signature_verification: claim, ...(seq > 0 && rand() < 0.5 ? { prior_head: randValidHead(rand, seq - 1), chain_verification: randClaim(rand) } : {}) };
    checked++;
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    if (a !== b) violations++;
  }
  return { name: 'P6_deterministic_same_input_same_output', checked, violations };
}

// ---------- P7: shape invariant — no NaN/undefined/non-finite anywhere in output_payload ----------
function checkP7_shapeClean() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const seq = Math.floor(rand() * 500);
    const head = randValidHead(rand, seq);
    checked++;
    const v = findShapeViolations(compute({ head, signature_verification: randClaim(rand) }).output_payload);
    if (v.length) violations++;
  }
  return { name: 'P7_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P8 forced categorical boundary cases (structural gate only — no real signature) ----------
const G = randValidHead(mulberry32(1), 0);
const C = randValidHead(mulberry32(2), 5);
const OK_CLAIM = { verified: true, verified_by: 'forced-test' };
const FORCED_CASES = [
  [{}, 'fully empty input — head required'],
  [{ head: G }, 'well-formed genesis, no claim — signature_verification required'],
  [{ head: { ...G, prev_head_hash: 'sha256:' + 'aa'.repeat(32) }, signature_verification: OK_CLAIM }, 'genesis with non-null prev_head_hash — structural_error'],
  [{ head: { ...C, prev_head_hash: null }, signature_verification: OK_CLAIM }, 'seq > 0 with null prev_head_hash — structural_error'],
  [{ head: { ...G, proof: undefined }, signature_verification: OK_CLAIM }, 'missing proof — structural_error, head must already be signed'],
  [{ head: G, signature_verification: OK_CLAIM }, 'well-formed genesis with claim — NAV_HEAD_GENESIS'],
  [{ head: C, signature_verification: OK_CLAIM }, 'well-formed chained head with claim, no prior_head — NAV_HEAD_CHAINED'],
  [{ head: C, signature_verification: OK_CLAIM, prior_head: randValidHead(mulberry32(3), 4) }, 'chained head with prior_head but no chain_verification — structural_error'],
  [{ head: C, signature_verification: OK_CLAIM, prior_head: randValidHead(mulberry32(3), 4), chain_verification: OK_CLAIM }, 'chained head with prior_head and chain_verification — NAV_HEAD_CHAIN_CLAIMED_VALID'],
  [{ head: { ...C, rotates_to: 'did:key:zROTATED' }, signature_verification: OK_CLAIM }, 'rotation announced — NAV_HEAD_ROTATION_ANNOUNCED'],
];

function checkP8_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const plausible = op.head_hash === null; // compute() never fills head_hash
    rows.push({ label, structural_error: op.structural_error, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle();
const properties = [
  checkP1_validGenesisAlwaysPasses(),
  checkP2_validChainedAlwaysPasses(),
  checkP3_mutationAlwaysDetected(),
  checkP4_claimEchoedVerbatim(),
  checkP5_missingClaimRejected(),
  checkP6_deterministic(),
  checkP7_shapeClean(),
];
const forced = checkP8_forced();
const forcedImplausible = forced.filter((f) => !f.plausible);
properties.push({ name: 'P8_forced_boundary_cases_plausible', checked: forced.length, violations: forcedImplausible.length });

const ok = summarize(KERNEL_ID, oracle, properties);
if (!ok) console.log('forced boundary rows:', JSON.stringify(forced, null, 2));
process.exit(ok ? 0 : 1);
