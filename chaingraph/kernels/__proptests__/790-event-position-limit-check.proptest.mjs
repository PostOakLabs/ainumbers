// 790-event-position-limit-check — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (<=200 positions, prices on the 0..1000000 micro
// grid, closed refusal set enumerated in the sibling reachability fixtures and the branch
// inventory), but quantities span a wide integer range, so no totality claim is made over them.
// Properties below run over a committed mulberry32 seed (deterministic) plus a fixed corpus of
// structural cases.
//
// kernel_digest_at_authoring: sha256:c2ddcf46b3a0feaf41a421791b771c0b262d775a39dbd5e5e748a9fed4ce6ffa
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
import { compute, buildArtifact } from '../790-event-position-limit-check.kernel.mjs';
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

// ---------- round-3 cure: exact-value assertions (mutation floor) ----------
const POSN = (side, quantity, avg_price_micro, extra = {}) => ({
  contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', side, quantity, avg_price_micro,
  max_loss_minor: null, accountability_level_minor: null, limit_minor: null, limit_basis: 'max_loss',
  ...extra,
});
const RUN = (pp) => compute(pp).output_payload;
const FLAGRUN = (pp) => compute(pp).compliance_flags;

function checkAsOfCalendarAndWindow() {
  let checked = 0, violations = 0;
  const refusedAsOf = (asOf, profile = 'generic') => {
    checked++;
    const op = RUN({ profile, as_of: asOf, aggregation: 'per_contract', participant_class: 'standard', positions: [POSN('yes', 1, 500000)] });
    if (op.verdict !== 'REFUSED' || !FLAGRUN({ profile, as_of: asOf, aggregation: 'per_contract', participant_class: 'standard', positions: [POSN('yes', 1, 500000)] }).includes('AS_OF_REFUSED') || op.refusal.field !== 'as_of'
      || op.refusal.reason !== 'as_of must be an ISO-8601 date YYYY-MM-DD; the kernel never reads a wall clock') {
      violations++; console.log('  as_of not refused:', asOf, profile, op.refusal && op.refusal.reason);
    }
  };
  const acceptedAsOf = (asOf, profile = 'generic') => {
    checked++;
    const pp = { profile, as_of: asOf, aggregation: 'per_contract', participant_class: 'standard', positions: [POSN('yes', 1, 500000)] };
    const op = RUN(pp);
    if (op.verdict === 'REFUSED' || FLAGRUN(pp).includes('AS_OF_REFUSED') || FLAGRUN(pp).includes('PROFILE_NOT_EFFECTIVE') || op.as_of !== asOf) {
      violations++; console.log('  valid as_of refused:', asOf, profile, op.refusal && op.refusal.flag);
    }
  };
  // impossible calendar dates refuse; leap and month-length boundaries resolve both ways
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2026-01-00', '2100-02-29', '2026-12-32']) refusedAsOf(bad);
  for (const good of ['2028-02-29', '2000-02-29', '2026-04-30', '2026-12-31', '0000-01-01']) acceptedAsOf(good);
  // kalshi window: as_of ON effective_from is in scope, the day before is refused with the exact window reason
  checked++;
  let op = RUN({ ...BASE, as_of: '2026-10-30', positions: [POSN('yes', 1, 500000)] });
  if (op.verdict === 'REFUSED') { violations++; console.log('  as_of on effective_from refused:', op.refusal && op.refusal.flag); }
  checked++;
  op = RUN({ ...BASE, as_of: '2026-10-29', positions: [POSN('yes', 1, 500000)] });
  if (op.verdict !== 'REFUSED' || op.refusal.field !== 'as_of'
    || op.refusal.reason !== 'as_of falls outside the pinned profile window 2026-10-30..open') {
    violations++; console.log('  pre-window as_of not refused with exact reason:', op.refusal && op.refusal.reason);
  }
  return { name: 'as_of_calendar_and_profile_window_boundaries', checked, violations };
}

