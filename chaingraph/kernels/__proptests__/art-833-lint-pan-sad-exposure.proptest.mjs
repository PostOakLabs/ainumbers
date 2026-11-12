// art-833-lint-pan-sad-exposure — class-K property-test floor (FV-PBT-FLOOR-BUILD-SPEC.md).
// Authored by PAN-SAD-EXPOSURE-LINT-1, 2026-11-04.
// spec: node shard art-833-lint-pan-sad-exposure.json, cited_clause_digest (PCI DSS v4.0.1
//       excerpts 3.3.1.x / 3.4.1 / 3.5.1.x registered in clause-snapshot-registry.json)
// kernel_digest_at_authoring: sha256:0bf4137a67dbe6815e5a5db00f892291536a288047849f787875139461ab3d16
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-833-lint-pan-sad-exposure.proptest.mjs

import { compute } from '../art-833-lint-pan-sad-exposure.kernel.mjs';
import { runFixtureOracle, summarize, deepEqual } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KERNEL_ID = 'art-833-lint-pan-sad-exposure';
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, '..', 'fixtures');

const VERDICTS = new Set(['input_refused', 'no_findings', 'manual_review_required', 'findings_present']);
const SAD_CLASSES = ['full_track_data', 'card_verification_code', 'pin_or_pin_block'];

function baseRecord(mask) {
  return {
    record: {
      record_type: 'card_token',
      fields: [{ name: 'pan', value_class: 'primary_account_number', mask_expression: mask }],
    },
    stored_elements: [
      { name: 'pan_index_store', sad_class: 'none', retention: 'after_authorization', storage_location_class: 'persistent', encrypted: true },
    ],
  };
}

// P1 determinism: every fixture and reachability vector computes identically on a second run.
function checkDeterminism() {
  const files = [`${KERNEL_ID}.fixtures.json`, `${KERNEL_ID}.reachability.json`];
  let checked = 0;
  let violations = 0;
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8'));
    for (const vec of doc.vectors) {
      const a = compute(vec.policy_parameters);
      const b = compute(vec.policy_parameters);
      checked += 1;
      if (!deepEqual(a, b)) violations += 1;
    }
  }
  return { name: 'determinism_over_all_vectors', checked, violations };
}

// P2 ceiling safety: a mask within the first-six/last-four ceiling never produces an
// exceeds-ceiling finding; a mask beyond it on either side always produces exactly one.
function checkCeilingSafety() {
  let checked = 0;
  let violations = 0;
  const okMasks = ['prefix:0,suffix:0', 'redact:all', 'prefix:6,suffix:4', 'suffix:4', 'prefix:6', 'prefix:1,suffix:2'];
  const badMasks = ['prefix:7,suffix:4', 'prefix:6,suffix:5', 'prefix:99,suffix:99', 'prefix:8,suffix:0'];
  for (const m of okMasks) {
    const r = compute(baseRecord(m));
    checked += 1;
    if (r.compliance_flags.includes('MASK_DISPLAY_EXCEEDS_CEILING')) violations += 1;
    if (r.output_payload.field_exposure[0].verdict === 'exceeds_ceiling') violations += 1;
  }
  for (const m of badMasks) {
    const r = compute(baseRecord(m));
    checked += 1;
    if (!r.compliance_flags.includes('MASK_DISPLAY_EXCEEDS_CEILING')) violations += 1;
  }
  return { name: 'display_ceiling_boundary', checked, violations };
}

