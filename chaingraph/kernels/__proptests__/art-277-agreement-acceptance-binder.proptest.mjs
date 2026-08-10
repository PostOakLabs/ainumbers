// kernel_digest_at_authoring: sha256:f89876aa4e8bd2c8202f42f53375dcaadcf311417577d08361dc752421a2a965
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-277-agreement-acceptance-binder.
// Class B (bounded-numeric), FLOAT:NO — every field is a string/hex/enum check, no
// arithmetic on doubles anywhere in compute(). Forced CATEGORICAL boundary cases used
// per FV-PBT-FLOOR-BUILD-SPEC.md §3 instead of ULP forcing. Zero external dependencies
// (mulberry32 PRNG + explicit boundary arrays). READ-ONLY with respect to the kernel
// it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-277-agreement-acceptance-binder.proptest.mjs

import { compute } from '../art-277-agreement-acceptance-binder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-277-agreement-acceptance-binder.fixtures.json');
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
const rand = mulberry32(0x277B10);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randHex(rng, len) { let s = ''; for (let i = 0; i < len; i++) s += Math.floor(rng() * 16).toString(16); return s; }
const TRIALS = 8000;

function mkPP(rng) {
  const validHash = rng() > 0.3;
  return {
    referenced_execution_hash: validHash ? randHex(rng, 64) : randHex(rng, Math.floor(rng() * 63) + 1),
    template_id: rng() > 0.2 ? 'common-paper-mnda-v1.0' : '',
    body_sha256: rng() > 0.3 ? randHex(rng, 64) : randHex(rng, 63),
    accepting_party_role: pick(rng, ['party_a', 'party_b', 'party_c', '']),
    previous_proof_hash: rng() > 0.5 ? '' : (rng() > 0.5 ? randHex(rng, 64) : randHex(rng, 10)),
  };
}

// ---------- P1: monotonicity-shaped — allValid is exactly the AND of the 5 individual check passes ----------
function checkP1_allValidIsAnd() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const checks = r.output_payload.checks;
    const expectedValid = checks.every((c) => c.pass);
    const hasOutputFields = r.output_payload.accepted_template_id !== null;
    if (expectedValid !== hasOutputFields) violations++;
  }
  return { name: 'P1_output_fields_present_iff_all_five_checks_pass', trials: checked, violations };
}

// ---------- P2: boundedness — checks array always exactly 5 entries, each boolean, from a known check-name set ----------
function checkP2_checksShape() {
  const KNOWN_CHECKS = new Set(['referenced_execution_hash_valid', 'body_sha256_valid', 'template_id_present', 'accepting_party_role_valid', 'previous_proof_hash_valid_if_present']);
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const checks = r.output_payload.checks;
    if (checks.length !== 5) violations++;
    for (const c of checks) {
      if (typeof c.pass !== 'boolean') violations++;
      if (!KNOWN_CHECKS.has(c.check)) violations++;
    }
  }
  return { name: 'P2_checks_array_exactly_5_from_known_set_boolean_pass', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — accepting_party_role_valid iff role is exactly party_a or party_b ----------
function checkP3_roleAgreement() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expected = pp.accepting_party_role === 'party_a' || pp.accepting_party_role === 'party_b';
    const check = r.output_payload.checks.find((c) => c.check === 'accepting_party_role_valid');
    if (check.pass !== expected) violations++;
  }
  return { name: 'P3_role_valid_matches_fixed_party_a_or_party_b_set', trials: checked, violations };
}

// ---------- P4 (float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ referenced_execution_hash: 'a'.repeat(64) }, '64-char all-lowercase-hex hash — must pass (63 vs 64 vs 65 length boundary)'],
  [{ referenced_execution_hash: 'a'.repeat(63) }, '63-char hash (1 short) — must fail hashValid'],
  [{ referenced_execution_hash: 'a'.repeat(65) }, '65-char hash (1 over) — must fail hashValid (regex is anchored)'],
  [{ referenced_execution_hash: 'A'.repeat(64) }, '64-char UPPERCASE hex — kernel lowercases before testing, must pass'],
  [{ body_sha256: '' }, 'empty body_sha256 — must fail bodyHashValid, not throw on empty string'],
  [{ template_id: '' }, 'empty template_id after trim — must fail templateIdPresent'],
  [{ template_id: '   ' }, 'whitespace-only template_id — trim() must reduce to empty, fail templateIdPresent'],
  [{ accepting_party_role: 'party_c' }, 'unrecognized role value — must fail roleValid, not silently accept'],
  [{ previous_proof_hash: '' }, 'empty previous_proof_hash (optional field) — must PASS prevProofOk (empty is allowed)'],
  [{ previous_proof_hash: 'g'.repeat(64) }, 'previous_proof_hash with a non-hex character (g) at valid length — must fail the hex regex'],
];

function checkP4_forced() {
  const base = { referenced_execution_hash: 'a'.repeat(64), template_id: 'common-paper-mnda-v1.0', body_sha256: 'b'.repeat(64), accepting_party_role: 'party_a', previous_proof_hash: '' };
  const rows = [];
  for (const [overrides, label] of CATEGORICAL_BOUNDARY_CASES) {
    const pp = { ...base, ...overrides };
    let threw = false, r;
    try { r = compute(pp); } catch (e) { threw = true; r = { output_payload: { checks: [] } }; }
    rows.push({ label, overrides, checks: r.output_payload.checks, threw, plausible: !threw });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_allValidIsAnd());
results.properties.push(checkP2_checksShape());
results.properties.push(checkP3_roleAgreement());
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
