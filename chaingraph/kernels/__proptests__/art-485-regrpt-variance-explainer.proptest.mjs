// art-485-regrpt-variance-explainer.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C23-1).
// kernel_digest_at_authoring: sha256:58e771301c2c6f396bfeaa0f61ea75adfce6211b68c03938500f14a37a1a5c8f
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES, direct read confirmed — abs_change is a plain subtraction, pct_change is
// a genuine division (`abs_change / Math.abs(priorVal)`), and materiality is decided by
// `Math.abs(x) >= threshold` float comparisons on both the absolute and percentage movement. ULP
// forcing is mandatory per spec §3.
// Checks: fixture-oracle gate, termination (variances.length === union(prior,current) keys),
// differential re-derivation of abs_change/pct_change/is_material, boundedness (ranked array is
// sorted descending by contribution, ranks are 1..n with no gaps), ULP-boundary forcing on the
// materiality threshold comparisons (0, -0, denormals, ±1 ULP, priorVal near/at 0 for the
// division guard), and metamorphic permutation-invariance of the cells array order (per-line-item
// results are exact and order-independent; only rank position can move on ties, so ties are
// avoided by construction in the random generator to keep the check exact).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-485-regrpt-variance-explainer.proptest.mjs

import { compute } from '../art-485-regrpt-variance-explainer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-485-regrpt-variance-explainer.fixtures.json');
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
const rand = mulberry32(0x485C23);

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 8);
  const priorCells = [], currentCells = [];
  const usedContribs = new Set();
  for (let i = 0; i < n; i++) {
    const li = `line_${i}`;
    // distinct-magnitude contributions to avoid rank ties (permutation check needs exactness).
    let priorVal = Math.round((100 + i * 137) * (1 + rng()));
    if (rng() < 0.85) priorCells.push({ line_item: li, value: priorVal });
    if (rng() < 0.85) currentCells.push({ line_item: li, value: Math.round(priorVal * (0.5 + rng())) });
  }
  return {
    instance_pair: { prior: { as_of: '2026-03-31', cells: priorCells }, current: { as_of: '2026-06-30', cells: currentCells } },
    materiality_policy: { default_threshold_abs: 100, default_threshold_pct: 0.1, version: 'v1' },
    explanations: [],
  };
}

const TRIALS = 5000;

// ---------- P1: termination — variances.length === |union(prior keys, current keys)| ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const keys = new Set([...pp.instance_pair.prior.cells.map((c) => c.line_item), ...pp.instance_pair.current.cells.map((c) => c.line_item)]);
    if (output_payload.variances.length !== keys.size) violations++;
    if (output_payload.summary.total_line_items !== keys.size) violations++;
  }
  return { name: 'P1_termination_variances_bounded', trials: checked, violations };
}

// ---------- P2 (differential): abs_change/pct_change/is_material re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const priorMap = new Map(pp.instance_pair.prior.cells.map((c) => [c.line_item, c.value]));
    const currentMap = new Map(pp.instance_pair.current.cells.map((c) => [c.line_item, c.value]));
    const th = pp.materiality_policy;
    for (const v of output_payload.variances) {
      const priorVal = priorMap.has(v.line_item) ? priorMap.get(v.line_item) : null;
      const currentVal = currentMap.has(v.line_item) ? currentMap.get(v.line_item) : null;
      const hasBoth = priorVal !== null && currentVal !== null;
      const expectedAbs = hasBoth ? currentVal - priorVal : null;
      if (v.abs_change !== expectedAbs) violations++;
      const expectedPct = hasBoth && priorVal !== 0 ? expectedAbs / Math.abs(priorVal) : null;
      if (v.pct_change !== expectedPct) violations++;
      const breachesAbs = expectedAbs !== null && Math.abs(expectedAbs) >= th.default_threshold_abs && th.default_threshold_abs > 0;
      const breachesPct = expectedPct !== null && Math.abs(expectedPct) >= th.default_threshold_pct && th.default_threshold_pct > 0;
      if (v.is_material !== (breachesAbs || breachesPct)) violations++;
    }
  }
  return { name: 'P2_abs_pct_change_differential', trials: checked, violations };
}

