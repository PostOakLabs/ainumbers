// art-776-paypal-dispute-deadline-evidence — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:97a3ed884dcf23313c3122f86ba95099c95fbffa75e3d80ee76e17ba5cdd5a42
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
//   P7 psp input: psp absent and psp 'paypal' produce byte-identical compute() output;
//      an unknown psp is refused; PSP-path draws replay deterministically and echo
//      their stage and psp,
//   P8 per-PSP table arithmetic + honesty: Adyen NoC/RFI dues equal create + the
//      matrix days for schemed columns exactly (Mastercard 40, Amex 14/14, TWINT 10);
//      visa NoC and Klarna RFI are null with BOTH/ALL stated values quoted; Stripe
//      inquiries carry the 120-day auto-close; every null seller_response carries
//      source not_stated with a basis naming NOT STATED; every cited clause url
//      belongs to the payload's own PSP snapshot,
//   P9 network bundle scoping on PSP paths: the CE3.0-shaped bundle exists iff the
//      PSP's network-chargeback stage AND its card-rail condition hold (stripe:
//      needs_response + card_network; adyen: NoC/CHARGEBACK + card scheme; square:
//      EVIDENCE_REQUIRED); every emitted bundle stays art-297-consumable with
//      delivery_proof present exactly when fulfillment evidence is complete,
//   P10 PSP-path refusals: stage vocabulary mismatch across PSPs and funding_source
//      on a non-PayPal path are named refusals.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers
// only. node:crypto is used ONLY by the independent P4 re-check, never by the kernel.
//
// Run: node chaingraph/kernels/__proptests__/art-776-paypal-dispute-deadline-evidence.proptest.mjs

import {
  compute as compute775, REASON_EVIDENCE, jcsCanonical,
  PSPS, STRIPE_STAGES, ADYEN_STAGES, SQUARE_STAGES,
  ADYEN_SCHEMES, ADYEN_CARD_SCHEMES, ADYEN_NOC_RESPONSE_DAYS, ADYEN_RFI_RESPONSE_DAYS,
  STRIPE_INQUIRY_CLOSE_DAYS,
} from '../art-776-paypal-dispute-deadline-evidence.kernel.mjs';
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
const PSP_SOURCE_URLS = {
  stripe: ['https://docs.stripe.com/api/disputes/object', 'https://docs.stripe.com/disputes/how-disputes-work', 'https://docs.stripe.com/disputes/responding'],
  adyen: ['https://docs.adyen.com/risk-management/disputes-api', 'https://docs.adyen.com/risk-management/disputes-api/dispute-notifications', 'https://docs.adyen.com/risk-management/understanding-disputes/dispute-timeframes', 'https://docs.adyen.com/risk-management/understanding-disputes/dispute-process-and-flow'],
  square: ['https://developer.squareup.com/docs/disputes-api/process-disputes', 'https://developer.squareup.com/docs/disputes-api/sandbox-testing', 'https://github.com/square/connect-api-specification', 'https://developer.squareup.com/reference/square/objects/Dispute'],
};

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

