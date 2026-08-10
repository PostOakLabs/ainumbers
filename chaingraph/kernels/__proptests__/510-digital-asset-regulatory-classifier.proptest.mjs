// kernel_digest_at_authoring: sha256:e70b5a1adf38189f6a6f09d6b4b0dcfaf16394beb5f30f8b397cadbb0ffa2a5f
//
// FV-PROPFLOOR-SHARD-B1-1 — property-test floor for 510-digital-asset-regulatory-classifier.
// Class B (bounded-numeric row per FV-PBT-FLOOR-BUILD-SPEC.md §3), FLOAT:NO — this is the row's
// stated exception: the kernel is purely categorical (jurisdiction/asset_type string matching) with
// one integer-domain threshold (market_cap_eur vs 500,000,000). NO ULP-boundary forcing is performed
// here — that is a deliberate scope decision (this kernel is the documented float:no exception among
// the 10), not an omission. Zero external dependencies. Read-only w.r.t. the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/510-digital-asset-regulatory-classifier.proptest.mjs

import { compute } from '../510-digital-asset-regulatory-classifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', '510-digital-asset-regulatory-classifier.fixtures.json');
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
const rand = mulberry32(0x510A1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

const ASSET_TYPES = ['cbdc', 'stablecoin_usd', 'stablecoin_eur', 'tokenized_security', 'deposit_token', 'utility_token', 'other'];
const JURISDICTIONS = ['us', 'eu', 'uk', 'other'];
const ISSUER_TYPES = ['bank', 'investment_firm', 'fund', 'other'];
const TRIALS = 20000;

function randPP(rng) {
  return {
    asset_type: pick(rng, ASSET_TYPES),
    issuer_jurisdiction: pick(rng, JURISDICTIONS),
    issuer_type: pick(rng, ISSUER_TYPES),
    transfer_value: rng() < 0.5,
    redeemable_par: rng() < 0.5,
    economic_rights: rng() < 0.5,
    market_cap_eur: rng() < 0.7 ? randRange(rng, 0, 1_000_000_000) : null,
    on_dlt: rng() < 0.5,
  };
}

const FRAMEWORKS = ['GENIUS Act', 'MiFID II', 'MiCA', 'EU DLT Pilot Regime'];
const APPLIES_VALUES = new Set(['EXEMPT', 'APPLIES', 'NOT APPLICABLE', 'ELIGIBLE', 'NOT ELIGIBLE', 'UNKNOWN', 'N/A', 'NOTE']);

// ---------- P1: boundedness — output shape is always the 4 fixed frameworks in fixed order, no undefined leak ----------
function checkP1_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload;
    checked++;
    const results_ = r.classification_results;
    if (!Array.isArray(results_) || results_.length !== 4) { violations++; continue; }
    for (let j = 0; j < 4; j++) {
      if (results_[j].framework !== FRAMEWORKS[j]) violations++;
      if (!APPLIES_VALUES.has(results_[j].applies)) violations++;
      if (results_[j].flag !== null && typeof results_[j].flag !== 'string') violations++;
    }
  }
  return { name: 'P1_boundedness_fixed_framework_shape', trials: checked, violations };
}

// ---------- P2: metamorphic — MiFID II applying implies MiCA is NOT APPLICABLE (mutual exclusivity) ----------
function checkP2_mifidMicaMutualExclusion() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = compute(randPP(rand)).output_payload.classification_results;
    checked++;
    const mifid = r.find((x) => x.framework === 'MiFID II');
    const mica = r.find((x) => x.framework === 'MiCA');
    if (mifid.applies === 'APPLIES' && mica.applies !== 'NOT APPLICABLE') violations++;
  }
  return { name: 'P2_mifid_applies_implies_mica_not_applicable', trials: checked, violations };
}

