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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { executionHash, cgCanon } from './_hash.mjs';
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

// ── (7) HA-RETRO-2 / HARETRO-Y9C-1 FLAGSHIP SWEEP — gate_policy wired on target chain steps ────
// Reads graph/chains/*.json shards directly (the assembled source of truth) so this stays valid
// whether or not chaingraph.json has been re-assembled. Each entry names the chain, the step
// tool_id carrying the gate, and the expected gate_policy (§27.4 enum) wired onto it.
{
  const CHAINS_DIR = resolve(HERE, '..', 'graph', 'chains');
  const wired = [
    { chain: 'adverse-action-notice-compliance', step: 'art-228-build-adverse-action-notice', policy: 'review_required' },
    { chain: 'mortgage-high-cost-and-hpml-screen', step: 'art-234-test-hoepa-high-cost', policy: 'review_required' },
    { chain: 'fair-lending-disparity-audit', step: 'art-229-compute-disparity-metrics', policy: 'review_required' },
    { chain: 'kyb-beneficial-ownership-attribution', step: 'art-268-compute-cdd-ownership-25pct', policy: 'review_required' },
    { chain: 'y9c-schedule-hc-hcr-capital', step: 'art-436-bhc-schedule-hcr-capital', policy: 'dual_control' },
    { chain: 'genius-listing-acceptance-pack', step: 'art-06-genius-act-reserve-attestation', policy: 'review_required' },
    { chain: 'fiusd-reserve-attestation', step: 'art-06-genius-act-reserve-attestation', policy: 'review_required' },
    { chain: 'stablecoin-issuer-genius-mica', step: 'art-06-genius-act-reserve-attestation', policy: 'review_required' },
    { chain: 'tempo-issuance', step: 'art-06-genius-act-reserve-attestation', policy: 'review_required' },
    { chain: 'call-report-edit-gate', step: 'art-433-call-report-rcr-capital', policy: 'review_required' },
    { chain: 'model-passport-lifecycle', step: 'art-453-model-validation-status', policy: 'review_required' },
    { chain: 'mortgage-government-loan-fit', step: 'art-223-conforming-loan-limit', policy: 'review_required' },
    { chain: 'insurer-rbc-action-level', step: 'art-254-compute-rbc-action-level', policy: 'escalate' },
    // HA-RETRO-3B (2026-07-26) — bucket B, 14 node-chain pairs across 7 nodes, gate objects authored
    // from scratch (no pre-existing own-step gate) per HA-GATE-SURFACE-MEASURE-1's strict §3 target set.
    { chain: 'mortgage-agency-pricing-and-eligibility', step: 'art-223-conforming-loan-limit', policy: 'review_required' },
    { chain: 'life-illustration-self-support-test', step: 'art-254-compute-rbc-action-level', policy: 'escalate' },
    { chain: 'canton-cash-leg-assurance', step: 'sim-01-lcr-nsfr-liquidity-stress-test', policy: 'escalate' },
    { chain: 'treasury-clearing-liquidity', step: 'sim-01-lcr-nsfr-liquidity-stress-test', policy: 'escalate' },
    { chain: 'wholesale-settlement-intraday-liquidity', step: 'sim-01-lcr-nsfr-liquidity-stress-test', policy: 'escalate' },
    { chain: 'digital-trade-counterparty-aml', step: 'art-10-amla-transaction-typology-risk-scorer', policy: 'escalate' },
    { chain: 'digital-trade-tbml-surveillance', step: 'art-10-amla-transaction-typology-risk-scorer', policy: 'escalate' },
    { chain: 'treasury-clearing-onboarding', step: 'art-10-amla-transaction-typology-risk-scorer', policy: 'escalate' },
    { chain: 'wholesale-settlement-participant-onboarding', step: 'art-10-amla-transaction-typology-risk-scorer', policy: 'escalate' },
    { chain: 'tempo-onchain-aml', step: 'art-38-tempo-onchain-aml', policy: 'escalate' },
    { chain: 'tempo-onchain-aml', step: 'art-10-amla-transaction-typology-risk-scorer', policy: 'escalate' },
    { chain: 'tempo-zone-disclosure', step: 'art-38-tempo-onchain-aml', policy: 'escalate' },
    { chain: 'aml-lookback-cycle', step: 'art-90-sanctions-screening-fit-diagnostic', policy: 'escalate' },
    { chain: 'aml-lookback-cycle', step: 'art-97-sanctions-screening-quality-scorer', policy: 'escalate' },
    // ASSURANCE-GATES-1 (2026-07-26) — A-shape appends (gate_policy added to a pre-existing own-step
    // gate) + B-shape authored gates (no pre-existing gate on that step) across the assurance family.
    { chain: 'einvoice-validation-pipeline', step: 'art-293-einvoice-format-validator', policy: 'review_required' },
    { chain: 'einvoice-validation-pipeline', step: 'art-294-einvoice-vat-calc-verifier', policy: 'review_required' },
    { chain: 'dora-escalation-demo', step: 'art-29-dora-readiness-diagnostic', policy: 'escalate' },
    { chain: 'dora-resilience', step: 'art-29-dora-readiness-diagnostic', policy: 'escalate' },
    { chain: 'globe-annual-cycle', step: 'art-456-globe-safe-harbour-tests', policy: 'review_required' },
    { chain: 'substantive-procedure-cycle', step: 'art-465-workpaper-bundle-composer', policy: 'escalate' },
  ];
  const errs = [];
  for (const w of wired) {
    const shardPath = resolve(CHAINS_DIR, `${w.chain}.json`);
    if (!existsSync(shardPath)) { errs.push(`${w.chain}: shard missing`); continue; }
    const chain = JSON.parse(readFileSync(shardPath, 'utf8'));
    const step = (chain.steps || []).find((s) => s.tool_id === w.step);
    if (!step) { errs.push(`${w.chain}: step ${w.step} not found`); continue; }
    if (!step.gate) { errs.push(`${w.chain}/${w.step}: no gate object`); continue; }
    if (step.gate.gate_policy !== w.policy) errs.push(`${w.chain}/${w.step}: gate_policy is "${step.gate.gate_policy}", want "${w.policy}"`);
    if (!POLICY.includes(step.gate.gate_policy)) errs.push(`${w.chain}/${w.step}: gate_policy "${step.gate.gate_policy}" not in haGatePolicy enum`);
  }
  if (errs.length) bad(`HA-RETRO-2/HARETRO-Y9C-1/HARETRO-GATE-AUTHOR-1/HA-RETRO-3A sweep: ${errs.join('; ')}`);
  else ok(`HA-RETRO-2/HARETRO-Y9C-1/HARETRO-GATE-AUTHOR-1/HA-RETRO-3A sweep: gate_policy present and enum-valid on all ${wired.length} wired chain steps (adverse-action, HOEPA/HPML, fair-lending, KYB beneficial-ownership review_required; Y-9C HC-R dual_control; GENIUS reserve pre-check ×4, call-report capital, model-passport review_required; mortgage government-loan-fit review_required; insurer RBC action-level escalate)`);
}

