// kernel_digest_at_authoring: sha256:91212db29e804d760fdea1ab5633eeaae9a06c743518d3b746a30c50f026116d
//
// FV-PROPFLOOR-SHARD-B10-1 — property-test floor for art-276-mutual-nda-composer.
//
// ⚠ RECLASSIFICATION (FIX-2 carry per FV-PBT-FLOOR-BUILD-SPEC.md §3, spot-checked
// against the kernel source, not inherited from the triage table): this kernel is a
// document composer, not a scalar-arithmetic B kernel. Its only numeric fields
// (mnda_term_years, confidentiality_term_years) never enter arithmetic — compute()
// does exactly one thing with each: a `typeof === 'number' && > 0` gate, then string
// interpolation ("N year(s)"). There is no rounding, no division, no multi-step
// floating computation for a classic ULP artifact (round-tie, x/y*y!==x, etc.) to hide
// in. float_sensitive is real but NARROW — a single boundary check, not arithmetic —
// so P4 below forces the >0 boundary (0, negative, NaN, denormal-small-positive,
// negative zero) rather than the fuller ULP battery used by the shard's arithmetic
// kernels. Recorded in the manifest per spec §3's instruction to correct and note.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-276-mutual-nda-composer.proptest.mjs

import { compute } from '../art-276-mutual-nda-composer.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-276-mutual-nda-composer.fixtures.json');
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
const rand = mulberry32(0x276B10);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const TRIALS = 6000;
const REQUIRED_KEYS = ['purpose', 'effective_date', 'mnda_term_mode', 'confidentiality_term_mode', 'governing_law', 'jurisdiction'];

function mkPP(rng) {
  const includeAll = rng() > 0.3;
  const mnda_term_mode = pick(rng, ['expires_after_period', 'continues_until_terminated']);
  const confidentiality_term_mode = pick(rng, ['fixed_period', 'perpetuity']);
  const pp = {
    purpose: includeAll || rng() > 0.5 ? 'Evaluating a potential business relationship.' : '',
    effective_date: includeAll || rng() > 0.5 ? '2026-01-01' : '',
    mnda_term_mode,
    confidentiality_term_mode,
    governing_law: includeAll || rng() > 0.5 ? 'Delaware' : '',
    jurisdiction: includeAll || rng() > 0.5 ? 'Delaware' : '',
  };
  if (mnda_term_mode === 'expires_after_period') pp.mnda_term_years = rng() > 0.2 ? Math.floor(rng() * 10) + 1 : 0;
  if (confidentiality_term_mode === 'fixed_period') pp.confidentiality_term_years = rng() > 0.2 ? Math.floor(rng() * 10) + 1 : 0;
  return pp;
}

// ---------- P1: monotonicity/completeness — assembled_markdown non-null iff every required-fields check passes ----------
function checkP1_completenessGate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const allValid = r.output_payload.checks.every((c) => c.pass);
    const hasDoc = r.output_payload.assembled_markdown !== null;
    if (allValid !== hasDoc) violations++;
    if (allValid !== !r.compliance_flags.includes('KEY_TERMS_INCOMPLETE')) violations++;
  }
  return { name: 'P1_assembled_markdown_present_iff_all_checks_pass', trials: checked, violations };
}

// ---------- P2: boundedness — the vendored body is byte-identical and its sha256 never changes ----------
function checkP2_bodyInvariant() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const op = r.output_payload;
    if (op.body_sha256 !== '51accb97035821280371ff3088871e3866927ef0ce60e64ed5244883f11b6cfe') violations++;
    if (op.template_id !== 'common-paper-mnda-v1.0') violations++;
    if (op.license !== 'CC-BY-4.0') violations++;
  }
  return { name: 'P2_vendored_body_hash_and_template_id_invariant', trials: checked, violations };
}

// ---------- P3: fixed-tier agreement — checks array always carries exactly 5 named checks, each with a boolean pass ----------
function checkP3_checksShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const checks = r.output_payload.checks;
    if (checks.length !== 5) violations++;
    for (const c of checks) {
      if (typeof c.pass !== 'boolean') violations++;
      if (typeof c.check !== 'string' || !c.check) violations++;
    }
  }
  return { name: 'P3_checks_array_always_5_named_boolean_checks', trials: checked, violations };
}

// ---------- P4 (mandatory, narrowed per reclassification): forced boundary at the year>0 gate ----------
const ULP_BOUNDARY_CASES = [
  [{ mnda_term_years: 0 }, 'mnda_term_years exactly zero — fails the >0 gate, termYearsOk must be false, checks incomplete'],
  [{ mnda_term_years: -0 }, 'mnda_term_years negative zero — (-0 > 0) is false in JS, must be treated identically to 0'],
  [{ mnda_term_years: -1 }, 'mnda_term_years negative — fails >0 gate'],
  [{ mnda_term_years: Number.MIN_VALUE }, 'mnda_term_years smallest positive double (denormal) — passes >0 gate, must render without throwing'],
  [{ mnda_term_years: NaN }, 'mnda_term_years is NaN (still typeof "number") — (NaN > 0) is false, must fail gate not throw'],
  [{ confidentiality_term_years: 0 }, 'confidentiality_term_years exactly zero — fails the >0 gate'],
  [{ confidentiality_term_years: -0 }, 'confidentiality_term_years negative zero — must be treated identically to 0'],
  [{ mnda_term_years: 0.1 * 3 }, 'mnda_term_years = 0.1*3 (classic non-exact double artifact) — passes >0 gate, interpolates as the exact double'],
  [{ mnda_term_years: Infinity }, 'mnda_term_years is Infinity — passes >0 gate (Infinity > 0 true), must render "Infinity year(s)" without throwing'],
  [{ mnda_term_years: 1e-300 }, 'mnda_term_years near-subnormal positive — passes >0 gate, must not underflow to a falsy value'],
];

function checkP4_forced() {
  const base = {
    purpose: 'Evaluate a potential business relationship.',
    effective_date: '2026-01-01',
    mnda_term_mode: 'expires_after_period',
    confidentiality_term_mode: 'fixed_period',
    governing_law: 'Delaware',
    jurisdiction: 'Delaware',
    mnda_term_years: 3,
    confidentiality_term_years: 5,
  };
  const rows = [];
  for (const [overrides, label] of ULP_BOUNDARY_CASES) {
    const pp = { ...base, ...overrides };
    let threw = false, r;
    try { r = compute(pp); } catch (e) { threw = true; r = { output_payload: {}, compliance_flags: [] }; }
    const plausible = !threw;
    rows.push({ label, overrides, allValid: r.output_payload.checks ? r.output_payload.checks.every((c) => c.pass) : null, threw, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_completenessGate());
results.properties.push(checkP2_bodyInvariant());
results.properties.push(checkP3_checksShape());
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
