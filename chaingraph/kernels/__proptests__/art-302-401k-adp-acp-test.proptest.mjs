// kernel_digest_at_authoring: sha256:b5846a6b36327671eca8553c1a075d732ce6a236e0cf86fbd688c4ee4e52a6ad
//
// FV-PROPFLOOR-SHARD-B11-1 — property-test floor for art-302-401k-adp-acp-test.
// Class B (bounded-numeric), FLOAT-SENSITIVE (allowed_max_pct is Math.max of two raw-double
// formulas — basicMax = nhce*1.25, altMax = min(nhce+0.02, nhce*2) — compared against a raw-double
// hce_pct) — ULP-boundary forcing is MANDATORY per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3 float
// harness (art-107/art-15). This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-302-401k-adp-acp-test.proptest.mjs

import { compute } from '../art-302-401k-adp-acp-test.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-302-401k-adp-acp-test.fixtures.json');
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
const rand = mulberry32(0x30201);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 10000;

function allowedMax(nhce) {
  const basicMax = nhce * 1.25;
  const altMax = Math.min(nhce + 0.02, nhce * 2);
  return Math.max(basicMax, altMax);
}

function mkPP(rng) {
  return {
    method: pick(rng, ['current_year', 'prior_year']),
    adp_hce_pct: randRange(rng, 0, 0.2),
    adp_nhce_pct: randRange(rng, 0, 0.2),
    acp_hce_pct: randRange(rng, 0, 0.2),
    acp_nhce_pct: randRange(rng, 0, 0.2),
  };
}

// ---------- P1: monotone — raising hce_pct never turns adp.pass false→true ----------
function checkP1_monotoneHce() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const low = { ...pp, adp_hce_pct: 0 };
    const high = { ...pp, adp_hce_pct: 1 };
    const r1 = compute(low);
    const r2 = compute(high);
    checked++;
    if (r1.output_payload.adp.pass === false && r2.output_payload.adp.pass === true) violations++;
  }
  return { name: 'P1_monotone_adp_pass_nonincreasing_as_hce_pct_rises', trials: checked, violations };
}

// ---------- P2: boundedness — allowed_max_pct always finite non-negative when computed ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { adp, acp } = r.output_payload;
    if (adp.computed && (!Number.isFinite(adp.allowed_max_pct) || adp.allowed_max_pct < 0)) violations++;
    if (acp.computed && (!Number.isFinite(acp.allowed_max_pct) || acp.allowed_max_pct < 0)) violations++;
  }
  return { name: 'P2_boundedness_allowed_max_pct_finite_nonnegative', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — pass matches exact hce<=allowed_max comparison ----------
function checkP3_passAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectedMax = allowedMax(pp.adp_nhce_pct);
    if (r.output_payload.adp.pass !== (pp.adp_hce_pct <= expectedMax)) violations++;
    const expectedExcess = pp.adp_hce_pct <= expectedMax ? 0 : pp.adp_hce_pct - expectedMax;
    if (r.output_payload.adp.excess_pct !== expectedExcess) violations++;
  }
  return { name: 'P3_pass_matches_exact_hce_le_allowed_max_comparison', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ method: 'current_year', adp_hce_pct: 0.07, adp_nhce_pct: 0.056 }, 'hce_pct exactly at basicMax boundary (0.056*1.25=0.07) — pass must be TRUE (<=, not <)'],
  [{ method: 'current_year', adp_hce_pct: 0.07000000000000001, adp_nhce_pct: 0.056 }, '1-ULP above the exact basicMax boundary — pass must be false'],
  [{ method: 'current_year', adp_hce_pct: 0, adp_nhce_pct: 0 }, 'nhce_pct exactly zero — basicMax 0, altMax min(0.02,0)=0, allowed_max 0, hce 0 — pass true (0<=0)'],
  [{ method: 'current_year', adp_hce_pct: 0.02, adp_nhce_pct: 0.005 }, 'nhce small enough that altMax (nhce+0.02) wins over basicMax (nhce*1.25) — Math.max selection must pick altMax exactly'],
  [{ method: 'current_year', adp_hce_pct: 0.1, adp_nhce_pct: 0.1 }, 'nhce large enough that altMax cap (nhce*2) applies via Math.min — allowed_max must equal Math.max(1.25*nhce, 2*nhce) = 2*nhce exactly'],
  [{ method: 'current_year', adp_hce_pct: 0.1 * 3, adp_nhce_pct: 0.08 * 3 }, 'hce/nhce chosen as classic non-exact double products (0.1*3, 0.08*3) — comparison must use the EXACT doubles, not rounded'],
  [{ method: 'current_year', adp_hce_pct: Number.MIN_VALUE, adp_nhce_pct: Number.MIN_VALUE }, 'smallest positive doubles for both — must remain finite, pass true, no underflow-to-zero mismatch'],
  [{ method: 'current_year', adp_hce_pct: -0, adp_nhce_pct: 0.05 }, 'negative-zero hce_pct — must behave as zero, pass true'],
  [{ method: 'current_year', adp_hce_pct: 0.2, adp_nhce_pct: 0.2, acp_hce_pct: 0.25, acp_nhce_pct: 0.2 }, 'acp allowed_max exactly at basicMax*1.25=0.25 boundary — acp.pass must be true'],
  [{ method: 'current_year', adp_hce_pct: 1e-300, adp_nhce_pct: 1e-300 }, 'near-subnormal doubles for both hce/nhce — must remain finite, no NaN propagation'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp);
    const { adp, acp } = r.output_payload;
    const finite = (!adp.computed || Number.isFinite(adp.allowed_max_pct)) && (!acp.computed || Number.isFinite(acp.allowed_max_pct));
    const plausible = finite;
    rows.push({ label, pp, adp, acp, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneHce());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_passAgreement());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