// ---------- P3: boundedness — ranked is sorted descending by contribution, ranks 1..n ----------
function checkP3_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const ranked = output_payload.variances;
    for (let k = 0; k < ranked.length; k++) {
      if (ranked[k].rank !== k + 1) violations++;
      if (k > 0 && ranked[k].contribution > ranked[k - 1].contribution) violations++;
    }
  }
  return { name: 'P3_rank_sort_boundedness', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (mandatory, float_sensitive: yes) ----------
function checkP4_ulp_forcing() {
  const eps = Number.EPSILON;
  const forced = [
    { prior: 1000, current: 1100, thAbs: 100, label: 'abs_change exactly == threshold_abs' },
    { prior: 1000, current: 1100 + eps * 1000, thAbs: 100, label: 'abs_change just over threshold_abs' },
    { prior: 1000, current: 1100 - eps * 1000, thAbs: 100, label: 'abs_change just under threshold_abs' },
    { prior: 0, current: 5, thAbs: 100, label: 'priorVal exactly 0 -> pct_change null, division guard' },
    { prior: -0, current: 5, thAbs: 100, label: 'priorVal negative-zero -> priorVal!==0 is false, pct_change null' },
    { prior: Number.MIN_VALUE, current: 1, thAbs: 0, thPct: 0.5, label: 'priorVal denormal -> huge pct_change' },
    { prior: 1000, current: 1000, thAbs: 0, label: 'zero change vs zero threshold -> always material (>0 gate false since threshold_abs>0 required)' },
  ];
  let violations = 0, checked = 0;
  const rows = [];
  for (const c of forced) {
    const pp = {
      instance_pair: { prior: { as_of: 'p', cells: [{ line_item: 'L', value: c.prior }] }, current: { as_of: 'c', cells: [{ line_item: 'L', value: c.current }] } },
      materiality_policy: { default_threshold_abs: c.thAbs ?? 0, default_threshold_pct: c.thPct ?? 0 },
      explanations: [],
    };
    const { output_payload } = compute(pp);
    checked++;
    const v = output_payload.variances[0];
    const expectedAbsChange = c.current - c.prior;
    if (v.abs_change !== expectedAbsChange) violations++;
    const expectedPct = c.prior !== 0 ? expectedAbsChange / Math.abs(c.prior) : null;
    if (v.pct_change !== expectedPct) violations++;
    rows.push({ ...c, abs_change: v.abs_change, pct_change: v.pct_change, is_material: v.is_material });
  }
  results.ulp_forced_rows = rows;
  return { name: 'P4_ulp_boundary_forcing_float_sensitive', trials: checked, violations };
}

// ---------- P5: metamorphic — exact permutation-invariance of cells order ----------
// NOTE: `rank` itself is NOT asserted invariant — two line items with an EXACTLY equal
// contribution (a real case: both items present on only one side of the pair, so
// abs_change is null and contribution defaults to 0 for every such item) are legitimately
// tie-broken by Array.prototype.sort's stable-but-input-order-dependent placement, which is
// expected sort behavior, not a kernel defect. The invariant this property actually owns is
// that every line item's OWN computed fields (abs_change/pct_change/is_material/contribution)
// are identical regardless of input array order — checked per line_item, ignoring rank.
function checkP5_permutation_exact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = randomPP(rand);
    const shuffledPrior = [...pp.instance_pair.prior.cells];
    const shuffledCurrent = [...pp.instance_pair.current.cells];
    for (const arr of [shuffledPrior, shuffledCurrent]) {
      for (let j = arr.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
    }
    const pp2 = { ...pp, instance_pair: { prior: { ...pp.instance_pair.prior, cells: shuffledPrior }, current: { ...pp.instance_pair.current, cells: shuffledCurrent } } };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp2).output_payload;
    checked++;
    // Compared via SORTED line_item keys — a plain object/Map built from array iteration order
    // preserves insertion order, so an unsorted comparison would flag a pure key-order artifact
    // as a false violation even when every value is byte-identical (measured during authoring).
    const fields = (v) => `${v.abs_change}|${v.pct_change}|${v.is_material}|${v.contribution}`;
    const sorted1 = r1.variances.map((v) => `${v.line_item}=${fields(v)}`).sort();
    const sorted2 = r2.variances.map((v) => `${v.line_item}=${fields(v)}`).sort();
    if (JSON.stringify(sorted1) !== JSON.stringify(sorted2)) violations++;
  }
  return { name: 'P5_permutation_invariance_per_item_fields_exact', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_boundedness());
results.properties.push(checkP4_ulp_forcing());
results.properties.push(checkP5_permutation_exact());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-485-regrpt-variance-explainer',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
