// 790-event-position-limit-check — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (<=200 positions, prices on the 0..1000000 micro
// grid, closed refusal set enumerated in the sibling reachability fixtures and the branch
// inventory), but quantities span a wide integer range, so no totality claim is made over them.
// Properties below run over a committed mulberry32 seed (deterministic) plus a fixed corpus of
// structural cases.
//
// kernel_digest_at_authoring: sha256:70aba29ee694a8ba0bf1a56fde8e3fad6df58574b4c4905f1476f98fc723cb01
// spec: the row EVENT-POSITION-LIMIT-CHECK-1 contract plus the pinned primary text mapped in
//   research/EVENT-POSITION-LIMIT-PIN-2026-10-30.md — per-contract/per-event/per-series max
//   loss against CALLER-SUPPLIED accountability levels and position limits; market-maker
//   treatment as data; one rounding rule (ceil micro->minor, conservative toward finding).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/790-event-position-limit-check.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../790-event-position-limit-check.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '790-event-position-limit-check';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261031;
const N = 200;

const BASE = {
  profile: 'kalshi_rulebook_v1_29',
  as_of: '2026-10-31',
  aggregation: 'per_contract',
  netting: 'gross',
  participant_class: 'standard',
};

function randomValidPp(rng) {
  const nPos = 1 + Math.floor(rng() * 6);
  const positions = [];
  for (let i = 0; i < nPos; i++) {
    positions.push({
      contract_label: 'C-' + String(i + 1).padStart(2, '0'),
      event_label: 'EVT-' + (1 + Math.floor(rng() * 3)),
      series_label: 'SER-' + (1 + Math.floor(rng() * 2)),
      side: rng() < 0.5 ? 'yes' : 'no',
      quantity: 1 + Math.floor(rng() * 20000),
      avg_price_micro: Math.floor(rng() * 1000001),
      max_loss_minor: null,
      accountability_level_minor: Math.floor(rng() * 5000000),
      limit_minor: Math.floor(rng() * 8000000),
      limit_basis: rng() < 0.7 ? 'max_loss' : 'contracts',
    });
  }
  const pp = { ...BASE, positions };
  const r = rng();
  if (r < 0.2) pp.participant_class = 'market_maker';
  else if (r < 0.35) pp.aggregation = 'per_event';
  else if (r < 0.5) pp.aggregation = 'per_series';
  else if (r < 0.6) pp.netting = 'per_contract_net';
  return pp;
}

// Exact max-loss model, independent of the kernel: BigInt micro -> ceil to minor.
function modelMaxLossMinor(side, quantity, priceMicro) {
  if (quantity === 0) return 0;
  const micro = side === 'yes'
    ? BigInt(quantity) * BigInt(priceMicro)
    : BigInt(quantity) * BigInt(1000000 - priceMicro);
  return Number((micro + 9999n) / 10000n);
}

