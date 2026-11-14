// 796-payment-system-mi-pack — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (aggregate scalars only, closed
// four-value profile set, closed refusal set enumerated in the sibling
// reachability fixtures), but the declared VALUES axis is continuous, so no
// totality claim is made over it. Properties below run over a committed
// mulberry32 seed (deterministic) plus a fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:1edf9b8af2109b7ec5315e78771f357eec4d214173dc49d38dcf19afd07d5f49
// spec: PAYMENT-SYSTEM-MI-PACK-1 — compute a payment system's management-information
//   pack (speed, availability, failure, fraud, complaints, adoption, cost,
//   transparency KPIs) from declared aggregate counts, against the pinned FSB
//   G20 target/KPI texts and the pinned operational-risk principle statement
//   (research/PAYMENT-SYSTEM-MI-PIN-2026-10-30.md).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/796-payment-system-mi-pack.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute, buildArtifact } from '../796-payment-system-mi-pack.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '796-payment-system-mi-pack';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'),
);
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261031;
const N = 200;

const PROFILES = ['generic', 'g20_retail', 'fast_payment_scheme', 'gov_payments'];
const REASON_CODES = new Set(['NOT_DECLARED', 'ZERO_DENOMINATOR', 'NEGATIVE_INPUT', 'MISSING_DENOMINATOR', 'IMPOSSIBLE_INPUT']);

// Closed output vocabulary per KPI: unit and definition_ref are fixed per kpi_id
// across every branch (value, null-with-reason, refusal). Asserted exactly.
const EXPECTED_UNIT = {
  speed_pct_within_1h: 'percent',
  speed_pct_within_1bd: 'percent',
  cost_avg_fee_bps: 'bps_of_transaction_value',
  failure_rate_bps: 'bps_of_transactions',
  availability_pct: 'percent',
  fraud_rate_bps: 'bps_of_transaction_value',
  fraud_count_share_bps: 'bps_of_transactions',
  complaints_resolution_pct: 'percent',
  adoption_users_per_1000_eligible: 'users_per_1000_eligible',
  adoption_accepting_locations: 'locations',
  transparency_disclosure_pct: 'percent',
};
const EXPECTED_DEF = {
  speed_pct_within_1h: 'g20_speed_target+fsb_speed_kpi1',
  speed_pct_within_1bd: 'g20_speed_target+fsb_speed_kpi2',
  cost_avg_fee_bps: 'fsb_cost_kpi_family_adapted',
  failure_rate_bps: 'design_convention',
  availability_pct: 'pfmi_p17_anchor_design_convention',
  fraud_rate_bps: 'design_convention',
  fraud_count_share_bps: 'design_convention',
  complaints_resolution_pct: 'design_convention',
  adoption_users_per_1000_eligible: 'fsb_access_kpi_family_adapted',
  adoption_accepting_locations: 'design_convention',
  transparency_disclosure_pct: 'fsb_transparency_kpi1_adapted',
};
const KPI_IDS = new Set(Object.keys(EXPECTED_UNIT));

// Fully-declared valid base for structural sweeps (all sections present, no
// flags fire: channel sums reconcile, credited counts sit under the total).
const CLEAN_BASE = {
  profile: 'generic',
  transactions: { count: 1000, value: 5000, credited_within_1h_count: 400, credited_within_1bd_count: 600, by_channel: [{ channel: 'web', count: 600, value: 3000 }, { channel: 'app', count: 400, value: 2000 }] },
  failures: [{ reason_class: 'timeout', count: 5 }],
  availability: { scheduled_minutes: 43200, unplanned_downtime_minutes: 60, incidents: 2 },
  fraud: { count: 5, value: 100 },
  complaints: { received: 10, resolved_within_sla: 8 },
  adoption: { active_users: 100, eligible_population: 1000, accepting_merchants_or_agencies: 40 },
  cost: { fee_value: 25 },
  transparency: { services_disclosing_cost_and_speed: 7, services_total: 10 },
};

function r2(v) { return Math.round(v * 100) / 100; }

/** Random VALID policy_parameters over the declared aggregate-only domain. */
function randomValidPp(rng) {
  const profile = PROFILES[Math.floor(rng() * PROFILES.length)];
  const count = Math.floor(rng() * 2000000);
  const totalValue = r2(rng() * 500000000);
  const tx = { count, value: totalValue };
  if (rng() < 0.6) {
    const c1 = Math.floor(count * rng());
    const v1 = r2(totalValue * rng());
    tx.by_channel = [
      { channel: 'channel_a', count: c1, value: v1 },
      { channel: 'channel_b', count: count - c1, value: r2(totalValue - v1) },
    ];
  }
  if (rng() < 0.8) tx.credited_within_1h_count = Math.floor(count * rng());
  if (rng() < 0.4) tx.credited_within_1bd_count = Math.floor(count * rng());
  const pp = { profile, transactions: tx };
  if (rng() < 0.8) pp.failures = [{ reason_class: 'timeout', count: Math.floor(rng() * count * 0.05) }];
  if (rng() < 0.8) pp.availability = { scheduled_minutes: 43200, unplanned_downtime_minutes: Math.floor(rng() * 600), incidents: Math.floor(rng() * 10) };
  if (rng() < 0.7) pp.fraud = { count: Math.floor(rng() * 500), value: r2(rng() * 2000000) };
  if (rng() < 0.7) {
    const received = 1 + Math.floor(rng() * 1000);
    pp.complaints = { received, resolved_within_sla: Math.floor(received * rng()) };
  }
  if (rng() < 0.7) pp.adoption = { active_users: Math.floor(rng() * 500000), eligible_population: 1 + Math.floor(rng() * 900000), accepting_merchants_or_agencies: Math.floor(rng() * 50000) };
  if (rng() < 0.6) pp.cost = { fee_value: r2(rng() * 5000000) };
  if (rng() < 0.6) pp.transparency = { services_disclosing_cost_and_speed: Math.floor(rng() * 12), services_total: 1 + Math.floor(rng() * 14) };
  if (rng() < 0.3) {
    const pcount = 1 + Math.floor(rng() * 100000);
    const pReceived = 1 + Math.floor(rng() * 1000);
    pp.prior_period = {
      transactions: { count: pcount, value: r2(rng() * 200000000), credited_within_1h_count: Math.floor(pcount * rng()) },
      failures: [{ reason_class: 'timeout', count: Math.floor(rng() * pcount * 0.05) }],
      availability: { scheduled_minutes: 43200, unplanned_downtime_minutes: Math.floor(rng() * 600) },
      fraud: { count: Math.floor(rng() * 500), value: r2(rng() * 2000000) },
      complaints: { received: pReceived, resolved_within_sla: Math.floor(pReceived * rng()) },
      adoption: { active_users: Math.floor(rng() * 500000), eligible_population: 1 + Math.floor(rng() * 900000) },
    };
  }
  return pp;
}

