// §27.11 evidence-verification gate — unit + NEGATIVE-CONTROL suite for `_hagate.mjs`.
//
// WHY THIS FILE EXISTS. `isConformantEvidence()` checks the SHAPE of a §16 proof block, never its
// bytes. Before §27.11 the gate reported `satisfied` identically for two real Ed25519 sign-offs and for
// two hand-typed records carrying a plausible but unsigned proof block — an authorization gap, since
// §27.3 `dual_control(2)` is supposed to mean two distinct humans actually signed.
//
// The controls below are the point of the file: an UNSIGNED record and a TAMPERED record are both run
// through the REAL `_proof.mjs` verifier (WebCrypto Ed25519, no stubs) and must come back false, while a
// genuinely signed record must come back true — and the gate result must differ visibly between them.
// ⛔ A test that only fed a hand-made boolean into `verdictOf` would prove nothing about the gap.
//
// Run: node chaingraph/kernels/hagate-evidence-verification.test.mjs

import {
  evaluateHaGate, classifyEvidenceVerification, distinctApprovers, hasRejection,
  findActiveOverride, isConformantEvidence, HA_EVIDENCE_VERIFICATION,
} from './_hagate.mjs';
import { sign, verify, rawPubkeyToDidKey } from './_proof.mjs';

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ok  ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}
function eq(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const SUBJECT = 'sha256:' + 'a'.repeat(64);
const NOW = '2026-08-01T12:00:00.000Z';

/** A §27 approval record for `did`, unsigned — no `audit_signature` at all. */
function bareRecord(did, record_type = 'approval', role = 'approver') {
  return { record_type, role, subject_hash: SUBJECT, decision: 'approve', identity: { id: did }, timestamp: NOW };
}

/** The forgery this whole section exists to catch: a plausible but wholly fabricated proof block. */
function fabricatedRecord(did) {
  const r = bareRecord(did);
  r.audit_signature = {
    proof: {
      type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: `${did}#key-1`, proofPurpose: 'assertionMethod', created: NOW,
      proofValue: 'z' + '1'.repeat(86),   // well-formed base58 shape, signs nothing
    },
  };
  return r;
}

async function makeIdentity() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const did = await rawPubkeyToDidKey(kp.publicKey);
  return { did, publicKey: kp.publicKey, privateKey: kp.privateKey };
}

async function signedRecord(id, record_type = 'approval', role = 'approver') {
  return sign(bareRecord(id.did, record_type, role), {
    verificationMethod: `${id.did}#key-1`, created: NOW, privateKey: id.privateKey,
  });
}

/**
 * The real §27.11 wiring a surface must do: resolve each record's key from its own `identity.id`
 * and verify the §16 proof bytes. Returns the SYNCHRONOUS `verdictOf` the pure evaluator takes.
 */
async function buildVerdictOf(records, keysByDid) {
  const verdicts = new Map();
  for (const r of records) {
    const pub = keysByDid.get(r.identity?.id);
    verdicts.set(r, pub ? await verify(r, pub) : undefined);
  }
  return (r) => verdicts.get(r);
}

