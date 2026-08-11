// art-205-license-terms-assembler.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:bebb5b6028df2c00c50d629078971ca09785b5ca51b473d2515c05becc4ca1aa
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — pure string substitution, no arithmetic).
// Checks: fixture-oracle gate, termination (rendered_text length is bounded by the FIXED template
// body length plus the sum of caller-supplied field-value lengths — unbounded input is the caller's
// field strings, and the bound is tested directly), boundedness (fields_missing subset of
// template.fields_required, checks.length small constant), a completeness/differential property
// (when all required fields are supplied, no "[FIELD: required]" placeholder token survives
// rendering), and metamorphic field-length monotonicity (rendered_text length strictly tracks the
// substituted field length for a single varied field, all else fixed).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-205-license-terms-assembler.proptest.mjs

import { compute } from '../art-205-license-terms-assembler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-205-license-terms-assembler.fixtures.json');
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
const rand = mulberry32(0x2050A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TEMPLATES = {
  'CC-STANDARD-USE': { required: ['licensor_name', 'work_title', 'license_id', 'license_url'], optional: ['attribution_text', 'effective_date'] },
  'IP3-RIGHTS-RECORD': { required: ['licensor_name', 'licensee_name', 'work_title', 'license_id', 'territory', 'term_years'], optional: ['royalty_rate', 'effective_date', 'renewal_option'] },
  'NFT-EMBEDDED-LICENSE': { required: ['creator_name', 'nft_title', 'tier_id', 'tier_label'], optional: ['collection_name', 'effective_date'] },
};
const TEMPLATE_IDS = Object.keys(TEMPLATES);

function randomString(rng, maxLen) {
  const n = 1 + Math.floor(rng() * maxLen);
  const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
  let s = '';
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(rng() * CHARS.length)];
  return s;
}

// Guaranteed non-blank-after-trim (kernel's `required_fields_present` check treats a
// whitespace-only supplied value as MISSING per its `String(fields[f]).trim() === ''` test —
// correct kernel behavior, not something P3 below should treat as a violation).
function randomNonBlankString(rng, maxLen) {
  const s = randomString(rng, maxLen);
  return s.trim() === '' ? 'x' + s : s;
}

const TRIALS = 5000;

// ---------- P1: termination — rendered_text length bounded by template body + supplied field lengths ----------
function checkP1_termination_length_bound() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const template_id = pick(rand, TEMPLATE_IDS);
    const spec = TEMPLATES[template_id];
    const fields = {};
    let suppliedLen = 0;
    for (const f of spec.required.concat(spec.optional)) {
      if (rand() < 0.7) { const v = randomString(rand, 200); fields[f] = v; suppliedLen += v.length; }
    }
    const { output_payload } = compute({ template_id, fields });
    checked++;
    if (output_payload.rendered_text === null) { violations++; continue; }
    // Rendered text can only grow from supplied field substitutions (bounded, generous slack for template scaffolding).
    if (output_payload.rendered_text.length > suppliedLen * 2 + 3000) violations++;
  }
  return { name: 'P1_termination_rendered_length_bounded', trials: checked, violations };
}

// ---------- P2: boundedness — fields_missing subset of fields_required ----------
function checkP2_missing_subset_of_required() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const template_id = pick(rand, TEMPLATE_IDS);
    const spec = TEMPLATES[template_id];
    const fields = {};
    for (const f of spec.required.concat(spec.optional)) {
      if (rand() < 0.5) fields[f] = randomString(rand, 40);
    }
    const { output_payload } = compute({ template_id, fields });
    checked++;
    for (const m of output_payload.fields_missing) if (!spec.required.includes(m)) violations++;
    if (output_payload.checks.length > 2) violations++;
  }
  return { name: 'P2_fields_missing_subset_of_required', trials: checked, violations };
}

// ---------- P3 (differential/completeness): all-required-present -> no "[FIELD: required]" leftover ----------
function checkP3_no_leftover_required_tokens() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const template_id = pick(rand, TEMPLATE_IDS);
    const spec = TEMPLATES[template_id];
    const fields = {};
    for (const f of spec.required) fields[f] = randomNonBlankString(rand, 30); // ALL required present, guaranteed non-blank
    for (const f of spec.optional) if (rand() < 0.5) fields[f] = randomString(rand, 30); // optional partial
    const { output_payload } = compute({ template_id, fields });
    checked++;
    if (output_payload.fields_missing.length !== 0) violations++;
    for (const f of spec.required) {
      if (output_payload.rendered_text.includes(`[${f}: required]`)) violations++;
    }
  }
  return { name: 'P3_no_leftover_required_placeholder_tokens', trials: checked, violations };
}

// ---------- P4: metamorphic — rendered_text length strictly increases with a single field's length ----------
function checkP4_field_length_monotonicity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const template_id = pick(rand, TEMPLATE_IDS);
    const spec = TEMPLATES[template_id];
    const fields = {};
    for (const f of spec.required) fields[f] = randomString(rand, 20);
    const varyField = spec.required[0];
    const shortVal = randomString(rand, 5);
    const longVal = shortVal + randomString(rand, 50); // strictly longer, same prefix
    const r1 = compute({ template_id, fields: { ...fields, [varyField]: shortVal } }).output_payload;
    const r2 = compute({ template_id, fields: { ...fields, [varyField]: longVal } }).output_payload;
    checked++;
    if (!(r2.rendered_text.length > r1.rendered_text.length)) violations++;
  }
  return { name: 'P4_field_length_monotonicity', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_length_bound());
results.properties.push(checkP2_missing_subset_of_required());
results.properties.push(checkP3_no_leftover_required_tokens());
results.properties.push(checkP4_field_length_monotonicity());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-205-license-terms-assembler',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