// ---------- class-B/K properties ----------

/** P1 DETERMINISM: compute(pp) twice gives byte-identical output. */
function checkDeterminism(rng) {
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism_same_input_same_output', checked, violations };
}

/** P2 OUTPUT SHAPE + KPI ID SORT + null-with-reason + rounding rule. */
function checkShapeAndRounding(rng) {
  let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const { output_payload } = compute(randomValidPp(rng));
    checked++;
    let bad = false;
    if (output_payload.verdict !== 'completed' && output_payload.verdict !== 'refused') bad = true;
    const ids = output_payload.kpis.map((k) => k.kpi_id);
    for (let j = 1; j < ids.length; j++) if (!(ids[j - 1] < ids[j])) bad = true; // sorted by id, no dups
    for (const k of output_payload.kpis) {
      if (!KPI_IDS.has(k.kpi_id) || k.unit !== EXPECTED_UNIT[k.kpi_id] || k.definition_ref !== EXPECTED_DEF[k.kpi_id]) bad = true; // closed id/unit/definition_ref vocabulary
      if (k.value === null) { if (!REASON_CODES.has(k.reason_code)) bad = true; } // null carries a reason code, never silent zero
      else {
        if (typeof k.value !== 'number' || !Number.isFinite(k.value) || k.value < 0) bad = true;
        if (k.unit === 'percent' && Math.abs(Math.round(k.value * 100) - k.value * 100) > 1e-9) bad = true; // 2 dp percent
        if (k.unit.indexOf('bps') === 0 && !Number.isInteger(k.value)) bad = true; // integer basis points
      }
      if (k.target !== undefined && k.target !== null && k.meets_target === undefined) bad = true;
    }
    if (bad) violations++;
  }
  return { name: 'P2_shape_sorted_nulls_carry_reason_rounding', checked, violations };
}

/** P3 INVALID-DOMAIN REJECTION (class-A): the closed refusal set fires and never misclassifies. */
function checkRefusals() {
  let checked = 0, violations = 0;
  const cases = [
    [{ profile: 'mystery_scheme', transactions: { count: 10 } }, 'PROFILE_NOT_IN_CLOSED_SET_REFUSED'],
    [{ profile: 'generic', transactions: { value: 5 } }, 'TRANSACTION_TOTAL_MISSING_OR_INVALID_REFUSED'],
    [{ profile: 'generic', transactions: { count: 10, credited_within_1h_count: 5 }, cost: { fee_value: '2.50 each' } }, 'IDENTIFIER_LIKE_FIELD_REFUSED'],
    [{ profile: 'g20_retail', transactions: { count: 10, value: 5, credited_within_1h_count: 'acct 90123' } }, 'IDENTIFIER_LIKE_FIELD_REFUSED'],
    [{ profile: 'gov_payments', transactions: { count: 10 }, complaints: { received: 'claims-7' } }, 'IDENTIFIER_LIKE_FIELD_REFUSED'],
    [{ transactions: { count: 10 } }, 'PROFILE_NOT_IN_CLOSED_SET_REFUSED'],
  ];
  for (const [pp, expectedFlag] of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.verdict !== 'refused' || !compliance_flags.includes(expectedFlag)) violations++;
    if (output_payload.refused_because && !output_payload[output_payload.refused_because]) violations++; // reachable-path marker truthy
    const fieldless = expectedFlag !== 'IDENTIFIER_LIKE_FIELD_REFUSED';
    if (fieldless && ('refused_field' in output_payload)) violations++; // no-field refusals never carry refused_field
    if (!fieldless && output_payload.refused_field === undefined) violations++; // field refusals name the offending field
  }
  return { name: 'P3_closed_refusal_set_fires_with_markers', checked, violations };
}

