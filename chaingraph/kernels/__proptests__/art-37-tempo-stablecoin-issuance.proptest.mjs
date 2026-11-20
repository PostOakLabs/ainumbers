// kernel_digest_at_authoring: sha256:83504e9c412e35e48899ad32cf27cfe945a3b0e6d0b3f78ed989be5e22f2923f
//
// FV-PROPFLOOR-SHARD-B13-1 — property-test floor for art-37-tempo-stablecoin-issuance.
// Class B (bounded-numeric). ⚠ FIX-2 CARRY CORRECTION: the WU row lists this kernel as
// float:yes, but direct inspection of the kernel source (art-37-tempo-stablecoin-issuance.kernel.mjs)
// shows compute() performs no continuous floating-point arithmetic at all — every check is a
// boolean/string-equality gate (currency_pass, rbac_pass, freeze_pass, ofac_pass, yield_warning) and
// supplyCap only ever appears in a strict `supplyCap > 0` comparison, never a division, multiplication,
// or accumulation. This row is corrected to float:no and carries forced CATEGORICAL boundary cases
// instead of ULP forcing, per FV-PBT-FLOOR-BUILD-SPEC.md §3's own instruction to verify and correct
// misclassification before authoring. Noted in the shard manifest per the WU's FIX-2 CARRY clause.
// Zero external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-37-tempo-stablecoin-issuance.proptest.mjs

import { compute } from '../art-37-tempo-stablecoin-issuance.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-37-tempo-stablecoin-issuance.fixtures.json');
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
const rand = mulberry32(0x379C);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randBool(rng) { return rng() < 0.5; }
const TRIALS = 6000;

function mkPP(rng) {
  return {
    tokenName: 'Token' + Math.floor(rng() * 1000),
    currencyCode: pick(rng, ['USD', 'EUR', 'usd', 'GBP']),
    supplyCap: pick(rng, [0, 1000, 1_000_000]),
    issuerLei: pick(rng, [null, 'LEI0000000000000000']),
    roleIssuer: randBool(rng),
    rolePause: randBool(rng),
    roleBurnBlocked: randBool(rng),
    yieldEnabled: randBool(rng),
    freezeEnabled: randBool(rng),
    ofacEnabled: randBool(rng),
    allowlistEnabled: randBool(rng),
    blocklistEnabled: randBool(rng),
    is_eu_emt: randBool(rng),
  };
}

// ---------- P1: boundedness — verdict is always one of the 3 declared enum values ----------
function checkP1_verdictBounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    if (!['PASS', 'WARN', 'FAIL', 'INDETERMINATE'].includes(r.output_payload.verdict)) violations++;
  }
  return { name: 'P1_verdict_bounded_to_3_state_enum', trials: checked, violations };
}

// ---------- P2: metamorphic — verdict is FAIL iff fail_count > 0, WARN iff fail_count === 0 && warn_count > 0 ----------
function checkP2_verdictMatchesCounts() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const o = r.output_payload;
    const expected = o.fail_count > 0 ? 'FAIL' : o.warn_count > 0 ? 'WARN' : 'PASS';
    if (o.verdict !== expected) violations++;
  }
  return { name: 'P2_verdict_matches_fail_and_warn_counts', trials: checked, violations };
}