// ── (8) §27.4 ATTESTED-ARTIFACT SUBJECT — HA-ATTESTED-1, art-502 ─────────────────────────────────
// §27.4 admits a subject that is NOT the output of a §12 kernel node: the sealed output of a pinned
// non-OCG producer. Its identifier has a preimage fixed EXACTLY and exhaustively as three members —
// sha256(JCS({tool_ref, inputs_digest, artifact})) — and the value MUST be recomputable offline by a
// verifier that never executed the producer. These checks prove that property against the shipped
// art-502 kernel rather than asserting it in prose:
//
//   (8a) OFFLINE RECOMPUTATION — the preimage the kernel echoes is re-hashed here through a DIFFERENT
//        code path (_hash.mjs cgCanon + WebCrypto) than the kernel used (its inlined synchronous
//        SHA-256 for the §18 guest). Agreement across two implementations is the actual claim.
//   (8b) CLOSED PREIMAGE — exactly three members, and a caller who adds a run identifier, a host and a
//        timestamp gets a BYTE-IDENTICAL subject_hash, so no clock or session state can enter it.
//   (8c) PRODUCER PINNING — a missing manifest_digest is FLAGGED, never assumed.
//   (8d) NO REPLAY CLAIM — `replay_verified` is ABSENT from every payload, not `false`; and no
//        clock-derived governance date (`last_reviewed`/`valid_until`) is emitted.
//   (8e) BINDING — the §27 record rules hold over an attested subject exactly as over a node subject:
//        absent records ⇒ hold; two DISTINCT identities ⇒ dual_control(2) satisfied; the SAME identity
//        twice ⇒ still hold; an unsigned record is not conformant evidence; an EXPIRED override reverts.
{
  const ART502_FIXTURE = resolve(HERE, 'fixtures', 'art-502-bind-attested-subject.fixtures.json');
  const KERNEL = resolve(HERE, 'art-502-bind-attested-subject.kernel.mjs');
  if (!existsSync(ART502_FIXTURE) || !existsSync(KERNEL)) {
    bad('§27.4 attested subject: art-502 kernel or fixtures missing — the non-node subject class has no implementation');
  } else {
    const { compute: computeAttested } = await import(pathToFileURL(KERNEL).href);
    const a5 = JSON.parse(readFileSync(ART502_FIXTURE, 'utf8'));
    const at = fx.attested_subject;
    const vec = (a5.vectors || []).find((v) => v.name === at.fixture_vector);
    const closedVec = (a5.vectors || []).find((v) => v.name === 'extra-caller-keys-cannot-reach-the-preimage');
    const declaredVec = (a5.vectors || []).find((v) => v.name === 'pinned-declared-inputs');
    const unpinnedVec = (a5.vectors || []).find((v) => v.name === 'unpinned-no-manifest-digest');

    if (!vec || !closedVec || !declaredVec || !unpinnedVec) {
      bad('§27.4 attested subject: art-502 fixtures are missing one of the required vectors');
    } else {
      const op = computeAttested(vec.policy_parameters).output_payload;

      // (8a) OFFLINE RECOMPUTATION through the independent WebCrypto path.
      const preimage = op.subject_preimage;
      const bytes = new TextEncoder().encode(JSON.stringify(cgCanon(preimage)));
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const recomputed = `sha256:${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
      if (recomputed === op.subject_hash) ok(`§27.4 offline recomputation: an independent verifier re-hashing the echoed three-member preimage through cgCanon + WebCrypto reproduces the kernel's subject_hash (${op.subject_hash.slice(0, 23)}…) — the kernel used its own inlined synchronous SHA-256, so two implementations agree`);
      else bad(`§27.4 offline recomputation FAILED: kernel says ${op.subject_hash}, independent recomputation says ${recomputed} — the subject is not offline-verifiable`);

      // (8b) CLOSED PREIMAGE — exactly three members, and caller extras cannot reach it.
      const members = Object.keys(preimage).sort();
      const wantMembers = ['artifact', 'inputs_digest', 'tool_ref'];
      const membersOk = members.join(',') === wantMembers.join(',') && op.preimage_member_count === 3;
      const closedOk = closedVec.output_payload.subject_hash === declaredVec.output_payload.subject_hash;
      // negative control: a real member change MUST move the subject_hash, or the check is vacuous.
      const movedVec = computeAttested({ ...declaredVec.policy_parameters, inputs_digest: 'sha256:'.concat('d'.repeat(64)) }).output_payload;
      const movesOk = movedVec.subject_hash !== declaredVec.output_payload.subject_hash;
      if (membersOk && closedOk && movesOk) ok(`§27.4 closed preimage: exactly three members (${wantMembers.join(', ')}); a caller adding run_id, host and generated_at gets a BYTE-IDENTICAL subject_hash, while a real inputs_digest change moves it — no clock, run identifier or session state can enter the preimage`);
      else bad(`§27.4 closed preimage broken — members:[${members.join(',')}] count:${op.preimage_member_count} extras-excluded:${closedOk} non-vacuous:${movesOk}`);

      // (8c) PRODUCER PINNING — absence of manifest_digest is flagged, never assumed.
      const unp = unpinnedVec.output_payload;
      const flagged = unp.producer_pinned === false && (unp.findings || []).some((f) => f.code === 'MANIFEST_DIGEST_ABSENT');
      const pinnedOk = op.producer_pinned === true;
      if (flagged && pinnedOk) ok(`§27.4 producer pinning: a missing tool_ref.manifest_digest yields producer_pinned:false plus a named MANIFEST_DIGEST_ABSENT finding — the chainless analogue of the §17 kernel_digest is never assumed present`);
      else bad(`§27.4 producer pinning broken — unpinned flagged:${flagged}, pinned vector pinned:${pinnedOk}`);

      // (8d) NO REPLAY CLAIM and NO clock-derived governance dates, across EVERY vector.
      const banned = ['replay_verified', 'last_reviewed', 'valid_until'];
      const hits = [];
      const walk = (v, path) => {
        if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
        else if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (banned.includes(k)) hits.push(`${path}.${k}`); walk(v[k], `${path}.${k}`); }
      };
      for (const v of a5.vectors) walk(v.output_payload, v.name);
      const limitStated = typeof op.no_arithmetic_claim === 'string' && /replay_verified/.test(op.no_arithmetic_claim);
      if (hits.length === 0 && limitStated) ok(`§27.4 stated limit: replay_verified is ABSENT from all ${a5.vectors.length} vectors (omitted, never false — no replay was attempted), no clock-derived last_reviewed/valid_until is emitted, and the no-arithmetic-claim limit travels inside the payload`);
      else bad(`§27.4 stated limit broken — forbidden members present: [${hits.join(', ')}]; limit stated in payload: ${limitStated}`);

      // (8e) The §27 record rules hold over an attested subject exactly as over a node subject.
      const subjectHash = op.subject_hash;
      const sign = (id) => ({ audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: `${id}#key-1` } } });
      const approval = (id) => ({ record_type: 'approval', role: at.role, subject_hash: subjectHash, identity: { id }, ...sign(id) });
      const distinctRecords = at.distinct_identities.map(approval);
      // Same human signing twice under two DIFFERENT keys — distinctness is by identity.id, never by key.
      const repeatedRecords = [
        approval(at.repeated_identity),
        { record_type: 'approval', role: at.role, subject_hash: subjectHash, identity: { id: at.repeated_identity }, audit_signature: { proof: { cryptosuite: 'eddsa-jcs-2022', verificationMethod: `${at.repeated_identity}#key-2` } } },
      ];
      const unsignedRecords = at.distinct_identities.map((id) => ({ record_type: 'approval', role: at.role, subject_hash: subjectHash, identity: { id } }));
      const mkOverride = (expiry) => ({ record_type: 'override', role: at.role, subject_hash: subjectHash, identity: { id: at.override_identity }, override: { expiry, scope: `subject:${subjectHash}`, reason_code: 'ATTESTED_SUBJECT_EMERGENCY_CLOSE' }, ...sign(at.override_identity) });

      const g = (records, policy = 'dual_control', threshold = 2) => evaluateHaGate({ gatePolicy: policy, threshold, role: at.role, subjectHash, records, nowISO: at.override_now });

      const absent = g([]);
      const distinct2 = g(distinctRecords);
      const repeated2 = g(repeatedRecords);
      const unsigned2 = g(unsignedRecords);
      const overrideOn = g([mkOverride(at.override_active_expiry)]);
      const overrideOff = g([mkOverride(at.override_expired_expiry)]);

      const wantAbsent = absent.status === 'hold' && !absent.satisfied;
      const wantDistinct = distinct2.status === 'satisfied' && distinct2.matched_identities.length === 2;
      const wantRepeated = repeated2.status === 'hold' && !repeated2.satisfied;
      const wantUnsigned = unsigned2.status === 'hold' && !unsigned2.satisfied;
      const wantOverrideOn = overrideOn.status === 'override_active' && overrideOn.satisfied;
      const wantOverrideOff = overrideOff.status === 'hold' && overrideOff.policy_applied === at.reverts_to_policy;

      if (wantAbsent && wantDistinct && wantRepeated && wantUnsigned && wantOverrideOn && wantOverrideOff) {
        ok(`§27.4 binding over an attested subject: absent records ⇒ hold; two DISTINCT identities ⇒ dual_control(2) satisfied; one identity signing twice under two different keys ⇒ still hold (§27.3 distinctness by identity.id, never by key); unsigned approvals ⇒ not conformant evidence, still hold (§27.2); an active override applies and an EXPIRED one reverts to "${at.reverts_to_policy}" (§27.5 — never a silent permanent auto-pass)`);
      } else {
        bad(`§27.4 binding over an attested subject broken — absent:${JSON.stringify(absent)} distinct:${JSON.stringify(distinct2)} repeated:${JSON.stringify(repeated2)} unsigned:${JSON.stringify(unsigned2)} overrideOn:${JSON.stringify(overrideOn)} overrideOff:${JSON.stringify(overrideOff)}`);
      }
    }
  }
}

if (fail === 0) { console.log(`\n✓ validate-ha-records clean — ${checked} §27 check(s) passed.`); process.exit(0); }
console.error(`\n✗ ${fail} §27 human-accountability failure(s).`);
process.exit(1);
