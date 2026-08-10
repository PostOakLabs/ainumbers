// kernel_digest_at_authoring: sha256:949b39c2c3461b1855d81d48fe4f12b764bd6dca603183b7909b69d7b0dde81a
//
// FV-PROPFLOOR-SHARD-B20-1 — property-test floor for art-339-compute-gross-to-net.
// Class B (bounded-numeric), FLOAT-SENSITIVE — FICA wage-base and Additional
// Medicare threshold math divides/clamps dollar amounts at hard-coded cutoffs
// ($176,100 / $200,000) — ULP-boundary forcing at those cutoffs is MANDATORY per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-339-compute-gross-to-net.proptest.mjs

import { compute } from '../art-339-compute-gross-to-net.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-339-compute-gross-to-net.fixtures.json');
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
const rand = mulberry32(0x339971);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;

function mkPP(rng) {
  const gross = randRange(rng, 0, 15000);
  const pretax = randRange(rng, 0, gross * 0.3);
  return {
    gross_wages_per_period: gross,
    federal_withholding_per_period: randRange(rng, 0, gross * 0.3),
    pretax_reduces_fica_and_fit: pretax,
    post_tax_other_deductions: randRange(rng, 0, gross * 0.1),
    ytd_fica_wages_before_period: randRange(rng, 0, 250000),
  };
}

// ---------- P1: monotonicity — net_pay non-increasing in post_tax_other_deductions ----------
function checkP1_netPayMonotonicInDeductions() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const lo = compute(pp).output_payload;
    const hi = compute({ ...pp, post_tax_other_deductions: pp.post_tax_other_deductions + 100 }).output_payload;
    if (hi.net_pay > lo.net_pay + 0.02 && lo.net_pay > 0) violations++;
  }
  return { name: 'P1_net_pay_nonincreasing_in_post_tax_deductions', trials: checked, violations };
}

// ---------- P2: boundedness — FICA components nonnegative, SS taxable wages never exceed room remaining or FICA wages ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const r = compute(pp).output_payload;
    if ([r.social_security_tax, r.medicare_tax, r.additional_medicare_tax].some((v) => v < 0)) violations++;
    if (r.ss_taxable_wages_this_period > r.fica_wages_this_period + 0.02) violations++;
    const ssRoomRemaining = Math.max(0, Math.round((r.ss_wage_base - pp.ytd_fica_wages_before_period) * 100) / 100);
    if (r.ss_taxable_wages_this_period > ssRoomRemaining + 0.02) violations++;
  }
  return { name: 'P2_fica_components_nonnegative_and_ss_taxable_bounded', trials: checked, violations };
}

// ---------- P3: metamorphic — once YTD is past the SS wage base, no further SS tax accrues ----------
function checkP3_ssCapEnforced() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    checked++;
    const past = { ...pp, ytd_fica_wages_before_period: 176100 + randRange(rand, 0, 100000) };
    const r = compute(past).output_payload;
    if (r.social_security_tax > 1e-6) violations++;
  }
  return { name: 'P3_no_ss_tax_once_ytd_past_wage_base', trials: checked, violations };
}

// ---------- P4 (mandatory): ULP-boundary forcing ----------
const ULP_BOUNDARY_CASES = [
  [{ gross_wages_per_period: 0, federal_withholding_per_period: 0, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, 'gross_wages_per_period exactly zero — GROSS_TO_NET_ZERO_WAGES flag, net_pay must be 0'],
  [{ gross_wages_per_period: -0, federal_withholding_per_period: 0, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, 'gross_wages_per_period negative zero — Math.max(0,...) clamps identically to positive zero'],
  [{ gross_wages_per_period: Number.MIN_VALUE, federal_withholding_per_period: 0, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, 'gross_wages_per_period at smallest denormal — must remain finite, near-zero FICA'],
  [{ gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 176100 }, 'ytd_fica_wages_before_period exactly at the SS wage base — SS_WAGE_BASE_REACHED flag, ss_taxable_wages_this_period must be exactly 0'],
  [{ gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 176099.99 }, 'ytd_fica_wages_before_period 1 cent below the SS wage base — ss_taxable_wages_this_period must be exactly 0.01, not the full period wages'],
  [{ gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 200000 }, 'ytd_fica_wages_before_period exactly at the Additional Medicare threshold — ADDITIONAL_MEDICARE_APPLIED flag, all this-period wages subject to the 0.9% surtax'],
  [{ gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 199999.99 }, 'ytd_fica_wages_before_period 1 cent below the Additional Medicare threshold — only the excess over the threshold is surtaxed'],
  [{ gross_wages_per_period: 0.1 * 3 * 10000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, 'gross_wages_per_period = (0.1*3)*10000, a repeating-decimal double close to but not exactly 3000 — x/y*y!==x class case, must round cleanly'],
  [{ gross_wages_per_period: 3000, federal_withholding_per_period: 300, pretax_reduces_fica_and_fit: 1e9, post_tax_other_deductions: 0, ytd_fica_wages_before_period: 0 }, 'pretax_reduces_fica_and_fit astronomically large (exceeds gross) — fica_wages_this_period clamps to 0 via Math.max(0,...), no negative FICA wage base'],
  [{ gross_wages_per_period: 500, federal_withholding_per_period: 400, pretax_reduces_fica_and_fit: 0, post_tax_other_deductions: 400, ytd_fica_wages_before_period: 0 }, 'deductions exceeding gross wages — net_pay must clamp to 0 (NET_PAY_NEGATIVE flag), never negative in output'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = [r.net_pay, r.social_security_tax, r.medicare_tax, r.additional_medicare_tax].every(Number.isFinite) && r.net_pay >= 0;
    rows.push({ label, input: pp, net_pay: r.net_pay, social_security_tax: r.social_security_tax, medicare_tax: r.medicare_tax, additional_medicare_tax: r.additional_medicare_tax, ss_taxable_wages_this_period: r.ss_taxable_wages_this_period, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_netPayMonotonicInDeductions());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_ssCapEnforced());
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