/** P4 NEGATIVE-INPUT HANDLING: negative declared values null the affected KPI with NEGATIVE_INPUT, flagged, never negative output values. */
function checkNegativeInputs() {
  let checked = 0, violations = 0;
  const base = { profile: 'fast_payment_scheme', transactions: { count: 1000, value: 100000, credited_within_1h_count: 800 }, fraud: { count: 5, value: 1000 }, complaints: { received: 10, resolved_within_sla: 9 }, adoption: { active_users: 100, eligible_population: 200 } };
  const negatives = [
    () => { const pp = JSON.parse(JSON.stringify(base)); pp.transactions.credited_within_1h_count = -5; return pp; },
    () => { const pp = JSON.parse(JSON.stringify(base)); pp.fraud.value = -100; return pp; },
    () => { const pp = JSON.parse(JSON.stringify(base)); pp.complaints.resolved_within_sla = -1; return pp; },
    () => { const pp = JSON.parse(JSON.stringify(base)); pp.adoption.active_users = -3; return pp; },
  ];
  for (const mk of negatives) {
    checked++;
    const { output_payload, compliance_flags } = compute(mk());
    if (!compliance_flags.includes('NEGATIVE_DECLARED_VALUE')) violations++;
    if (!output_payload.data_quality.some((d) => d.flag === 'NEGATIVE_DECLARED_VALUE')) violations++;
    if (output_payload.kpis.some((k) => k.value !== null && k.value < 0)) violations++;
  }
  return { name: 'P4_negative_input_null_with_reason_and_flag', checked, violations };
}

/** P5 DATA-QUALITY: channel mismatch and credited-above-total flags; manual review demanded. */
function checkDataQuality() {
  let checked = 0, violations = 0;
  const mismatch = { profile: 'generic', transactions: { count: 10000, value: 200000, by_channel: [{ channel: 'web', count: 6000, value: 110000 }, { channel: 'mobile', count: 3500, value: 80000 }] } };
  checked++;
  let out = compute(mismatch);
  const flags = out.output_payload.data_quality.map((d) => d.flag);
  if (!flags.includes('CHANNEL_COUNT_TOTALS_MISMATCH') || !flags.includes('CHANNEL_VALUE_TOTALS_MISMATCH')) violations++;
  if (!out.output_payload.manual_review_required) violations++;
  const above = { profile: 'g20_retail', transactions: { count: 1000, value: 50000, credited_within_1h_count: 1200 } };
  checked++;
  out = compute(above);
  if (!out.output_payload.data_quality.some((d) => d.flag === 'CREDITED_WITHIN_1H_ABOVE_TOTAL')) violations++;
  return { name: 'P5_channel_mismatch_and_credited_above_total_flagged', checked, violations };
}

/** P6 DELTAS: deltas only when prior_period declared; abs_delta identity holds; speed KPI monotone in the within-1h count. */
function checkDeltasAndMonotonicity(rng) {
  let checked = 0, violations = 0;
  const prior = { transactions: { count: 500000, value: 90000000, credited_within_1h_count: 350000 }, fraud: { count: 60, value: 120000 }, complaints: { received: 100, resolved_within_sla: 90 }, adoption: { active_users: 80000, eligible_population: 250000 } };
  const cur = { transactions: { count: 600000, value: 100000000, credited_within_1h_count: 480000 }, fraud: { count: 50, value: 100000 }, complaints: { received: 100, resolved_within_sla: 95 }, adoption: { active_users: 90000, eligible_population: 250000 } };
  const withPrior = compute({ profile: 'g20_retail', transactions: cur.transactions, fraud: cur.fraud, complaints: cur.complaints, adoption: cur.adoption, prior_period: prior });
  const withoutPrior = compute({ profile: 'g20_retail', transactions: cur.transactions, fraud: cur.fraud, complaints: cur.complaints, adoption: cur.adoption });
  checked++;
  if (withPrior.output_payload.deltas.length === 0 || withoutPrior.output_payload.deltas.length !== 0) violations++;
  checked++;
  const d = withPrior.output_payload.deltas.find((x) => x.kpi_id === 'speed_pct_within_1h');
  if (!d || Math.abs(d.abs_delta - (d.current - d.prior)) > 1e-9 || d.current <= d.prior) violations++;
  checked++;
  if (withPrior.output_payload.deltas.some((x) => x.pct_delta !== null && x.pct_delta < 0 && x.abs_delta > 0)) violations++;
  // monotone: raising credited_within_1h_count never lowers speed_pct_within_1h
  for (let i = 0; i < 50; i++) {
    checked++;
    const c = 1 + Math.floor(rng() * 100000);
    const h = Math.floor(rng() * c);
    const h2 = Math.min(c, h + 1 + Math.floor(rng() * (c - h)));
    const mk = (credited) => compute({ profile: 'g20_retail', transactions: { count: c, value: 1000000, credited_within_1h_count: credited } }).output_payload.kpis.find((k) => k.kpi_id === 'speed_pct_within_1h').value;
    if (mk(h2) < mk(h)) violations++;
  }
  return { name: 'P6_deltas_identity_and_speed_monotone', checked, violations };
}

/** P7 PROFILE-KEYED TARGETS: the speed target attaches exactly on g20_retail/fast_payment_scheme, the availability reference exactly on the operational profiles; the generic profile claims no pinned target in its notes. */
function checkProfileTargets() {
  let checked = 0, violations = 0;
  const tx = { count: 1000, value: 100000, credited_within_1h_count: 800 };
  const avail = { scheduled_minutes: 43200, unplanned_downtime_minutes: 30 };
  for (const profile of PROFILES) {
    checked++;
    const { output_payload } = compute({ profile, transactions: tx, availability: avail });
    const speed = output_payload.kpis.find((k) => k.kpi_id === 'speed_pct_within_1h');
    const availability = output_payload.kpis.find((k) => k.kpi_id === 'availability_pct');
    const speedTargeted = profile === 'g20_retail' || profile === 'fast_payment_scheme';
    const availTargeted = profile === 'fast_payment_scheme' || profile === 'gov_payments';
    if (speedTargeted !== Object.prototype.hasOwnProperty.call(speed, 'target')) violations++;
    if (speedTargeted && (speed.target !== 75 || speed.meets_target !== (speed.value >= 75))) violations++;
    if (availTargeted !== Object.prototype.hasOwnProperty.call(availability, 'target')) violations++;
    if (profile === 'generic' && output_payload.profile_notes.some((n) => n.indexOf('pinned 75-percent') !== -1)) violations++;
  }
  return { name: 'P7_profile_keyed_targets_and_notes', checked, violations };
}

