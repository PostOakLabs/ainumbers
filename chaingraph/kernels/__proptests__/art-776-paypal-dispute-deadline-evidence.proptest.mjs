// art-776-paypal-dispute-deadline-evidence — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:eccdef3d5f7ca5483630fafd6531b68216f4f0bbab99b37885cc0f2c1a29b6f7
// spec: PAYPAL-DISPUTE-DEADLINE-NODE-1 (board/queued), hub proposal
//   PAYPAL-HUB-PROPOSALS-2026-10-24.md section 2 row 9 + section 9.5.4 + desk amendment
//   2026-10-25; clause authority research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md.
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny.
// float_sensitive: NO — the entire computation is integer millisecond and day arithmetic
//   (Math.floor of whole-millisecond differences over 86400000 ms days) plus string
//   assembly and SHA-256 byte arithmetic. No IEEE-754 division or fractional comparison.
//
// Checks:
//   fixture-oracle gate (mandatory before any property is trusted),
//   P1 deadline arithmetic: INQUIRY seller response due = create + 10 days (S8/S1) and
//      inquiry stage end = create + 20 days (S1/S8), exactly; a supplied
//      seller_response_due_date is passed through verbatim (same instant) and overrides
//      the computed rule; days_remaining = floor((due - as_of)/day) and past_due sign;
//      CHARGEBACK and both appeal stages return due null with source not_stated and a
//      basis that names NOT STATED,
//   P2 stage scoping: the CE3.0-shaped bundle exists iff lifecycle_stage is CHARGEBACK
//      AND funding_source is card; funding unknown yields no bundle at all with a
//      reason; every other combination yields paypal_process_evidence labelled not
//      CE3.0; CE3.0 never appears for INQUIRY, PRE_ARBITRATION or ARBITRATION,
//   P3 determinism + echo: identical inputs replay byte-identically; reason, stage and
//      funding echo back; evidence vocabulary equals disputes.js REASON_EVIDENCE
//      (four reasons, verbatim evidence types and required fields),
//   P4 differential: (a) the inline sync SHA-256 used for delivery_proof.digest equals
//      node:crypto over the same jcsStringify canonical preimage; (b) CONSUMABILITY:
//      feeding the emitted CE3.0-shaped bundle to art-297's own compute (imported
//      read-only, never edited) classifies delivery_proof present exactly when the
//      fulfillment evidence is complete, and never classifies a null PayPal field as
//      present,
//   P5 NOT STATED honesty: no successful payload contains a chargeback-stage or
//      appeal-stage response window number; every null deadline carries source
//      not_stated, a basis naming NOT STATED, days_remaining null and past_due null;
//      the only day counts emitted anywhere are the snapshot-stated 10 and 20,
//   P6 forced categorical refusals: reason outside the four lib reasons (including a
//      real schema v1.12 enum value), stage outside the snapshot enum, funding outside
//      the amendment enum, rollover/offset/malformed timestamps, missing as_of, bad
//      passthrough — each a named refusal, never a silent guess.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers
// only. node:crypto is used ONLY by the independent P4 re-check, never by the kernel.
//
// Run: node chaingraph/kernels/__proptests__/art-776-paypal-dispute-deadline-evidence.proptest.mjs

import { compute as compute775, REASON_EVIDENCE, jcsCanonical } from '../art-776-paypal-dispute-deadline-evidence.kernel.mjs';
import { compute as compute297 } from '../art-297-agentic-dispute-ce30-linter.kernel.mjs';
import { jcsStringify } from '../_hash.mjs';
import { mulberry32, pick, runFixtureOracle, summarize } from './_pbt-common.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const KERNEL_ID = 'art-776-paypal-dispute-deadline-evidence';
const DAY_MS = 86400000;
const STAGES = ['INQUIRY', 'CHARGEBACK', 'PRE_ARBITRATION', 'ARBITRATION'];
const FUNDINGS = ['card', 'paypal_balance_or_bank', 'unknown'];
const REASONS = Object.keys(REASON_EVIDENCE);

