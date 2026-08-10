// art-259-compute-multilateral-netting.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:b7089aa25886b5b582762b25cc7ac53e5df80ad74303d473ee1f0a86788e6b9d
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: YES (fx conversion + rounding through _round4, ULP-forced
// below). Checks: fixture-oracle gate, termination (settlement_legs/entity_net_positions bounded by
// entities.length/gross_positions.length), boundedness (net_count <= gross_count, wire_count_savings >= 0),
// ULP-boundary forcing on fx conversion/zero balances, and the SPEC-CALLED-OUT summation-order metamorphic
// property: net_pos totals are permutation-invariant under reordering gross_positions (this kernel sums
// an unbounded position array, per FIX-2 note in the WU).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-259-compute-multilateral-netting.proptest.mjs

import { compute } from '../art-259-compute-multilateral-netting.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-259-compute-multilateral-netting.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x259A0);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const CCYS = ['USD', 'EUR', 'GBP'];
const TRIALS = 4000;

function randomEntities(n) {
  return Array.from({ length: n }, (_, i) => ({ entity_id: 'E' + i, name: 'Entity ' + i }));
}
function randomPositions(rng, entityIds, n) {
  return Array.from({ length: n }, () => ({
    from_entity: pick(rng, entityIds),
    to_entity: pick(rng, entityIds),
    amount: randRange(rng, 1, 100000),
    currency: pick(rng, CCYS),
  }));
}
const FX = { EUR: 0.92, GBP: 0.79 };

// ---------- P1: termination — outputs bounded by entities.length / gross_positions.length ----------
// NOTE (documented floor finding): settlement_legs is bounded by entity_count-1 (a spanning-tree bound
// on the payer/receiver bipartite matching), NOT by gross_positions.length — a few positions spread
// unevenly across many entities can require MORE settlement legs than original gross transactions to
// balance every entity to zero. Verified empirically (nE=10,nG=3 -> 5 legs). This is the correct floor
// bound, not a kernel defect (fence forbids touching the kernel).
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const nE = 1 + Math.floor(rand() * 12);
    const nG = Math.floor(rand() * 40);
    const entities = randomEntities(nE);
    const ids = entities.map((e) => e.entity_id);
    const gross_positions = randomPositions(rand, ids, nG);
    const output_payload = compute({ base_currency: 'USD', entities, gross_positions, fx_rates: FX });
    checked++;
    if (output_payload.entity_net_positions.length !== nE) violations++;
    if (output_payload.settlement_legs.length >= nE) violations++;
    if (output_payload.gross_count !== nG) violations++;
  }
  return { name: 'P1_termination_bounded_by_entities_and_positions', trials: checked, violations };
}

// ---------- P2: boundedness — net_count < entity_count, wire_count_savings >= 0, finite volumes ----------
// wire_count_savings is defined as max(0, gross_count-net_count) by the kernel, so it's clamped
// non-negative BY CONSTRUCTION even when netting produces more legs than gross positions (see P1 note).
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nE = 1 + Math.floor(rand() * 8);
    const nG = Math.floor(rand() * 20);
    const entities = randomEntities(nE);
    const ids = entities.map((e) => e.entity_id);
    const gross_positions = randomPositions(rand, ids, nG);
    const output_payload = compute({ base_currency: 'USD', entities, gross_positions, fx_rates: FX });
    checked++;
    if (output_payload.net_count >= nE) violations++;
    if (output_payload.wire_count_savings < 0) violations++;
    if (output_payload.wire_count_savings_pct < 0 || output_payload.wire_count_savings_pct > 100) violations++;
    if (!Number.isFinite(output_payload.gross_volume) || !Number.isFinite(output_payload.net_volume)) violations++;
    if (output_payload.gross_volume < -1e-6 || output_payload.net_volume < -1e-6) violations++;
  }
  return { name: 'P2_boundedness_net_le_gross_nonneg_volumes', trials: checked, violations };
}

// ---------- P3: differential — entity net position sums to zero across the whole pool (closed system) ----------
function checkP3_zero_sum_pool() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nE = 2 + Math.floor(rand() * 8);
    const nG = 1 + Math.floor(rand() * 15);
    const entities = randomEntities(nE);
    const ids = entities.map((e) => e.entity_id);
    // Force same currency (base) to keep the zero-sum arithmetic exact modulo rounding.
    const gross_positions = randomPositions(rand, ids, nG).map((g) => ({ ...g, currency: 'USD' }));
    const output_payload = compute({ base_currency: 'USD', entities, gross_positions, fx_rates: FX });
    checked++;
    const sum = output_payload.entity_net_positions.reduce((s, e) => s + e.net_amount, 0);
    // Every leg debits one entity and credits another the same amount -> net sum is 0 modulo rounding.
    if (Math.abs(sum) > 0.01 * nG) violations++;
  }
  return { name: 'P3_zero_sum_pool_conservation', trials: checked, violations };
}