/** P8 REFUSAL-FIELD SWEEP: a string in ANY declared numeric field refuses with
 *  IDENTIFIER_LIKE_FIELD_REFUSED and names the offending field (bare field
 *  name) in refused_field. One structural case per declared field over the
 *  full valid base. */
function checkRefusalFieldSweep() {
  let checked = 0, violations = 0;
  const sweep = [
    ['transactions', 'count', 'count'],
    ['transactions', 'value', 'value'],
    ['transactions', 'credited_within_1h_count', 'credited_within_1h_count'],
    ['transactions', 'credited_within_1bd_count', 'credited_within_1bd_count'],
    ['availability', 'scheduled_minutes', 'scheduled_minutes'],
    ['availability', 'unplanned_downtime_minutes', 'unplanned_downtime_minutes'],
    ['availability', 'incidents', 'incidents'],
    ['fraud', 'count', 'count'],
    ['fraud', 'value', 'value'],
    ['complaints', 'received', 'received'],
    ['complaints', 'resolved_within_sla', 'resolved_within_sla'],
    ['adoption', 'active_users', 'active_users'],
    ['adoption', 'eligible_population', 'eligible_population'],
    ['adoption', 'accepting_merchants_or_agencies', 'accepting_merchants_or_agencies'],
    ['cost', 'fee_value', 'fee_value'],
    ['transparency', 'services_disclosing_cost_and_speed', 'services_disclosing_cost_and_speed'],
    ['transparency', 'services_total', 'services_total'],
  ];
  for (const [section, field, bare] of sweep) {
    const pp = JSON.parse(JSON.stringify(CLEAN_BASE));
    pp[section][field] = 'free text';
    checked++;
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.verdict !== 'refused') violations++;
    if (compliance_flags.indexOf('IDENTIFIER_LIKE_FIELD_REFUSED') === -1) violations++;
    if (output_payload.refused_field !== bare) violations++;
    if (output_payload.refused_because !== 'identifier_or_free_text_value_in_declared_field') violations++;
  }
  return { name: 'P8_refusal_field_sweep_names_offending_field', checked, violations };
}

/** P9 BRANCH CENSUS: every per-KPI value branch (NOT_DECLARED,
 *  ZERO_DENOMINATOR, MISSING_DENOMINATOR, NEGATIVE_INPUT) is driven by a
 *  structural case asserting the exact reason_code, unit and definition_ref of
 *  the affected KPI, the fixed 11-KPI id set, the exact negative-field path
 *  list, the PRIOR_PERIOD_NOT_COMPUTABLE flag shape, and the period echo. */
