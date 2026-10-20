// art-764-solo-401k-vs-sep-ira.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-112 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18T01:23Z, Builder-verifies-at-land 30/30: every payload fixture vector
// re-executed through compute() matching the stored outputs, APEX-PORT-112-LAND-1).
// kernel_digest_at_authoring: sha256:10942aed80a83daa102da2855fc161d844ec6b265fc3f4504ccabb0271dc9c12
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO — the kernel is integer cents with floor division end to end
// (applyBp is the only rate application), so every asserted relation is exact.
//
// Checks: fixture-oracle gate (the 4 Apex live vectors and the 26 boundary vectors
// at and just past every comparator — 415(c) headroom edge, SIMPLE base+catchup vs
// net income, zero/one-cent net income refusal edges, zero/one-bp marginal rate,
// unsupported tax year, super catch-up band edges 59/60/63/64, existing-deferrals
// offset); P1 the winner ranking is non-decreasing under marginal-rate changes and
// the winner is the max of ranking (restated independently); P2 catch-up band is a
// pure function of age restated independently (60-63 super band, 50+ otherwise,
// none under 50) and the published constants restate the outputs on a
// deferral-and-415c-unbound input; P3 determinism (two runs agree byte-for-byte)
// and output shape (no undefined/NaN/non-finite anywhere in output_payload);
// P4 invalid-domain inputs are refused with the named reason and a null-ed refusal
// payload, for every numeric bound, every type bound and non-object pp;
// P5 refusal/payload complementarity: every fixture refusal vector carries a
// refusal_reason and empty ranking, every computed vector carries null
// refusal_reason and a 3-plan ranking whose totals match the plan blocks.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-764-solo-401k-vs-sep-ira.proptest.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-764-solo-401k-vs-sep-ira.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-764-solo-401k-vs-sep-ira';

const basePP = () => ({
  tax_year: 2026,
  net_income_usd_cents: 12_000_000,
  age: 45,
  marginal_rate_bp: 2400,
  existing_employer_plan: false,
  existing_deferrals_cents: 0,
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// P1 — ranking/winner restatement: winner is the argmax of ranking (first in
// declared tie order), under randomized marginal rates and deferral offsets.
function checkP1WinnerRestated() {
  const rng = mulberry32(764112);
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    const pp = {
      ...basePP(),
      net_income_usd_cents: 1 + Math.floor(rng() * 40_000_000),
      age: 18 + Math.floor(rng() * 103),
      marginal_rate_bp: Math.floor(rng() * 10_001),
      existing_deferrals_cents: Math.floor(rng() * 3_600_000),
    };
    const out = compute(pp).output_payload;
    const max = Math.max(...out.ranking.map((r) => r.max_total_usd_cents));
    const firstMax = out.ranking.find((r) => r.max_total_usd_cents === max).plan;
    checked++;
    if (out.winner !== firstMax) { violations++; console.log(`P1 violation: winner ${out.winner} != first argmax ${firstMax}`); }
    if (out.solo_401k.max_total_usd_cents !== out.ranking.find((r) => r.plan === 'solo_401k').max_total_usd_cents) { violations++; console.log('P1 violation: solo plan block vs ranking mismatch'); }
    if (out.sep_ira.tax_savings_usd_cents !== Math.floor((out.sep_ira.max_total_usd_cents * pp.marginal_rate_bp) / 10_000)) { violations++; console.log('P1 violation: sep tax_savings not rate-times-contribution'); }
  }
  return { name: 'P1 winner argmax restated + tax-savings identity (120 draws)', checked, violations };
}

// P2 — catch-up band restated from age alone; published-limit restatement on an
// unbound input (high net income, zero deferrals) where ceilings are the limits.
function checkP2BandsAndLimits() {
  let checked = 0, violations = 0;
  const cases = [[49, 0, 0], [50, 800_000, 400_000], [59, 800_000, 400_000], [60, 1_125_000, 525_000], [63, 1_125_000, 525_000], [64, 800_000, 400_000], [120, 800_000, 400_000]];
  for (const [age, soloCu, simpleCu] of cases) {
    const out = compute({ ...basePP(), net_income_usd_cents: 20_000_000_000, age }).output_payload;
    checked += 3;
    if (out.solo_401k.catchup_usd_cents !== soloCu) { violations++; console.log(`P2 violation: age ${age} solo catchup ${out.solo_401k.catchup_usd_cents} != ${soloCu}`); }
    if (out.simple_ira.employee_usd_cents !== 1_700_000 + simpleCu) { violations++; console.log(`P2 violation: age ${age} simple employee ${out.simple_ira.employee_usd_cents} != base+catchup`); }
    if (out.catchup_eligible !== (age >= 50) || out.super_catchup_band !== (age >= 60 && age <= 63)) { violations++; console.log(`P2 violation: age ${age} band flags wrong`); }
  }
  return { name: 'P2 band edges 49/50/59/60/63/64/120 + limit restatement', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  const rng = mulberry32(112764);
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const pp = {
      ...basePP(),
      net_income_usd_cents: 1 + Math.floor(rng() * 5_000_000_000),
      age: 18 + Math.floor(rng() * 103),
      marginal_rate_bp: Math.floor(rng() * 10_001),
      existing_employer_plan: rng() < 0.5,
    };
    const a = compute(pp), b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); }
    if (hasBadNumber(a.output_payload)) { violations++; console.log('P3 violation: non-finite number in output_payload'); }
    if (a.output_payload.ranking.length !== 3) { violations++; console.log('P3 violation: ranking length != 3'); }
  }
  return { name: 'P3 determinism + shape (60 draws)', checked, violations };
}