function checkLabelShapes() {
  let checked = 0, violations = 0;
  const withLabel = (v, field) => {
    const pos = POSN('yes', 1, 500000);
    pos[field] = v;
    return { ...BASE, positions: [pos] };
  };
  const refusedLabel = (v, field, why) => {
    checked++;
    const pp = withLabel(v, field);
    const op = RUN(pp);
    if (op.verdict !== 'REFUSED' || !FLAGRUN(pp).includes('LABEL_IDENTIFIER_SUSPECTED') || op.refusal.field !== field
      || op.refusal.reason !== 'label field looks like an account id, member id, address, email or hash (' + why + '); labels must be synthetic contract, event or series designators') {
      violations++; console.log('  label not refused as', why, ':', JSON.stringify(v), field, op.refusal && op.refusal.reason);
    }
  };
  const acceptedLabel = (v, field) => {
    checked++;
    const op = RUN(withLabel(v, field));
    if (op.verdict === 'REFUSED') { violations++; console.log('  near-miss label refused:', JSON.stringify(v), field, op.refusal && op.refusal.reason); }
  };
  // each shape fires on a hit; the exact near-miss under each guard edge accepts
  refusedLabel('acct:1001', 'contract_label', 'account-or-member-id-shape');
  refusedLabel('0x' + 'a1'.repeat(20), 'contract_label', 'address-shape');   // 42-char 0x hex
  refusedLabel('a'.repeat(32), 'event_label', 'hash-shape');
  refusedLabel('WXID123456789', 'series_label', 'id-token-shape');           // 4 letters + 6+ digits, >=12 chars, has ID
  refusedLabel('synthetic@label', 'contract_label', 'email-shape');
  refusedLabel('', 'event_label', 'empty');
  refusedLabel('A'.repeat(65), 'contract_label', 'over-64-chars');
  acceptedLabel('0xdeadbeef', 'contract_label');    // 0x hex but under 20 chars
  acceptedLabel('a'.repeat(31), 'event_label');     // 31 hex chars, under the 32 floor
  acceptedLabel('WXID123456', 'series_label');      // letters+digits with ID but under 12 chars
  acceptedLabel('ABCD123456', 'contract_label');    // letters+digits but no ID substring
  acceptedLabel('123456ID789012', 'series_label');  // digits+ID but no 4-letters-then-digits run
  acceptedLabel('Z'.repeat(64), 'event_label');     // exactly 64 non-hex chars is allowed
  return { name: 'label_identifier_shapes_refused_and_near_misses_accepted', checked, violations };
}

function checkFieldValidationBoundaries() {
  let checked = 0, violations = 0;
  const refusedField = (mut, flag, field) => {
    checked++;
    const op = RUN({ ...BASE, positions: [POSN('yes', 1, 500000, mut)] });
    if (op.verdict !== 'REFUSED' || !FLAGRUN({ ...BASE, positions: [POSN('yes', 1, 500000, mut)] }).includes(flag) || op.refusal.field !== field) {
      violations++; console.log('  field not refused:', flag, JSON.stringify(mut), op.refusal && op.refusal.flag);
    }
  };
  // quantity: positive integer only
  refusedField({ quantity: 0 }, 'QUANTITY_REFUSED', 'quantity');
  refusedField({ quantity: -1 }, 'QUANTITY_REFUSED', 'quantity');
  refusedField({ quantity: 1.5 }, 'QUANTITY_REFUSED', 'quantity');
  refusedField({ quantity: '2' }, 'QUANTITY_REFUSED', 'quantity');
  // price: integer on the closed 0..1000000 micro grid
  refusedField({ avg_price_micro: -1 }, 'PRICE_REFUSED', 'avg_price_micro');
  refusedField({ avg_price_micro: 1000001 }, 'PRICE_REFUSED', 'avg_price_micro');
  refusedField({ avg_price_micro: 1.5 }, 'PRICE_REFUSED', 'avg_price_micro');
  checked++;
  if (RUN({ ...BASE, positions: [POSN('yes', 1, 0)] }).positions[0].max_loss_minor !== 0) violations++;      // price floor 0 accepted
  checked++;
  if (RUN({ ...BASE, positions: [POSN('yes', 1, 1000000)] }).positions[0].max_loss_minor !== 100) violations++; // price ceiling -> 100 minor
  // declared fields, when present, must be non-negative integers; zero is valid and used as given
  refusedField({ max_loss_minor: -1 }, 'MAX_LOSS_REFUSED', 'max_loss_minor');
  refusedField({ max_loss_minor: '5' }, 'MAX_LOSS_REFUSED', 'max_loss_minor');
  refusedField({ accountability_level_minor: -1 }, 'ACCOUNTABILITY_LEVEL_REFUSED', 'accountability_level_minor');
  refusedField({ limit_minor: -1 }, 'LIMIT_REFUSED', 'limit_minor');
  checked++;
  const zero = RUN({ ...BASE, positions: [POSN('yes', 1, 500000, { max_loss_minor: 0, accountability_level_minor: 0, limit_minor: 0 })] });
  if (zero.positions[0].max_loss_minor !== 0 || zero.verdict !== 'WITHIN') violations++;
  return { name: 'field_validation_integer_and_range_boundaries', checked, violations };
}