function checkBranchCensus() {
  let checked = 0, violations = 0;
  const kpiOf = (out, id) => out.output_payload.kpis.find((k) => k.kpi_id === id);
  const expectReason = (out, id, reason) => {
    const k = kpiOf(out, id);
    if (!k || k.reason_code !== reason || k.unit !== EXPECTED_UNIT[id] || k.definition_ref !== EXPECTED_DEF[id]) violations++;
  };
  const idsOk = (out) => {
    const ks = out.output_payload.kpis;
    return ks.length === 11 && ks.every((k) => KPI_IDS.has(k.kpi_id));
  };

  // zero transaction total: count-denominated KPIs ZERO_DENOMINATOR, value-denominated MISSING_DENOMINATOR
  checked++;
  let out = compute({ profile: 'generic', transactions: { count: 0, credited_within_1h_count: 0, credited_within_1bd_count: 0 }, failures: [{ reason_class: 'timeout', count: 0 }], fraud: { count: 0, value: 50 }, cost: { fee_value: 100 } });
  if (!idsOk(out)) violations++;
  expectReason(out, 'speed_pct_within_1h', 'ZERO_DENOMINATOR');
  expectReason(out, 'speed_pct_within_1bd', 'ZERO_DENOMINATOR');
  expectReason(out, 'failure_rate_bps', 'ZERO_DENOMINATOR');
  expectReason(out, 'fraud_count_share_bps', 'ZERO_DENOMINATOR');
  expectReason(out, 'cost_avg_fee_bps', 'MISSING_DENOMINATOR');
  expectReason(out, 'fraud_rate_bps', 'MISSING_DENOMINATOR');
  if (JSON.stringify(out.compliance_flags) !== '[]') violations++;

  // zero transaction value: cost and fraud-rate ZERO_DENOMINATOR
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100, value: 0 }, cost: { fee_value: 10 }, fraud: { value: 5 } });
  if (!idsOk(out)) violations++;
  expectReason(out, 'cost_avg_fee_bps', 'ZERO_DENOMINATOR');
  expectReason(out, 'fraud_rate_bps', 'ZERO_DENOMINATOR');

  // zero / absent availability denominators
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, availability: { scheduled_minutes: 0, unplanned_downtime_minutes: 0 } });
  expectReason(out, 'availability_pct', 'ZERO_DENOMINATOR');
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, availability: { scheduled_minutes: 100 } });
  expectReason(out, 'availability_pct', 'NOT_DECLARED');

  // zero complaints denominator; a non-finite declared value is refused at
  // entry (I-JSON scan), never read as a missing value, never a NaN output
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, complaints: { received: 0, resolved_within_sla: 0 } });
  expectReason(out, 'complaints_resolution_pct', 'ZERO_DENOMINATOR');
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, complaints: { received: 5, resolved_within_sla: NaN } });
  if (out.output_payload.verdict !== 'refused' || out.output_payload.refused_because !== 'non_finite_number_in_declared_field') violations++;
  if (out.compliance_flags.indexOf('IJSON_UNSAFE_INPUT_REFUSED') === -1) violations++;

  // zero transparency / adoption denominators
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, transparency: { services_total: 0, services_disclosing_cost_and_speed: 0 } });
  expectReason(out, 'transparency_disclosure_pct', 'ZERO_DENOMINATOR');
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, adoption: { active_users: 5, eligible_population: 0 } });
  expectReason(out, 'adoption_users_per_1000_eligible', 'ZERO_DENOMINATOR');

  // full negative sweep: every flat declared field negative at once; each
  // affected KPI nulls with NEGATIVE_INPUT and the detail names every path
  checked++;
  const negpp = { profile: 'generic', transactions: { count: 100, value: -1, credited_within_1h_count: -1, credited_within_1bd_count: -1 }, availability: { scheduled_minutes: -1, unplanned_downtime_minutes: -1, incidents: -1 }, fraud: { count: -1, value: -1 }, complaints: { received: -1, resolved_within_sla: -1 }, adoption: { active_users: -1, eligible_population: -1, accepting_merchants_or_agencies: -1 }, cost: { fee_value: -1 }, transparency: { services_disclosing_cost_and_speed: -1, services_total: -1 } };
  out = compute(negpp);
  if (!idsOk(out)) violations++;
  expectReason(out, 'speed_pct_within_1h', 'NEGATIVE_INPUT');
  expectReason(out, 'speed_pct_within_1bd', 'NEGATIVE_INPUT');
  expectReason(out, 'cost_avg_fee_bps', 'NEGATIVE_INPUT');
  expectReason(out, 'availability_pct', 'NEGATIVE_INPUT');
  expectReason(out, 'fraud_rate_bps', 'NEGATIVE_INPUT');
  expectReason(out, 'fraud_count_share_bps', 'NEGATIVE_INPUT');
  expectReason(out, 'complaints_resolution_pct', 'NEGATIVE_INPUT');
  expectReason(out, 'adoption_users_per_1000_eligible', 'NEGATIVE_INPUT');
  expectReason(out, 'adoption_accepting_locations', 'NEGATIVE_INPUT');
  expectReason(out, 'transparency_disclosure_pct', 'NEGATIVE_INPUT');
  const negDq = out.output_payload.data_quality.find((d) => d.flag === 'NEGATIVE_DECLARED_VALUE');
  const expectedPaths = ['transactions.value', 'transactions.credited_within_1h_count', 'transactions.credited_within_1bd_count', 'availability.scheduled_minutes', 'availability.unplanned_downtime_minutes', 'availability.incidents', 'fraud.count', 'fraud.value', 'complaints.received', 'complaints.resolved_within_sla', 'adoption.active_users', 'adoption.eligible_population', 'adoption.accepting_merchants_or_agencies', 'cost.fee_value', 'transparency.services_disclosing_cost_and_speed', 'transparency.services_total'];
  if (!negDq || !negDq.detail || !Array.isArray(negDq.detail.fields)) violations++;
  else {
    const got = new Set(negDq.detail.fields);
    if (negDq.detail.fields.length !== expectedPaths.length) violations++;
    for (const p of expectedPaths) if (!got.has(p)) violations++;
  }
  if (out.compliance_flags.indexOf('NEGATIVE_DECLARED_VALUE') === -1) violations++;

  // negative by_channel value is path-named in the same detail list
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100, value: 1000, by_channel: [{ channel: 'a', count: 100, value: -9 }] } });
  const chDq = out.output_payload.data_quality.find((d) => d.flag === 'NEGATIVE_DECLARED_VALUE');
  if (!chDq || !chDq.detail || !Array.isArray(chDq.detail.fields) || chDq.detail.fields.indexOf('by_channel[0].value') === -1) violations++;

  // NEGATIVE_INPUT on a targeted profile: target still attaches, meets_target null; exact-target boundary meets (>=, not >)
  checked++;
  out = compute({ profile: 'g20_retail', transactions: { count: 100, value: 500, credited_within_1h_count: -5 } });
  const sp = kpiOf(out, 'speed_pct_within_1h');
  if (!sp || sp.reason_code !== 'NEGATIVE_INPUT' || sp.target !== 75 || sp.meets_target !== null) violations++;
  checked++;
  out = compute({ profile: 'g20_retail', transactions: { count: 100, credited_within_1h_count: 75 } });
  const sp2 = kpiOf(out, 'speed_pct_within_1h');
  if (!sp2 || sp2.target !== 75 || sp2.meets_target !== true || sp2.value !== 75) violations++;

  // fully-declared clean run: no flags, no review, period absent -> null, exact evidence counters
  checked++;
  const cleanOut = compute(JSON.parse(JSON.stringify(CLEAN_BASE)));
  const cp = cleanOut.output_payload;
  if (cp.verdict !== 'completed' || !idsOk(cleanOut)) violations++;
  if (JSON.stringify(cleanOut.compliance_flags) !== '[]' || JSON.stringify(cp.data_quality) !== '[]' || JSON.stringify(cp.deltas) !== '[]') violations++;
  if (cp.manual_review_required !== false || cp.period !== null) violations++;
  if (!cp.evidence || cp.evidence.record_type !== 'payment_system_mi_pack' || cp.evidence.computed_from !== 'declared_aggregate_counts_only' || cp.evidence.pii_carried !== false || cp.evidence.kpis_emitted !== 11 || cp.evidence.kpis_null_with_reason !== 0 || cp.evidence.data_quality_flags !== 0 || cp.evidence.deltas_emitted !== 0) violations++;

  // prior_period that refuses (negative count) is flagged, not silently dropped
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, prior_period: { transactions: { count: -5 } } });
  if (JSON.stringify(out.compliance_flags) !== '["PRIOR_PERIOD_NOT_COMPUTABLE"]') violations++;
  if (out.output_payload.data_quality.length !== 1 || out.output_payload.data_quality[0].flag !== 'PRIOR_PERIOD_NOT_COMPUTABLE' || JSON.stringify(out.output_payload.data_quality[0].detail) !== '{}') violations++;
  if (JSON.stringify(out.output_payload.deltas) !== '[]') violations++;

  // period echo: object echoed with only start/end (falsy members nulled);
  // a wrong-typed member or a non-object period is a REFUSAL (D4/D6), never a
  // silent null
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, period: { start: '2026-01-01', end: '2026-03-31' } });
  if (JSON.stringify(out.output_payload.period) !== '{"start":"2026-01-01","end":"2026-03-31"}') violations++;
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, period: { start: '', end: '' } });
  if (JSON.stringify(out.output_payload.period) !== '{"start":null,"end":null}') violations++;
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, period: { start: '', end: 0 } });
  if (out.output_payload.verdict !== 'refused' || out.output_payload.refused_because !== 'period_member_wrong_type' || out.output_payload.refused_field !== 'period.end') violations++;
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, period: 'x' });
  if (out.output_payload.verdict !== 'refused' || out.output_payload.refused_because !== 'period_wrong_type') violations++;

  return { name: 'P9_branch_census_reasons_units_paths_period', checked, violations };
}

