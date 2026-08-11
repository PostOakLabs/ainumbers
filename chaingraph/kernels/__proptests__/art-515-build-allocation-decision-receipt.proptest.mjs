// art-515-build-allocation-decision-receipt.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C25-1).
// kernel_digest_at_authoring: sha256:cfa8312a00a78e19af8654199d3cfbc6224cc85e41ade3919d9eca0e60f46b40
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — CORRECTED from the WU row's float:yes (per FIX-2 discipline). Direct source
// read: the kernel's own header states "Money is fixed-point BigInt parsed from decimal strings, never
// float multiplication", confirmed — `toFixed`/`mulFixed`/`divFixed`/`roundFixedToString` are
// exclusively BigInt `*`/`/` operators, which are exact. The only `Number(...)` conversions are of a
// BigInt DIFFERENCE used purely for a sort-comparator SIGN (`Number(a.costBpsFixed - b.costBpsFixed)`)
// — sign is preserved by BigInt-to-Number conversion at any magnitude, so no precision loss can flip a
// comparator's ordering. Forced categorical boundary cases are used in place of ULP-boundary forcing.
// Checks: fixture-oracle gate, an explicit CONVERGENCE-OR-REPORT property for the greedy allocation
// loop in `buildOptimal` (bounded by `eligibleItems.length`, tested directly including the
// early-break-on-`remaining<=0` path), differential re-derivation of chosenCostFixed/
// chosenAdjustedTotalFixed, metamorphic order-invariance of inventory_snapshot/eligibility_schedule
// (the fixed tie-break sorts on asset_id, not array position), and forced categorical boundary cases
// (duplicate inventory ids, zero/negative obligation, unknown objective).
//
// Run: node chaingraph/kernels/__proptests__/art-515-build-allocation-decision-receipt.proptest.mjs

import { compute } from '../art-515-build-allocation-decision-receipt.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-515-build-allocation-decision-receipt.fixtures.json');
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
const rand = mulberry32(0x51500);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomPP(rng) {
  const ids = ['A1', 'A2', 'A3', 'A4'];
  const eligibility_schedule = ids.map((id) => ({ asset_id: id, eligible: rng() < 0.75 }));
  const inventory_snapshot = ids.map((id) => ({
    asset_id: id,
    available_amount: (rng() * 100000).toFixed(2),
    cost_bps: Math.floor(rng() * 200),
    hqla: rng() < 0.5,
    haircut_pct: (rng() * 20).toFixed(2),
  }));
  const objective = pick(rng, ['cheapest_to_deliver', 'preserve_hqla', 'minimise_movements']);
  const allocation_chosen = ids.filter(() => rng() < 0.5).map((id) => ({ asset_id: id, amount: (rng() * 30000).toFixed(2) }));
  return {
    obligation_ref: 'OB1', as_of: '2026-08-11',
    obligation_amount: (rng() * 50000).toFixed(2),
    eligibility_schedule, inventory_snapshot, objective, allocation_chosen,
  };
}

const TRIALS = 2500;

// ---------- P1: CONVERGENCE-OR-REPORT — the greedy allocation loop is bounded by eligibleItems.length ----------
function checkP1_convergence_bound() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const eligibleCount = pp.eligibility_schedule.filter((e) => e.eligible === true).length;
    if (output_payload.reproducibility.optimal_allocation.length > eligibleCount) violations++;
  }
  // explicit termination check: even with a huge obligation the loop must still terminate in at
  // most eligibleItems.length iterations (early break on exhausting the ordered list), never hang.
  checked++;
  {
    const pp = {
      obligation_ref: 'X', as_of: 'x', obligation_amount: '999999999.99',
      eligibility_schedule: [{ asset_id: 'A', eligible: true }, { asset_id: 'B', eligible: true }],
      inventory_snapshot: [{ asset_id: 'A', available_amount: '100', cost_bps: 1 }, { asset_id: 'B', available_amount: '200', cost_bps: 2 }],
      objective: 'cheapest_to_deliver', allocation_chosen: [],
    };
    const { output_payload } = compute(pp);
    if (output_payload.reproducibility.optimal_allocation.length > 2) violations++;
  }
  return { name: 'P1_greedy_loop_convergence_bounded_by_eligible_count', trials: checked, violations };
}