function checkNettingExactConservativeAllocation() {
  let checked = 0, violations = 0;
  // YES residual: 5 yes (3 @400000, 2 @700000) against 1 no @300000 -> net 4; the conservative
  // allocation offsets cheapest-first, leaving the 2 highest-price yes plus 2 of the cheap ones:
  // spend 2*700000 + 2*400000 = 2200000 micro over 4 contracts -> avg 550000 -> 220 minor.
  const cheap = ['yes', 3, 400000], exp = ['yes', 2, 700000], noMid = ['no', 1, 300000];
  const outs = [[cheap, exp, noMid], [exp, cheap, noMid], [exp, noMid, cheap]].map((order) =>
    RUN({ ...BASE, netting: 'per_contract_net', positions: order.map(([s, q, p]) => POSN(s, q, p)) }));
  checked += outs.length;
  if (!deepEqual(outs[0], outs[1]) || !deepEqual(outs[0], outs[2])) { violations++; console.log('  netting output differs by position order'); }
  const p0 = outs[0].positions[0];
  if (p0.side !== 'yes' || p0.quantity !== 4 || p0.avg_price_micro !== 550000 || p0.max_loss_minor !== 220
    || p0.rounding !== 'ceil_micro_to_minor' || p0.netted !== true || outs[0].verdict !== 'WITHIN') {
    violations++; console.log('  yes-residual netting mismatch:', JSON.stringify(p0));
  }
  // NO residual: 5 no (3 @400000, 2 @700000) against 1 yes @500000 -> net -4; loss per no contract is
  // (1000000 - price); the conservative residual keeps the highest-loss no contracts (3 @400000 at
  // 600000/unit + 1 @700000 at 300000/unit) -> total loss 2100000 micro over 4 -> unit ceil 525000
  // -> avg_price 475000 -> max loss 4*525000 = 210 minor.
  checked++;
  const outNo = RUN({ ...BASE, netting: 'per_contract_net', positions: [POSN('no', 3, 400000), POSN('no', 2, 700000), POSN('yes', 1, 500000)] });
  const pn = outNo.positions[0];
  if (pn.side !== 'no' || pn.quantity !== 4 || pn.avg_price_micro !== 475000 || pn.max_loss_minor !== 210 || pn.netted !== true) {
    violations++; console.log('  no-residual netting mismatch:', JSON.stringify(pn));
  }
  // equal yes and no -> net 0 book with zero max loss
  checked++;
  const outZero = RUN({ ...BASE, netting: 'per_contract_net', positions: [POSN('yes', 2, 600000), POSN('no', 2, 600000)] });
  const pz = outZero.positions[0];
  if (pz.quantity !== 0 || pz.max_loss_minor !== 0 || pz.rounding !== 'netted_to_zero' || outZero.verdict !== 'WITHIN') {
    violations++; console.log('  net-zero book mismatch:', JSON.stringify(pz));
  }
  // net 1: the residual is a single cheapest contract
  checked++;
  const outOne = RUN({ ...BASE, netting: 'per_contract_net', positions: [POSN('yes', 2, 400000), POSN('no', 1, 400000)] });
  const p1 = outOne.positions[0];
  if (p1.side !== 'yes' || p1.quantity !== 1 || p1.avg_price_micro !== 400000 || p1.max_loss_minor !== 40) {
    violations++; console.log('  net-1 book mismatch:', JSON.stringify(p1));
  }
  return { name: 'per_contract_net_conservative_allocation_exact_values_order_independent', checked, violations };
}