const rand = mulberry32(0xA7755);
function isoAt(baseMs, dayShift, hourShift = 0) {
  return new Date(baseMs + dayShift * DAY_MS + hourShift * 3600000).toISOString();
}
function randomPP(rng) {
  const baseMs = Date.UTC(2026, 9, 1, 12, 0, 0); // 2026-10-01T12:00:00Z, fixed epoch
  const withEvidence = rng() < 0.7;
  const eh = {};
  if (withEvidence) {
    if (rng() < 0.6) { eh.carrier_name = 'SyntheticCarrier' + Math.floor(rng() * 1000); eh.tracking_number = 'SYN-' + Math.floor(rng() * 100000); }
    if (rng() < 0.4) eh.refund_id = 'SYN-REFUND-' + Math.floor(rng() * 1000);
    if (rng() < 0.4) eh.notes = 'Synthetic narrative ' + Math.floor(rng() * 1000);
  }
  const pp = {
    dispute_reason: pick(rng, REASONS),
    lifecycle_stage: pick(rng, STAGES),
    funding_source: pick(rng, FUNDINGS),
    dispute_create_time: isoAt(baseMs, Math.floor(rng() * 30)),
    as_of: isoAt(baseMs, Math.floor(rng() * 60) - 5),
  };
  if (rng() < 0.4) pp.seller_response_due_date = isoAt(Date.parse(pp.dispute_create_time), 3 + Math.floor(rng() * 20));
  if (rng() < 0.5) pp.transaction_ref = 'SYN-TXN-' + Math.floor(rng() * 1000);
  if (rng() < 0.3) pp.card_network = 'visa';
  if (Object.keys(eh).length > 0 || rng() < 0.5) pp.evidence_on_hand = eh;
  return pp;
}

// ---------- P1 deadline arithmetic ----------
function checkP1_deadlines() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute775(pp);
    if (o.refusal_reason) continue;
    const createMs = Date.parse(o.dispute_create_time);
    const asOfMs = Date.parse(o.as_of);
    const sr = o.deadlines.seller_response;
    checked++;
    if (pp.seller_response_due_date) {
      if (sr.due !== new Date(Date.parse(pp.seller_response_due_date)).toISOString() || sr.source !== 'passthrough') violations++;
    } else if (pp.lifecycle_stage === 'INQUIRY') {
      if (sr.due !== new Date(createMs + 10 * DAY_MS).toISOString() || sr.source !== 'snapshot_rule_10_day') violations++;
    } else {
      if (sr.due !== null || sr.source !== 'not_stated' || !/NOT STATED/i.test(sr.basis)) violations++;
    }
    if (sr.due !== null) {
      const days = Math.floor((Date.parse(sr.due) - asOfMs) / DAY_MS);
      if (sr.days_remaining !== days || sr.past_due !== (days < 0)) violations++;
    } else if (sr.days_remaining !== null || sr.past_due !== null) violations++;
    if (pp.lifecycle_stage === 'INQUIRY') {
      const iq = o.deadlines.inquiry_stage;
      if (iq.due !== new Date(createMs + 20 * DAY_MS).toISOString() || iq.source !== 'snapshot_rule_20_day') violations++;
      if (o.deadlines.escalation_available_until !== iq.due) violations++;
    } else if (o.deadlines.inquiry_stage !== null || o.deadlines.escalation_available_until !== null) violations++;
  }
  return { name: 'P1_deadline_arithmetic', checked, violations };
}

// ---------- P2 stage scoping ----------
function checkP2_stage_scoping() {
  let checked = 0, violations = 0;
  for (const stage of STAGES) {
    for (const funding of FUNDINGS) {
      checked++;
      const pp = { dispute_reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', lifecycle_stage: stage, funding_source: funding, dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z', evidence_on_hand: { carrier_name: 'SyntheticCarrier', tracking_number: 'SYN-P2' } };
      const { output_payload: o } = compute775(pp);
      if (o.refusal_reason) { violations++; continue; }
      const isCe30 = stage === 'CHARGEBACK' && funding === 'card';
      if (o.bundle_decision.ce30_applicable !== isCe30) violations++;
      if (isCe30) {
        if (o.ce30_shaped_bundle === null || o.bundle_decision.bundle_kind !== 'ce30_shaped' || o.paypal_process_evidence !== null) violations++;
      } else if (funding === 'unknown') {
        if (o.ce30_shaped_bundle !== null || o.paypal_process_evidence !== null || o.bundle_decision.bundle_kind !== null) violations++;
        if (!/unknown/i.test(o.bundle_decision.reason)) violations++;
      } else {
        if (o.ce30_shaped_bundle !== null || o.paypal_process_evidence === null || o.bundle_decision.bundle_kind !== 'paypal_process_evidence') violations++;
        if (!/NOT CE3\.0/i.test(o.paypal_process_evidence.label)) violations++;
      }
      if (stage !== 'CHARGEBACK' && o.ce30_shaped_bundle !== null) violations++;
      if (stage !== 'CHARGEBACK' && funding === 'card' && /ce30/i.test(o.bundle_decision.reason) && o.ce30_shaped_bundle !== null) violations++;
    }
  }
  // 200 random draws: scoping is a pure function of (stage, funding)
  for (let i = 0; i < 200; i++) {
    const pp = randomPP(rand);
    const { output_payload: o } = compute775(pp);
    if (o.refusal_reason) continue;
    checked++;
    const isCe30 = o.lifecycle_stage === 'CHARGEBACK' && o.funding_source === 'card';
    if ((o.ce30_shaped_bundle !== null) !== isCe30) violations++;
    if (o.funding_source === 'unknown' && (o.ce30_shaped_bundle !== null || o.paypal_process_evidence !== null)) violations++;
  }
  return { name: 'P2_stage_scoping', checked, violations };
}

