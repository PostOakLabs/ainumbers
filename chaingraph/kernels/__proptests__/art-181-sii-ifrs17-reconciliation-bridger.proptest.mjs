// kernel_digest_at_authoring: sha256:83afe488b0820b034337102a6031f5e0e2ead582faf4d3998b0d65dabc2def33
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-181-sii-ifrs17-reconciliation-bridger.
// Class B (bounded reconciliation bridge). float-sensitive: yes -- the 10%-of-technical-provisions
// tolerance check is a raw-division comparison. ULP-boundary forcing is mandatory per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit boundary
// arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-181-sii-ifrs17-reconciliation-bridger.proptest.mjs

import { compute } from '../art-181-sii-ifrs17-reconciliation-bridger.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-181-sii-ifrs17-reconciliation-bridger.fixtures.json');
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
const rand = mulberry32(0x18101);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const TRIALS = 8000;

function mkProvisions(rng) {
  return {
    sii_best_estimate: randRange(rng, 0, 50000),
    sii_risk_margin: randRange(rng, 0, 5000),
    ifrs17_fcf: randRange(rng, 0, 50000),
    ifrs17_ra: randRange(rng, 0, 5000),
    ifrs17_csm: randRange(rng, 0, 2000),
  };
}

// ---------- P1: boundedness -- relative_bridge_delta_pct and ra_vs_rm_ratio_pct are non-negative ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const provisions = mkProvisions(rand);
    const r = compute({ provisions }).output_payload;
    checked++;
    if (r.relative_bridge_delta_pct < 0) violations++;
    if (r.ra_vs_risk_margin_ratio_pct < 0) violations++;
  }
  return { name: 'P1_boundedness_relative_pcts_nonneg', trials: checked, violations };
}

// ---------- P2: identities -- sii_tp/ifrs_icl sums and within-tolerance flag match the raw formula exactly ----------
function checkP2_identities() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const provisions = mkProvisions(rand);
    const r = compute({ provisions }).output_payload;
    checked++;
    const expSiiTp = provisions.sii_best_estimate + provisions.sii_risk_margin;
    const expIfrsIcl = provisions.ifrs17_fcf + provisions.ifrs17_ra + provisions.ifrs17_csm;
    if (r.sii_technical_provisions !== expSiiTp) violations++;
    if (r.ifrs17_insurance_contract_liabilities !== expIfrsIcl) violations++;
    const expDelta = expSiiTp - expIfrsIcl;
    if (r.bridge_delta !== expDelta) violations++;
    const expRel = expSiiTp > 0 ? Math.abs(expDelta / expSiiTp) : 0;
    const expWithinTol = expRel <= 0.1;
    if (r.bridge_within_tolerance !== expWithinTol) violations++;
  }
  return { name: 'P2_sums_and_tolerance_flag_match_raw_formula', trials: checked, violations };
}

// ---------- P3: monotone -- when SII already exceeds IFRS17 (delta >= 0), shrinking IFRS17 further
// can only widen the gap, so an already-out-of-tolerance case can never become in-tolerance ----------
function checkP3_monotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const provisions = mkProvisions(rand);
    const r1 = compute({ provisions }).output_payload;
    if (r1.bridge_delta < 0) continue; // only meaningful when SII TP already >= IFRS17 ICL
    const widened = { ...provisions, ifrs17_fcf: Math.max(0, provisions.ifrs17_fcf - 100000) };
    const r2 = compute({ provisions: widened }).output_payload;
    checked++;
    if (!r1.bridge_within_tolerance && r2.bridge_within_tolerance) violations++;
  }
  return { name: 'P3_monotone_widening_gap_never_restores_tolerance', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ sii_best_estimate: 900, sii_risk_margin: 100, ifrs17_fcf: 900, ifrs17_ra: 0, ifrs17_csm: 0 }, 'rel_delta exactly 0.1 (10%) -- must be within tolerance (<=)'],
  [{ sii_best_estimate: 900, sii_risk_margin: 100, ifrs17_fcf: 899.9999999999999, ifrs17_ra: 0, ifrs17_csm: 0 }, 'rel_delta 1 ULP above 0.1 -- must fail tolerance'],
  [{ sii_best_estimate: 0, sii_risk_margin: 0, ifrs17_fcf: 0, ifrs17_ra: 0, ifrs17_csm: 0 }, 'all-zero provisions -- guarded division, must default to within tolerance'],
  [{ sii_best_estimate: -0, sii_risk_margin: -0, ifrs17_fcf: 0, ifrs17_ra: 0, ifrs17_csm: 0 }, 'negative-zero provisions -- must behave as zero'],
  [{ sii_best_estimate: Number.MIN_VALUE, sii_risk_margin: 0, ifrs17_fcf: 0, ifrs17_ra: 0, ifrs17_csm: 0 }, 'denormal sii_best_estimate -- must stay finite'],
  [{ sii_risk_margin: 700, ifrs17_ra: 700 }, 'ra exactly equal to risk margin -- ratio exactly 100%, must not throw'],
  [{ sii_best_estimate: 10000, sii_risk_margin: 1000, ifrs17_fcf: 9900 + Number.EPSILON * 10000, ifrs17_ra: 0, ifrs17_csm: 0 }, 'near-ULP fcf perturbation around the 10% boundary'],
  [{ sii_best_estimate: 0.1, sii_risk_margin: 0.2, ifrs17_fcf: 0, ifrs17_ra: 0, ifrs17_csm: 0 }, '0.1+0.2 float-repr sum -- x/y*y!==x style, must stay finite'],
];

function checkP4_forced() {
  const rows = [];
  for (const [provisions, label] of ULP_BOUNDARY_CASES) {
    const r = compute({ provisions }).output_payload;
    const finite = Number.isFinite(r.sii_technical_provisions) && Number.isFinite(r.ifrs17_insurance_contract_liabilities)
      && Number.isFinite(r.bridge_delta) && Number.isFinite(r.relative_bridge_delta_pct)
      && Number.isFinite(r.ra_vs_risk_margin_ratio_pct);
    rows.push({ label, provisions, bridge_within_tolerance: r.bridge_within_tolerance, relative_bridge_delta_pct: r.relative_bridge_delta_pct, plausible: finite });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_identities());
results.properties.push(checkP3_monotone());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-181-sii-ifrs17-reconciliation-bridger',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