// P3 encryption invariance: encryption never clears a persistent after-authorization SAD
// finding, for every SAD subclass (Requirement 3.3.1 "even if encrypted"; 3.3.1.3 for
// re-encrypted PIN blocks).
function checkEncryptionNeverClearsSadFinding() {
  let checked = 0;
  let violations = 0;
  for (const sad of SAD_CLASSES) {
    for (const encrypted of [true, false]) {
      const pp = {
        record: { record_type: 'card_token', fields: [{ name: 'pan', value_class: 'primary_account_number', mask_expression: 'prefix:6,suffix:4' }] },
        stored_elements: [{ name: 'e', sad_class: sad, retention: 'after_authorization', storage_location_class: 'persistent', encrypted }],
      };
      const r = compute(pp);
      checked += 1;
      if (!r.compliance_flags.includes('SAD_STORED_AFTER_AUTHORIZATION')) violations += 1;
      if (r.output_payload.findings[0].paragraph.indexOf(sad === 'full_track_data' ? '3.3.1.1' : sad === 'card_verification_code' ? '3.3.1.2' : '3.3.1.3') < 0) violations += 1;
    }
  }
  return { name: 'encryption_never_clears_sad_finding', checked, violations };
}

// P4 refusal totality: every reachability vector reaches INPUT_REFUSED with a structured
// non-verdict, and an unknown enum value never produces findings.
function checkRefusalTotality() {
  let checked = 0;
  let violations = 0;
  const reach = JSON.parse(readFileSync(join(FIXTURES_DIR, `${KERNEL_ID}.reachability.json`), 'utf8'));
  for (const vec of reach.vectors) {
    const r = compute(vec.policy_parameters);
    checked += 1;
    if (!r.compliance_flags.includes('INPUT_REFUSED')) violations += 1;
    if (r.output_payload.verdict !== 'input_refused') violations += 1;
  }
  return { name: 'refusal_totality_over_reachability_vectors', checked, violations };
}

// P5 flag mirror (AUTHORING-STANDARD section 2): output_payload.issues is truthy exactly
// when compliance_flags is non-empty, and manual_review_required is truthy exactly when at
// least one manual-review flag is present.
function checkFlagMirror() {
  const cases = [];
  for (const m of ['prefix:6,suffix:4', 'prefix:8,suffix:4', '', 'plain']) cases.push(baseRecord(m));
  cases.push({});
  const reach = JSON.parse(readFileSync(join(FIXTURES_DIR, `${KERNEL_ID}.reachability.json`), 'utf8'));
  for (const vec of reach.vectors) cases.push(vec.policy_parameters);
  let checked = 0;
  let violations = 0;
  for (const pp of cases) {
    const r = compute(pp);
    const op = r.output_payload;
    checked += 1;
    const issuesTruthy = Array.isArray(op.issues) && op.issues.length > 0;
    const flagsTruthy = Array.isArray(r.compliance_flags) && r.compliance_flags.length > 0;
    if (issuesTruthy !== flagsTruthy) violations += 1;
    const mrTruthy = op.manual_review_required === true;
    const mrFlags = (r.compliance_flags || []).some((c) => c.indexOf('REVIEW') >= 0 || c === 'DISPLAY_EXPRESSION_NOT_ANALYZED');
    if (mrTruthy !== mrFlags) violations += 1;
    if (!VERDICTS.has(op.verdict)) violations += 1;
  }
  return { name: 'flag_mirror_issues_and_manual_review', checked, violations };
}

// P6 clean-input totality: the refusal path never swallows well-formed input. Every
// conformance vector (all well-formed) must produce a non-refused verdict.
function checkWellFormedInputNeverRefused() {
  const doc = JSON.parse(readFileSync(join(FIXTURES_DIR, `${KERNEL_ID}.fixtures.json`), 'utf8'));
  let checked = 0;
  let violations = 0;
  for (const vec of doc.vectors) {
    const r = compute(vec.policy_parameters);
    checked += 1;
    if (r.compliance_flags.includes('INPUT_REFUSED')) violations += 1;
  }
  return { name: 'well_formed_conformance_inputs_never_refused', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkCeilingSafety(),
  checkEncryptionNeverClearsSadFinding(),
  checkRefusalTotality(),
  checkFlagMirror(),
  checkWellFormedInputNeverRefused(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — PAN masking / SAD retention / digest exposure.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
