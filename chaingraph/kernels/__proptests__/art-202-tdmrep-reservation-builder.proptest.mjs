// art-202-tdmrep-reservation-builder property-test floor (FV-PROPFLOOR-SHARD-A-REMAINDER-2).
// kernel_digest_at_authoring: sha256:77d5d176f6eb5aa056509c41f30ed50029f753eba0fb68413759e38b7b670e08
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED
// domain, not a totality proof. Shape: 3-item fixed schema_checks array (reservation_value,
// location_format, policy_url_format) feeding an all_checks_pass gap flag, alongside a
// tdmrep_json rule + HTTP-header + HTML-meta-tag string builder from a reserved flag, an
// optional location pattern, and an optional policy URL -- confirmed against direct kernel
// source read per this row's fence (re-derived as the 13th kernel missing from wave 3's own
// row text, per this row's own note).
// float:no (reserved coerces to a 0/1 int; location/policy_url are declared strings) -- forced
// CATEGORICAL boundary cases (reserved true/false/0/1/'0', valid/invalid location, valid/invalid/
// absent policy_url -- all 3 schema_checks pass/fail combinations exercised) stand in for ULP
// forcing. ZERO external dependencies -- pure Node built-ins only. READ-ONLY w.r.t. the kernel
// it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-202-tdmrep-reservation-builder.proptest.mjs

import { compute } from '../art-202-tdmrep-reservation-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function isValidHttpUrl(u) { if (!u) return true; return /^https?:\/\/[^\s]+$/.test(u); }
function isValidLocation(loc) { return typeof loc === 'string' && loc.length > 0 && loc[0] === '/'; }

const RESERVED_VALUES = [true, false, 1, 0, '0', 'yes', undefined];
const LOCATIONS = ['/', '/path/to/content', 'no-leading-slash', '', undefined];
const POLICY_URLS = ['https://example.com/policy', 'http://example.com', 'not-a-url', '', undefined];

function randomPP(rng) {
  return { reserved: pick(rng, RESERVED_VALUES), location: pick(rng, LOCATIONS), policy_url: pick(rng, POLICY_URLS) };
}

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-202-tdmrep-reservation-builder.fixtures.json');
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

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const { output_payload } = compute({});
  const mutated = { ...output_payload, tdm_reservation: output_payload.tdm_reservation === 1 ? 0 : 1 };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: tdm_reservation coercion agreement -- 0 iff reserved is exactly false/0/'0', else 1.
function checkP1_reservationCoercionAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(202001);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    const expected = (pp.reserved === false || pp.reserved === 0 || pp.reserved === '0') ? 0 : 1;
    if (output_payload.tdm_reservation !== expected) violations++;
  }
  return { name: 'P1_reservation_coercion_agreement_random300', trials: checked, violations };
}

// P2: schema_checks 3-item shape and all_checks_pass agreement, random 300-sample.
function checkP2_schemaChecksAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(202002);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.schema_checks.length !== 3) violations++;
    const loc = output_payload.location;
    const policy_url = typeof pp.policy_url === 'string' ? pp.policy_url.trim() : '';
    const locCheck = output_payload.schema_checks.find((c) => c.check === 'location_format');
    if (!locCheck || locCheck.pass !== isValidLocation(loc)) violations++;
    const urlCheck = output_payload.schema_checks.find((c) => c.check === 'policy_url_format');
    if (!urlCheck || urlCheck.pass !== isValidHttpUrl(policy_url)) violations++;
    const resCheck = output_payload.schema_checks.find((c) => c.check === 'reservation_value');
    if (!resCheck || resCheck.pass !== true) violations++;
    const expectedAllPass = output_payload.schema_checks.every((c) => c.pass);
    if (output_payload.all_checks_pass !== expectedAllPass) violations++;
  }
  return { name: 'P2_schema_checks_agreement_random300', trials: checked, violations };
}

// P3: tdmrep_json / content_usage_header / meta_tag_html agree with tdm_reservation + location + policy_url.
function checkP3_builderOutputAgreement() {
  let violations = 0, checked = 0;
  const rng = mulberry32(202003);
  for (let i = 0; i < 300; i++) {
    const pp = randomPP(rng);
    const { output_payload } = compute(pp);
    checked++;
    const rule = output_payload.tdmrep_json[0];
    if (rule.location !== output_payload.location) violations++;
    if (rule['tdm-reservation'] !== output_payload.tdm_reservation) violations++;
    const policy_url = typeof pp.policy_url === 'string' ? pp.policy_url.trim() : '';
    if (policy_url && rule['tdm-policy'] !== policy_url) violations++;
    if (!policy_url && 'tdm-policy' in rule) violations++;
    if (!output_payload.content_usage_header.includes(`tdm-reservation: ${output_payload.tdm_reservation}`)) violations++;
    if (!output_payload.meta_tag_html.includes(`content="${output_payload.tdm_reservation}"`)) violations++;
  }
  return { name: 'P3_builder_output_agreement_random300', trials: checked, violations };
}

// P4: forced categorical boundary cases -- all 3 schema_checks pass/fail combinations exercised
// (default all-pass, bad location, bad policy_url, both bad), plus every declared reserved value.
function checkP4_forcedCategoricalBoundaries() {
  let violations = 0, checked = 0;

  let r = compute({}).output_payload;
  checked++; if (r.all_checks_pass !== true) violations++;

  r = compute({ location: 'no-slash' }).output_payload;
  checked++; if (r.all_checks_pass !== false) violations++;

  r = compute({ policy_url: 'not-a-url' }).output_payload;
  checked++; if (r.all_checks_pass !== false) violations++;

  r = compute({ location: 'no-slash', policy_url: 'not-a-url' }).output_payload;
  checked++; if (r.all_checks_pass !== false) violations++;

  for (const v of RESERVED_VALUES) {
    r = compute({ reserved: v }).output_payload;
    checked++;
    const expected = (v === false || v === 0 || v === '0') ? 0 : 1;
    if (r.tdm_reservation !== expected) violations++;
  }

  return { name: 'P4_forced_categorical_boundary_cases_schema_checks_and_reserved', trials: checked, violations };
}

// P5: output shape / no NaN / undefined across missing-field and empty-object inputs.
function checkP5_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const inputs = [{}, { reserved: true }, { location: '/x', policy_url: 'https://example.com' }, { iscc_ref: 'ISCC:abc' }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (![0, 1].includes(output_payload.tdm_reservation)) violations++;
    if (typeof output_payload.location !== 'string') violations++;
    if (!Array.isArray(output_payload.tdmrep_json)) violations++;
    if (typeof output_payload.content_usage_header !== 'string') violations++;
    if (typeof output_payload.meta_tag_html !== 'string') violations++;
    if (!Array.isArray(output_payload.schema_checks) || output_payload.schema_checks.length !== 3) violations++;
    if (typeof output_payload.all_checks_pass !== 'boolean') violations++;
  }
  return { name: 'P5_output_shape_no_nan_undefined', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_reservationCoercionAgreement());
results.properties.push(checkP2_schemaChecksAgreement());
results.properties.push(checkP3_builderOutputAgreement());
results.properties.push(checkP4_forcedCategoricalBoundaries());
results.properties.push(checkP5_outputShapeInvariant());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-202-tdmrep-reservation-builder',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