/** P10 I-JSON ENTRY REFUSAL (D1): any value the shared canonicalizer would reject
 *  (unsafe integer, non-finite number) is refused at entry with a per-class
 *  because code and a dotted refused_field path, wherever it sits in the declared
 *  input (declared field, container entry, prior_period, undeclared extra key);
 *  buildArtifact() then returns a refused artifact with a null execution_hash
 *  instead of throwing, and a well-formed input still hashes. */
async function checkIjsonRefusals() {
  let checked = 0, violations = 0;
  const unsafe = 9007199254740992; // 2^53, the first unsafe integer
  const cases = [
    [{ profile: 'generic', transactions: { count: unsafe } }, 'policy_parameters.transactions.count', 'unsafe_integer_in_declared_field'],
    [{ profile: 'generic', transactions: { count: 10 }, fraud: { count: 1, value: 1152921504606846976 } }, 'policy_parameters.fraud.value', 'unsafe_integer_in_declared_field'],
    [{ profile: 'generic', transactions: { count: 10, by_channel: [{ channel: 'web', count: 5, value: 18014398509481984 }] } }, 'policy_parameters.transactions.by_channel[0].value', 'unsafe_integer_in_declared_field'],
    [{ profile: 'generic', transactions: { count: 10 }, prior_period: { transactions: { count: unsafe } } }, 'policy_parameters.prior_period.transactions.count', 'unsafe_integer_in_declared_field'],
    [{ profile: 'generic', transactions: { count: 10 }, notes_from_caller: { tally: unsafe } }, 'policy_parameters.notes_from_caller.tally', 'unsafe_integer_in_declared_field'],
    [{ profile: 'generic', transactions: { count: 10 }, complaints: { received: 5, resolved_within_sla: Infinity } }, 'policy_parameters.complaints.resolved_within_sla', 'non_finite_number_in_declared_field'],
  ];
  for (const [pp, field, because] of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.verdict !== 'refused' || output_payload.refused_because !== because) violations++;
    if (compliance_flags.indexOf('IJSON_UNSAFE_INPUT_REFUSED') === -1) violations++;
    if (output_payload.refused_field !== field) violations++;
  }
  // the artifact path never throws on the refused class: refusal echoed, null hash
  checked++;
  const art = await buildArtifact({ profile: 'generic', transactions: { count: unsafe } }, {});
  if (!art.output_payload || art.output_payload.verdict !== 'refused') violations++;
  if (art.execution_hash !== null) violations++;
  // the guard never weakens the happy path: a well-formed input still hashes
  checked++;
  const okArt = await buildArtifact({ profile: 'generic', transactions: { count: 10 } }, {});
  if (typeof okArt.execution_hash !== 'string' || !/^[0-9a-f]{64}$/.test(okArt.execution_hash)) violations++;
  return { name: 'P10_ijson_entry_refusal_and_null_hash_artifact', checked, violations };
}

/** P11 CONTAINER REFUSALS (D2/D3): by_channel / failures present but not an
 *  array, or an entry that is not an object, has a non-integer or non-safe
 *  count, or a non-number value, refuse with a named flag and the offending
 *  entry path; well-typed entries still compute. */
