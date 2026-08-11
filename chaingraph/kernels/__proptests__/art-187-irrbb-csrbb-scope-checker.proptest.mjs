// kernel_digest_at_authoring: sha256:fea6edb4b186ef335fd7e3df37d128065a18992ad5cfb21893345d0ed47e2a22
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-187-irrbb-csrbb-scope-checker.
// Class B (bounded scope checker), float:no exception per the WU row — the kernel's only
// numeric use is a summed >0 scope-amount gate; no real division/rounding chain. Forced
// categorical boundary cases used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-187-irrbb-csrbb-scope-checker.proptest.mjs

import { compute } from '../art-187-irrbb-csrbb-scope-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-187-irrbb-csrbb-scope-checker.fixtures.json');
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
const rand = mulberry32(0x18701);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;
const KNOWN_GAPS = new Set(['csrbb_methodology_defined', 'csrbb_included_in_icaap']);

function mkPP(rng) {
  return {
    instruments: {
      fvoci_afs_bonds: rng() < 0.3 ? 0 : randRange(rng, 0, 5000),
      fair_value_loans: rng() < 0.3 ? 0 : randRange(rng, 0, 5000),
      liquidity_buffer_bonds: rng() < 0.3 ? 0 : randRange(rng, 0, 5000),
    },
    governance: {
      csrbb_methodology_defined: rng() < 0.5,
      csrbb_included_in_icaap: rng() < 0.5,
    },
  };
}

// ---------- P1: monotone -- setting a governance flag true can only remove, never add, that gap ----------
function checkP1_monotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const better = { instruments: pp.instruments, governance: { csrbb_methodology_defined: true, csrbb_included_in_icaap: true } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(better).output_payload;
    checked++;
    if (r2.gaps.length > r1.gaps.length) violations++;
  }
  return { name: 'P1_monotone_full_governance_never_worsens_gaps', trials: checked, violations };
}

// ---------- P2: boundedness -- gaps drawn only from the known set of 2; conformant iff gaps empty when in scope ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.gaps.length > 2) violations++;
    for (const g of r.gaps) if (!KNOWN_GAPS.has(g)) violations++;
    const expConformant = r.in_scope ? r.gaps.length === 0 : true;
    if (r.csrbb_conformant !== expConformant) violations++;
    if (r.in_scope !== (r.in_scope_amount > 0)) violations++;
  }
  return { name: 'P2_boundedness_gaps_known_set_and_conformant_iff_empty', trials: checked, violations };
}

// ---------- P3: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ instruments: { fvoci_afs_bonds: 0, fair_value_loans: 0, liquidity_buffer_bonds: 0 }, governance: {} }, 'all-zero instruments -- out of scope, conformant by vacuous truth'],
  [{ instruments: { fvoci_afs_bonds: 0.0001 }, governance: {} }, 'smallest-possible positive in-scope amount -- must be in scope with both gaps'],
  [{ instruments: { fair_value_loans: 500 }, governance: { csrbb_methodology_defined: true, csrbb_included_in_icaap: true } }, 'in-scope with both governance flags set -- conformant, no gaps'],
  [{ instruments: { liquidity_buffer_bonds: 500 }, governance: { csrbb_methodology_defined: true, csrbb_included_in_icaap: false } }, 'in-scope with one gap missing -- single-item gaps array'],
  [{ instruments: { fvoci_afs_bonds: -500 }, governance: {} }, 'negative instrument amount -- must not throw, in_scope_amount can be negative (not clamped)'],
  [{}, 'all-empty input -- defaults to 0/false, out of scope, conformant, no throw'],
  [{ instruments: { fvoci_afs_bonds: 100, fair_value_loans: 100, liquidity_buffer_bonds: 100 }, governance: { csrbb_methodology_defined: 'yes' } }, 'non-boolean truthy governance value -- strict === true check must treat it as false'],
];

function checkP3_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = typeof r.in_scope === 'boolean' && typeof r.csrbb_conformant === 'boolean' && Array.isArray(r.gaps)
      && Number.isFinite(r.in_scope_amount);
    rows.push({ label, pp, in_scope: r.in_scope, csrbb_conformant: r.csrbb_conformant, gaps: r.gaps, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotone());
results.properties.push(checkP2_boundedness());
results.boundary_forced = checkP3_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-187-irrbb-csrbb-scope-checker',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
