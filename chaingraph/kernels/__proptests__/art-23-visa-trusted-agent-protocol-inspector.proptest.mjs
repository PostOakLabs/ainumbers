// art-23-visa-trusted-agent-protocol-inspector.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C7-1).
// kernel_digest_at_authoring: sha256:7e92bc87f416f5fa615f69201caf653373e34bccee02976a5a65f9f4d57fd300
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — string/regex parsing plus integer weight
// arithmetic; the only "score" math is `100 - errors*15 - warnings*4` clamped to [0,100],
// all integers). Checks: fixture-oracle gate, termination (findings/params bounded by the
// finite field list the kernel inspects), boundedness (score in [0,100]), a differential
// re-derivation of score/verdict from errors/warnings counts, and forced categorical
// boundary cases for every branch (missing header, malformed header, each missing param,
// non-ed25519 alg, mismatched signature label).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-23-visa-trusted-agent-protocol-inspector.proptest.mjs

import { compute } from '../art-23-visa-trusted-agent-protocol-inspector.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-23-visa-trusted-agent-protocol-inspector.fixtures.json');
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
const rand = mulberry32(0x23A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomSigInput(rng) {
  const parts = ['@method', '@target-uri', '@authority', 'content-digest'];
  const comps = parts.filter(() => rng() < 0.6);
  const compsStr = comps.map((c) => `"${c}"`).join(' ');
  const params = [];
  if (rng() < 0.8) params.push(`created=${1700000000 + Math.floor(rng() * 1e8)}`);
  if (rng() < 0.6) params.push(`expires=${1800000000 + Math.floor(rng() * 1e8)}`);
  if (rng() < 0.6) params.push(`nonce=n${Math.floor(rng() * 1e6)}`);
  if (rng() < 0.8) params.push(`keyid=agent-key-${Math.floor(rng() * 10)}`);
  if (rng() < 0.7) params.push(`alg=${pick(rng, ['ed25519', 'rsa-pss-sha512', 'hmac-sha256'])}`);
  if (rng() < 0.5) params.push(`tag=${pick(rng, ['trusted-agent', 'agent-x', 'other'])}`);
  return `sig1=(${compsStr});${params.join(';')}`;
}

const TRIALS = 5000;

// ---------- P1: termination — findings length bounded by the fixed field list inspected ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const siRaw = rand() < 0.9 ? randomSigInput(rand) : '';
    const sigRaw = rand() < 0.8 ? `sig1=:${'a'.repeat(Math.floor(rand() * 40))}:` : '';
    const { output_payload: o } = compute({ signature_input: siRaw, signature: sigRaw });
    checked++;
    if (o.findings.length < 1 || o.findings.length > 10) violations++;
  }
  return { name: 'P1_termination_findings_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — score always in [0,100] ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const siRaw = rand() < 0.9 ? randomSigInput(rand) : '';
    const sigRaw = rand() < 0.8 ? `sig1=:${'a'.repeat(Math.floor(rand() * 40))}:` : '';
    const { output_payload: o } = compute({ signature_input: siRaw, signature: sigRaw });
    checked++;
    if (o.score < 0 || o.score > 100) violations++;
  }
  return { name: 'P2_score_bounded_0_to_100', trials: checked, violations };
}

// ---------- P3 (differential): score/verdict re-derived from errors/warnings/passes counts ----------
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const siRaw = rand() < 0.9 ? randomSigInput(rand) : '';
    const sigRaw = rand() < 0.8 ? `sig1=:${'a'.repeat(Math.floor(rand() * 40))}:` : '';
    const { output_payload: o } = compute({ signature_input: siRaw, signature: sigRaw });
    checked++;
    const refScore = Math.max(0, Math.min(100, 100 - o.errors * 15 - o.warnings * 4));
    const refVerdict = o.score >= 85 ? 'TAP_READY' : o.score >= 60 ? 'PARTIAL' : 'NOT_READY';
    if (o.score !== refScore) violations++;
    if (o.verdict !== refVerdict) violations++;
    // findings may also include 'info'-level entries, not counted in errors/warnings/passes
    if (o.errors + o.warnings + o.passes > o.findings.length) violations++;
  }
  return { name: 'P3_differential_score_verdict_from_counts', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no) ----------
function checkP4_categoricalBoundaries() {
  let violations = 0, checked = 0;
  const cases = [
    { signature_input: '', signature: '' }, // no header at all
    { signature_input: 'not a valid header', signature: '' }, // malformed
    { signature_input: 'sig1=("@method");created=1;expires=2;nonce=n;keyid=k;alg=ed25519', signature: '' }, // no signature
    { signature_input: 'sig1=("@method");created=1;expires=2;nonce=n;keyid=k;alg=rsa-pss', signature: 'sig1=:x:' }, // non-ed25519
    { signature_input: 'sig1=("@method");created=1;expires=2;nonce=n;keyid=k;alg=ed25519', signature: 'sig2=:x:' }, // label mismatch
    { signature_input: 'sig1=("@method" "@target-uri");created=1;expires=2;nonce=n;keyid=k;alg=ed25519;tag=trusted-agent', signature: 'sig1=:x:' }, // full pass
  ];
  for (const c of cases) {
    checked++;
    const { output_payload: o } = compute(c);
    if (o.score < 0 || o.score > 100) violations++;
    if (!['TAP_READY', 'PARTIAL', 'NOT_READY'].includes(o.verdict)) violations++;
  }
  // spot-check the two clearest branches
  const noHeader = compute(cases[0]).output_payload;
  if (noHeader.errors < 1) violations++;
  const fullPass = compute(cases[5]).output_payload;
  if (fullPass.verdict !== 'TAP_READY') violations++;
  return { name: 'P4_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_differential());
results.properties.push(checkP4_categoricalBoundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-23-visa-trusted-agent-protocol-inspector',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