// ---------- P3 determinism + vocabulary echo ----------
function checkP3_determinism() {
  let checked = 0, violations = 0;
  // Vocabulary equals disputes.js verbatim (expected copy pinned from
  // paypal-agent-shop/lib/disputes.js REASON_EVIDENCE, PAYPAL-E6-DISPUTE-EVIDENCE-1).
  const EXPECTED = {
    MERCHANDISE_OR_SERVICE_NOT_RECEIVED: ['PROOF_OF_FULFILLMENT', ['carrier_name', 'tracking_number']],
    MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: ['OTHER', ['notes']],
    UNAUTHORISED: ['PROOF_OF_FULFILLMENT', ['carrier_name', 'tracking_number']],
    CREDIT_NOT_PROCESSED: ['PROOF_OF_REFUND', ['refund_id']],
  };
  checked++;
  if (JSON.stringify(Object.keys(REASON_EVIDENCE)) !== JSON.stringify(Object.keys(EXPECTED))) violations++;
  for (const [r, [et, req]] of Object.entries(EXPECTED)) {
    checked++;
    if (REASON_EVIDENCE[r].evidence_type !== et || JSON.stringify(REASON_EVIDENCE[r].required) !== JSON.stringify(req)) violations++;
  }
  for (let i = 0; i < 200; i++) {
    const pp = randomPP(rand);
    const a = compute775(pp), b = compute775(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    const o = a.output_payload;
    if (o.refusal_reason) continue;
    if (o.dispute_reason !== pp.dispute_reason || o.lifecycle_stage !== pp.lifecycle_stage || o.funding_source !== pp.funding_source) violations++;
    if (o.required_evidence.evidence_type !== REASON_EVIDENCE[pp.dispute_reason].evidence_type) violations++;
  }
  return { name: 'P3_determinism_echo', checked, violations };
}

// ---------- P4 differential: digest + art-297 consumability ----------
function checkP4_differential() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const pp = { dispute_reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', lifecycle_stage: 'CHARGEBACK', funding_source: 'card', dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z', transaction_ref: 'SYN-TXN-' + i };
    const withEv = i % 2 === 0;
    if (withEv) pp.evidence_on_hand = { carrier_name: 'SyntheticCarrier' + i, tracking_number: 'SYN-' + i };
    const { output_payload: o } = compute775(pp);
    checked++;
    // (a) digest differential vs node:crypto over the same JCS canonical preimage;
    //     the kernel's inline jcsCanonical must equal the shared _hash.mjs jcsStringify
    if (withEv) {
      const pre = jcsStringify({ evidence_type: 'PROOF_OF_FULFILLMENT', carrier_name: pp.evidence_on_hand.carrier_name, tracking_number: pp.evidence_on_hand.tracking_number });
      const want = createHash('sha256').update(pre).digest('hex');
      if (o.ce30_shaped_bundle.evidence.delivery_proof.digest !== want) violations++;
      if (jcsCanonical({ evidence_type: 'PROOF_OF_FULFILLMENT', carrier_name: pp.evidence_on_hand.carrier_name, tracking_number: pp.evidence_on_hand.tracking_number }) !== pre) violations++;
      if (o.ce30_shaped_bundle.evidence.delivery_proof.bound_transaction_ref !== pp.transaction_ref) violations++;
    } else if (o.ce30_shaped_bundle.evidence.delivery_proof !== null) violations++;
    // (b) art-297 consumability: feed the bundle to the terminal linter read-only.
    //     art-297 names the element 'fulfillment' and reads evidence.delivery_proof.
    const lint = compute297({ dispute: o.ce30_shaped_bundle.dispute, evidence: o.ce30_shaped_bundle.evidence });
    const dp = lint.output_payload.per_element.find((e) => e.element === 'fulfillment');
    checked++;
    if (withEv && dp.status !== 'present') violations++;
    if (!withEv && dp.status !== 'missing') violations++;
    // null PayPal fields must never read as present in art-297
    const ai = lint.output_payload.per_element.find((e) => e.element === 'agent_identity');
    const am = lint.output_payload.per_element.find((e) => e.element === 'authorization_at_delegation');
    if (ai.status !== 'missing' || am.status !== 'missing') violations++;
  }
  return { name: 'P4_differential_digest_and_art297', checked, violations };
}