// ---------- P3: fixed-threshold-tier agreement — asset_type=cbdc always yields GENIUS EXEMPT ----------
function checkP3_cbdcAlwaysExempt() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randPP(rand);
    pp.asset_type = 'cbdc';
    const r = compute(pp).output_payload.classification_results;
    checked++;
    const genius = r.find((x) => x.framework === 'GENIUS Act');
    if (genius.applies !== 'EXEMPT' || genius.flag !== 'CBDC_EXEMPT_GENIUS') violations++;
  }
  return { name: 'P3_cbdc_always_genius_exempt', trials: checked, violations };
}

// ---------- P4: DLT pilot market_cap_eur threshold tier agreement (500,000,000 boundary) ----------
function checkP4_dltThreshold() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = {
      asset_type: 'tokenized_security',
      issuer_jurisdiction: 'eu',
      issuer_type: pick(rand, ISSUER_TYPES),
      transfer_value: rand() < 0.5,
      redeemable_par: rand() < 0.5,
      economic_rights: false, // must stay false so MiFID II does not preempt MiCA/DLT
      market_cap_eur: randRange(rand, 0, 1_000_000_000),
      on_dlt: true,
    };
    const r = compute(pp).output_payload.classification_results;
    checked++;
    const dlt = r.find((x) => x.framework === 'EU DLT Pilot Regime');
    const expected = pp.market_cap_eur <= 500_000_000 ? 'ELIGIBLE' : 'NOT ELIGIBLE';
    if (dlt.applies !== expected) violations++;
  }
  return { name: 'P4_dlt_pilot_marketcap_threshold_agreement', trials: checked, violations };
}

// ---------- boundary_forced (no ULP forcing — float:no exception; forced CATEGORICAL boundary cases instead) ----------
const BOUNDARY_CASES = [
  ['market_cap_eur exactly 500,000,000 — must be ELIGIBLE (<=, not <)', { asset_type: 'tokenized_security', issuer_jurisdiction: 'eu', issuer_type: 'other', transfer_value: false, redeemable_par: false, economic_rights: false, market_cap_eur: 500_000_000, on_dlt: true }],
  ['market_cap_eur 500,000,001 — must be NOT ELIGIBLE', { asset_type: 'tokenized_security', issuer_jurisdiction: 'eu', issuer_type: 'other', transfer_value: false, redeemable_par: false, economic_rights: false, market_cap_eur: 500_000_001, on_dlt: true }],
  ['market_cap_eur null — DLT result must be UNKNOWN, not a crash', { asset_type: 'tokenized_security', issuer_jurisdiction: 'eu', issuer_type: 'other', transfer_value: false, redeemable_par: false, economic_rights: false, market_cap_eur: null, on_dlt: true }],
  ['market_cap_eur=0 — boundary at zero, must be ELIGIBLE', { asset_type: 'tokenized_security', issuer_jurisdiction: 'eu', issuer_type: 'other', transfer_value: false, redeemable_par: false, economic_rights: false, market_cap_eur: 0, on_dlt: true }],
];
function checkBoundaryForced() {
  const rows = [];
  for (const [label, pp] of BOUNDARY_CASES) {
    const r = compute(pp).output_payload.classification_results;
    const dlt = r.find((x) => x.framework === 'EU DLT Pilot Regime');
    let expected;
    if (pp.market_cap_eur === null || pp.market_cap_eur === undefined) expected = 'UNKNOWN';
    else expected = pp.market_cap_eur <= 500_000_000 ? 'ELIGIBLE' : 'NOT ELIGIBLE';
    const agrees = dlt.applies === expected;
    rows.push({ label, market_cap_eur: pp.market_cap_eur, dlt_applies: dlt.applies, expected, plausible: agrees });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_boundedness());
results.properties.push(checkP2_mifidMicaMutualExclusion());
results.properties.push(checkP3_cbdcAlwaysExempt());
results.properties.push(checkP4_dltThreshold());
results.boundary_forced = checkBoundaryForced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  float_sensitive: false,
  ulp_forcing_applicable: false,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