function checkContainerRefusals() {
  let checked = 0, violations = 0;
  const cases = [
    [{ profile: 'generic', transactions: { count: 10, by_channel: 'x' } }, 'BY_CHANNEL_MALFORMED_REFUSED', 'by_channel_not_an_array', 'transactions.by_channel'],
    [{ profile: 'generic', transactions: { count: 10, by_channel: [{ channel: 'web', count: '600', value: 1 }] } }, 'BY_CHANNEL_MALFORMED_REFUSED', 'malformed_channel_entry', 'by_channel[0].count'],
    [{ profile: 'generic', transactions: { count: 10, by_channel: [{ channel: 'web', count: 5, value: '3000' }] } }, 'BY_CHANNEL_MALFORMED_REFUSED', 'malformed_channel_entry', 'by_channel[0].value'],
    [{ profile: 'generic', transactions: { count: 10, by_channel: [{ channel: 'web', count: 1.5, value: 1 }] } }, 'BY_CHANNEL_MALFORMED_REFUSED', 'malformed_channel_entry', 'by_channel[0].count'],
    [{ profile: 'generic', transactions: { count: 10, by_channel: ['web'] } }, 'BY_CHANNEL_MALFORMED_REFUSED', 'malformed_channel_entry', 'by_channel[0]'],
    [{ profile: 'generic', transactions: { count: 10 }, failures: 'x' }, 'FAILURES_MALFORMED_REFUSED', 'failures_not_an_array', 'failures'],
    [{ profile: 'generic', transactions: { count: 10 }, failures: [{ reason_class: 'timeout', count: '5' }] }, 'FAILURES_MALFORMED_REFUSED', 'malformed_failure_entry', 'failures[0].count'],
    [{ profile: 'generic', transactions: { count: 10 }, failures: [{ reason_class: 'timeout', count: 3, value: false }] }, 'FAILURES_MALFORMED_REFUSED', 'malformed_failure_entry', 'failures[0].value'],
    [{ profile: 'generic', transactions: { count: 10 }, failures: [{ reason_class: 'timeout', count: 2.5 }] }, 'FAILURES_MALFORMED_REFUSED', 'malformed_failure_entry', 'failures[0].count'],
  ];
  for (const [pp, flag, because, field] of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.verdict !== 'refused' || output_payload.refused_because !== because) violations++;
    if (compliance_flags.indexOf(flag) === -1) violations++;
    if (output_payload.refused_field !== field) violations++;
  }
  // control: well-typed entries still compute (5 failures per 100 transactions = 500 bps)
  checked++;
  const out = compute({ profile: 'generic', transactions: { count: 100 }, failures: [{ reason_class: 'timeout', count: 5 }], by_channel: [{ channel: 'web', count: 100, value: 50 }] });
  const fr = out.output_payload.kpis.find((k) => k.kpi_id === 'failure_rate_bps');
  if (out.output_payload.verdict !== 'completed' || !fr || fr.value !== 500) violations++;
  if (out.output_payload.data_quality.length !== 0) violations++;
  return { name: 'P11_container_refusals_by_channel_and_failures', checked, violations };
}

/** P12 PERIOD VALIDATION (D4/D6): wrong-typed period / prior_period and dates
 *  that are not real calendar dates (day past the month length, month outside
 *  1-12, Feb 29 on a non-leap year, non-zero-padded shape) refuse with the
 *  offending member named; real dates, including Feb 29 on a leap year, pass
 *  and echo. */
function checkPeriodDates() {
  let checked = 0, violations = 0;
  const cases = [
    [{ period: 'x' }, 'PERIOD_MALFORMED_REFUSED', 'period_wrong_type', 'period'],
    [{ period: { start: '2026-02-31', end: '2026-03-31' } }, 'PERIOD_MALFORMED_REFUSED', 'period_date_not_a_real_calendar_date', 'period.start'],
    [{ period: { start: '2026-01-01', end: '2026-13-45' } }, 'PERIOD_MALFORMED_REFUSED', 'period_date_not_a_real_calendar_date', 'period.end'],
    [{ period: { start: '2026-02-29' } }, 'PERIOD_MALFORMED_REFUSED', 'period_date_not_a_real_calendar_date', 'period.start'],
    [{ period: { start: '2026-4-05' } }, 'PERIOD_MALFORMED_REFUSED', 'period_date_not_a_real_calendar_date', 'period.start'],
    [{ period: { start: 20260101 } }, 'PERIOD_MALFORMED_REFUSED', 'period_member_wrong_type', 'period.start'],
    [{ prior_period: 'x' }, 'PRIOR_PERIOD_MALFORMED_REFUSED', 'prior_period_wrong_type', 'prior_period'],
    [{ prior_period: ['2026-01-01'] }, 'PRIOR_PERIOD_MALFORMED_REFUSED', 'prior_period_wrong_type', 'prior_period'],
  ];
  for (const [extra, flag, because, field] of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(Object.assign({ profile: 'generic', transactions: { count: 10 } }, extra));
    if (output_payload.verdict !== 'refused' || output_payload.refused_because !== because) violations++;
    if (compliance_flags.indexOf(flag) === -1) violations++;
    if (output_payload.refused_field !== field) violations++;
  }
  // controls: real calendar dates pass and echo, leap-year aware
  const okCases = [
    [{ period: { start: '2024-02-29', end: '2026-12-31' } }, '{"start":"2024-02-29","end":"2026-12-31"}'],
    [{ period: { start: '2023-02-28', end: '2026-11-30' } }, '{"start":"2023-02-28","end":"2026-11-30"}'],
    [{ period: { start: '2026-01-01' } }, '{"start":"2026-01-01","end":null}'],
  ];
  for (const [extra, echo] of okCases) {
    checked++;
    const { output_payload } = compute(Object.assign({ profile: 'generic', transactions: { count: 10 } }, extra));
    if (output_payload.verdict !== 'completed' || JSON.stringify(output_payload.period) !== echo) violations++;
  }
  return { name: 'P12_period_and_prior_period_real_calendar_dates', checked, violations };
}

