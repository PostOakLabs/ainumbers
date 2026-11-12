// art-711-sco60-crypto-asset-exposure-classifier-v2.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the build spec at
// research/art281-sco60/BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:5627f00323bc2806d95cc61771090e8d3ff31a943cb31b8a145a7dda8fdad419
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO for every verdict — threshold decisions cross-multiply exact
// integers (exposure*100 against tier1*multiplier under the 1e12 minor-unit caps so
// every product stays below 2^53), the aggregate is an integer sum, the excess is an
// integer difference made exact by the centesimal (divisible-by-100) capital rule,
// and compute() touches no Date, no float accumulation and no Math.random. The one
// reported float, group2_exposure_pct_tier1, is display-only and never feeds a verdict.
//
// Checks: fixture-oracle gate (V1..V9 + the three-case V7 refusal family); P1
// monotonicity (a higher leg never yields fewer flags and never un-crosses or
// un-breaches); P2 the excess identity (zero at or below the 1% threshold, exposure
// minus 1% of Tier 1 in the crossed band, the whole aggregate above the 2% limit —
// kills any 1/2-constant mutant); P3 whole-book treatment occurs IFF above the 2%
// limit; P4 exact boundary sweep (exposure exactly at, one minor unit above, and one
// below each threshold over random centesimal Tier 1 values — kills every > vs >=
// boundary mutant and every threshold-constant mutant); P5 invalid-domain inputs are
// refused with named reasons, never a throw; P6 determinism (two runs agree
// byte-for-byte) and output shape (no undefined/NaN/non-finite anywhere); P7
// same-asset entries merge legs before the higher-of measurement.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-711-sco60-crypto-asset-exposure-classifier-v2.proptest.mjs

import { compute } from '../art-711-sco60-crypto-asset-exposure-classifier-v2.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-711-sco60-crypto-asset-exposure-classifier-v2';
const AMOUNT_CAP = 1e12;

// ---------- shared random domain (declared-domain inputs only) ----------

function baseInputs(rng, over = {}) {
  const tier1 = 100 * (1 + Math.floor(rng() * 1e7)); // centesimal, 100 .. 1e9
  const legs = () => Math.floor(rng() * 1e6); // per-leg far under the cap; the aggregate stays exact
  const positions = over.positions || [
    { cryptoasset: 'asset-a', holding_type: 'direct_cash', long_exposure: legs(), short_exposure: legs() },
    { cryptoasset: 'asset-b', holding_type: 'indirect_fund', long_exposure: legs(), short_exposure: legs() },
  ];
  return { bank_tier1_capital: over.tier1 !== undefined ? over.tier1 : tier1, group2_positions: positions };
}

function oneAsset(tier1, counted, name = 'asset-a') {
  return { bank_tier1_capital: tier1, group2_positions: [{ cryptoasset: name, holding_type: 'direct_cash', long_exposure: counted, short_exposure: 0 }] };
}

function flagCount(r) {
  return r.compliance_flags.length;
}

// ---------- properties ----------

// P1 monotonicity: raising any leg never lowers the flag count and never flips
// crossed/breached from true back to false.
function checkMonotonicity() {
  const rng = mulberry32(711001);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 80; i++) {
    const pp = baseInputs(rng);
    const before = compute(pp);
    const bumped = structuredClone(pp);
    const p = bumped.group2_positions[Math.floor(rng() * bumped.group2_positions.length)];
    if (rng() < 0.5) p.long_exposure += 1 + Math.floor(rng() * 1000);
    else p.short_exposure += 1 + Math.floor(rng() * 1000);
    const after = compute(bumped);
    checked++;
    if (flagCount(after) < flagCount(before)) violations++;
    checked++;
    if (before.output_payload.group2_limit_breached && !after.output_payload.group2_limit_breached) violations++;
    checked++;
    if (before.output_payload.group2_threshold_crossed && !after.output_payload.group2_threshold_crossed) violations++;
  }
  return { name: 'P1 a higher exposure never yields fewer flags and never un-fires a threshold', checked, violations };
}

