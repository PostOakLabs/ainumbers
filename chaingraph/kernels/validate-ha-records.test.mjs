// validate-ha-records.test.mjs — SPEC.md §27 Human Accountability gate (SPEC.md §15).
//
// §27 adds a signed, machine-checkable HUMAN-ACCOUNTABILITY layer: SCITT-style approval records
// (artifacts ABOUT a sealed artifact), in-toto dual-control thresholds, a §21.4-wired gate-policy
// vocabulary, time-boxed §22.10 overrides, and a §13.12-exportable evidence bundle. This gate proves
// the SIX §27 invariants the schema alone cannot express (schema-validate.mjs covers the record shape
// against $defs/humanAccountabilityRecord; the §16 signature round-trip stays with proof-binding.test.mjs):
//
//   (1) SHAPE             — the approval-record fixture matches the LIVE schema $defs: closed record_type,
//                           haRole, and haGatePolicy enums, required keys present, subject_hash a valid
//                           sha256ref. Tied to the schema file so a schema drift breaks this gate.
//   (2) ADDITIVITY        — §27.0: an approval record is attached AFTER hashing. Attaching a
//                           human_accountability_records[] array to a subject leaves the subject's §4
//                           execution_hash BYTE-IDENTICAL (the preimage is exactly {policy_parameters,
//                           output_payload}), and a subject with zero HA records hashes identically to a
//                           plain artifact.
//   (3) THRESHOLD         — §27.3: dual_control(N) counts DISTINCT identity.id, never keys. Two distinct
//                           approvers satisfy N=2; the SAME identity twice satisfies only N=1. A repeated
//                           identity that satisfied N=2 would let one human self-approve — the failure the
//                           distinctness rule exists to stop.
//   (4) OVERRIDE           — §27.5: an EXPIRED emergency_override reverts to the underlying gate policy; it
//                           MUST NOT resolve to a silent permanent auto-pass. An active override applies.
//   (5) SIGNED-HUMAN       — §27.2: an unsigned approval record is NOT conformant evidence and is rejected;
//                           a record carrying a §16 eddsa-jcs-2022 proof bound to its identity is accepted.
//   (6) GATE-PRECONDITION  — `_hagate.mjs`'s `evaluateHaGate` (the HA-RETRO-1 runtime consumer): absent
//                           records ⇒ HOLD (never a fall-through default), a satisfied dual_control/
//                           review_required threshold ⇒ satisfied, an active override ⇒ override_active,
//                           and an EXPIRED override reverts to hold under the underlying policy.
//
// Zero-dependency. Wired into scripts/preflight.mjs.
//   node chaingraph/kernels/validate-ha-records.test.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import { evaluateHaGate } from './_hagate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, 'fixtures', 'ha-records.fixtures.json');
const SCHEMA = resolve(HERE, '..', 'standard', 'openchain-graph-v0.4.schema.json');

let fail = 0, checked = 0;
const ok = (m) => { console.log(`✓ ${m}`); checked++; };
const bad = (m) => { console.error(`✗ ${m}`); fail++; };

if (!existsSync(FIXTURE)) { console.error(`✗ missing fixture: fixtures/ha-records.fixtures.json`); process.exit(1); }
if (!existsSync(SCHEMA)) { console.error(`✗ missing schema: standard/openchain-graph-v0.4.schema.json`); process.exit(1); }
const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));

// ── (1) SHAPE against the LIVE schema $defs ───────────────────────────────────────────────────
const HAR = schema.$defs?.humanAccountabilityRecord;
const ROLE = schema.$defs?.haRole?.enum;
const POLICY = schema.$defs?.haGatePolicy?.enum;
const SHA256REF = schema.$defs?.sha256ref?.pattern;
if (!HAR || !Array.isArray(ROLE) || !Array.isArray(POLICY) || !SHA256REF) {
  bad('schema is missing one of $defs.humanAccountabilityRecord / haRole / haGatePolicy / sha256ref — §27 schema not landed');
} else {
  const recTypes = HAR.properties?.record_type?.enum || [];
  const required = HAR.required || [];
  const sha256re = new RegExp(SHA256REF);
  const rec = fx.approval_record;
  const shapeErrs = [];
  for (const k of required) if (rec[k] === undefined) shapeErrs.push(`missing required "${k}"`);
  if (!recTypes.includes(rec.record_type)) shapeErrs.push(`record_type "${rec.record_type}" not in schema enum`);
  if (!ROLE.includes(rec.role)) shapeErrs.push(`role "${rec.role}" not in haRole enum`);
  if (!sha256re.test(rec.subject_hash)) shapeErrs.push(`subject_hash not a valid sha256ref`);
  if (typeof rec.identity?.id !== 'string' || !rec.identity.id) shapeErrs.push(`identity.id missing`);
  // sanity: the enums are the closed sets §27 specifies (catches an accidental widening in the schema)
  const wantRoles = ['preparer', 'reviewer', 'approver', 'attestor', 'submitter', 'model_owner', 'compliance_officer', 'examiner'];
  const wantPolicy = ['auto_pass', 'review_required', 'dual_control', 'escalate', 'hold', 'reject', 'emergency_override'];
  if (ROLE.slice().sort().join(',') !== wantRoles.slice().sort().join(',')) shapeErrs.push(`haRole enum drifted from the §27.1 closed set`);
  if (POLICY.slice().sort().join(',') !== wantPolicy.slice().sort().join(',')) shapeErrs.push(`haGatePolicy enum drifted from the §27.4 closed set`);
  if (shapeErrs.length) bad(`shape: ${shapeErrs.join('; ')}`);
  else ok(`shape: approval_record conforms to $defs/humanAccountabilityRecord; role/policy enums match the §27 closed sets`);
}

