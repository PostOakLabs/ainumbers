// kernel_digest_at_authoring: sha256:acbbbf9e75cae616381dcbdd06684f7b930a4717cb5966d6de4438ede3f04201
//
// FV-PROPFLOOR-SHARD-B23-1 — property-test floor for art-411-ai-addendum-assembler.
// Class B (bounded-numeric). ⚠ CLASSIFICATION CORRECTED FROM THE WU: the WU row listed this
// kernel as float-sensitive, but direct read of the kernel source (chaingraph/kernels/
// art-411-ai-addendum-assembler.kernel.mjs) shows it has NO numeric fields at all — every
// input/output is a boolean, string, or fixed template constant (no arithmetic, no division,
// no float comparison anywhere in compute()). Corrected to float:no per FV-PBT-FLOOR-BUILD-
// SPEC.md §3's FIX-2 carry instruction ("verify float-sensitivity ... not inherited from the
// triage table alone"); forced CATEGORICAL boundary cases used instead of ULP forcing. Zero
// external dependencies. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-411-ai-addendum-assembler.proptest.mjs

import { compute } from '../art-411-ai-addendum-assembler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-411-ai-addendum-assembler.fixtures.json');
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
const rand = mulberry32(0x411C3);
const TRIALS = 10000;
const BOOL_OR_MISSING = [true, false, undefined];
const STR_VALUES = ['some text', '', '   ', undefined];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkPP(rng) {
  return {
    train_on_customer_data: pick(rng, BOOL_OR_MISSING),
    model_improvement: pick(rng, BOOL_OR_MISSING),
    training_data: pick(rng, STR_VALUES),
    training_purposes: pick(rng, STR_VALUES),
    training_restrictions: pick(rng, STR_VALUES),
    improvement_restrictions: pick(rng, STR_VALUES),
    retention_window: pick(rng, STR_VALUES),
    output_ownership: pick(rng, STR_VALUES),
    subprocessor_ai: pick(rng, STR_VALUES),
    effective_date: pick(rng, STR_VALUES),
  };
}

// ---------- P1: fixed rule — allValid false implies both markdown fields are null ----------
function checkP1_invalidImpliesNullMarkdown() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    const allValid = op.checks.every((c) => c.pass);
    if (!allValid && (op.cover_page_markdown !== null || op.assembled_markdown !== null)) violations++;
    if (allValid && (op.cover_page_markdown === null || op.assembled_markdown === null)) violations++;
  }
  return { name: 'P1_invalid_checks_imply_null_markdown_and_vice_versa', trials: checked, violations };
}

// ---------- P2: fixed constants never move (body/template identity round-trip) ----------
function checkP2_constantsStable() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.template_id !== 'common-paper-ai-addendum-v1.0') violations++;
    if (op.license !== 'CC-BY-4.0') violations++;
    if (op.body_sha256 !== '192a7dc6d7caea8dd49c519bca7d157c8618a66a8546fdff763d80019598ff16') violations++;
  }
  return { name: 'P2_template_constants_stable', trials: checked, violations };
}

// ---------- P3: fixed rule — AI_TRAINING_PERMITTED flag exactly matches train_on_customer_data===true ----------
function checkP3_trainingFlagExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const expectPermitted = pp.train_on_customer_data === true;
    const hasPermitted = r.compliance_flags.includes('AI_TRAINING_PERMITTED');
    const hasNotPermitted = r.compliance_flags.includes('AI_TRAINING_NOT_PERMITTED');
    if (expectPermitted && !hasPermitted) violations++;
    if (!expectPermitted && !hasNotPermitted) violations++;
    if (hasPermitted && hasNotPermitted) violations++;
  }
  return { name: 'P3_ai_training_flag_matches_input_exactly', trials: checked, violations };
}

// ---------- P4 (categorical boundary forcing, float:no exception) ----------
const REQUIRED = { retention_window: '30 days', output_ownership: 'Customer', subprocessor_ai: 'None', effective_date: '2026-08-10' };
const CATEGORICAL_BOUNDARY_CASES = [
  [{ train_on_customer_data: true, model_improvement: false, training_data: 'chat logs', training_purposes: 'quality', ...REQUIRED },
    'train_on_customer_data true with both training_data and training_purposes present — must be fully valid, markdown non-null'],
  [{ train_on_customer_data: true, model_improvement: false, training_data: '', training_purposes: '', ...REQUIRED },
    'train_on_customer_data true but training_data/training_purposes both empty — training_fields_present_if_needed must fail, markdown null'],
  [{ train_on_customer_data: false, model_improvement: false, ...REQUIRED },
    'train_on_customer_data false, no training fields needed — must be fully valid regardless of training_data/training_purposes'],
  [{ train_on_customer_data: 'yes', model_improvement: false, ...REQUIRED },
    'train_on_customer_data as a non-boolean string "yes" — booleans_valid must fail (strict boolean check), never coerce truthy string'],
  [{ train_on_customer_data: false, model_improvement: false, retention_window: '', output_ownership: 'Customer', subprocessor_ai: 'None', effective_date: '2026-08-10' },
    'one required field (retention_window) empty string — required_fields_present must fail, missing list names exactly that field'],
  [{ train_on_customer_data: false, model_improvement: false, retention_window: '   ', output_ownership: 'Customer', subprocessor_ai: 'None', effective_date: '2026-08-10' },
    'whitespace-only required field — trim() must treat as empty/missing, not as present'],
  [{}, 'fully empty policy_parameters — all four required fields missing, both booleans null, must be fully invalid with null markdown'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const op = r.output_payload;
    const allValid = op.checks.every((c) => c.pass);
    const consistent = allValid ? (op.cover_page_markdown !== null && op.assembled_markdown !== null)
      : (op.cover_page_markdown === null && op.assembled_markdown === null);
    rows.push({ label, input: pp, all_valid: allValid, checks: op.checks, plausible: consistent });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_invalidImpliesNullMarkdown());
results.properties.push(checkP2_constantsStable());
results.properties.push(checkP3_trainingFlagExact());
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