// ---------- P5 NOT STATED honesty ----------
function checkP5_not_stated() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 250; i++) {
    const pp = randomPP(rand);
    delete pp.seller_response_due_date; // computed-rule paths only
    const { output_payload: o } = compute775(pp);
    if (o.refusal_reason) continue;
    checked++;
    const sr = o.deadlines.seller_response;
    if (sr.due === null) {
      if (sr.source !== 'not_stated' || !/NOT STATED/i.test(sr.basis) || sr.days_remaining !== null || sr.past_due !== null) violations++;
      // no invented window number may ride along in the basis
      if (/\b(5|7|14|30|45|75|90|180)\s+day/i.test(sr.basis)) violations++;
    }
    // the only day counts the kernel may state are the snapshot's 10 and 20
    for (const m of o.cited_clauses) {
      if (!/10 days|20 days|10 days after|first 10 days|20 days/.test(m.quote) && /\b\d+\s+days?\b/.test(m.quote)) violations++;
    }
  }
  // forced: chargeback and appeal stages with no passthrough are ALWAYS not_stated
  for (const stage of ['CHARGEBACK', 'PRE_ARBITRATION', 'ARBITRATION']) {
    checked++;
    const { output_payload: o } = compute775({ dispute_reason: 'CREDIT_NOT_PROCESSED', lifecycle_stage: stage, funding_source: 'card', dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-02T12:00:00Z' });
    if (o.deadlines.seller_response.due !== null || o.deadlines.seller_response.source !== 'not_stated') violations++;
  }
  return { name: 'P5_not_stated_honesty', checked, violations };
}

// ---------- P6 forced categorical refusals ----------
function checkP6_forced_categorical() {
  let checked = 0, violations = 0;
  const ok = { dispute_reason: 'CREDIT_NOT_PROCESSED', lifecycle_stage: 'CHARGEBACK', funding_source: 'card', dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z' };
  const cases = [
    [{ ...ok, dispute_reason: 'DUPLICATE_TRANSACTION' }, 'REFUSED_UNKNOWN_DISPUTE_REASON'],
    [{ ...ok, dispute_reason: 'PROBLEM_WITH_REMITTANCE' }, 'REFUSED_UNKNOWN_DISPUTE_REASON'],
    [{ ...ok, lifecycle_stage: 'INQUIRY_STAGE' }, 'REFUSED_UNKNOWN_LIFECYCLE_STAGE'],
    [{ ...ok, funding_source: 'wire' }, 'REFUSED_UNKNOWN_FUNDING_SOURCE'],
    [{ ...ok, dispute_create_time: '2026-02-30T12:00:00Z' }, 'REFUSED_BAD_DISPUTE_CREATE_TIME'],
    [{ ...ok, dispute_create_time: '2026-10-01T12:00:00+02:00' }, 'REFUSED_BAD_DISPUTE_CREATE_TIME'],
    [{ ...ok, as_of: '2026-10-05' }, 'REFUSED_BAD_AS_OF'],
    [{ ...ok, seller_response_due_date: 'not-a-timestamp' }, 'REFUSED_BAD_SELLER_RESPONSE_DUE_DATE'],
  ];
  for (const [pp, want] of cases) {
    checked++;
    const { output_payload: o, compliance_flags } = compute775(pp);
    if (o.refusal_reason !== want || o.refused !== want || !o.domain_errors.some((d) => d.code === want)) violations++;
    if (!compliance_flags.includes('ART775_INPUT_REFUSED')) violations++;
  }
  { const { output_payload: o } = compute775({ ...ok, as_of: undefined }); checked++;
    if (o.refusal_reason !== 'REFUSED_BAD_AS_OF') violations++; }
  { const { output_payload: o } = compute775({ ...ok }); checked++;
    if (o.refusal_reason !== null || o.domain_errors.length !== 0) violations++; }
  return { name: 'P6_forced_categorical_refusals', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute775);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures present)', got: String((e && e.message) || e) }] };
}

const kernelSource = readFileSync(new URL('../art-776-paypal-dispute-deadline-evidence.kernel.mjs', import.meta.url), 'utf8');
if (/JSON\.stringify\([\s\S]{0,200}?,\s*Object\.keys\([\s\S]{0,160}?\)\.sort\(\)\s*\)/.test(kernelSource) || /function\s+simpleHash\s*\(/.test(kernelSource)) {
  oracle.failures.push({ name: 'forbidden-hash-pattern', expected: 'none', got: 'kernel matches a lint-forbidden-hash pattern' });
}

const properties = [
  checkP1_deadlines(),
  checkP2_stage_scoping(),
  checkP3_determinism(),
  checkP4_differential(),
  checkP5_not_stated(),
  checkP6_forced_categorical(),
];

const okRun = summarize(KERNEL_ID, oracle, properties);
process.exit(okRun ? 0 : 1);