function checkNettingBoundaryAgainstAccountabilityLevel() {
  let checked = 0, violations = 0;
  // net 40 at price 10000 micro/contract = 40 minor: exactly at the declared level is not a breach,
  // one contract more (net 41 -> 41 minor) breaches with the exact effective level recorded.
  // Both legs carry the same level so the netting group stays uniform.
  checked++;
  const at = RUN({ ...BASE, netting: 'per_contract_net', positions: [POSN('yes', 80, 10000, { accountability_level_minor: 40 }), POSN('no', 40, 10000, { accountability_level_minor: 40 })] });
  if (at.verdict !== 'WITHIN' || at.groups[0].accountability_exceeded !== false
    || at.groups[0].max_loss_minor !== 40 || at.groups[0].effective_accountability_level_minor !== 40) {
    violations++; console.log('  net-at-level mismatch:', JSON.stringify(at.groups[0]));
  }
  checked++;
  const over = compute({ ...BASE, netting: 'per_contract_net', positions: [POSN('yes', 81, 10000, { accountability_level_minor: 40 }), POSN('no', 40, 10000, { accountability_level_minor: 40 })] });
  if (over.output_payload.verdict !== 'ACCOUNTABILITY_REVIEW'
    || over.output_payload.groups[0].accountability_exceeded !== true
    || over.output_payload.groups[0].max_loss_minor !== 41
    || over.output_payload.accountability_breaches[0].effective_level_minor !== 40
    || over.output_payload.accountability_breaches[0].market_maker_multiplier_applied !== null) {
    violations++; console.log('  net-level-plus-1 mismatch:', JSON.stringify(over.output_payload.accountability_breaches));
  }
  return { name: 'netted_max_loss_at_level_is_within_and_level_plus_1_breaches', checked, violations };
}

function checkConflictingLevelsLimitsBases() {
  let checked = 0, violations = 0;
  const conflictCase = (extraA, extraB) => compute({
    ...BASE, netting: 'per_contract_net',
    positions: [POSN('yes', 1, 400000, extraA), POSN('no', 1, 400000, extraB)],
  });
  // conflicting accountability levels inside one netting group
  checked++;
  const cl = conflictCase({ accountability_level_minor: 10 }, { accountability_level_minor: 20 });
  if (!cl.compliance_flags.includes('NON_UNIFORM_ACCOUNTABILITY_LEVELS') || !cl.compliance_flags.includes('AGG_LEVELS_NOT_UNIFORM_PER_GROUP_CHECKS_ONLY')
    || cl.output_payload.manual_review_required !== true || cl.output_payload.positions[0].accountability_level_minor !== null
    || cl.output_payload.groups[0].effective_accountability_level_minor !== null) {
    violations++; console.log('  conflicting levels mismatch:', cl.compliance_flags.join(','), JSON.stringify(cl.output_payload.positions[0]));
  }
  // conflicting limit minors -> no effective limit, group checks only
  checked++;
  const climit = conflictCase({ limit_minor: 500 }, { limit_minor: 600 });
  if (climit.output_payload.manual_review_required !== true || climit.output_payload.positions[0].limit_minor !== null
    || climit.output_payload.groups[0].limit_applies !== false) {
    violations++; console.log('  conflicting limits mismatch:', JSON.stringify(climit.output_payload.positions[0]));
  }
  // conflicting limit bases -> the netted book falls back to max_loss basis
  checked++;
  const cbasis = conflictCase({ limit_basis: 'max_loss' }, { limit_basis: 'contracts' }).output_payload;
  if (cbasis.manual_review_required !== true || cbasis.positions[0].limit_basis !== 'max_loss') {
    violations++; console.log('  conflicting bases mismatch:', JSON.stringify(cbasis.positions[0]));
  }
  // cross-book non-uniform levels inside one aggregation group (gross): two books at different
  // levels, or one declared + one null, both set the flag and block an effective level
  checked++;
  const x1 = compute({ ...BASE, aggregation: 'per_event', positions: [POSN('yes', 1, 500000, { contract_label: 'C-1', accountability_level_minor: 10 }), POSN('yes', 1, 500000, { contract_label: 'C-2', accountability_level_minor: 20 })] });
  if (!x1.compliance_flags.includes('NON_UNIFORM_ACCOUNTABILITY_LEVELS') || x1.output_payload.manual_review_required !== true
    || x1.output_payload.groups[0].effective_accountability_level_minor !== null) {
    violations++; console.log('  cross-book level conflict mismatch:', x1.compliance_flags.join(','));
  }
  checked++;
  const x2 = compute({ ...BASE, aggregation: 'per_event', positions: [POSN('yes', 1, 500000, { contract_label: 'C-1' }), POSN('yes', 1, 500000, { contract_label: 'C-2', accountability_level_minor: 20 })] });
  if (x2.output_payload.manual_review_required !== true || x2.output_payload.groups[0].effective_accountability_level_minor !== null) {
    violations++; console.log('  null-vs-declared level mismatch');
  }
  // uniform books at one level keep an effective level and no flag
  checked++;
  const u = RUN({ ...BASE, aggregation: 'per_event', positions: [POSN('yes', 1, 500000, { contract_label: 'C-1', accountability_level_minor: 10 }), POSN('yes', 1, 500000, { contract_label: 'C-2', accountability_level_minor: 10 })] });
  if (u.manual_review_required !== false || u.groups[0].effective_accountability_level_minor !== 10) {
    violations++; console.log('  uniform levels mismatch:', JSON.stringify(u.groups[0]));
  }
  return { name: 'conflicting_levels_limits_bases_set_non_uniform_flag_and_null_effectives', checked, violations };
}

