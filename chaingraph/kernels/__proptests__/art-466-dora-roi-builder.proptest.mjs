// art-466-dora-roi-builder.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C21-1).
// kernel_digest_at_authoring: sha256:4f605ce91ebec16f4f7e409b383f1f5f273b5f3e0551894aed9765e2b7681d80
// human_sign_off: PENDING
//
// ⚠ CORRECTION TO THE WU ROW'S TABLE (per FIX-2, "confirm against each kernel's own source
// before relying on the table"): the row tags this kernel `float:yes`. Direct read finds ZERO
// floating-point arithmetic anywhere in compute() — LEI validation is ISO 7064 Mod 97-10 INTEGER
// checksum arithmetic (`(remainder*10 + digit) % 97`, always exact in float64 for the digit
// range involved), and every other check is string/Set/referential-integrity logic
// (checkMandatory, providerIds.has(), functionIds.has()). There is no division, no
// multiplication of continuous magnitudes, and no threshold compare on a derived float anywhere
// in this kernel. **This shard reclassifies art-466 as float:no** and uses forced categorical
// boundary cases instead of ULP-forcing, per spec §3's float:no row. (See this shard's manifest
// for the compensating correction that keeps the shard's float-sensitive count at 6/10.)
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// Checks: fixture-oracle gate, termination (bounded by providers.length + functions.length +
// contracts.length, three independent `.map()` passes, no recursion), boundedness
// (`findings.length` equals exactly 1 (entity mandatory) + 1 (entity LEI) + 2*providers.length +
// 2*functions.length + up to 3*contracts.length; `summary.overall_pass` iff every finding
// passed), a permutation-invariance metamorphic identity (reordering providers/functions/
// contracts leaves `summary.checks` pass/fail counts and `summary.overall_pass` unchanged, since
// every check is evaluated per-record independently of array order), and forced categorical
// boundary cases (LEI mod-97 check-digit exact pass/fail by a single trailing character, a
// dangling function->provider reference, a dangling contract->function/provider reference, a
// contract whose provider_id disagrees with its function's own provider_id, a
// whitespace-only mandatory field treated as missing by `safeStr().trim()`).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-466-dora-roi-builder.proptest.mjs

import { compute } from '../art-466-dora-roi-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-466-dora-roi-builder.fixtures.json');
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
const rand = mulberry32(0x46600);

// A confirmed-valid LEI (checked against the kernel's own ISO 7064 mod-97 logic).
const VALID_LEI = '529900T8BM49AURSDO55';

function randomPP(rng, n) {
  const providers = [];
  const functions = [];
  const contracts = [];
  for (let i = 0; i < n; i++) {
    providers.push({ provider_id: `prov-${i}`, name: `Provider ${i}`, lei: VALID_LEI, country: 'IE' });
    functions.push({ function_id: `func-${i}`, provider_id: `prov-${i}`, name: `Function ${i}`, critical: rng() < 0.5 });
    contracts.push({ contract_id: `con-${i}`, function_id: `func-${i}`, provider_id: `prov-${i}`, contract_reference: `REF-${i}`, start_date: '2025-01-01', governing_law: 'Ireland' });
  }
  return { entity: { entity_name: 'Bank NV', entity_lei: VALID_LEI }, providers, functions, contracts };
}

const TRIALS = 3000;

// ---------- P1: termination — bounded by providers/functions/contracts length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 10);
    const pp = randomPP(rand, n);
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.providers.length !== n || o.functions.length !== n || o.contracts.length !== n) violations++;
  }
  const bigPP = randomPP(rand, 3000);
  const { output_payload: bigOut } = compute(bigPP);
  checked++;
  if (bigOut.providers.length !== 3000) violations++;
  return { name: 'P1_termination_bounded_by_provider_function_contract_arrays', trials: checked, violations };
}

