// art-413-screen-sanctions-private.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C19-1).
// kernel_digest_at_authoring: sha256:2af360c0c70be73aaad6a5c1ac72f0718d6480b7b8d524a8d929b684532805e2
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO — the WU row's triage table listed this kernel as float:yes; RE-CONFIRMED
// BY DIRECT READ per FIX-2 and that classification does not hold. screenPartiesPrivate() is pure
// string substring matching (`probe.includes(sdn)`) over a fixed 3-name OFAC_SDN_NAMES test list,
// counted with plain integer increments (hit_count, total_checked). commitPrivateInput() does
// hex-to-byte parsing (parseInt base 16) and a WebCrypto SHA-256 digest — no floating-point
// arithmetic anywhere in the file. Forced categorical boundary cases are used, not ULP forcing.
// Checks: fixture-oracle gate (via buildArtifact against the private witness in the .disclosure.json
// sidecar — this is a §25 ocg-private-input@1 node, same shape as art-415), a decoy compute()
// contract check (SPEC.md §18.3: the plaintext-free `compute(pp)` export must never leak a verdict),
// termination (hit_count/total_checked bounded by the private parties array length — a single
// linear scan, no recursion), boundedness (hit_count <= total_checked, clean === (hit_count===0)),
// a differential re-derivation of hit_count against an independent reimplementation of the
// substring-match rule, a metamorphic identity (permutation-invariance of the parties array order
// — hit_count/total_checked/clean are order-independent aggregates), and forced categorical
// boundary cases (empty party list, every party name matches an SDN entry, case-insensitivity
// toggle).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled). Uses the
// runtime's real globalThis.crypto.subtle (Node 19+ WebCrypto) for the commitment digest, exactly
// as production does.
//
// Run: node chaingraph/kernels/__proptests__/art-413-screen-sanctions-private.proptest.mjs

import { compute, buildArtifact } from '../art-413-screen-sanctions-private.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-413-screen-sanctions-private.fixtures.json');
  const disclosurePath = path.join(__dirname, '..', 'fixtures', 'art-413-screen-sanctions-private.disclosure.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const disclosure = JSON.parse(readFileSync(disclosurePath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const disc = disclosure.vectors.find((d) => d.name === vec.name);
    const artifact = await buildArtifact({
      parties: disc.input_value, salt: disc.salt,
      list_version: vec.policy_parameters.list_version,
      matching_config: vec.policy_parameters.matching_config,
    });
    const a = JSON.stringify(artifact.output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: artifact.output_payload });
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
const rand = mulberry32(0x413C19);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OFAC_SDN_NAMES = ['SANCTIONED ENTITY', 'OFAC_TEST_SDN', 'BLOCKED_PARTY'];
const CLEAN_NAMES = ['Acme Trading LLC', 'Beta Freight Co', 'Northwind Logistics', 'Contoso Shipping'];

function randomName(rng) {
  if (rng() < 0.25) {
    const sdn = pick(rng, OFAC_SDN_NAMES);
    return rng() < 0.5 ? sdn : `${pick(rng, ['Global', 'Acme'])} ${sdn} Holdings`;
  }
  return pick(rng, CLEAN_NAMES);
}
function randomParties(rng, n) { return Array.from({ length: n }, () => ({ name: randomName(rng) })); }

function reimplementHits(parties, caseInsensitive) {
  let hit_count = 0;
  for (const p of parties) {
    const probe = caseInsensitive ? String(p.name).toUpperCase() : String(p.name);
    if (OFAC_SDN_NAMES.some((sdn) => probe.includes(sdn))) hit_count++;
  }
  return hit_count;
}

const TRIALS = 2000; // WebCrypto digest calls are more expensive than pure JS

// ---------- P0: decoy compute() contract — never leaks a verdict from policy_parameters alone ----------
function checkP0_decoy() {
  const r = compute({ list_version: 'x' });
  const ok = r.screened === false && r.hit_count === 0 && r.clean === null;
  return { name: 'P0_decoy_compute_never_leaks_verdict', trials: 1, violations: ok ? 0 : 1 };
}

// ---------- P1: termination — hit_count/total_checked bounded by parties.length ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const parties = randomParties(rand, n);
    const artifact = await buildArtifact({ parties, salt: SALT });
    checked++;
    if (artifact.output_payload.hit_count > n) violations++;
    if (artifact.output_payload.coverage.total_checked !== n) violations++;
  }
  return { name: 'P1_termination_hit_count_bounded_by_parties_length', trials: checked, violations };
}

// ---------- P2: boundedness — hit_count <= total_checked, clean iff hit_count===0 ----------
async function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const parties = randomParties(rand, n);
    const artifact = await buildArtifact({ parties, salt: SALT });
    checked++;
    const o = artifact.output_payload;
    if (o.hit_count > o.coverage.total_checked) violations++;
    if (o.clean !== (o.hit_count === 0)) violations++;
  }
  return { name: 'P2_hit_count_bounded_and_clean_iff_zero_hits', trials: checked, violations };
}

// ---------- P3: differential — hit_count re-derived against independent substring-match reimplementation ----------
async function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const parties = randomParties(rand, n);
    const caseInsensitive = rand() < 0.9;
    const artifact = await buildArtifact({ parties, salt: SALT, matching_config: { case_insensitive: caseInsensitive } });
    checked++;
    const expected = reimplementHits(parties, caseInsensitive);
    if (artifact.output_payload.hit_count !== expected) violations++;
  }
  return { name: 'P3_hit_count_differential', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of parties order ----------
async function checkP4_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 400; i++) {
    const n = 2 + Math.floor(rand() * 6);
    const parties = randomParties(rand, n);
    const a1 = await buildArtifact({ parties, salt: SALT });
    const shuffled = [...parties].reverse();
    const a2 = await buildArtifact({ parties: shuffled, salt: SALT });
    checked++;
    if (a1.output_payload.hit_count !== a2.output_payload.hit_count) violations++;
    if (a1.output_payload.coverage.total_checked !== a2.output_payload.coverage.total_checked) violations++;
    if (a1.output_payload.clean !== a2.output_payload.clean) violations++;
  }
  return { name: 'P4_permutation_invariance_metamorphic', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
async function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // empty party list -> clean, zero hits
  {
    const a = await buildArtifact({ parties: [], salt: SALT });
    checked++;
    if (a.output_payload.hit_count !== 0 || !a.output_payload.clean) violations++;
  }
  // every party matches an SDN entry
  {
    const parties = OFAC_SDN_NAMES.map((n) => ({ name: n }));
    const a = await buildArtifact({ parties, salt: SALT });
    checked++;
    if (a.output_payload.hit_count !== OFAC_SDN_NAMES.length) violations++;
    if (a.output_payload.clean) violations++;
  }
  // case_insensitive:false with a lowercase SDN name -> no hit
  {
    const parties = [{ name: 'sanctioned entity' }];
    const a = await buildArtifact({ parties, salt: SALT, matching_config: { case_insensitive: false } });
    checked++;
    if (a.output_payload.hit_count !== 0) violations++;
  }
  return { name: 'P5_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP0_decoy());
results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_boundedness());
results.properties.push(await checkP3_differential());
results.properties.push(await checkP4_permutation_invariance());
results.properties.push(await checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-413-screen-sanctions-private',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
