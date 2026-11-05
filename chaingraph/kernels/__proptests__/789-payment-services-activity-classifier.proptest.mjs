// 789-payment-services-activity-classifier — class-K property-test FLOOR, authored for the
// activity-classifier build (PAYMENT-SERVICES-ACTIVITY-CLASSIFIER-1).
// kernel_digest_at_authoring: sha256:8327eb29242dc5b4aa5975f9ba3249f38717b6f834c8275f478f90a022914bcc
// spec: board/queued/PAYMENT-SERVICES-ACTIVITY-CLASSIFIER-1.md (fixed contract) +
// research/PAYMENT-SERVICES-CLASSES-PIN-2026-10-30.md (pinned texts, class/exclusion mapping).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/789-payment-services-activity-classifier.proptest.mjs

import { compute } from '../789-payment-services-activity-classifier.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '789-payment-services-activity-classifier';

const PROFILES = ['bermuda_psa', 'eu_psd2', 'uk_psrs'];
const FACTS = ['holds_customer_funds', 'executes_transfers', 'issues_payment_instruments', 'acquires_transactions', 'money_remittance', 'initiates_payments_without_holding_funds', 'provides_account_information', 'technical_service_only', 'operates_stored_value_wallet', 'commercial_agent_for_one_side', 'limited_network'];

// Deterministic pseudo-random bit patterns over the closed fact enum (no Math.random —
// the floor itself must be reproducible).
function pattern(i) {
  const activities = {};
  let x = 0x9e3779b9 ^ (i * 0x85ebca6b);
  for (const f of FACTS) {
    x = (x * 0x2545f491 + 0x9e3779b9) >>> 0;
    activities[f] = ((x >>> 13) & 1) === 1;
  }
  return activities;
}

// Class-K 1: trigger closure — every class in classes_triggered must carry at least one
// triggering fact that compute() was actually told was true, on every input.
function checkTriggerClosure() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    for (const profile of PROFILES) {
      const pp = { profile, activities: pattern(i) };
      const { output_payload } = compute(pp);
      if (output_payload.refused) continue;
      checked++;
      for (const c of output_payload.classes_triggered) {
        const fires = c.triggered_by.filter((f) => pp.activities[f]);
        if (fires.length !== c.triggered_by.length) { violations++; continue; }
        if (fires.length === 0) violations++;
      }
    }
  }
  return { name: 'class_trigger_closure_over_declared_facts', checked, violations };
}

// Class-K 2: conflict equivalence — TECH_CLASS_BUT_HOLDS_FUNDS is reported exactly when
// technical_service_only and holds_customer_funds are both declared (non-refused inputs).
function checkConflictEquivalence() {
  let checked = 0, violations = 0;
  const cases = [
    { technical_service_only: false, holds_customer_funds: false },
    { technical_service_only: true, holds_customer_funds: false },
    { technical_service_only: false, holds_customer_funds: true },
    { technical_service_only: true, holds_customer_funds: true },
  ];
  for (const profile of PROFILES) {
    for (const over of cases) {
      const pp = { profile, activities: { technical_service_only: over.technical_service_only, holds_customer_funds: over.holds_customer_funds } };
      const { output_payload } = compute(pp);
      checked++;
      const fired = output_payload.conflicts.some((c) => c.conflict_id === 'TECH_CLASS_BUT_HOLDS_FUNDS');
      const want = over.technical_service_only && over.holds_customer_funds;
      if (fired !== want) violations++;
    }
  }
  return { name: 'conflict_reported_iff_tech_only_and_holds_funds', checked, violations };
}

// Class-K 3: exclusion soundness — every recorded exclusion corresponds to a declared
// fact, and no exclusion is marked applied while one of its named conflicts still fires
// as the TECH_CLASS conflict (technical-service exclusion must never apply when the
// firm holds customer funds).
function checkExclusionSoundness() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    const pp = { profile: PROFILES[i % PROFILES.length], activities: pattern(i) };
    const { output_payload } = compute(pp);
    if (output_payload.refused) continue;
    checked++;
    for (const ex of output_payload.exclusions_applied) {
      if (pp.activities[ex.exclusion_id] !== true) violations++;
      if (ex.applied && ex.exclusion_id === 'technical_service_only' && pp.activities.holds_customer_funds) violations++;
    }
  }
  return { name: 'exclusion_records_only_declared_and_never_applied_against_funds', checked, violations };
}

// Class-A 1: invalid-domain rejection — an unknown profile is refused with
// not_legal_advice true and no classes; non-boolean activity values are recorded, never
// silently coerced into a class trigger.
function checkInvalidDomainRejection() {
  let checked = 0, violations = 0;
  const bad = compute({ profile: 'not_a_regime', activities: { holds_customer_funds: true } });
  checked++;
  if (!bad.output_payload.refused || bad.output_payload.reason !== 'unknown_profile' || bad.output_payload.classes_triggered.length !== 0 || bad.output_payload.not_legal_advice !== true) violations++;
  checked++;
  if (!bad.compliance_flags.includes('PSA_REFUSED_UNKNOWN_PROFILE')) violations++;
  const nonbool = compute({ profile: 'eu_psd2', activities: { holds_customer_funds: 'yes' } });
  checked++;
  if (nonbool.output_payload.refused || !nonbool.output_payload.rejected_inputs.some((r) => r.where === 'activities.holds_customer_funds')) violations++;
  checked++;
  if (nonbool.output_payload.classes_triggered.some((c) => c.triggered_by.includes('holds_customer_funds'))) violations++;
  const missing = compute({ profile: 'eu_psd2' });
  checked++;
  if (!missing.output_payload.refused || missing.output_payload.reason !== 'missing_or_invalid_activities') violations++;
  return { name: 'invalid_domain_refusal_and_recorded_rejection', checked, violations };
}

// Class-B 1: determinism and output shape — the same pp always yields byte-identical
// output, every non-refused payload carries the contract fields, not_legal_advice is
// always true, and regime_status is 'proposed' only for the Bermuda profile.
function checkDeterminismAndShape() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const profile = PROFILES[i % PROFILES.length];
    const pp = { profile, activities: pattern(i), current_licence: i % 3 === 0 ? 'msb_2016' : undefined };
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    checked++;
    if (a !== b) violations++;
    const out = compute(pp).output_payload;
    checked++;
    for (const field of ['classes_triggered', 'exclusions_applied', 'conflicts', 'transition_note', 'regime_status', 'not_legal_advice']) {
      if (!(field in out)) violations++;
    }
    checked++;
    if (out.not_legal_advice !== true) violations++;
    checked++;
    const want = profile === 'bermuda_psa' ? 'proposed' : 'enacted';
    if (out.regime_status !== want) violations++;
    checked++;
    if (profile === 'bermuda_psa' && !compute(pp).compliance_flags.includes('PSA_REGIME_PROPOSED_NOT_ENACTED')) violations++;
  }
  return { name: 'determinism_contract_fields_and_regime_status_marker', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkTriggerClosure(),
  checkConflictEquivalence(),
  checkExclusionSoundness(),
  checkInvalidDomainRejection(),
  checkDeterminismAndShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — activity classifier (closure, conflict equivalence, exclusion soundness, refusal, determinism/shape).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