function checkMarketMakerMultiplierAndExemptionBoundaries() {
  let checked = 0, violations = 0;
  const posn = { quantity: 1, avg_price_micro: 400000, accountability_level_minor: 4, limit_minor: 30 }; // max loss 40 minor
  // 10x default on level 4 -> effective 40 equals max loss 40 -> no breach
  checked++;
  const at = compute({ ...BASE, participant_class: 'market_maker', positions: [POSN('yes', posn.quantity, posn.avg_price_micro, posn)] });
  if (at.output_payload.verdict !== 'WITHIN' || at.output_payload.accountability_breaches.length !== 0
    || !at.compliance_flags.includes('MM_ACCOUNTABILITY_MULTIPLIER_APPLIED')) {
    violations++; console.log('  mm at-multiplier-level mismatch:', at.output_payload.verdict);
  }
  // level 3 -> effective 30 < 40 -> breach with the exact effective level and multiplier
  checked++;
  const over = compute({ ...BASE, participant_class: 'market_maker', positions: [POSN('yes', 1, 400000, { accountability_level_minor: 3, limit_minor: 30 })] });
  if (over.output_payload.verdict !== 'ACCOUNTABILITY_REVIEW' || over.output_payload.accountability_breaches[0].effective_level_minor !== 30
    || over.output_payload.accountability_breaches[0].market_maker_multiplier_applied !== 10) {
    violations++; console.log('  mm multiplier breach mismatch:', JSON.stringify(over.output_payload.accountability_breaches));
  }
  // exemption: a limit below max loss is a LIMIT_BREACH for standard, out of scope for an exempt MM
  checked++;
  const std = RUN({ ...BASE, participant_class: 'standard', positions: [POSN('yes', 1000, 400000, { limit_minor: 30 })] });
  if (std.verdict !== 'LIMIT_BREACH' || std.groups[0].limit_applies !== true || std.limit_breaches[0].limit_minor !== 30) {
    violations++; console.log('  standard limit breach mismatch:', std.verdict);
  }
  checked++;
  const mm = compute({ ...BASE, participant_class: 'market_maker', positions: [POSN('yes', 1000, 400000, { limit_minor: 30 })] });
  if (mm.output_payload.verdict !== 'WITHIN' || mm.output_payload.groups[0].limit_applies !== false
    || mm.output_payload.market_maker_treatment.limit_exempt !== true
    || !mm.compliance_flags.includes('LIMIT_CHECKS_SCOPE_NOTE_MM_EXEMPT')) {
    violations++; console.log('  mm exemption mismatch:', mm.output_payload.verdict, mm.output_payload.groups[0].limit_applies);
  }
  return { name: 'market_maker_multiplier_boundary_and_limit_exemption_scope', checked, violations };
}

