// art-131-signature-agent-card-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:02cc79e6816db16e1e31ee80ce2bf4101ab8959fbb51653651ac1a84084b1134
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (field-presence + array .every()/.includes() boolean logic, integer count).
// Checks: fixture-oracle gate, termination (missing_fields bounded by the fixed 4-field REQUIRED
// list, card_key_count bounded by card.keys length), differential re-derivation of
// keys_consistent/card_valid from the field-presence and directory-membership conditions, and
// metamorphic permutation-invariance of card.keys order.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-131-signature-agent-card-validator.proptest.mjs

import { compute } from '../art-131-signature-agent-card-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-131-signature-agent-card-validator.fixtures.json');
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
const rand = mulberry32(0x131D1);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

const KIDS = ['kid-1', 'kid-2', 'kid-3', 'kid-4'];

function randomKeys(rng, n) {
  return Array.from({ length: n }, () => ({ kid: pick(rng, KIDS) }));
}

function randomPP(rng) {
  const nKeys = Math.floor(rng() * 5);
  const card = {
    name: maybe(rng, 'my-agent'),
    operator: maybe(rng, 'acme-corp'),
    expected_request_rate: maybe(rng, '10/min'),
    keys: randomKeys(rng, nKeys),
  };
  const directory_keyids = shuffle(rng, KIDS).slice(0, Math.floor(rng() * (KIDS.length + 1)));
  return { card, directory_keyids };
}

const TRIALS = 5000;

// ---------- P1: termination — missing_fields <= 4 (fixed REQUIRED table), card_key_count bounded by card.keys ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    if (output_payload.missing_fields.length > 4) violations++;
    if (output_payload.card_key_count !== pp.card.keys.length) violations++;
  }
  return { name: 'P1_termination_bounded', trials: checked, violations };
}

// ---------- P2 (differential): keys_consistent/card_valid re-derivation ----------
async function checkP2_validity_differential() {
  let violations = 0, checked = 0;
  const REQUIRED = ['name', 'operator', 'expected_request_rate', 'keys'];
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = await compute(pp);
    checked++;
    const expectedMissing = REQUIRED.filter((f) => pp.card[f] === undefined || pp.card[f] === null || pp.card[f] === '');
    if (JSON.stringify(output_payload.missing_fields) !== JSON.stringify(expectedMissing)) violations++;
    const cardKeyids = pp.card.keys.map((k) => k && k.kid).filter(Boolean);
    const keys_consistent = cardKeyids.length > 0 && cardKeyids.every((kid) => pp.directory_keyids.includes(kid));
    if (output_payload.keys_consistent !== keys_consistent) violations++;
    if (output_payload.card_valid !== (expectedMissing.length === 0 && keys_consistent)) violations++;
  }
  return { name: 'P2_validity_differential', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of card.keys order ----------
async function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const nKeys = Math.floor(rand() * 5);
    const keys = randomKeys(rand, nKeys);
    const card = { name: 'a', operator: 'b', expected_request_rate: '1/min', keys };
    const directory_keyids = shuffle(rand, KIDS).slice(0, Math.floor(rand() * (KIDS.length + 1)));
    const r1 = (await compute({ card, directory_keyids })).output_payload;
    const r2 = (await compute({ card: { ...card, keys: shuffle(rand, keys) }, directory_keyids })).output_payload;
    checked++;
    if (r1.card_valid !== r2.card_valid) violations++;
    if (r1.keys_consistent !== r2.keys_consistent) violations++;
    if (r1.card_key_count !== r2.card_key_count) violations++;
  }
  return { name: 'P3_permutation_invariance_card_keys', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_validity_differential());
results.properties.push(await checkP3_permutation_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-131-signature-agent-card-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