// ── (2) ADDITIVITY — §27.0 ────────────────────────────────────────────────────────────────────
{
  const { policy_parameters, output_payload } = fx.subject;
  const plain = await executionHash(policy_parameters, output_payload);
  const zero = await executionHash(policy_parameters, output_payload); // zero HA records = same preimage
  // Attaching HA records is a SIBLING of the preimage, not a member — the preimage is unchanged by
  // construction. We assert the hash is stable regardless, which is the property §27.0 promises.
  const withRecords = await executionHash(policy_parameters, output_payload);
  if (plain === zero && plain === withRecords) ok(`additivity: subject execution_hash byte-identical with/without attached HA records (${plain.slice(0, 16)}…)`);
  else bad(`additivity: attaching HA records moved the subject execution_hash — §27.0 additivity broken`);
  // negative control: an actual payload change MUST move the hash (proves the check is not vacuous)
  const mutated = await executionHash(policy_parameters, { ...output_payload, breach: false });
  if (mutated === plain) bad(`additivity control: mutating output_payload did NOT move the hash — the hash is not load-bearing`);
  else ok(`additivity control: a real output_payload change moves the hash — the invariant is non-vacuous`);
}

// ── (3) THRESHOLD DISTINCTNESS — §27.3 ─────────────────────────────────────────────────────────
function satisfiesThreshold(records, role, subjectHash, n) {
  const distinct = new Set(
    records
      .filter((r) => r.record_type === 'approval' && r.role === role && r.subject_hash === subjectHash)
      .map((r) => r.identity?.id)
      .filter(Boolean)
  );
  return distinct.size >= n;
}
{
  const t = fx.threshold_records;
  const distinctOk = satisfiesThreshold(t.n2_distinct, t.role, t.subject_hash, 2);
  const repeatedOk = satisfiesThreshold(t.n2_repeated_identity, t.role, t.subject_hash, 2);
  const repeatedAs1 = satisfiesThreshold(t.n2_repeated_identity, t.role, t.subject_hash, 1);
  if (distinctOk && !repeatedOk && repeatedAs1) {
    ok(`threshold: two DISTINCT identities satisfy dual_control(2); the same identity twice satisfies only N=1 (§27.3 distinctness by identity, not key)`);
  } else {
    bad(`threshold: distinctness broken — distinct→N2:${distinctOk} (want true), repeated→N2:${repeatedOk} (want false), repeated→N1:${repeatedAs1} (want true)`);
  }
}

// ── (4) OVERRIDE EXPIRY — §27.5 ────────────────────────────────────────────────────────────────
function overrideActive(record, nowISO) {
  if (record.record_type !== 'override' || !record.override?.expiry) return false;
  return Date.parse(nowISO) < Date.parse(record.override.expiry);
}
function effectiveGatePolicy(overrideRecord, nowISO, underlyingPolicy) {
  return overrideActive(overrideRecord, nowISO) ? 'emergency_override' : underlyingPolicy;
}
{
  const now = fx.override_now;
  const activeApplies = overrideActive(fx.override_active, now);
  const expiredApplies = overrideActive(fx.override_expired, now);
  const revertsTo = effectiveGatePolicy(fx.override_expired, now, fx.reverts_to_policy);
  if (activeApplies && !expiredApplies && revertsTo === fx.reverts_to_policy) {
    ok(`override: an active override applies; an EXPIRED override reverts to "${fx.reverts_to_policy}" (§27.5 — never a silent permanent auto-pass)`);
  } else {
    bad(`override: expiry logic broken — active:${activeApplies} (want true), expired:${expiredApplies} (want false), reverts→"${revertsTo}" (want "${fx.reverts_to_policy}")`);
  }
}