// P2 the excess identity: excess === 0 at or below the 1% threshold,
// exposure - 1% of Tier 1 strictly inside the crossed band, and the whole
// aggregate above the 2% limit. Any mutant of the 1% or 2% constants moves the
// band edges and breaks the identity somewhere in the sweep.
function checkExcessIdentity() {
  const rng = mulberry32(711002);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 120; i++) {
    const { bank_tier1_capital: tier1 } = baseInputs(rng);
    const onePct = tier1 / 100;
    const twoPct = tier1 / 50;
    const exposure = Math.floor(rng() * twoPct * 3); // sweep below, across and above both thresholds
    const { output_payload: op } = compute(oneAsset(tier1, exposure));
    checked++;
    const want = exposure > twoPct ? exposure : (exposure > onePct ? exposure - onePct : 0);
    if (op.group2b_excess_amount !== want) violations++;
    checked++;
    if (op.group2_limit_breached !== (exposure > twoPct)) violations++;
    checked++;
    if (op.group2_threshold_crossed !== (exposure > onePct)) violations++;
    checked++;
    if (op.one_pct_tier1_amount !== onePct || op.two_pct_tier1_amount !== twoPct) violations++;
  }
  return { name: 'P2 excess equals max(0, exposure - 1% of Tier 1) in the crossed band and the whole aggregate above 2%', checked, violations };
}

// P3 whole-book treatment occurs IFF the aggregate is above the 2% limit;
// excess-only occurs IFF crossed and not breached; none occurs IFF not crossed.
function checkTreatmentScope() {
  const rng = mulberry32(711003);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 120; i++) {
    const { bank_tier1_capital: tier1 } = baseInputs(rng);
    const onePct = tier1 / 100;
    const twoPct = tier1 / 50;
    const exposure = Math.floor(rng() * twoPct * 3);
    const { output_payload: op } = compute(oneAsset(tier1, exposure));
    checked++;
    if ((op.group2b_treatment === 'whole_book') !== op.group2_limit_breached) violations++;
    checked++;
    if ((op.group2b_treatment === 'excess_only') !== (op.group2_threshold_crossed && !op.group2_limit_breached)) violations++;
    checked++;
    if ((op.group2b_treatment === 'none') !== (!op.group2_threshold_crossed)) violations++;
    checked++;
    if ((op.risk_weight_applied_pct === 1250) !== (op.group2b_excess_amount > 0)) violations++;
    checked++;
    if (op.pillar3_precheck_pass !== !op.group2_limit_breached) violations++;
  }
  return { name: 'P3 whole book at 2b iff above 2%, excess-only iff crossed and not breached', checked, violations };
}

// P4 exact boundary sweep — the mutant killer. Over random centesimal Tier 1
// values, an exposure of exactly 1% of Tier 1 is NOT crossed, one minor unit
// more IS; exactly 2% is NOT breached, one minor unit more IS. Kills every
// `>` -> `>=` mutant and every threshold-constant mutant (1<->2 swap, 1 or 2
// replaced by a neighbour).
function checkExactBoundaries() {
  const rng = mulberry32(711004);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const { bank_tier1_capital: tier1 } = baseInputs(rng);
    const onePct = tier1 / 100;
    const twoPct = tier1 / 50;
    const cases = [
      [onePct, false, false], [onePct + 1, true, false], [onePct - 1, false, false],
      [twoPct, true, false], [twoPct + 1, true, true], [twoPct - 1, true, false],
    ];
    for (const [exposure, wantCrossed, wantBreached] of cases) {
      const { output_payload: op } = compute(oneAsset(tier1, exposure));
      checked += 2;
      if (op.group2_threshold_crossed !== wantCrossed) violations++;
      if (op.group2_limit_breached !== wantBreached) violations++;
    }
  }
  return { name: 'P4 exact 1%/2% boundaries: exactly-at is compliant, one minor unit above fires, strict > both sides', checked, violations };
}