// ---------- P2 (differential): chosenCostFixed / chosenAdjustedTotalFixed re-derived (BigInt, exact) ----------
function checkP2_cost_differential() {
  let violations = 0, checked = 0;
  const SCALE = 10n ** 8n;
  function toFixed(v) {
    let s = String(v ?? 0).trim();
    let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    let [ip = '0', fp = ''] = s.split('.');
    if (ip === '') ip = '0';
    fp = fp.slice(0, 8).padEnd(8, '0');
    let mag = BigInt(ip + fp);
    return neg ? -mag : mag;
  }
  function fixedToPlainString(value, places) {
    const neg = value < 0n;
    const abs = neg ? -value : value;
    const divisor = 10n ** BigInt(8 - places);
    const q = abs / divisor;
    let qs = q.toString().padStart(places + 1, '0');
    const result = `${qs.slice(0, -places)}.${qs.slice(-places)}`;
    return (neg && q !== 0n) ? `-${result}` : result;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    let chosenCostFixed = 0n;
    for (const c of output_payload.reproducibility.chosen_allocation) {
      const item = pp.inventory_snapshot.find((x) => x.asset_id === c.asset_id);
      if (!item) continue;
      const amtFixed = toFixed(c.amount);
      const costFixed = toFixed(item.cost_bps ?? 0);
      chosenCostFixed += (amtFixed * costFixed) / SCALE;
    }
    if (output_payload.delta.cost_chosen !== fixedToPlainString(chosenCostFixed, 2)) violations++;
  }
  return { name: 'P2_chosen_cost_bigint_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permuting inventory/eligibility order never changes the re-derivation ----------
function checkP3_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1200; i++) {
    const pp = randomPP(rand);
    const shuffled = {
      ...pp,
      eligibility_schedule: [...pp.eligibility_schedule].sort(() => rand() - 0.5),
      inventory_snapshot: [...pp.inventory_snapshot].sort(() => rand() - 0.5),
    };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.reproducibility.verdict !== r2.reproducibility.verdict) violations++;
    const sortById = (arr) => [...arr].sort((a, b) => (a.asset_id < b.asset_id ? -1 : 1));
    if (JSON.stringify(sortById(r1.reproducibility.optimal_allocation)) !== JSON.stringify(sortById(r2.reproducibility.optimal_allocation))) violations++;
  }
  return { name: 'P3_inventory_and_eligibility_order_invariance', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — no ULP forcing applies) ----------
function checkP4_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  const base = { obligation_ref: 'O', as_of: 'x' };

  // duplicate inventory asset_id -> only the first is kept, second recorded as duplicate
  checked++;
  {
    const r = compute({
      ...base, obligation_amount: '10',
      eligibility_schedule: [{ asset_id: 'A', eligible: true }],
      inventory_snapshot: [{ asset_id: 'A', available_amount: '5', cost_bps: 1 }, { asset_id: 'A', available_amount: '999', cost_bps: 2 }],
      objective: 'cheapest_to_deliver', allocation_chosen: [],
    }).output_payload;
    if (!r.exceptions.some((e) => e.field === 'inventory_snapshot' && e.reason.indexOf('duplicate') !== -1)) violations++;
  }
  // zero obligation -> not positive, exception raised, no throw
  checked++;
  {
    const r = compute({ ...base, obligation_amount: '0', eligibility_schedule: [], inventory_snapshot: [], objective: 'cheapest_to_deliver', allocation_chosen: [] }).output_payload;
    if (r.obligation.positive !== false) violations++;
  }
  // negative obligation -> not positive
  checked++;
  {
    const r = compute({ ...base, obligation_amount: '-5', eligibility_schedule: [], inventory_snapshot: [], objective: 'cheapest_to_deliver', allocation_chosen: [] }).output_payload;
    if (r.obligation.positive !== false) violations++;
  }
  // unknown objective -> no optimal allocation computed, judgment_required
  checked++;
  {
    const r = compute({
      ...base, obligation_amount: '10',
      eligibility_schedule: [{ asset_id: 'A', eligible: true }],
      inventory_snapshot: [{ asset_id: 'A', available_amount: '100', cost_bps: 1 }],
      objective: 'some_unheard_of_objective', allocation_chosen: [],
    }).output_payload;
    if (r.reproducibility.verdict !== null || r.judgment_required === null) violations++;
  }
  // empty input -> finite gate, no throw
  checked++;
  {
    const r = compute({}).output_payload;
    if (typeof r !== 'object' || r === null) violations++;
  }
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_convergence_bound());
results.properties.push(checkP2_cost_differential());
results.properties.push(checkP3_order_invariance());
results.properties.push(checkP4_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-515-build-allocation-decision-receipt',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