async function main() {
  const alice = await makeIdentity();
  const bob = await makeIdentity();
  const keys = new Map([[alice.did, alice.publicKey], [bob.did, bob.publicKey]]);

  console.log('§27.11.2 vocabulary is closed');
  eq('four values, in spec order', HA_EVIDENCE_VERIFICATION.join(','), 'verified,structural_only,invalid,not_applicable');
  check('frozen', Object.isFrozen(HA_EVIDENCE_VERIFICATION));

  console.log('\nThe gap itself — a fabricated proof block passes the STRUCTURAL check');
  const forged = [fabricatedRecord(alice.did), fabricatedRecord(bob.did)];
  check('fabricated records are structurally conformant', forged.every(isConformantEvidence));
  eq('and unsigned records are not', forged.length && isConformantEvidence(bareRecord(alice.did)), false);
  const forgedVerdicts = await buildVerdictOf(forged, keys);
  check('REAL verifier rejects both fabrications', forged.every((r) => forgedVerdicts(r) === false));

  console.log('\nNEGATIVE CONTROL — two fabricated dual_control approvals');
  const bad = evaluateHaGate({
    gatePolicy: 'dual_control', role: 'approver', subjectHash: SUBJECT,
    records: forged, nowISO: NOW, verdictOf: forgedVerdicts,
  });
  eq('§27.11.4 excludes them from the count', bad.matched_identities.length, 0);
  eq('threshold outcome is HOLD, not satisfied', bad.status, 'hold');
  eq('evidence_verification reports the failed check', bad.evidence_verification, 'invalid');

  console.log('\nPOSITIVE CONTROL — two genuinely signed dual_control approvals');
  const good = [await signedRecord(alice), await signedRecord(bob)];
  const goodVerdicts = await buildVerdictOf(good, keys);
  check('REAL verifier accepts both', good.every((r) => goodVerdicts(r) === true));
  const ok = evaluateHaGate({
    gatePolicy: 'dual_control', role: 'approver', subjectHash: SUBJECT,
    records: good, nowISO: NOW, verdictOf: goodVerdicts,
  });
  eq('two distinct approvers counted', ok.matched_identities.length, 2);
  eq('threshold outcome is satisfied', ok.status, 'satisfied');
  eq('evidence_verification is verified', ok.evidence_verification, 'verified');

  console.log('\nTHE PAIR IS DISTINGUISHABLE (the defect, restated as an assertion)');
  check('forged and signed no longer produce the same verdict',
    JSON.stringify([bad.status, bad.evidence_verification]) !== JSON.stringify([ok.status, ok.evidence_verification]));

  console.log('\nTAMPER CONTROL — a validly signed record whose payload was altered afterwards');
  const tampered = structuredClone(good[0]);
  tampered.decision = 'reject';
  eq('still structurally conformant', isConformantEvidence(tampered), true);
  eq('REAL verifier rejects the tampered payload', await verify(tampered, alice.publicKey), false);

  console.log('\n§27.11.3 — the gate RECORDS, it does not BLOCK');
  const noVerifier = evaluateHaGate({
    gatePolicy: 'dual_control', role: 'approver', subjectHash: SUBJECT, records: good, nowISO: NOW,
  });
  eq('a met threshold stays satisfied with no verifier available', noVerifier.status, 'satisfied');
  eq('and is honestly labelled structural_only', noVerifier.evidence_verification, 'structural_only');
  check('⛔ absence is never read as verified', noVerifier.evidence_verification !== 'verified');

  console.log('\n§27.11.2 not_applicable — outcomes that count zero records');
  for (const p of ['auto_pass', 'reject', 'escalate']) {
    const r = evaluateHaGate({ gatePolicy: p, role: 'approver', subjectHash: SUBJECT, records: [], nowISO: NOW });
    eq(`${p} makes no claim about evidence`, r.evidence_verification, 'not_applicable');
  }
  eq('an unknown policy holds and claims nothing',
    evaluateHaGate({ gatePolicy: 'nope', role: 'approver', subjectHash: SUBJECT, records: [], nowISO: NOW }).evidence_verification, 'not_applicable');
  eq('a hold with no records at all claims nothing',
    evaluateHaGate({ gatePolicy: 'review_required', role: 'approver', subjectHash: SUBJECT, records: [], nowISO: NOW }).evidence_verification, 'not_applicable');

  console.log('\n§27.11.4 applies to rejections and overrides too');
  const forgedRejection = fabricatedRecord(alice.did);
  forgedRejection.record_type = 'rejection';
  forgedRejection.decision = 'reject';
  const rejVerdicts = await buildVerdictOf([forgedRejection], keys);
  eq('a fabricated rejection no longer blocks the gate',
    hasRejection([forgedRejection], 'approver', SUBJECT, true, rejVerdicts), false);
  eq('and it still blocks when nothing was checked',
    hasRejection([forgedRejection], 'approver', SUBJECT, true, null), true);

  const forgedOverride = fabricatedRecord(alice.did);
  forgedOverride.record_type = 'override';
  forgedOverride.override = { scope: 'gate:test', expiry: '2099-01-01T00:00:00.000Z', subject_hash: SUBJECT };
  const ovrVerdicts = await buildVerdictOf([forgedOverride], keys);
  eq('a fabricated override does not satisfy §27.5',
    findActiveOverride([forgedOverride], SUBJECT, NOW, true, ovrVerdicts), null);
  const ovrResult = evaluateHaGate({
    gatePolicy: 'review_required', role: 'approver', subjectHash: SUBJECT,
    records: [forgedOverride], nowISO: NOW, verdictOf: ovrVerdicts,
  });
  eq('the excluded override is reported, not silently dropped', ovrResult.evidence_verification, 'invalid');
  eq('and the underlying policy reverts, never a silent pass', ovrResult.status, 'hold');

  const realOverride = bareRecord(alice.did, 'override');
  realOverride.override = { scope: 'gate:test', expiry: '2099-01-01T00:00:00.000Z', subject_hash: SUBJECT };
  const signedOverride = await sign(realOverride, {
    verificationMethod: `${alice.did}#key-1`, created: NOW, privateKey: alice.privateKey,
  });
  const soVerdicts = await buildVerdictOf([signedOverride], keys);
  check('a genuinely signed override verifies', soVerdicts(signedOverride) === true);
  const soResult = evaluateHaGate({
    gatePolicy: 'review_required', role: 'approver', subjectHash: SUBJECT,
    records: [signedOverride], nowISO: NOW, verdictOf: soVerdicts,
  });
  eq('signed override is active', soResult.status, 'override_active');
  eq('and its evidence is verified', soResult.evidence_verification, 'verified');

  console.log('\n§27.11.4 — a MIX of one good and one forged approval');
  const mixed = [good[0], fabricatedRecord(bob.did)];
  const mixedVerdicts = await buildVerdictOf(mixed, keys);
  const mix = evaluateHaGate({
    gatePolicy: 'dual_control', role: 'approver', subjectHash: SUBJECT,
    records: mixed, nowISO: NOW, verdictOf: mixedVerdicts,
  });
  eq('only the real approver counts', mix.matched_identities.length, 1);
  eq('N=2 is not met', mix.status, 'hold');
  eq('invalid outranks the verified survivor', mix.evidence_verification, 'invalid');

  console.log('\nclassifyEvidenceVerification unit cases');
  eq('empty + no invalid', classifyEvidenceVerification({ counted: [], invalid: [] }, null), 'not_applicable');
  eq('invalid wins over empty', classifyEvidenceVerification({ counted: [], invalid: [{}] }, null), 'invalid');
  eq('counted but unchecked', classifyEvidenceVerification({ counted: [{}], invalid: [] }, null), 'structural_only');
  eq('one unchecked among verified degrades to structural_only',
    classifyEvidenceVerification({ counted: ['a', 'b'], invalid: [] }, (r) => (r === 'a' ? true : undefined)), 'structural_only');

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — §27.11 evidence-verification gate (${failures} failure(s))`);
  if (failures) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