// ---------- structural corpus ----------
function checkExactMaxLossModel() {
  let checked = 0, violations = 0;
  const cases = [
    ['yes', 500, 300000, 15000],
    ['yes', 1000, 400000, 40000],
    ['no', 500, 600000, 20000],
    ['yes', 300, 400000, 12000],
    ['no', 200, 600000, 8000],
    ['yes', 7, 333333, 234], // 7*333333 = 2333331 micro -> ceil /10000 = 234 (rounding UP)
    ['no', 1, 999999, 1],    // 1 micro -> ceil to 1 minor (rounding UP)
  ];
  for (const [side, q, p, expect] of cases) {
    checked++;
    const pp = { ...BASE, positions: [{ contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side, quantity: q, avg_price_micro: p, max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss' }] };
    const r = compute(pp);
    const got = r.output_payload.positions[0].max_loss_minor;
    if (got !== expect || got !== modelMaxLossMinor(side, q, p)) {
      violations++;
      console.log('  exact-max-loss mismatch', side, q, p, 'got', got, 'expect', expect);
    }
  }
  return { name: 'max_loss_matches_independent_bigint_model_with_ceil_rounding', checked, violations };
}

function checkVerdictHierarchy() {
  let checked = 0, violations = 0;
  const mk = (pal, lim) => ({ ...BASE, positions: [{ contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'yes', quantity: 1000, avg_price_micro: 400000, max_loss_minor: null, accountability_level_minor: pal, limit_minor: lim, limit_basis: 'max_loss' }] });
  const cases = [
    [50000, 60000, 'WITHIN'],
    [30000, 50000, 'ACCOUNTABILITY_REVIEW'],
    [30000, 35000, 'LIMIT_BREACH'],
    [null, 35000, 'LIMIT_BREACH'], // no accountability level declared -> no accountability finding; the limit still breaches
    [30000, null, 'ACCOUNTABILITY_REVIEW'],
  ];
  for (const [pal, lim, expect] of cases) {
    checked++;
    const r = compute(mk(pal, lim));
    if (r.output_payload.verdict !== expect) { violations++; console.log('  verdict hierarchy mismatch', pal, lim, 'got', r.output_payload.verdict, 'expect', expect); }
  }
  return { name: 'verdict_hierarchy_limit_over_accountability_over_within', checked, violations };
}

function checkMarketMakerTreatment() {
  let checked = 0, violations = 0;
  const posn = { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'yes', quantity: 1000, avg_price_micro: 400000, max_loss_minor: null, accountability_level_minor: 30000, limit_minor: 50000, limit_basis: 'max_loss' };
  // standard: max loss 40000 breaches PAL 30000 -> ACCOUNTABILITY_REVIEW
  checked++;
  let r = compute({ ...BASE, participant_class: 'standard', positions: [posn] });
  if (r.output_payload.verdict !== 'ACCOUNTABILITY_REVIEW') violations++;
  // market maker with 10x default: effective 300000, limit exempt -> WITHIN
  checked++;
  r = compute({ ...BASE, participant_class: 'market_maker', positions: [posn] });
  if (r.output_payload.verdict !== 'WITHIN') violations++;
  if (r.output_payload.market_maker_treatment.accountability_multiplier !== 10) violations++;
  if (r.output_payload.market_maker_treatment.limit_exempt !== true) violations++;
  // market maker with multiplier 1 override: effective 30000 -> breach again
  checked++;
  r = compute({ ...BASE, participant_class: 'market_maker', mm_accountability_multiplier: 1, positions: [posn] });
  if (r.output_payload.verdict !== 'ACCOUNTABILITY_REVIEW') violations++;
  // exemption override off: limit applies and 40000 <= 50000 -> limit in scope again
  checked++;
  r = compute({ ...BASE, participant_class: 'market_maker', mm_limit_exempt: false, positions: [posn] });
  if (r.output_payload.groups[0].limit_applies !== true) violations++;
  return { name: 'market_maker_treatment_is_data_multiplier_and_exemption', checked, violations };
}

function checkNettingNeverIncreasesMaxLoss() {
  let checked = 0, violations = 0;
  const rng = mulberry32(SEED + 7);
  for (let i = 0; i < N; i++) {
    const qtyYes = 1 + Math.floor(rng() * 5000);
    const qtyNo = 1 + Math.floor(rng() * 5000);
    const pYes = Math.floor(rng() * 1000001);
    const pNo = Math.floor(rng() * 1000001);
    const posns = [
      { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'yes', quantity: qtyYes, avg_price_micro: pYes, max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss' },
      { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'no', quantity: qtyNo, avg_price_micro: pNo, max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss' },
    ];
    const gross = compute({ ...BASE, netting: 'gross', positions: posns }).output_payload.groups[0].max_loss_minor;
    const net = compute({ ...BASE, netting: 'per_contract_net', positions: posns }).output_payload.groups[0].max_loss_minor;
    checked++;
    if (!(net <= gross)) { violations++; console.log('  net exceeded gross', net, gross); }
  }
  return { name: 'per_contract_net_max_loss_never_exceeds_gross', checked, violations };
}

function checkAggregationSumsMonotonically() {
  let checked = 0, violations = 0;
  const rng = mulberry32(SEED + 11);
  for (let i = 0; i < N; i++) {
    const positions = [];
    const n = 1 + Math.floor(rng() * 5);
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const q = 1 + Math.floor(rng() * 1000);
      const p = Math.floor(rng() * 1000001);
      const side = rng() < 0.5 ? 'yes' : 'no';
      positions.push({ contract_label: 'C-' + j, event_label: 'E-1', series_label: 'S-1', side, quantity: q, avg_price_micro: p, max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss' });
      sum += modelMaxLossMinor(side, q, p);
    }
    const g = compute({ ...BASE, aggregation: 'per_event', positions }).output_payload.groups[0];
    checked++;
    if (g.max_loss_minor !== sum) { violations++; console.log('  per-event sum mismatch', g.max_loss_minor, sum); }
  }
  return { name: 'per_event_group_max_loss_equals_sum_of_exact_position_models', checked, violations };
}

function checkRefusalsTotalOverNastyProfiles() {
  let checked = 0, violations = 0;
  const nasty = ['', 'GENERIC', 'kalshi_rulebook_v1_28', 'generic ', 42, null, {}, [], 'kalshi_rulebook_v1_29_extra'];
  for (const p of nasty) {
    checked++;
    const pp = { ...BASE, profile: p, positions: [{ contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'yes', quantity: 1, avg_price_micro: 500000, max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss' }] };
    const r = compute(pp);
    if (r.output_payload.verdict !== 'REFUSED' || !r.compliance_flags.includes('PROFILE_REFUSED')) { violations++; console.log('  profile not refused for', JSON.stringify(p)); }
  }
  // the two valid profiles never take the profile refusal
  for (const p of ['kalshi_rulebook_v1_29', 'generic']) {
    checked++;
    const pp = { ...BASE, profile: p, positions: [{ contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'yes', quantity: 1, avg_price_micro: 500000, max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss' }] };
    const r = compute(pp);
    if (r.compliance_flags.includes('PROFILE_REFUSED')) violations++;
  }
  return { name: 'unknown_profiles_refused_closed_enum_accepted', checked, violations };
}

function checkReachabilityFixturesAllFire() {
  let checked = 0, violations = 0;
  for (const v of REACH.vectors) {
    checked++;
    const r = compute(v.policy_parameters);
    const op = r.output_payload;
    if (op.verdict !== 'REFUSED' || op.manual_review_required !== true || !r.compliance_flags.includes(v.flag)) {
      violations++;
      console.log('  reachability fixture does not fire:', v.name, 'expected', v.flag, 'got', r.compliance_flags.join(','));
    }
  }
  return { name: 'every_declared_refused_branch_fires_on_its_fixture', checked, violations };
}

function checkDeterminismAndShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(SEED + 23);
  for (let i = 0; i < 50; i++) {
    const pp = randomValidPp(rng);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (!deepEqual(a.output_payload, b.output_payload)) violations++;
    const sv = findShapeViolations(a.output_payload);
    if (sv.length > 0) { violations++; console.log('  shape violations', sv.slice(0, 3)); }
  }
  return { name: 'determinism_and_output_shape_no_nan_undefined', checked, violations };
}

function checkDeclaredMaxLossUsedAsGiven() {
  let checked = 0, violations = 0;
  const pp = { ...BASE, positions: [{ contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side: 'yes', quantity: 1000, avg_price_micro: 400000, max_loss_minor: 12345, accountability_level_minor: 20000, limit_minor: null, limit_basis: 'max_loss' }] };
  checked++;
  const r = compute(pp);
  if (r.output_payload.positions[0].max_loss_minor !== 12345) violations++;
  if (r.output_payload.groups[0].max_loss_minor !== 12345) violations++;
  if (r.output_payload.verdict !== 'WITHIN') violations++; // 12345 <= 20000 declared level
  return { name: 'caller_declared_max_loss_minor_used_as_given', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures readable + outputs matching)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkExactMaxLossModel(),
  checkVerdictHierarchy(),
  checkMarketMakerTreatment(),
  checkNettingNeverIncreasesMaxLoss(),
  checkAggregationSumsMonotonically(),
  checkRefusalsTotalOverNastyProfiles(),
  checkReachabilityFixturesAllFire(),
  checkDeterminismAndShape(),
  checkDeclaredMaxLossUsedAsGiven(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
