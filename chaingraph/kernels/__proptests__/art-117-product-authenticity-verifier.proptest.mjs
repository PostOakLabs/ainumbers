// art-117-product-authenticity-verifier.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C2-1).
// kernel_digest_at_authoring: sha256:eccd83a646d2c8ea26dd08a3afd2982697f9bef25047dba10eff238e27f185d4
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (string-prefix checks and an ownership-chain loop, no numeric thresholds).
// Checks: fixture-oracle gate, termination (ownership-continuity loop bounded by transfers.length),
// authentic/chains_to_root/ownership_continuous differential re-derivation, boundedness (compliance_flags
// membership matches the booleans exactly), and a metamorphic check that only presented_lineage_hashes[0]
// (not the rest of the array) affects chains_to_root.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-117-product-authenticity-verifier.proptest.mjs

import { compute } from '../art-117-product-authenticity-verifier.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-117-product-authenticity-verifier.fixtures.json');
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
const rand = mulberry32(0xA17A1);
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }

const ROOT_HASH = 'sha256:' + 'a'.repeat(64);
const OTHER_HASH = 'sha256:' + 'b'.repeat(64);

function randomTransfers(rng, n) {
  const parties = ['manufacturer', 'distributor', 'retailer', 'consumer'];
  const transfers = [];
  let prevTo = parties[0];
  for (let i = 0; i < n; i++) {
    const from = rng() < 0.85 ? prevTo : parties[randInt(rng, 0, parties.length - 1)]; // occasionally break continuity
    const to = parties[randInt(rng, 0, parties.length - 1)];
    transfers.push({ from, to });
    prevTo = to;
  }
  return transfers;
}

function randomInput(rng) {
  const claimed_root_hash = rng() < 0.7 ? ROOT_HASH : 'not-a-hash';
  const nHashes = randInt(rng, 0, 3);
  const presented_lineage_hashes = [];
  for (let i = 0; i < nHashes; i++) presented_lineage_hashes.push(i === 0 ? (rng() < 0.6 ? ROOT_HASH : OTHER_HASH) : OTHER_HASH);
  const n = randInt(rng, 0, 6);
  return { product_id: 'P1', claimed_root_hash, presented_lineage_hashes, ownership_transfers: randomTransfers(rng, n) };
}

const TRIALS = 5000;

// ---------- P1: termination — the continuity loop always completes within transfers.length iterations ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const start = Date.now();
    compute(pp);
    checked++;
    if (Date.now() - start > 1000) violations++; // sanity bound; loop is O(n) so this never trips in practice
  }
  return { name: 'P1_termination_bounded_loop', trials: checked, violations };
}

// ---------- P2 (differential): chains_to_root / ownership_continuous / authentic re-derivation ----------
function checkP2_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload } = compute(pp);
    checked++;
    const root_ok = typeof pp.claimed_root_hash === 'string' && pp.claimed_root_hash.startsWith('sha256:');
    const expectedChains = root_ok && pp.presented_lineage_hashes.length > 0 && pp.presented_lineage_hashes[0] === pp.claimed_root_hash;
    if (output_payload.chains_to_root !== expectedChains) violations++;
    let expectedContinuous = true;
    for (let j = 1; j < pp.ownership_transfers.length; j++) {
      if (pp.ownership_transfers[j].from !== pp.ownership_transfers[j - 1].to) { expectedContinuous = false; break; }
    }
    if (output_payload.ownership_continuous !== expectedContinuous) violations++;
    if (output_payload.authentic !== (expectedChains && expectedContinuous)) violations++;
  }
  return { name: 'P2_authenticity_differential', trials: checked, violations };
}

// ---------- P3: boundedness — compliance_flags membership matches the booleans exactly ----------
function checkP3_flags_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomInput(rand);
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('AUTHENTICITY_ASSESSED')) violations++;
    if (output_payload.authentic && !compliance_flags.includes('PRODUCT_AUTHENTIC')) violations++;
    if (!output_payload.authentic && !compliance_flags.includes('PRODUCT_AUTHENTICITY_FAILED')) violations++;
    if (!output_payload.ownership_continuous && !compliance_flags.includes('OWNERSHIP_CHAIN_BROKEN')) violations++;
    if (output_payload.ownership_continuous && compliance_flags.includes('OWNERSHIP_CHAIN_BROKEN')) violations++;
  }
  return { name: 'P3_compliance_flags_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — only presented_lineage_hashes[0] affects chains_to_root, not the rest ----------
function checkP4_metamorphic_tail_irrelevant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randomInput(rand);
    if (pp.presented_lineage_hashes.length === 0) { checked++; continue; }
    const mutatedTail = { ...pp, presented_lineage_hashes: [pp.presented_lineage_hashes[0], 'sha256:' + 'f'.repeat(64), 'sha256:' + 'e'.repeat(64)] };
    const r1 = compute(pp).output_payload;
    const r2 = compute(mutatedTail).output_payload;
    checked++;
    if (r1.chains_to_root !== r2.chains_to_root) violations++;
  }
  return { name: 'P4_metamorphic_tail_hashes_irrelevant', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_differential());
results.properties.push(checkP3_flags_bounded());
results.properties.push(checkP4_metamorphic_tail_irrelevant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-117-product-authenticity-verifier',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