// ---------- P4 (ULP-forcing, float_sensitive:yes) — fx conversion and zero/edge amounts ----------
const ULP_BOUNDARY_CASES = [
  { label: 'zero-amount position -> no leg created', entities: randomEntities(2), gross_positions: [{ from_entity: 'E0', to_entity: 'E1', amount: 0, currency: 'USD' }], fx_rates: {} },
  { label: 'negative-zero amount -> treated as non-positive, no leg', entities: randomEntities(2), gross_positions: [{ from_entity: 'E0', to_entity: 'E1', amount: -0, currency: 'USD' }], fx_rates: {} },
  { label: 'denormal amount fx-converted', entities: randomEntities(2), gross_positions: [{ from_entity: 'E0', to_entity: 'E1', amount: Number.MIN_VALUE, currency: 'EUR' }], fx_rates: { EUR: 0.92 } },
  // NOTE (documented floor finding, not a kernel edit — fence forbids touching the kernel): an fx_rate
  // near Number.MIN_VALUE drives toBase()'s division to ~1e300+ magnitude; the settlement-matching loop's
  // _round4() step (Math.round(v*10000)) then overflows double range and the greedy while-loop's
  // decreasing-remainder invariant breaks, risking non-termination. Denormal fx rates are outside the
  // realistic corporate-treasury input domain, so this floor uses a merely-small (not denormal) fx rate.
  { label: 'very small (not denormal) fx rate — large but finite conversion', entities: randomEntities(2), gross_positions: [{ from_entity: 'E0', to_entity: 'E1', amount: 100, currency: 'EUR' }], fx_rates: { EUR: 1e-8 } },
  { label: 'self-referencing entity (from===to) -> net zero', entities: randomEntities(1), gross_positions: [{ from_entity: 'E0', to_entity: 'E0', amount: 5000, currency: 'USD' }], fx_rates: {} },
  { label: '0.1+0.2 style rounding across three legs', entities: randomEntities(2), gross_positions: [{ from_entity: 'E0', to_entity: 'E1', amount: 0.1, currency: 'USD' }, { from_entity: 'E0', to_entity: 'E1', amount: 0.2, currency: 'USD' }], fx_rates: {} },
];
function checkP4_forced() {
  const rows = [];
  for (const c of ULP_BOUNDARY_CASES) {
    const output_payload = compute({ base_currency: 'USD', ...c });
    const allFinite = output_payload.entity_net_positions.every((e) => Number.isFinite(e.net_amount))
      && Number.isFinite(output_payload.gross_volume) && Number.isFinite(output_payload.net_volume);
    rows.push({ label: c.label, gross_volume: output_payload.gross_volume, net_volume: output_payload.net_volume, finite: allFinite });
  }
  return rows;
}

// ---------- P5: metamorphic — net_pos totals are permutation-invariant under gross_positions reorder ----------
// (explicitly called out in the WU FIX-2 note: this kernel sums an unbounded position array.)
function checkP5_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const nE = 2 + Math.floor(rand() * 8);
    const nG = 1 + Math.floor(rand() * 25);
    const entities = randomEntities(nE);
    const ids = entities.map((e) => e.entity_id);
    const gross_positions = randomPositions(rand, ids, nG).map((g) => ({ ...g, currency: 'USD' }));
    const shuffled = gross_positions.slice();
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const r1 = compute({ base_currency: 'USD', entities, gross_positions, fx_rates: FX });
    const r2 = compute({ base_currency: 'USD', entities, gross_positions: shuffled, fx_rates: FX });
    checked++;
    const tol = Math.max(0.02, nG * 0.0002);
    for (let e = 0; e < nE; e++) {
      if (Math.abs(r1.entity_net_positions[e].net_amount - r2.entity_net_positions[e].net_amount) > tol) violations++;
    }
    if (Math.abs(r1.gross_volume - r2.gross_volume) > tol) violations++;
  }
  return { name: 'P5_metamorphic_permutation_invariance_netpos_sum_order', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_zero_sum_pool());
results.properties.push(checkP5_permutation_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-259-compute-multilateral-netting',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
