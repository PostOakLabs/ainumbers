// kernel_digest_at_authoring: sha256:59ffd31eb91e148f5ffd33a6d7d396cef95c7f55035d3cbe8e8c0457f2cb58ea
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-197-pil-flavor-mapper.
// Class B (bounded categorical mapper w/ real-number fee/revshare clamps). float-sensitive: yes --
// defaultMintingFee/commercialRevShare pass raw numbers through Math.floor/Math.min(100, ...)
// clamps, so ULP-boundary forcing on those clamps is mandatory per FV-PBT-FLOOR-BUILD-SPEC.md §3.
// `compute()` in this kernel is async — every call site here awaits it. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2/B3
// harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-197-pil-flavor-mapper.proptest.mjs

import { compute } from '../art-197-pil-flavor-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-197-pil-flavor-mapper.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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
const rand = mulberry32(0x19701);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 6000;
const COMMERCIAL_VALUES = [true, false, 'yes', 'no', 'maybe'];

function mkPP(rng) {
  return {
    commercial_use: pick(rng, COMMERCIAL_VALUES),
    derivatives_allowed: pick(rng, COMMERCIAL_VALUES),
    minting_fee: rng() < 0.2 ? -randRange(rng, 0, 1000) : randRange(rng, 0, 1000),
    rev_share_pct: rng() < 0.2 ? -randRange(rng, 0, 50) : randRange(rng, 0, 150),
  };
}
function resolveFlavor(commercial, derivatives) {
  const com = commercial === true || commercial === 'yes';
  const deriv = derivatives === true || derivatives === 'yes';
  if (!com) return 'non_commercial_social_remixing';
  if (!deriv) return 'commercial_use';
  return 'commercial_remix';
}

// ---------- P1: flavor resolution is a pure categorical function of commercial_use/derivatives_allowed ----------
async function checkP1_flavorResolution() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = (await compute(pp)).output_payload;
    checked++;
    const expFlavor = resolveFlavor(pp.commercial_use, pp.derivatives_allowed);
    if (r.flavor !== expFlavor) violations++;
    if (r.license_terms_id !== (expFlavor === 'non_commercial_social_remixing' ? 1 : null)) violations++;
  }
  return { name: 'P1_flavor_is_pure_function_of_commercial_and_derivatives', trials: checked, violations };
}

// ---------- P2: boundedness -- commercialRevShare in [0,100], defaultMintingFee non-negative integer ----------
async function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = (await compute(pp)).output_payload;
    checked++;
    const t = r.pil_terms;
    if (t.commercialRevShare < 0 || t.commercialRevShare > 100) violations++;
    if (t.defaultMintingFee < 0) violations++;
    if (!Number.isInteger(t.defaultMintingFee) || !Number.isInteger(t.commercialRevShare)) violations++;
  }
  return { name: 'P2_boundedness_revshare_0_100_and_fee_nonneg_integer', trials: checked, violations };
}

// ---------- P3: clamp identity -- fee/revshare match the raw floor+clamp formula exactly ----------
async function checkP3_clampIdentity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = (await compute(pp)).output_payload;
    checked++;
    const fee = Number(pp.minting_fee);
    const rev = Number(pp.rev_share_pct);
    const flavor = resolveFlavor(pp.commercial_use, pp.derivatives_allowed);
    const expFee = flavor === 'non_commercial_social_remixing'
      ? 0
      : (Number.isFinite(fee) && fee >= 0 ? Math.floor(fee) : 0);
    const expRev = flavor === 'commercial_remix'
      ? (Number.isFinite(rev) && rev >= 0 ? Math.min(100, Math.floor(rev)) : 0)
      : 0;
    if (r.pil_terms.defaultMintingFee !== expFee) violations++;
    if (r.pil_terms.commercialRevShare !== expRev) violations++;
  }
  return { name: 'P3_fee_and_revshare_match_raw_floor_clamp_formula', trials: checked, violations };
}

// ---------- P4: ULP-boundary forcing (float_sensitive: yes) ----------
const ULP_BOUNDARY_CASES = [
  [{ commercial_use: true, derivatives_allowed: true, rev_share_pct: 100 }, 'rev_share_pct exactly at the 100 clamp -- must stay 100'],
  [{ commercial_use: true, derivatives_allowed: true, rev_share_pct: 100 + Number.EPSILON * 100 }, 'rev_share_pct 1 ULP above 100 -- must clamp to 100'],
  [{ commercial_use: true, derivatives_allowed: true, rev_share_pct: 99.9999999999999 }, 'rev_share_pct just below 100 -- floor must yield 99, not 100'],
  [{ commercial_use: true, derivatives_allowed: false, minting_fee: 0 }, 'minting_fee exactly zero -- must stay 0, not throw'],
  [{ commercial_use: true, derivatives_allowed: false, minting_fee: -0 }, 'negative-zero minting_fee -- >=0 true, floor(-0) must serialize as 0'],
  [{ commercial_use: true, derivatives_allowed: false, minting_fee: Number.MIN_VALUE }, 'denormal minting_fee -- floor must yield 0, not throw'],
  [{ commercial_use: true, derivatives_allowed: false, minting_fee: -1 }, 'negative minting_fee -- must clamp to 0 (fee < 0 guard)'],
  [{ commercial_use: true, derivatives_allowed: true, rev_share_pct: -1 }, 'negative rev_share_pct -- must clamp to 0'],
  [{ commercial_use: true, derivatives_allowed: false, minting_fee: Infinity }, 'non-finite minting_fee -- must clamp to 0, not Infinity'],
  [{ commercial_use: true, derivatives_allowed: true, rev_share_pct: 10.999999999999998 }, 'rev_share_pct just below an integer -- floor must round down, not up'],
];

async function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of ULP_BOUNDARY_CASES) {
    const r = (await compute(pp)).output_payload;
    const t = r.pil_terms;
    const plausible = Number.isInteger(t.defaultMintingFee) && t.defaultMintingFee >= 0
      && Number.isInteger(t.commercialRevShare) && t.commercialRevShare >= 0 && t.commercialRevShare <= 100;
    rows.push({ label, pp, defaultMintingFee: t.defaultMintingFee, commercialRevShare: t.commercialRevShare, plausible });
  }
  return rows;
}

const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_flavorResolution());
results.properties.push(await checkP2_boundedness());
results.properties.push(await checkP3_clampIdentity());
results.boundary_forced = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-197-pil-flavor-mapper',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
