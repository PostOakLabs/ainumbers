// art-289-lint-besu-settlement-contract.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:8452fcfb980e34593a3e46cab2d75a620d9e598ea12e618b94c74b04ff1f4ce7
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (regex/structural lint over strings and array shapes, no arithmetic).
// Checks: fixture-oracle gate, termination/boundedness (findings.length fixed at 6 in both
// modes), differential re-derivation of invariants_pass + overall from severities, and
// metamorphic idempotence (same input never produces a different output_payload).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-289-lint-besu-settlement-contract.proptest.mjs

import { compute } from '../art-289-lint-besu-settlement-contract.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-289-lint-besu-settlement-contract.fixtures.json');
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
const rand = mulberry32(0x289A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Random Solidity-shaped fragments — bias toward exercising every rule (R1-R6) on both sides.
const TRANSFER_CALLS = ['safeTransfer(a, 1)', 'transferFrom(b, address(this), 1)', 'safeTransfer(c, 2)'];
const EVENT_NAMES = ['event Settled(bytes32 indexed id);', 'event Finalized(bytes32 indexed id);', 'event Foo(uint x);', ''];
const GUARD_MODS = ['onlyCompliant', 'whenNotPaused', 'complianceGate', ''];
const UPGRADE_PATTERNS = ['delegatecall(x)', 'UUPSUpgradeable', 'TransparentUpgradeableProxy', ''];

function randomSolidity(rng) {
  const nCalls = Math.floor(rng() * 3);
  const calls = Array.from({ length: nCalls }, () => pick(rng, TRANSFER_CALLS));
  const hasRequire = rng() < 0.7;
  const body = calls.map((c) => (hasRequire ? `require(${c}, "fail");` : `${c};`)).join('\n');
  const payable = rng() < 0.3 ? 'payable' : '';
  const msgValue = rng() < 0.2 ? 'uint v = msg.value;' : '';
  const evt = pick(rng, EVENT_NAMES);
  const guard = pick(rng, GUARD_MODS);
  const upgrade = pick(rng, UPGRADE_PATTERNS);
  const disclose = rng() < 0.5 ? '// UPGRADEABLE: yes\n' : '';
  const unboundedLoop = rng() < 0.3 ? 'for (uint i = 0; i < arr.length; i++) { }' : '';
  const maxGuard = rng() < 0.5 ? 'require(arr.length <= MAX, "too many");' : '';
  return `${disclose}contract Settlement {\n  ${evt}\n  ${upgrade};\n  function transferPair(address a, address b) external ${payable} ${guard} {\n    ${body}\n    ${msgValue}\n    ${unboundedLoop}\n    ${maxGuard}\n  }\n}`;
}

const ABI_TYPES = ['function', 'event'];
function randomAbi(rng) {
  const n = Math.floor(rng() * 6);
  const items = [];
  for (let i = 0; i < n; i++) {
    const type = pick(rng, ABI_TYPES);
    if (type === 'function') {
      items.push({
        type: 'function',
        name: rng() < 0.5 ? 'transfer' : 'foo',
        stateMutability: rng() < 0.3 ? 'payable' : 'nonpayable',
      });
    } else {
      items.push({ type: 'event', name: rng() < 0.5 ? 'Settled' : 'Bar' });
    }
  }
  return items;
}

const TRIALS = 5000;

// ---------- P1: termination/boundedness — findings.length is fixed at 6 in both modes ----------
function checkP1_findings_count_fixed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const isAbi = rand() < 0.5;
    const pp = isAbi
      ? { artifact_kind: 'abi', source: JSON.stringify(randomAbi(rand)) }
      : { artifact_kind: 'solidity', source: randomSolidity(rand) };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.findings.length !== 6) violations++;
    if (Object.keys(output_payload.invariants_pass).length !== 6) violations++;
  }
  return { name: 'P1_findings_count_fixed_at_6', trials: checked, violations };
}

// ---------- P2 (differential): invariants_pass + overall re-derived from severities ----------
function checkP2_overall_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const isAbi = rand() < 0.5;
    const pp = isAbi
      ? { artifact_kind: 'abi', source: JSON.stringify(randomAbi(rand)) }
      : { artifact_kind: 'solidity', source: randomSolidity(rand) };
    const { output_payload } = compute(pp);
    checked++;
    for (const f of output_payload.findings) {
      if (output_payload.invariants_pass[f.rule_id] !== (f.severity === 'pass')) violations++;
    }
    const failCount = output_payload.findings.filter((f) => f.severity === 'fail').length;
    const warnCount = output_payload.findings.filter((f) => f.severity === 'warn').length;
    const expectedOverall = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';
    if (output_payload.overall !== expectedOverall) violations++;
    if (output_payload.fail_count !== failCount || output_payload.warn_count !== warnCount) violations++;
  }
  return { name: 'P2_overall_and_counts_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every severity is one of the declared enum values ----------
function checkP3_severity_enum_bounded() {
  let violations = 0, checked = 0;
  const VALID = new Set(['pass', 'fail', 'warn']);
  for (let i = 0; i < TRIALS; i++) {
    const isAbi = rand() < 0.5;
    const pp = isAbi
      ? { artifact_kind: 'abi', source: JSON.stringify(randomAbi(rand)) }
      : { artifact_kind: 'solidity', source: randomSolidity(rand) };
    const { output_payload } = compute(pp);
    checked++;
    for (const f of output_payload.findings) if (!VALID.has(f.severity)) violations++;
  }
  return { name: 'P3_severity_bounded_to_declared_enum', trials: checked, violations };
}

// ---------- P4: metamorphic — idempotence (same input never yields a different output) ----------
function checkP4_idempotence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const isAbi = rand() < 0.5;
    const pp = isAbi
      ? { artifact_kind: 'abi', source: JSON.stringify(randomAbi(rand)) }
      : { artifact_kind: 'solidity', source: randomSolidity(rand) };
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
  }
  return { name: 'P4_idempotence_same_input_same_output', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_findings_count_fixed());
results.properties.push(checkP2_overall_differential());
results.properties.push(checkP3_severity_enum_bounded());
results.properties.push(checkP4_idempotence());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-289-lint-besu-settlement-contract',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