/** P13 IMPOSSIBLE-KPI FLAGS (D5): impossible declared relations (a part above
 *  its whole) and fractional declared count fields raise a named data-quality
 *  flag mirrored into compliance_flags, null the affected KPI with
 *  IMPOSSIBLE_INPUT, and demand manual review; zero-denominator inputs keep
 *  ZERO_DENOMINATOR; valid relations still compute a value. */
function checkImpossibleRelations() {
  let checked = 0, violations = 0;
  const cases = [
    [{ availability: { scheduled_minutes: 10000, unplanned_downtime_minutes: 11574 } }, 'DOWNTIME_ABOVE_SCHEDULED_MINUTES', 'availability_pct'],
    [{ complaints: { received: 100, resolved_within_sla: 150 } }, 'COMPLAINTS_RESOLVED_ABOVE_RECEIVED', 'complaints_resolution_pct'],
    [{ adoption: { active_users: 2000000, eligible_population: 1000000 } }, 'ADOPTION_ACTIVE_USERS_ABOVE_ELIGIBLE', 'adoption_users_per_1000_eligible'],
    [{ transparency: { services_disclosing_cost_and_speed: 12, services_total: 10 } }, 'TRANSPARENCY_DISCLOSING_ABOVE_TOTAL', 'transparency_disclosure_pct'],
    [{ availability: { scheduled_minutes: 1.5, unplanned_downtime_minutes: 60 } }, 'FRACTIONAL_DECLARED_COUNT', 'availability_pct'],
  ];
  for (const [extra, flag, kpiId] of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(Object.assign({ profile: 'generic', transactions: { count: 1000 } }, extra));
    if (output_payload.verdict !== 'completed') violations++;
    if (!output_payload.data_quality.some((d) => d.flag === flag)) violations++;
    if (compliance_flags.indexOf(flag) === -1) violations++;
    if (!output_payload.manual_review_required) violations++;
    const k = output_payload.kpis.find((x) => x.kpi_id === kpiId);
    if (!k || k.value !== null || k.reason_code !== 'IMPOSSIBLE_INPUT') violations++;
  }
  // controls: zero denominators keep ZERO_DENOMINATOR (never the impossible flag)
  checked++;
  let out = compute({ profile: 'generic', transactions: { count: 100 }, adoption: { active_users: 5, eligible_population: 0 } });
  if (!out.output_payload.kpis.find((k) => k.kpi_id === 'adoption_users_per_1000_eligible' && k.reason_code === 'ZERO_DENOMINATOR')) violations++;
  if (out.compliance_flags.indexOf('ADOPTION_ACTIVE_USERS_ABOVE_ELIGIBLE') !== -1) violations++;
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, transparency: { services_disclosing_cost_and_speed: 0, services_total: 0 } });
  if (!out.output_payload.kpis.find((k) => k.kpi_id === 'transparency_disclosure_pct' && k.reason_code === 'ZERO_DENOMINATOR')) violations++;
  // control: valid relations still compute a value with no flag
  checked++;
  out = compute({ profile: 'generic', transactions: { count: 100 }, complaints: { received: 100, resolved_within_sla: 90 }, availability: { scheduled_minutes: 43200, unplanned_downtime_minutes: 60 } });
  if (out.output_payload.data_quality.length !== 0 || out.output_payload.manual_review_required) violations++;
  if (!out.output_payload.kpis.every((k) => k.value !== null || k.reason_code === 'NOT_DECLARED')) violations++;
  return { name: 'P13_impossible_relations_flagged_kpi_null_with_reason', checked, violations };
}

/** P14 COMMITTED REACHABILITY VECTORS REFIRE: every refusal path recorded in
 *  the sibling reachability fixtures fires today with the observed flags,
 *  because and field (the corpus is evidence, not history). */
function checkReachabilityRefire() {
  let checked = 0, violations = 0;
  for (const v of REACH.vectors) {
    checked++;
    const { output_payload, compliance_flags } = compute(v.policy_parameters);
    if (output_payload.verdict !== v.observed.verdict) violations++;
    if (output_payload.refused_because !== v.observed.refused_because) violations++;
    const field = output_payload.refused_field === undefined ? null : output_payload.refused_field;
    if (field !== v.observed.refused_field) violations++;
    if (output_payload.manual_review_required !== v.observed.manual_review_required) violations++;
    for (const f of v.observed_flags) if (compliance_flags.indexOf(f) === -1) violations++;
  }
  return { name: 'P14_committed_reachability_vectors_refire', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(golden vectors match compute())', got: String((e && e.message) || e) }] };
}
const rng = mulberry32(SEED);
const p10 = await checkIjsonRefusals(); // top-level await: P10 exercises the async artifact path
const properties = [
  checkDeterminism(rng),
  checkShapeAndRounding(rng),
  checkRefusals(),
  checkNegativeInputs(),
  checkDataQuality(),
  checkDeltasAndMonotonicity(rng),
  checkProfileTargets(),
  checkRefusalFieldSweep(),
  checkBranchCensus(),
  p10,
  checkContainerRefusals(),
  checkPeriodDates(),
  checkImpossibleRelations(),
  checkReachabilityRefire(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — seed ${SEED}.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