// Order-swap across contracts sharing an event (ART790-CROSS-EVENT-LABEL-REFUSE-1): the earlier
// netting permutation test only reordered legs WITHIN one contract. Here three legs span two
// contracts in one event and the whole positions array is permuted; a valid book must be invariant.
function checkOrderSwapAcrossContractsSharingEvent() {
  let checked = 0, violations = 0;
  const legs = [
    POSN('yes', 300, 400000, { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', accountability_level_minor: 100 }),
    POSN('no', 100, 400000, { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1', accountability_level_minor: 100 }),
    POSN('yes', 100, 400000, { contract_label: 'C-2', event_label: 'E-1', series_label: 'S-1', accountability_level_minor: 100 }),
  ];
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const base = { ...BASE, aggregation: 'per_event', netting: 'per_contract_net' };
  const semantic = (o) => ({ verdict: o.verdict, manual_review_required: o.manual_review_required, groups: o.groups, accountability_breaches: o.accountability_breaches, limit_breaches: o.limit_breaches });
  const outs = orders.map((o) => semantic(RUN({ ...base, positions: o.map((i) => legs[i]) })));
  checked += outs.length;
  for (let i = 1; i < outs.length; i++) {
    if (!deepEqual(outs[0], outs[i])) { violations++; console.log('  order-swap across contracts changed findings:', JSON.stringify(orders[i]), outs[0].verdict, outs[i].verdict); }
  }
  return { name: 'per_contract_net_order_swap_across_contracts_sharing_event_findings_invariant', checked, violations };
}

function checkCrossLabelDisagreementRefusesOrderIndependently() {
  let checked = 0, violations = 0;
  const mk = (aggregation, badField) => {
    const a = POSN('yes', 300, 400000, { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1' });
    const b = POSN('no', 100, 400000, { contract_label: 'C-1', event_label: 'E-1', series_label: 'S-1' });
    b[badField] = badField === 'event_label' ? 'E-2' : 'S-2';
    const c = POSN('yes', 100, 400000, { contract_label: 'C-2', event_label: 'E-1', series_label: 'S-1', accountability_level_minor: 100 });
    return { ...BASE, aggregation, netting: 'per_contract_net', positions: [a, b, c] };
  };
  const cases = [
    ['per_event', 'event_label', 'CROSS_EVENT_LABEL_REFUSED'],
    ['per_series', 'series_label', 'CROSS_SERIES_LABEL_REFUSED'],
  ];
  for (const [agg, field, flag] of cases) {
    const pp = mk(agg, field);
    for (const p of [pp, { ...pp, positions: [...pp.positions].reverse() }]) {
      checked++;
      const op = RUN(p);
      if (op.verdict !== 'REFUSED' || !FLAGRUN(p).includes(flag) || op.refusal.field !== field) {
        violations++; console.log('  cross-label disagreement not refused order-independently:', agg, flag, op.verdict, op.refusal && op.refusal.flag);
      }
    }
    checked++;
    const pc = RUN({ ...pp, aggregation: 'per_contract' });
    if (pc.verdict === 'REFUSED') { violations++; console.log('  per_contract must not refuse a cross-label netting book'); }
  }
  return { name: 'cross_event_series_label_disagreement_refused_order_independently', checked, violations };
}

// (D6) buildArtifact_never_throws: an input whose {policy_parameters, output_payload} preimage the
// shared canonicalizer would reject mints an artifact with a null execution_hash and a
// hash_refusal beside it; a clean input (accepted or refused) gets a 64-hex hash.
async function checkBuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const hostile = [
    { zzz: NaN }, { zzz: -Infinity }, { zzz: Infinity }, { zzz: 1e300 }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } },
    { zzz: deep }, { zzz: wide }, { zzz: 10n }, { positions: [POSN('yes', 10n, 500000)] },
  ];
  for (const delta of hostile) {
    checked++;
    try {
      const art = await buildArtifact({ ...BASE, ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log(`  never-throw violation: ${Object.keys(delta)[0]} artifact shape`); }
      if (art.output_payload.verdict !== 'REFUSED') { violations++; console.log('  never-throw violation: hostile input not refused'); }
    } catch (e) { violations++; console.log(`  never-throw violation: buildArtifact threw: ${String(e.message).slice(0, 80)}`); }
  }
  for (const pp of [{ ...BASE, positions: [POSN('yes', 10, 500000)] }, { ...BASE, profile: 'nope' }, null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('  never-throw violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log(`  never-throw violation: buildArtifact threw on clean input: ${String(e.message).slice(0, 80)}`); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
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
  checkAsOfCalendarAndWindow(),
  checkLabelShapes(),
  checkFieldValidationBoundaries(),
  checkNettingExactConservativeAllocation(),
  checkNettingBoundaryAgainstAccountabilityLevel(),
  checkConflictingLevelsLimitsBases(),
  checkMarketMakerMultiplierAndExemptionBoundaries(),
  checkOrderSwapAcrossContractsSharingEvent(),
  checkCrossLabelDisagreementRefusesOrderIndependently(),
  await checkBuildArtifactNeverThrows(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