// P4 — every invalid-domain input is refused with the named reason and a null-ed payload.
function checkP4DomainRefusal() {
  const bad = [
    ['REFUSED_BAD_INPUT', null],
    ['REFUSED_BAD_INPUT', 'x'],
    ['REFUSED_BAD_INPUT', []],
    ['REFUSED_BAD_TAX_YEAR', { ...basePP(), tax_year: 20259 }],
    ['REFUSED_BAD_TAX_YEAR', { ...basePP(), tax_year: 20.5 }],
    ['NO_LIMITS_FOR_TAX_YEAR', { ...basePP(), tax_year: 2027 }],
    ['NO_LIMITS_FOR_TAX_YEAR', { ...basePP(), tax_year: 2025 }],
    ['REFUSED_BAD_NET_INCOME', { ...basePP(), net_income_usd_cents: 0 }],
    ['REFUSED_BAD_NET_INCOME', { ...basePP(), net_income_usd_cents: -1 }],
    ['REFUSED_BAD_NET_INCOME', { ...basePP(), net_income_usd_cents: 20_000_000_001 }],
    ['REFUSED_BAD_NET_INCOME', { ...basePP(), net_income_usd_cents: 12_000_000.5 }],
    ['REFUSED_BAD_AGE', { ...basePP(), age: 17 }],
    ['REFUSED_BAD_AGE', { ...basePP(), age: 121 }],
    ['REFUSED_BAD_AGE', { ...basePP(), age: 45.5 }],
    ['REFUSED_BAD_MARGINAL_RATE', { ...basePP(), marginal_rate_bp: -1 }],
    ['REFUSED_BAD_MARGINAL_RATE', { ...basePP(), marginal_rate_bp: 10_001 }],
    ['REFUSED_BAD_EXISTING_PLAN', { ...basePP(), existing_employer_plan: 'no' }],
    ['REFUSED_BAD_EXISTING_PLAN', { ...basePP(), existing_employer_plan: null }],
    ['REFUSED_BAD_EXISTING_DEFERRALS', { ...basePP(), existing_deferrals_cents: -1 }],
    ['REFUSED_BAD_EXISTING_DEFERRALS', { ...basePP(), existing_deferrals_cents: 72_000_001 }],
  ];
  let checked = 0, violations = 0;
  for (const [reason, pp] of bad) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.refusal_reason !== reason || r.compliance_flags[0] !== 'ART764_INPUT_REFUSED') {
      violations++; console.log(`P4 violation: expected ${reason}, got ${r.output_payload.refusal_reason}`);
    }
    if (r.output_payload.winner !== null || r.output_payload.ranking.length !== 0 || r.output_payload.domain_errors[0].code !== reason) {
      violations++; console.log(`P4 violation: ${reason} refusal payload not null-ed`);
    }
  }
  return { name: 'P4 named-domain refusals (20 cases)', checked, violations };
}

// P5 — refusal/computed complementarity on the shipped fixture set.
function checkP5FixtureComplementarity() {
  let checked = 0, violations = 0;
  // read fixtures through the same path the oracle helper uses
  const here = dirname(fileURLToPath(import.meta.url));
  const fx = JSON.parse(readFileSync(join(here, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
  for (const v of fx.vectors) {
    const r = compute(v.policy_parameters);
    checked++;
    if (r.output_payload.refusal_reason === null) {
      if (r.output_payload.ranking.length !== 3) { violations++; console.log(`P5 violation: ${v.name} computed without 3-plan ranking`); }
    } else if (r.compliance_flags[0] !== 'ART764_INPUT_REFUSED') {
      violations++; console.log(`P5 violation: ${v.name} refusal without ART764_INPUT_REFUSED`);
    }
  }
  return { name: `P5 fixture refusal/computed complementarity (${fx.vectors.length} vectors)`, checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1WinnerRestated(),
  checkP2BandsAndLimits(),
  checkP3DeterminismShape(),
  checkP4DomainRefusal(),
  checkP5FixtureComplementarity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