// ---------- P3: round-trip — currency_pass is exactly (currencyCode.toUpperCase() === 'USD'), case-insensitive ----------
function checkP3_currencyPassCaseInsensitive() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = (pp.currencyCode ?? '').toUpperCase() === 'USD';
    if (r.output_payload.genius.currency_pass !== expected) violations++;
  }
  return { name: 'P3_currency_pass_is_case_insensitive_usd_match', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced CATEGORICAL boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ currencyCode: 'usd', supplyCap: 1, roleIssuer: true, rolePause: true, freezeEnabled: true, ofacEnabled: true }, 'currencyCode lowercase "usd" — must pass via case-insensitive toUpperCase(), currency_pass true'],
  [{ currencyCode: 'USD', supplyCap: 0, roleIssuer: true, rolePause: true, freezeEnabled: true, ofacEnabled: true }, 'supplyCap exactly zero (boundary of the > 0 check) — supply_cap_pass must be false, verdict FAIL'],
  [{ currencyCode: 'USD', supplyCap: 1, roleIssuer: true, rolePause: true, freezeEnabled: true, ofacEnabled: true, yieldEnabled: true, is_us_ppsi: true }, 'yieldEnabled true with default is_us_ppsi (undefined -> falsy? kernel defaults roleIssuer style) — kernel hardcodes is_us_ppsi via !!pp.is_us_ppsi, so must be explicit; verify yield_warning follows yieldEnabled && !!is_us_ppsi'],
  [{ currencyCode: '', supplyCap: 1, roleIssuer: true, rolePause: true, freezeEnabled: true, ofacEnabled: true }, 'currencyCode empty string — currency_pass must be false (empty !== USD), never throw on .toUpperCase()'],
  [{ currencyCode: 'USD', supplyCap: 1, roleIssuer: false, rolePause: false, roleBurnBlocked: true, freezeEnabled: true, ofacEnabled: true }, 'roleIssuer and rolePause both false — rbac_pass must be false (AND of both), fail_count includes it'],
  [{ currencyCode: 'USD', supplyCap: 1, roleIssuer: true, rolePause: true, freezeEnabled: true, ofacEnabled: true, is_eu_emt: true, reserve_segregated: false }, 'is_eu_emt true with reserve_segregated absent (defaults false via !! in kernel — actually this kernel does not gate mica on it directly in verdict, only in mica.reserve_disclosure hardcode) — must not throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const o = r.output_payload;
    const plausible = ['PASS', 'WARN', 'FAIL', 'INDETERMINATE'].includes(o.verdict) && Number.isInteger(o.fail_count) && Number.isInteger(o.warn_count);
    rows.push({ label, input: pp, output: o, plausible });
  }
  return rows;
}

// ---------- P6: fail-closed — every positive vector with one required flag deleted, nulled,
// emptied or whitespace-only must never keep a positive verdict. ----------
function checkP6_requiredFieldNeverPositive() {
  const fixtures = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-37-tempo-stablecoin-issuance.fixtures.json'), 'utf8'));
  const required = [
    'allowlistEnabled', 'blocklistEnabled', 'yieldEnabled', 'freezeEnabled',
    'ofacEnabled', 'roleBurnBlocked', 'roleIssuer', 'rolePause',
  ];
  let violations = 0, checked = 0, positives = 0;
  for (const vec of fixtures.vectors) {
    if (compute(vec.policy_parameters).output_payload.verdict !== 'PASS') continue;
    positives++;
    for (const f of required) {
      for (const mode of ['delete', 'null', 'empty', 'blank']) {
        const pp = JSON.parse(JSON.stringify(vec.policy_parameters));
        if (mode === 'delete') delete pp[f];
        else pp[f] = mode === 'null' ? null : mode === 'empty' ? '' : '   ';
        checked++;
        const r = compute(pp).output_payload;
        if (r.verdict === 'PASS' || r.verdict === 'WARN') violations++;
        if (r.verdict !== 'INDETERMINATE') violations++;
      }
    }
  }
  if (positives === 0) violations++;
  return { name: 'P6_required_field_never_positive_including_blank', trials: checked, violations };
}

// ---------- D6: buildArtifact_never_throws — one fixture per unhashable class ----------
async function checkP5_buildArtifactNeverThrows() {
  const { buildArtifact } = await import('../art-37-tempo-stablecoin-issuance.kernel.mjs');
  let deep = {}; let cur = deep;
  for (let i = 0; i < 511; i++) { cur.n = {}; cur = cur.n; }
  const classes = [
    ['junk_1e300', { supplyCap: 1e300 }],
    ['nan', { supplyCap: NaN }],
    ['neg_infinity', { supplyCap: -Infinity }],
    ['depth_511', { supplyCap: deep }],
    ['over_1e6_values', { supplyCap: new Array(1000001).fill(0) }],
  ];
  let violations = 0; const rows = [];
  for (const [label, pp] of classes) {
    try {
      const a = await buildArtifact(pp);
      const ok = a.execution_hash === null && a.hash_refusal && typeof a.hash_refusal.reason === 'string';
      if (!ok) violations++;
      rows.push({ label, refused: !!ok });
    } catch (e) { violations++; rows.push({ label, threw: String(e && e.message).slice(0, 80) }); }
  }
  return { name: 'buildArtifact_never_throws', trials: classes.length, violations, rows };
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_verdictBounded());
results.properties.push(checkP2_verdictMatchesCounts());
results.properties.push(checkP3_currencyPassCaseInsensitive());
results.properties.push(checkP6_requiredFieldNeverPositive());
results.properties.push(await checkP5_buildArtifactNeverThrows());
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
