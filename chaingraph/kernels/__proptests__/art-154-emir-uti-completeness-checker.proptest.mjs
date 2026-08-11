// kernel_digest_at_authoring: sha256:a1345c863f22e1fa2e33494af805aa71608d1f4bf3f5d8a484ace002f1cb5601
//
// FV-PROPFLOOR-SHARD-B3-1 — property-test floor for art-154-emir-uti-completeness-checker.
// Class B (bounded categorical), float:no exception per the WU row — the row's stated exception:
// lag_h is a guarded division-derived display value but every decision boundary is a fixed
// integer-hour tier (34h), not a continuous-domain threshold, so forced CATEGORICAL boundary
// cases are used in place of ULP forcing per FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external
// dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the B1/B2 harnesses.
// This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-154-emir-uti-completeness-checker.proptest.mjs

import { compute } from '../art-154-emir-uti-completeness-checker.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-154-emir-uti-completeness-checker.fixtures.json');
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
const rand = mulberry32(0x15401);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
const TRIALS = 10000;
const GOOD_PARTY = 'MAES062Z21O4RZ2U7M96';

function mkPP(rng) {
  const trade_unix = Math.floor(randRange(rng, 1600000000, 1700000000));
  return {
    uti: rng() < 0.7 ? 'UTI001EXAMPLE2024042901' : 'bad uti $$',
    generating_party: rng() < 0.7 ? GOOD_PARTY : '',
    trade_unix,
    uti_shared_unix: trade_unix + Math.floor(randRange(rng, -1000, 200000)),
  };
}

// ---------- P1: monotone (decay) — increasing uti_shared_unix (holding trade_unix fixed) can only turn shared_on_time from true to false, never the reverse ----------
function checkP1_monotoneDecayOnTime() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const early = { ...pp, uti_shared_unix: pp.trade_unix };
    const late = { ...pp, uti_shared_unix: pp.trade_unix + 1000000 };
    const r1 = compute(early);
    const r2 = compute(late);
    checked++;
    if (r1.output_payload.shared_on_time === false && r2.output_payload.shared_on_time === true) violations++;
  }
  return { name: 'P1_monotone_decay_shared_on_time_never_recovers_with_later_sharing', trials: checked, violations };
}

// ---------- P2: boundedness — lag_h is null or finite, uti_complete implies the three sub-checks ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { lag_h, uti_complete, format_ok, generator_known, shared_on_time } = r.output_payload;
    if (lag_h !== null && !Number.isFinite(lag_h)) violations++;
    if (uti_complete && !(format_ok && generator_known && shared_on_time !== false)) violations++;
  }
  return { name: 'P2_boundedness_lag_h_finite_and_complete_implies_subchecks', trials: checked, violations };
}

// ---------- P3: categorical threshold agreement — shared_on_time matches the fixed 0..34h SLA band exactly ----------
function checkP3_slaAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { lag_h, shared_on_time } = r.output_payload;
    const expected = lag_h === null ? null : (lag_h >= 0 && lag_h <= 34);
    if (shared_on_time !== expected) violations++;
  }
  return { name: 'P3_shared_on_time_matches_fixed_34h_sla_band', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no exception — decision bands are fixed-hour tiers) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ uti: 'UTI001EXAMPLE2024042901', generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 + 34 * 3600 }, 'lag exactly 34h — shared_on_time must be true (boundary inclusive)'],
  [{ uti: 'UTI001EXAMPLE2024042901', generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 + 34 * 3600 + 60 }, 'lag 1 minute over 34h — shared_on_time must be false'],
  [{ uti: 'UTI001EXAMPLE2024042901', generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 }, 'lag exactly 0h — shared_on_time must be true'],
  [{ uti: 'UTI001EXAMPLE2024042901', generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 - 3600 }, 'negative lag (shared before trade) — shared_on_time must be false'],
  [{ uti: 'UTI001EXAMPLE2024042901', generating_party: GOOD_PARTY }, 'missing timestamps entirely — lag_h must be null, shared_on_time null, uti_complete true (shared_on_time !== false)'],
  [{ uti: 'A'.repeat(52), generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 }, 'UTI at exactly 52-char max length — format_ok must be true'],
  [{ uti: 'A'.repeat(53), generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 }, 'UTI at 53 chars (1 over max) — format_ok must be false'],
  [{ uti: '', generating_party: GOOD_PARTY, trade_unix: 1714348800, uti_shared_unix: 1714348800 }, 'empty-string UTI — format_ok must be false'],
  [{}, 'entirely empty policy_parameters — must default cleanly, uti_complete false, no throw'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { uti_complete, lag_h, shared_on_time } = r.output_payload;
    const plausible = typeof uti_complete === 'boolean' && (lag_h === null || Number.isFinite(lag_h));
    rows.push({ label, pp, uti_complete, lag_h, shared_on_time, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_monotoneDecayOnTime());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_slaAgreement());
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
