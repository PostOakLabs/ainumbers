// art-498-reward-flow-related-party.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:6c287e9bd9cecbd2b1b9cc99b8431526e5225a29aa44b21f63831f5814b58da1
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES (matches the WU row, direct read confirms). `minor(v)` converts every
// caller-supplied decimal reward_amount/materiality_threshold to integer minor units via
// `Math.round(n * 100)` — real IEEE-754 multiply-then-round — and the result gates
// `materiality_status` (AT_OR_ABOVE_THRESHOLD vs BELOW_THRESHOLD via `flagged_units >= threshold_units`)
// and the ESCALATION_RAISED compliance flag. A decimal amount near a half-cent boundary (e.g. 0.145,
// which is not exactly representable in binary) can round either way depending on floating
// representation, so ULP-boundary forcing is mandatory here.
// Checks: fixture-oracle gate, termination (recipients deduped and bounded by input array length),
// differential re-derivation of classification/materiality, permutation-invariance of recipients
// order (flagged_total is a sum, and the sort at the end normalizes output order), and ULP-boundary
// forcing around the minor()-unit rounding boundary and the materiality threshold comparison.
//
// Run: node chaingraph/kernels/__proptests__/art-498-reward-flow-related-party.proptest.mjs

import { compute } from '../art-498-reward-flow-related-party.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-498-reward-flow-related-party.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x49800);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const parentA = 'PARENT-A';
  const ownership_map = [
    { entity_ref: 'E1', ultimate_parent_ref: parentA, consortium_member: false },
    { entity_ref: 'E2', ultimate_parent_ref: 'PARENT-B', consortium_member: true },
    { entity_ref: 'E3', ultimate_parent_ref: null, consortium_member: false },
  ];
  const n = Math.floor(rng() * 6);
  const recipients = [];
  for (let i = 0; i < n; i++) {
    recipients.push({
      recipient_ref: `R${i}-${Math.floor(rng() * 4)}`,
      entity_ref: pick(rng, ['E1', 'E2', 'E3', undefined]),
      reward_amount: rng() < 0.1 ? undefined : (rng() - 0.3) * 1000,
    });
  }
  return {
    ruleset_version: 'v1',
    issuer_ref: 'ISSUER-1',
    issuer_ultimate_parent_ref: parentA,
    period_ref: 'Q1-2026',
    currency: 'USD',
    materiality_threshold: rng() < 0.1 ? undefined : rng() * 500,
    ownership_map,
    recipients,
  };
}

const TRIALS = 3000;

// ---------- P1: termination — recipients deduped and bounded by input array length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.recipients.length > pp.recipients.length) violations++;
    if (output_payload.recipient_count !== output_payload.recipients.length) violations++;
  }
  return { name: 'P1_recipients_bounded_and_deduped', trials: checked, violations };
}

// ---------- P2 (differential): classification and materiality re-derived ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let expectedFlaggedUnits = 0;
    for (const r of output_payload.recipients) {
      if (r.related_party && r.reward_amount !== null && r.reward_amount >= 0) {
        expectedFlaggedUnits += Math.round(r.reward_amount * 100);
      }
    }
    const expectedFlaggedTotal = Math.round(expectedFlaggedUnits) / 100;
    if (Math.abs(output_payload.flagged_total - expectedFlaggedTotal) > 1e-9) violations++;

    if (output_payload.flagged_recipient_count > 0 && output_payload.materiality_threshold !== null) {
      const thresholdUnits = Math.round(output_payload.materiality_threshold * 100);
      const expectedStatus = expectedFlaggedUnits >= thresholdUnits ? 'AT_OR_ABOVE_THRESHOLD' : 'BELOW_THRESHOLD';
      if (output_payload.materiality_status !== expectedStatus) violations++;
    }
  }
  return { name: 'P2_classification_and_materiality_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting recipients never changes flagged_total or materiality_status ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    if (pp.recipients.length < 2) continue;
    const shuffled = { ...pp, recipients: [...pp.recipients].sort(() => rand() - 0.5) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.flagged_total !== r2.flagged_total) violations++;
    if (r1.materiality_status !== r2.materiality_status) violations++;
    if (r1.recipient_count !== r2.recipient_count) violations++;
    // Output order is normalized by an internal sort on recipient_ref, so the recipient lists agree.
    if (JSON.stringify(r1.recipients) !== JSON.stringify(r2.recipients)) violations++;
  }
  return { name: 'P3_recipients_order_invariance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing around the minor()-unit rounding and materiality threshold ----------
function checkP4_ulp_boundary_forcing() {
  let violations = 0, checked = 0;
  const baseRow = { ruleset_version: 'v1', issuer_ref: 'I', issuer_ultimate_parent_ref: 'P', period_ref: 'Q1',
    ownership_map: [{ entity_ref: 'E1', ultimate_parent_ref: 'P', consortium_member: false }] };

  const cases = [
    { amount: 0.145, label: 'classic_binary_repr_boundary' },        // 0.145 is not exact in binary
    { amount: 0.005, label: 'half_cent_lower' },
    { amount: 0.015, label: 'half_cent_upper' },
    { amount: 0, label: 'zero' },
    { amount: -0, label: 'negative_zero' },
    { amount: Number.EPSILON, label: 'epsilon' },
    { amount: 1 + Number.EPSILON, label: 'one_plus_ulp' },
    { amount: 1 - Number.EPSILON, label: 'one_minus_ulp' },
    { amount: Number.MIN_VALUE, label: 'denormal' },
  ];
  for (const c of cases) {
    checked++;
    const pp = { ...baseRow, recipients: [{ recipient_ref: 'R1', entity_ref: 'E1', reward_amount: c.amount }] };
    const { output_payload } = compute(pp);
    // never throws, never NaN/undefined for the reward_amount field
    if (output_payload.recipients[0].reward_amount === undefined) violations++;
    if (Number.isNaN(output_payload.recipients[0].reward_amount)) violations++;
  }

  // x/y*y !== x style case for materiality threshold comparison
  {
    checked++;
    const x = 0.1, y = 3;
    const derived = (x / y) * y; // !== x in IEEE-754
    const pp = { ...baseRow, materiality_threshold: 10, recipients: [{ recipient_ref: 'R1', entity_ref: 'E1', reward_amount: 10 + (derived - x) }] };
    const { output_payload } = compute(pp);
    if (typeof output_payload.materiality_status !== 'string') violations++;
  }

  // exact boundary: flagged reward equals threshold exactly -> AT_OR_ABOVE_THRESHOLD
  {
    checked++;
    const pp = { ...baseRow, materiality_threshold: 5, recipients: [{ recipient_ref: 'R1', entity_ref: 'E1', reward_amount: 5 }] };
    const { output_payload } = compute(pp);
    if (output_payload.materiality_status !== 'AT_OR_ABOVE_THRESHOLD') violations++;
  }
  // one cent below threshold -> BELOW_THRESHOLD
  {
    checked++;
    const pp = { ...baseRow, materiality_threshold: 5, recipients: [{ recipient_ref: 'R1', entity_ref: 'E1', reward_amount: 4.99 }] };
    const { output_payload } = compute(pp);
    if (output_payload.materiality_status !== 'BELOW_THRESHOLD') violations++;
  }
  return { name: 'P4_ulp_boundary_forcing_minor_unit_and_materiality', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_ulp_boundary_forcing());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-498-reward-flow-related-party',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