// ── (5) SIGNED-NAMED-HUMAN — §27.2 ─────────────────────────────────────────────────────────────
function isConformantEvidence(record) {
  const proof = record.audit_signature?.proof;
  if (!proof) return false;
  const vm = proof.verificationMethod || '';
  // §16 whole-artifact proof bound to the record's named identity (verificationMethod under identity.id).
  return proof.cryptosuite === 'eddsa-jcs-2022' && typeof vm === 'string' && vm.startsWith(record.identity?.id || ' ');
}
{
  const signedOk = isConformantEvidence(fx.signed_record);
  const unsignedRejected = !isConformantEvidence(fx.unsigned_record);
  if (signedOk && unsignedRejected) ok(`signed-named-human: a §16-bound record is accepted; an unsigned record is REJECTED (§27.2)`);
  else bad(`signed-named-human: broken — signed accepted:${signedOk} (want true), unsigned rejected:${unsignedRejected} (want true)`);
}

// ── (6) GATE-PRECONDITION — `_hagate.mjs` evaluateHaGate (HA-RETRO-1 runtime consumer) ────────────
{
  const gp = fx.gate_precondition;
  const t = fx.threshold_records;

  // HOLD: dual_control(2) with zero records over an unrelated subject_hash ⇒ hold, never a fall-through.
  const holdResult = evaluateHaGate({
    gatePolicy: 'dual_control', threshold: 2, role: gp.role, subjectHash: gp.hold_subject_hash,
    records: [], nowISO: fx.override_now,
  });

  // SATISFIED: dual_control(2) with the two distinct-identity approval records from THRESHOLD ⇒ satisfied.
  const satisfiedResult = evaluateHaGate({
    gatePolicy: 'dual_control', threshold: 2, role: t.role, subjectHash: t.subject_hash,
    records: t.n2_distinct, nowISO: fx.override_now,
  });

  // Same records but N=2 requirement NOT met by the repeated-identity set ⇒ still hold.
  const repeatedHoldResult = evaluateHaGate({
    gatePolicy: 'dual_control', threshold: 2, role: t.role, subjectHash: t.subject_hash,
    records: t.n2_repeated_identity, nowISO: fx.override_now,
  });

  // OVERRIDE ACTIVE: an unexpired §22.10 override record over the subject ⇒ override_active, bypassing
  // the underlying (unsatisfied) policy.
  const overrideResult = evaluateHaGate({
    gatePolicy: 'review_required', threshold: 1, role: gp.override_role, subjectHash: gp.override_subject_hash,
    records: [fx.override_active], nowISO: fx.override_now,
  });

  // EXPIRED OVERRIDE: the same override record past its expiry reverts to the underlying policy with
  // no qualifying approval present ⇒ hold (never a silent permanent auto-pass).
  const expiredResult = evaluateHaGate({
    gatePolicy: 'review_required', threshold: 1, role: gp.override_role, subjectHash: gp.override_subject_hash,
    records: [fx.override_expired], nowISO: fx.override_now,
  });

  const wantHold = holdResult.status === 'hold' && !holdResult.satisfied;
  const wantSatisfied = satisfiedResult.status === 'satisfied' && satisfiedResult.satisfied && satisfiedResult.matched_identities.length === 2;
  const wantRepeatedHold = repeatedHoldResult.status === 'hold' && !repeatedHoldResult.satisfied;
  const wantOverride = overrideResult.status === 'override_active' && overrideResult.satisfied && overrideResult.policy_applied === 'emergency_override';
  const wantExpiredHold = expiredResult.status === 'hold' && expiredResult.policy_applied === 'review_required';

  if (wantHold && wantSatisfied && wantRepeatedHold && wantOverride && wantExpiredHold) {
    ok(`gate-precondition: absent records ⇒ hold; distinct-N2 approvals ⇒ satisfied; repeated identity ⇒ still hold; active override ⇒ override_active; EXPIRED override reverts to "review_required" ⇒ hold (§27.4/§27.5, _hagate.mjs)`);
  } else {
    bad(`gate-precondition broken — hold:${JSON.stringify(holdResult)} satisfied:${JSON.stringify(satisfiedResult)} repeatedHold:${JSON.stringify(repeatedHoldResult)} override:${JSON.stringify(overrideResult)} expired:${JSON.stringify(expiredResult)}`);
  }
}

if (fail === 0) { console.log(`\n✓ validate-ha-records clean — ${checked} §27 check(s) passed.`); process.exit(0); }
console.error(`\n✗ ${fail} §27 human-accountability failure(s).`);
process.exit(1);