// ---------- P7 psp input: default equivalence + determinism ----------
function randomPspPP(rng) {
  const baseMs = Date.UTC(2026, 9, 1, 12, 0, 0);
  const psp = pick(rng, ['stripe', 'adyen', 'square']);
  const stage = pick(rng, psp === 'stripe' ? STRIPE_STAGES : psp === 'adyen' ? ADYEN_STAGES : SQUARE_STAGES);
  const pp = { psp, lifecycle_stage: stage, dispute_create_time: isoAt(baseMs, Math.floor(rng() * 30)), as_of: isoAt(baseMs, Math.floor(rng() * 60) - 5) };
  if (rng() < 0.5) pp.dispute_reason = 'SYN-REASON-' + Math.floor(rng() * 100);
  if (psp === 'adyen' && rng() < 0.8) pp.card_network = pick(rng, ADYEN_SCHEMES);
  if (psp === 'stripe' && rng() < 0.6) pp.card_network = 'visa';
  if (rng() < 0.35) pp.seller_response_due_date = isoAt(Date.parse(pp.dispute_create_time), 3 + Math.floor(rng() * 20));
  if (rng() < 0.5) pp.transaction_ref = 'SYN-TXN-' + Math.floor(rng() * 1000);
  const eh = {};
  if (rng() < 0.6) { eh.carrier_name = 'SyntheticCarrier' + Math.floor(rng() * 1000); eh.tracking_number = 'SYN-' + Math.floor(rng() * 100000); }
  if (rng() < 0.3) eh.notes = 'Synthetic narrative ' + Math.floor(rng() * 1000);
  if (Object.keys(eh).length > 0 || rng() < 0.5) pp.evidence_on_hand = eh;
  return pp;
}
function checkP7_psp_input() {
  let checked = 0, violations = 0;
  // absent psp === psp 'paypal', byte-identical compute() output
  for (let i = 0; i < 150; i++) {
    const pp = randomPP(rand);
    checked++;
    if (JSON.stringify(compute775(pp)) !== JSON.stringify(compute775({ ...pp, psp: 'paypal' }))) violations++;
  }
  // unknown psp is a named refusal
  checked++;
  { const { output_payload: o, compliance_flags } = compute775({ psp: 'wepay', dispute_reason: 'CREDIT_NOT_PROCESSED', lifecycle_stage: 'CHARGEBACK', funding_source: 'card', dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z' });
    if (o.refusal_reason !== 'REFUSED_UNKNOWN_PSP' || !compliance_flags.includes('ART775_INPUT_REFUSED')) violations++; }
  // PSP draws: deterministic replay + echo
  for (let i = 0; i < 200; i++) {
    const pp = randomPspPP(rand);
    const a = compute775(pp), b = compute775(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    const o = a.output_payload;
    if (o.refusal_reason) continue;
    if (o.psp !== pp.psp || o.lifecycle_stage !== pp.lifecycle_stage) violations++;
    if (o.funding_source !== null || o.paypal_process_evidence !== null || o.missing_evidence !== null) violations++;
    if (o.required_evidence.evidence_type !== null || o.required_evidence.required !== null || !o.required_evidence.why) violations++;
  }
  return { name: 'P7_psp_input_default_equivalence', checked, violations };
}

// ---------- P8 per-PSP table arithmetic + honesty ----------
function checkP8_psp_tables() {
  let checked = 0, violations = 0;
  const base = { dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z' };
  // Adyen NoC matrix columns, exact arithmetic
  for (const [scheme, days] of Object.entries(ADYEN_NOC_RESPONSE_DAYS)) {
    checked++;
    const { output_payload: o } = compute775({ ...base, psp: 'adyen', lifecycle_stage: 'NOTIFICATION_OF_CHARGEBACK', card_network: scheme });
    const sr = o.deadlines.seller_response;
    if (sr.due !== new Date(Date.parse(base.dispute_create_time) + days * DAY_MS).toISOString() || sr.source !== 'snapshot_rule_matrix_noc') violations++;
    if (!sr.basis.includes('NoC date') || !sr.basis.includes(scheme)) violations++;
  }
  // Adyen RFI matrix columns
  for (const [scheme, days] of Object.entries(ADYEN_RFI_RESPONSE_DAYS)) {
    checked++;
    const { output_payload: o } = compute775({ ...base, psp: 'adyen', lifecycle_stage: 'REQUEST_FOR_INFORMATION', card_network: scheme });
    const sr = o.deadlines.seller_response;
    if (sr.due !== new Date(Date.parse(base.dispute_create_time) + days * DAY_MS).toISOString() || sr.source !== 'snapshot_rule_matrix_rfi') violations++;
  }
  // ambiguities stay null with ALL stated values quoted
  checked++;
  { const { output_payload: o } = compute775({ ...base, psp: 'adyen', lifecycle_stage: 'NOTIFICATION_OF_CHARGEBACK', card_network: 'visa' });
    const sr = o.deadlines.seller_response;
    if (sr.due !== null || sr.source !== 'not_stated' || !sr.basis.includes('9 days') || !sr.basis.includes('18 days')) violations++; }
  checked++;
  { const { output_payload: o } = compute775({ ...base, psp: 'adyen', lifecycle_stage: 'REQUEST_FOR_INFORMATION', card_network: 'klarna' });
    const sr = o.deadlines.seller_response;
    if (sr.due !== null || !sr.basis.includes('14 days') || !sr.basis.includes('7 days') || !sr.basis.includes('96 hours')) violations++; }
  // Stripe inquiries: 120-day auto-close exactly; non-inquiry stages carry no window
  for (const stage of STRIPE_STAGES) {
    checked++;
    const { output_payload: o } = compute775({ ...base, psp: 'stripe', lifecycle_stage: stage });
    const iq = o.deadlines.inquiry_stage;
    if (stage === 'warning_needs_response' || stage === 'warning_under_review') {
      if (iq.due !== new Date(Date.parse(base.dispute_create_time) + STRIPE_INQUIRY_CLOSE_DAYS * DAY_MS).toISOString() || iq.source !== 'snapshot_rule_120_day') violations++;
      if (o.deadlines.escalation_available_until !== iq.due) violations++;
    } else if (iq !== null) violations++;
  }
  // honesty + clause ownership over random PSP draws
  for (let i = 0; i < 250; i++) {
    const pp = randomPspPP(rand);
    delete pp.seller_response_due_date;
    const { output_payload: o } = compute775(pp);
    if (o.refusal_reason) continue;
    checked++;
    const sr = o.deadlines.seller_response;
    if (sr.due === null) {
      if (sr.source !== 'not_stated' || sr.days_remaining !== null || sr.past_due !== null) violations++;
      // every null carries an honest reason class; the window-shaped ones (range,
      // typical figure, matrix-key or scheme ambiguity) must name NOT STATED /
      // not supplied explicitly; spent/terminal states must say why no deadline remains
      const honestClass = /NOT STATED|not supplied|not stated on the fetched pages/i.test(sr.basis) ||
        /no response deadline|window is spent|response is made|response already|closed inquiry|accepted dispute|decided dispute/i.test(sr.basis);
      if (!honestClass) violations++;
      // the response-window stages specifically: the snapshot's own honesty marker
      if (pp.psp === 'stripe' && (pp.lifecycle_stage === 'needs_response' || pp.lifecycle_stage === 'warning_needs_response') && !/NOT STATED/i.test(sr.basis)) violations++;
      if (pp.psp === 'square' && (pp.lifecycle_stage === 'EVIDENCE_REQUIRED' || pp.lifecycle_stage === 'INQUIRY_EVIDENCE_REQUIRED') && !/NOT STATED/i.test(sr.basis)) violations++;
      if (pp.psp === 'adyen' && pp.lifecycle_stage === 'NOTIFICATION_OF_CHARGEBACK' && pp.card_network === 'visa' && !/NOT STATED/i.test(sr.basis)) violations++;
    } else {
      // computed dues must be create + an integer day count from the tables
      const dueMs = Date.parse(sr.due), createMs = Date.parse(o.dispute_create_time);
      const days = (dueMs - createMs) / DAY_MS;
      if (!Number.isInteger(days) || days <= 0) violations++;
      if (pp.psp === 'square' && days !== 0) violations++; // square states no computable number at all
      if (pp.psp === 'stripe') violations++; // stripe states no single response number
      if (pp.psp === 'adyen') {
        const inNoc = Object.values(ADYEN_NOC_RESPONSE_DAYS).includes(days);
        const inRfi = Object.values(ADYEN_RFI_RESPONSE_DAYS).includes(days);
        if (!inNoc && !inRfi) violations++;
      }
    }
    if (sr.due !== null) {
      const days = Math.floor((Date.parse(sr.due) - Date.parse(o.as_of)) / DAY_MS);
      if (sr.days_remaining !== days || sr.past_due !== (days < 0)) violations++;
    }
    for (const c of o.cited_clauses) {
      if (!PSP_SOURCE_URLS[pp.psp].includes(c.url)) violations++;
    }
  }
  return { name: 'P8_psp_table_arithmetic_honesty', checked, violations };
}

// ---------- P9 network bundle scoping on PSP paths ----------
function checkP9_psp_bundle_scoping() {
  let checked = 0, violations = 0;
  const base = { dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z', evidence_on_hand: { carrier_name: 'SyntheticCarrier', tracking_number: 'SYN-P9' } };
  // exhaustive over stages x rail conditions
  for (const stage of STRIPE_STAGES) {
    for (const net of [undefined, 'visa']) {
      checked++;
      const { output_payload: o } = compute775({ ...base, psp: 'stripe', lifecycle_stage: stage, ...(net ? { card_network: net } : {}) });
      const want = stage === 'needs_response' && net === 'visa';
      if ((o.ce30_shaped_bundle !== null) !== want || o.bundle_decision.ce30_applicable !== want) violations++;
    }
  }
  for (const stage of ADYEN_STAGES) {
    for (const scheme of [...ADYEN_CARD_SCHEMES, 'twint', 'klarna', undefined]) {
      checked++;
      const { output_payload: o } = compute775({ ...base, psp: 'adyen', lifecycle_stage: stage, ...(scheme ? { card_network: scheme } : {}) });
      const isCb = stage === 'NOTIFICATION_OF_CHARGEBACK' || stage === 'CHARGEBACK';
      const want = isCb && scheme !== undefined && ADYEN_CARD_SCHEMES.includes(scheme);
      if ((o.ce30_shaped_bundle !== null) !== want) violations++;
      if (isCb && scheme !== undefined && !ADYEN_CARD_SCHEMES.includes(scheme) && o.bundle_decision.bundle_kind !== null) violations++;
    }
  }
  for (const stage of SQUARE_STAGES) {
    checked++;
    const { output_payload: o } = compute775({ ...base, psp: 'square', lifecycle_stage: stage });
    const want = stage === 'EVIDENCE_REQUIRED';
    if ((o.ce30_shaped_bundle !== null) !== want) violations++;
  }
  // emitted bundles stay art-297-consumable; delivery_proof exactly when fulfillment complete
  const bundleCases = [
    { eh: { carrier_name: 'SyntheticCarrier', tracking_number: 'SYN-P9' }, pp: { ...base, psp: 'stripe', lifecycle_stage: 'needs_response', card_network: 'visa', transaction_ref: 'SYN-P9-ST' } },
    { eh: { carrier_name: 'SyntheticCarrier', tracking_number: 'SYN-P9' }, pp: { ...base, psp: 'adyen', lifecycle_stage: 'NOTIFICATION_OF_CHARGEBACK', card_network: 'mastercard', transaction_ref: 'SYN-P9-AD' } },
    { eh: { carrier_name: 'SyntheticCarrier', tracking_number: 'SYN-P9' }, pp: { ...base, psp: 'square', lifecycle_stage: 'EVIDENCE_REQUIRED', transaction_ref: 'SYN-P9-SQ' } },
    { eh: null, pp: { psp: 'stripe', lifecycle_stage: 'needs_response', card_network: 'visa', transaction_ref: null, dispute_create_time: base.dispute_create_time, as_of: base.as_of } },
  ];
  for (const { eh, pp } of bundleCases) {
    checked++;
    const { output_payload: o } = compute775(pp);
    const b = o.ce30_shaped_bundle;
    if (!b) { violations++; continue; }
    const complete = Boolean(eh && eh.carrier_name && eh.tracking_number);
    const wantRef = typeof pp.transaction_ref === 'string' ? pp.transaction_ref : null;
    if ((b.evidence.delivery_proof !== null) !== complete) violations++;
    if (complete) {
      const pre = jcsStringify({ evidence_type: 'PROOF_OF_FULFILLMENT', carrier_name: eh.carrier_name, tracking_number: eh.tracking_number });
      if (b.evidence.delivery_proof.digest !== createHash('sha256').update(pre).digest('hex')) violations++;
      if (b.evidence.delivery_proof.bound_transaction_ref !== wantRef) violations++;
    }    const lint = compute297({ dispute: b.dispute, evidence: b.evidence });
    const dp = lint.output_payload.per_element.find((e) => e.element === 'fulfillment');
    if (complete && dp.status !== 'present') violations++;
    if (!complete && dp.status !== 'missing') violations++;
  }
  return { name: 'P9_psp_network_bundle_scoping', checked, violations };
}

// ---------- P10 PSP-path refusals ----------
function checkP10_psp_refusals() {
  let checked = 0, violations = 0;
  const base = { dispute_create_time: '2026-10-01T12:00:00Z', as_of: '2026-10-05T12:00:00Z' };
  const cases = [
    [{ ...base, psp: 'stripe', lifecycle_stage: 'INQUIRY' }, 'REFUSED_UNKNOWN_LIFECYCLE_STAGE'],
    [{ ...base, psp: 'adyen', lifecycle_stage: 'needs_response' }, 'REFUSED_UNKNOWN_LIFECYCLE_STAGE'],
    [{ ...base, psp: 'adyen', lifecycle_stage: 'PREARBITRATION_WON' }, 'REFUSED_UNKNOWN_LIFECYCLE_STAGE'],
    [{ ...base, psp: 'square', lifecycle_stage: 'warning_needs_response' }, 'REFUSED_UNKNOWN_LIFECYCLE_STAGE'],
    [{ ...base, psp: 'stripe', lifecycle_stage: 'needs_response', funding_source: 'card' }, 'REFUSED_FUNDING_SOURCE_NOT_APPLICABLE'],
    [{ ...base, psp: 'square', lifecycle_stage: 'EVIDENCE_REQUIRED', funding_source: 'unknown' }, 'REFUSED_FUNDING_SOURCE_NOT_APPLICABLE'],
    [{ ...base, psp: 'stripe', lifecycle_stage: 'needs_response', dispute_create_time: '2026-02-30T12:00:00Z' }, 'REFUSED_BAD_DISPUTE_CREATE_TIME'],
    [{ ...base, psp: 'adyen', lifecycle_stage: 'CHARGEBACK', card_network: 'visa', as_of: 'yesterday' }, 'REFUSED_BAD_AS_OF'],
    [{ ...base, psp: 'square', lifecycle_stage: 'PROCESSING', seller_response_due_date: 'not-a-timestamp' }, 'REFUSED_BAD_SELLER_RESPONSE_DUE_DATE'],
  ];
  for (const [pp, want] of cases) {
    checked++;
    const { output_payload: o, compliance_flags } = compute775(pp);
    if (o.refusal_reason !== want || !o.domain_errors.some((d) => d.code === want)) violations++;
    if (!compliance_flags.includes('ART775_INPUT_REFUSED')) violations++;
  }
  return { name: 'P10_psp_refusals', checked, violations };
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
  checkP7_psp_input(),
  checkP8_psp_tables(),
  checkP9_psp_bundle_scoping(),
  checkP10_psp_refusals(),
];

const okRun = summarize(KERNEL_ID, oracle, properties);
process.exit(okRun ? 0 : 1);