// ---------- P2: boundedness — findings count formula, overall_pass consistency ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 8);
    const pp = randomPP(rand, n);
    const { output_payload: o } = compute(pp);
    checked++;
    // entity(2) + provider(2 each) + function(2 each) + contract(3 base + 1 extra
    // consistency check when both function_id and provider_id resolve, which this
    // generator's contracts always do -> 4 per contract).
    const expectedFindings = 2 + 2 * n + 2 * n + 4 * n;
    if (o.validation_report.findings.length !== expectedFindings) violations++;
    const allPass = o.validation_report.findings.every((f) => f.status === 'pass');
    if (o.validation_report.summary.overall_pass !== allPass) violations++;
  }
  return { name: 'P2_findings_count_formula_and_overall_pass_consistency', trials: checked, violations };
}

// ---------- P3: metamorphic — permutation-invariance of arrays ----------
function checkP3_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const n = 2 + Math.floor(rand() * 8);
    const pp = randomPP(rand, n);
    const shuffledProviders = [...pp.providers];
    const shuffledFunctions = [...pp.functions];
    const shuffledContracts = [...pp.contracts];
    for (const arr of [shuffledProviders, shuffledFunctions, shuffledContracts]) {
      for (let j = arr.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
    }
    const base = compute(pp).output_payload;
    const perm = compute({ ...pp, providers: shuffledProviders, functions: shuffledFunctions, contracts: shuffledContracts }).output_payload;
    checked++;
    if (JSON.stringify(base.validation_report.summary.checks) !== JSON.stringify(perm.validation_report.summary.checks)) violations++;
    if (base.validation_report.summary.overall_pass !== perm.validation_report.summary.overall_pass) violations++;
  }
  return { name: 'P3_permutation_invariance_of_provider_function_contract_arrays', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases (float:no — corrected classification) ----------
function checkP4_categorical_boundaries() {
  let violations = 0, checked = 0;
  // LEI mod-97 exact pass/fail by a single trailing character
  const validLeiResult = compute({ entity: { entity_name: 'E', entity_lei: VALID_LEI }, providers: [], functions: [], contracts: [] });
  checked++;
  if (validLeiResult.output_payload.validation_report.summary.checks.lei_validity.fail !== 0) violations++;
  const invalidLei = VALID_LEI.slice(0, -1) + (VALID_LEI.slice(-1) === '5' ? '6' : '5');
  const invalidLeiResult = compute({ entity: { entity_name: 'E', entity_lei: invalidLei }, providers: [], functions: [], contracts: [] });
  checked++;
  if (invalidLeiResult.output_payload.validation_report.summary.checks.lei_validity.fail !== 1) violations++;
  // dangling function -> provider reference
  const dangling = compute({ entity: { entity_name: 'E', entity_lei: VALID_LEI }, providers: [], functions: [{ function_id: 'f1', provider_id: 'nope', name: 'F' }], contracts: [] });
  checked++;
  if (!dangling.compliance_flags.includes('DANGLING_FUNCTION_REFERENCE')) violations++;
  // contract provider disagrees with function's provider
  const mismatch = compute({
    entity: { entity_name: 'E', entity_lei: VALID_LEI },
    providers: [{ provider_id: 'p1', name: 'P1', lei: VALID_LEI }, { provider_id: 'p2', name: 'P2', lei: VALID_LEI }],
    functions: [{ function_id: 'f1', provider_id: 'p1', name: 'F1' }],
    contracts: [{ contract_id: 'c1', function_id: 'f1', provider_id: 'p2', contract_reference: 'R', start_date: '2025-01-01', governing_law: 'X' }],
  });
  checked++;
  if (!mismatch.compliance_flags.includes('CONTRACT_FUNCTION_PROVIDER_MISMATCH')) violations++;
  // whitespace-only mandatory field is treated as missing (safeStr().trim())
  const whitespace = compute({ entity: { entity_name: '   ', entity_lei: VALID_LEI }, providers: [], functions: [], contracts: [] });
  checked++;
  if (!whitespace.compliance_flags.includes('MANDATORY_FIELD_MISSING')) violations++;
  return { name: 'P4_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_permutation_invariance());
results.properties.push(checkP4_categorical_boundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-466-dora-roi-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