// P5 invalid-domain inputs are refused with a named reason and the input flag,
// never a throw, never NaN/Infinity in the payload.
function checkRefusals() {
  let checked = 0;
  let violations = 0;
  const rng = mulberry32(711005);
  const good = baseInputs(mulberry32(711015));
  const bad = /** @type {{ key: string, value: unknown }[]} */ ([
    { key: 'bank_tier1_capital', value: 0 },
    { key: 'bank_tier1_capital', value: -500 },
    { key: 'bank_tier1_capital', value: 999 },
    { key: 'bank_tier1_capital', value: 1000.5 },
    { key: 'bank_tier1_capital', value: '1000' },
    { key: 'bank_tier1_capital', value: null },
    { key: 'bank_tier1_capital', value: AMOUNT_CAP + 100 },
    { key: 'group2_positions', value: undefined },
    { key: 'group2_positions', value: [] },
    { key: 'group2_positions', value: 'btc' },
    { key: 'group2_positions', value: [{ cryptoasset: '', holding_type: 'direct_cash', long_exposure: 1, short_exposure: 0 }] },
    { key: 'group2_positions', value: [{ cryptoasset: 'btc', holding_type: 'direct_cash', long_exposure: -1, short_exposure: 0 }] },
    { key: 'group2_positions', value: [{ cryptoasset: 'btc', holding_type: 'direct_cash', long_exposure: 1.5, short_exposure: 0 }] },
    { key: 'group2_positions', value: [{ cryptoasset: 'btc', holding_type: 'direct_cash', long_exposure: 0, short_exposure: 1e13 }] },
    { key: 'group2_positions', value: [{ cryptoasset: 'btc', holding_type: 'mutual_fund', long_exposure: 1, short_exposure: 0 }] },
    { key: 'group2_positions', value: [{ cryptoasset: 'btc', holding_type: null, long_exposure: 1, short_exposure: 0 }] },
    { key: 'group2_positions', value: ['btc'] },
    { key: 'group2_positions', value: null },
  ]);
  for (const { key, value } of bad) {
    const r = compute({ ...good, [key]: value });
    checked++;
    if (r.compliance_flags[0] !== 'ART711_INPUT_REFUSED') violations++;
    checked++;
    if (!r.output_payload.refusal_reason || !String(r.output_payload.refusal_reason).startsWith('REFUSED_')) violations++;
    checked++;
    if (r.output_payload.domain_errors.length === 0) violations++;
    checked++;
    if (findShapeViolations(r.output_payload).length > 0) violations++;
  }
  void rng;
  return { name: 'P5 invalid-domain inputs refused with named reasons, never a throw, never NaN', checked, violations };
}

// P6 compute() is deterministic (two runs agree byte-for-byte) and every payload —
// success and refusal — is free of undefined/NaN/non-finite values.
function checkDeterminismAndShape() {
  const rng = mulberry32(711006);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 25; i++) {
    const pp = baseInputs(rng);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    checked++;
    if (findShapeViolations(r1.output_payload).length > 0) violations++;
    const refusedRun = compute({ ...pp, bank_tier1_capital: 0 });
    checked++;
    if (findShapeViolations(refusedRun.output_payload).length > 0) violations++;
  }
  return { name: 'P6 determinism and output shape: no undefined/NaN/non-finite anywhere', checked, violations };
}

// P7 per-asset merge: entries naming the SAME cryptoasset have their legs summed
// before the higher-of measurement — the counted total is never a per-entry
// higher-of (which would double-count) and never a netted figure.
function checkPerAssetMerge() {
  let checked = 0;
  let violations = 0;
  const rng = mulberry32(711007);
  for (let i = 0; i < 60; i++) {
    const a = Math.floor(rng() * 1e5), b = Math.floor(rng() * 1e5);
    const c = Math.floor(rng() * 1e5), d = Math.floor(rng() * 1e5);
    const tier1 = 100 * (1 + Math.floor(rng() * 1e5));
    const pp = { bank_tier1_capital: tier1, group2_positions: [
      { cryptoasset: 'same-asset', holding_type: 'direct_cash', long_exposure: a, short_exposure: b },
      { cryptoasset: 'same-asset', holding_type: 'indirect_etn', long_exposure: c, short_exposure: d },
    ] };
    const { output_payload: op } = compute(pp);
    const long = a + c, short = b + d;
    const want = long >= short ? long : short;
    checked++;
    if (op.per_asset.length !== 1) violations++;
    checked++;
    if (op.per_asset[0].counted_exposure !== want) violations++;
    checked++;
    if (op.group2_exposure_amount !== want) violations++;
    checked++;
    if (op.per_asset[0].long_exposure !== long || op.per_asset[0].short_exposure !== short) violations++;
  }
  return { name: 'P7 same-asset entries merge legs before the higher-of measurement', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkMonotonicity(),
  checkExcessIdentity(),
  checkTreatmentScope(),
  checkExactBoundaries(),
  checkRefusals(),
  checkDeterminismAndShape(),
  checkPerAssetMerge(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — V1..V9+refusals fixture oracle + P1..P7.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
