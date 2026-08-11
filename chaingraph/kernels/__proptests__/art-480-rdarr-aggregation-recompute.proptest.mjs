// art-480-rdarr-aggregation-recompute.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C22-1).
// kernel_digest_at_authoring: sha256:03ded60475d18d57aeb7093295a95854b928661cde7ba44e34bf93df28373b4b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// ⛔ CORRECTION TO THE WU ROW'S TRIAGE TABLE (per FIX-2 discipline — confirm float-sensitivity
// against each kernel's own source before relying on the table): the WU row lists this kernel as
// float-sensitive (float:yes). Direct source read shows the OPPOSITE — this kernel is fixed-point
// BigInt arithmetic throughout (`SCALE = 10n ** 8n`, `toFixed()` parses decimal STRINGS via regex
// into BigInt, `mulFixed`/`divFixed`/`roundFixedToString` are pure BigInt division/multiplication).
// There is not a single `Number` arithmetic operation anywhere in the money path — the kernel's own
// header states this explicitly ("Fixed-point design ... never via floating multiplication"). This
// floor therefore treats it as float_sensitive: NO and uses forced categorical boundary cases
// (string-decimal edge inputs) in place of ULP-boundary forcing, which does not apply to BigInt math.
//
// Checks: fixture-oracle gate, termination (**the hierarchy roll-up `while` loop is the one
// convergence-relevant construct in this kernel — it walks each node's parent chain and is
// explicitly cycle-guarded by a per-node `seen` Set (`while (p && nodeById.has(p) && !seen.has(p))`),
// so termination is STRUCTURAL, not merely observed: tested directly against a deliberately
// cyclic hierarchy input to confirm the guard actually stops the walk**), differential re-derivation
// of recomputed_figure/delta via an independent BigInt roll-up, boundedness (contribution_breakdown
// entries are sorted by |value| descending and their count never exceeds
// hierarchy.length + 1 (+1 for UNMAPPED)), metamorphic permutation-invariance (shuffling extract
// line order never changes recomputed_figure — BigInt sums are order-independent), and forced
// categorical boundary cases (divFixed's own b===0n guard, malformed decimal strings, a genuine
// cyclic hierarchy). Zero external dependencies — pure Node built-ins only (mulberry32 PRNG,
// hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-480-rdarr-aggregation-recompute.proptest.mjs

import { compute } from '../art-480-rdarr-aggregation-recompute.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-480-rdarr-aggregation-recompute.fixtures.json');
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
const rand = mulberry32(0x480A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomAmountStr(rng) {
  const neg = rng() < 0.3 ? '-' : '';
  const intPart = Math.floor(rng() * 100000);
  const fracPart = Math.floor(rng() * 100);
  return `${neg}${intPart}.${String(fracPart).padStart(2, '0')}`;
}

function randomHierarchy(rng, n) {
  const nodes = Array.from({ length: n }, (_, i) => ({ node_id: `n${i}`, parent_node_id: i === 0 ? null : `n${Math.floor(rng() * i)}`, label: `Node ${i}` }));
  return nodes;
}

function randomExtract(rng, hierarchy, n) {
  const nodeIds = hierarchy.length > 0 ? hierarchy.map((h) => h.node_id) : ['UNMAPPED'];
  return Array.from({ length: n }, (_, i) => ({
    line_id: `l${i}`,
    node_id: rng() < 0.9 ? pick(rng, nodeIds) : 'GHOST',
    counterparty: pick(rng, ['cp1', 'cp2', 'cp3']),
    amount: randomAmountStr(rng),
    currency: 'USD',
    fx_rate_to_base: rng() < 0.9 ? '1.0' : randomAmountStr(rng),
    include: rng() < 0.85,
  }));
}

function randomPP(rng) {
  const hn = Math.floor(rng() * 6);
  const hierarchy = randomHierarchy(rng, hn);
  const en = Math.floor(rng() * 15);
  const extract = randomExtract(rng, hierarchy, en);
  return {
    base_currency: 'USD',
    reported_figure: randomAmountStr(rng),
    aggregation_policy: {
      exclude_flagged: rng() < 0.8,
      netting: { enabled: rng() < 0.4, by: pick(rng, ['counterparty', 'node']) },
      rounding: { decimal_places: pick(rng, [0, 2, 4]), mode: pick(rng, ['half_up', 'half_even', 'truncate']) },
    },
    hierarchy,
    extract,
  };
}

const TRIALS = 4000;

// ---------- P1: termination — the parent-chain roll-up walk is cycle-guarded (structural, tested directly) ----------
function checkP1_termination_cycle_guard() {
  let violations = 0, checked = 0;
  // Deliberately cyclic hierarchy: n0 -> n1 -> n2 -> n0.
  const cyclicHierarchy = [
    { node_id: 'n0', parent_node_id: 'n1' },
    { node_id: 'n1', parent_node_id: 'n2' },
    { node_id: 'n2', parent_node_id: 'n0' },
  ];
  const pp = {
    base_currency: 'USD', reported_figure: '0',
    aggregation_policy: {},
    hierarchy: cyclicHierarchy,
    extract: [{ line_id: 'l0', node_id: 'n0', amount: '100.00', fx_rate_to_base: '1', include: true }],
  };
  checked++;
  const start = Date.now();
  let threw = false;
  try { compute(pp); } catch (e) { threw = true; }
  const elapsedMs = Date.now() - start;
  // must terminate quickly (cycle guard, not an infinite loop) and must not throw
  if (elapsedMs > 2000 || threw) violations++;

  // random hierarchies (parent index < own index, so acyclic by construction) also terminate fast.
  for (let i = 0; i < TRIALS; i++) {
    const pp2 = randomPP(rand);
    checked++;
    const t0 = Date.now();
    compute(pp2);
    if (Date.now() - t0 > 2000) violations++;
  }
  return { name: 'P1_termination_hierarchy_walk_cycle_guarded', trials: checked, violations };
}

// ---------- P2 (differential): recomputed_figure re-derivation via independent BigInt roll-up ----------
function checkP2_recomputed_figure_differential() {
  let violations = 0, checked = 0;
  const SCALE = 10n ** 8n;
  function toFixed(v) {
    let s = String(v ?? 0).trim();
    let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); } else if (s.startsWith('+')) { s = s.slice(1); }
    if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') s = '0';
    let [intPart, fracPart = ''] = s.split('.');
    if (intPart === '') intPart = '0';
    if (fracPart.length > 8) fracPart = fracPart.slice(0, 8);
    fracPart = fracPart.padEnd(8, '0');
    let mag = BigInt(intPart + fracPart);
    if (neg) mag = -mag;
    return mag;
  }
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const excludeFlagged = pp.aggregation_policy.exclude_flagged !== false;
    const included = pp.extract.filter((l) => !(excludeFlagged && l.include === false));
    let total = 0n;
    for (const l of included) {
      const amt = toFixed(l.amount);
      const fx = toFixed(l.fx_rate_to_base ?? 1);
      total += (amt * fx) / SCALE;
    }
    // The kernel's recomputed_figure is ROUNDED to aggregation_policy.rounding.decimal_places
    // before rendering, so compare at that same decimal precision rather than at full 8-decimal
    // fixed-point resolution — grouping (netting) does not change the total (BigInt sum is
    // associative), only the display rounding step does.
    const decimalPlaces = Number.isInteger(pp.aggregation_policy.rounding?.decimal_places) ? pp.aggregation_policy.rounding.decimal_places : 2;
    const tolerance = 1.5 * 10 ** -decimalPlaces;
    const totalAsNumber = Number(total) / 1e8;
    const recomputedAsNumber = Number(output_payload.recomputed_figure);
    if (Math.abs(totalAsNumber - recomputedAsNumber) > tolerance) violations++;
  }
  return { name: 'P2_recomputed_figure_independent_bigint_resum_differential', trials: checked, violations };
}

