// art-293-einvoice-format-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:5daa83b6ade4cbfb782fb404e16e80077c9264bb4f636e9c1d6e564294e89f58
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (presence/codelist/cardinality checks over strings and array shapes,
// no arithmetic — confirmed by direct read).
// Checks: fixture-oracle gate, termination (findings.length bounded by the format's required-
// field count + 2 fixed rules + line_items.length), differential re-derivation of
// structural_completeness and missing_fields, and metamorphic prefix-invariance (appending a
// line item never changes the findings already produced for the document-level fields or
// earlier line items).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-293-einvoice-format-validator.proptest.mjs

import { compute } from '../art-293-einvoice-format-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-293-einvoice-format-validator.fixtures.json');
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
const rand = mulberry32(0x293A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const REQUIRED_BY_FORMAT = {
  'factur-x': ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  'xrechnung': ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name', 'leitweg_id'],
  'pint-ae': ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  'myinvois': ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  'peppol-bis3': ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
  'ksef-fa3': ['invoice_number', 'invoice_date', 'currency_code', 'seller_name', 'seller_vat_id', 'buyer_name'],
};
const FORMATS = Object.keys(REQUIRED_BY_FORMAT);
const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'MYR', 'ZZZ'];
const VAT_CATS = ['S', 'Z', 'E', 'AE', 'O', 'X'];

function randomFields(rng, format) {
  const fields = {};
  for (const f of REQUIRED_BY_FORMAT[format]) {
    if (rng() < 0.75) fields[f] = f + '-' + Math.floor(rng() * 1000);
  }
  fields.currency_code = pick(rng, CURRENCIES);
  return fields;
}
function randomLineItem(rng) { return { vat_category: pick(rng, VAT_CATS) }; }
function randomDocument(rng) {
  if (rng() < 0.1) return null;
  const format = rng() < 0.9 ? pick(rng, FORMATS) : 'unknown-format';
  const fields = randomFields(rng, REQUIRED_BY_FORMAT[format] ? format : 'factur-x');
  const nLines = Math.floor(rng() * 6);
  const line_items = Array.from({ length: nLines }, () => randomLineItem(rng));
  return { format, fields, line_items };
}

const TRIALS = 5000;

// ---------- P1: termination — findings.length bounded by required-count + 2 + line_items.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const document = randomDocument(rand);
    const { output_payload } = compute({ document });
    checked++;
    if (output_payload.parse_error !== null) {
      if (output_payload.findings.length !== 0) violations++;
      continue;
    }
    const required = REQUIRED_BY_FORMAT[output_payload.format];
    const expectedLen = required.length + 2 + output_payload.line_item_count;
    if (output_payload.findings.length !== expectedLen) violations++;
  }
  return { name: 'P1_termination_findings_bounded_by_required_plus_lines', trials: checked, violations };
}

// ---------- P2 (differential): structural_completeness + missing_fields re-derived ----------
function checkP2_completeness_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const document = randomDocument(rand);
    const { output_payload } = compute({ document });
    checked++;
    if (output_payload.parse_error !== null) continue;
    const expectedCompleteness = output_payload.findings.every((f) => f.pass);
    if (output_payload.structural_completeness !== expectedCompleteness) violations++;
    // missing_fields tracks every non-passing finding except per-line vat_category codelist
    // failures, which are reported only inside findings[] (confirmed by direct kernel read).
    const expectedMissingCount = output_payload.findings.filter((f) => !f.pass && !f.rule.startsWith('codelist:line[')).length;
    if (output_payload.missing_fields.length !== expectedMissingCount) violations++;
  }
  return { name: 'P2_structural_completeness_differential', trials: checked, violations };
}

// ---------- P3: boundedness — every finding.pass is boolean, rule strings well-formed ----------
function checkP3_findings_shape_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const document = randomDocument(rand);
    const { output_payload } = compute({ document });
    checked++;
    for (const f of output_payload.findings) {
      if (typeof f.pass !== 'boolean') violations++;
      if (typeof f.rule !== 'string' || f.rule.length === 0) violations++;
    }
  }
  return { name: 'P3_findings_shape_bounded', trials: checked, violations };
}

// ---------- P4: metamorphic — appending a line item leaves earlier findings unchanged ----------
function checkP4_prefix_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const format = pick(rand, FORMATS);
    const fields = randomFields(rand, format);
    // nBase >= 1 so the cardinality:line_items_non_empty finding (which depends on the FULL
    // line_items.length, not a prefix) stays pass=true in both r1 and r2 — otherwise appending
    // items to an empty base would legitimately flip that single finding, which is not a bug.
    const nBase = 1 + Math.floor(rand() * 4);
    const base = Array.from({ length: nBase }, () => randomLineItem(rand));
    const nExtra = Math.floor(rand() * 3);
    const extra = Array.from({ length: nExtra }, () => randomLineItem(rand));
    const r1 = compute({ document: { format, fields, line_items: base } }).output_payload;
    const r2 = compute({ document: { format, fields, line_items: base.concat(extra) } }).output_payload;
    checked++;
    const prefixLen = REQUIRED_BY_FORMAT[format].length + 2 + nBase;
    if (JSON.stringify(r1.findings) !== JSON.stringify(r2.findings.slice(0, prefixLen))) violations++;
  }
  return { name: 'P4_prefix_invariance_on_line_item_append', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_completeness_differential());
results.properties.push(checkP3_findings_shape_bounded());
results.properties.push(checkP4_prefix_invariance());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-293-einvoice-format-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