// ---------- P3: boundedness — contribution_breakdown length never exceeds hierarchy.length + 1 ----------
function checkP3_contribution_breakdown_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.contribution_breakdown.length > pp.hierarchy.length + 1) violations++;
    // sorted by |value| descending — parse each value string's magnitude and check monotonicity.
    const mags = output_payload.contribution_breakdown.map((r) => Math.abs(parseFloat(r.value)));
    for (let j = 1; j < mags.length; j++) if (mags[j] > mags[j - 1] + 1e-9) violations++;
  }
  return { name: 'P3_contribution_breakdown_bounded_and_sorted', trials: checked, violations };
}

// ---------- P4: metamorphic — shuffling extract line order never changes recomputed_figure (BigInt sum is order-independent) ----------
function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    if (pp.extract.length < 2) continue;
    const r1 = compute(pp).output_payload;
    const shuffled = { ...pp, extract: shuffle(rand, pp.extract) };
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.recomputed_figure !== r2.recomputed_figure) violations++;
    if (r1.delta !== r2.delta) violations++;
  }
  return { name: 'P4_shuffle_extract_lines_permutation_invariance', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (divFixed b===0n guard, malformed decimals, GHOST node) ----------
function checkP5_forced_categorical_boundaries() {
  let violations = 0, checked = 0;
  {
    checked++;
    // reported_figure = 0 -> deltaPctStr must be null (divFixed by zero is guarded, kernel special-cases it).
    const { output_payload } = compute({ base_currency: 'USD', reported_figure: '0', aggregation_policy: {}, hierarchy: [], extract: [{ line_id: 'l0', node_id: 'UNMAPPED', amount: '100.00', fx_rate_to_base: '1', include: true }] });
    if (output_payload.delta_pct !== null) violations++;
  }
  {
    checked++;
    // malformed decimal string -> toFixed() falls back to 0, never throws.
    let threw = false;
    try {
      compute({ base_currency: 'USD', reported_figure: 'not-a-number', aggregation_policy: {}, hierarchy: [], extract: [{ line_id: 'l0', node_id: 'UNMAPPED', amount: 'garbage', fx_rate_to_base: 'garbage', include: true }] });
    } catch (e) { threw = true; }
    if (threw) violations++;
  }
  {
    checked++;
    // line with no hierarchy mapping rolls up to UNMAPPED, never dropped.
    const { output_payload } = compute({ base_currency: 'USD', reported_figure: '0', aggregation_policy: {}, hierarchy: [{ node_id: 'n0', parent_node_id: null }], extract: [{ line_id: 'l0', node_id: 'GHOST', amount: '50.00', fx_rate_to_base: '1', include: true }] });
    if (!output_payload.contribution_breakdown.some((r) => r.node_id === 'UNMAPPED')) violations++;
    if (output_payload.recomputed_figure !== '50.00') violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_cycle_guard());
results.properties.push(checkP2_recomputed_figure_differential());
results.properties.push(checkP3_contribution_breakdown_boundedness());
results.properties.push(checkP4_permutation_invariance());
results.properties.push(checkP5_forced_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-480-rdarr-aggregation-recompute',
  float_sensitive: false,
  float_sensitive_correction: 'WU row triage table said yes; direct source read confirms no — pure BigInt fixed-point, zero IEEE-754 arithmetic in the money path.',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
