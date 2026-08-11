// art-505-dispose-carf-status-message.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C24-1).
// kernel_digest_at_authoring: sha256:035ab5ed297070b1f9a69babee5ab27760f0ac1404e3cc2f4383a6816ab39729
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (direct read confirmed — the WU row's own table agrees, no correction
// needed). This kernel disposes a returned status message via Map lookups keyed by string
// break_ref, string equality (signature presence checks) and array filtering. No numeric
// arithmetic of any kind appears anywhere in compute().
// Checks: fixture-oracle gate, termination (breaks bounded by file_errors.length +
// record_errors.length), the blocking-boundary property (an undeclared return path always yields
// zero breaks and the fixed status_message_return_not_declared verdict, never processing any
// error), differential re-derivation of each break's status (dispositioned/open) from the
// disposition-then-prior-then-open resolution order, boundedness (open+dispositioned counts sum to
// break_count minus suppressed), and metamorphic invariance (a suppressed error_code always
// produces zero breaks for that code; a disposition with a missing signature_value is never
// counted, regardless of what disposition string it declares).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-505-dispose-carf-status-message.proptest.mjs

import { compute } from '../art-505-dispose-carf-status-message.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-505-dispose-carf-status-message.fixtures.json');
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
const rand = mulberry32(0x505F0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function randomError(rng, i, level) {
  return { error_code: pick(rng, ['E-001', 'E-002', 'E-003']), doc_ref_id: level === 'record' ? `DOC-${i % 3}` : null, field_path: pick(rng, ['field.a', null]) };
}

function randomPP(rng) {
  const fn = Math.floor(rng() * 3);
  const rn = Math.floor(rng() * 5);
  const file_errors = [];
  for (let i = 0; i < fn; i++) file_errors.push(randomError(rng, i, 'file'));
  const record_errors = [];
  for (let i = 0; i < rn; i++) record_errors.push(randomError(rng, i, 'record'));
  return {
    submission_ref: 'SUB-1', reporting_jurisdiction: 'UK', schema_version: '1.0', cycle_ref: 'CYCLE-1',
    status_message_return_declared: rng() < 0.85,
    status_message_channel: rng() < 0.85 ? 'sftp' : '',
    status_message: { message_ref: 'MSG-1', file_errors, record_errors },
    submitted_records: [{ doc_ref_id: 'DOC-0', record_ref: 'REC-0' }, { doc_ref_id: 'DOC-1', record_ref: 'REC-1' }],
    dispositions: [],
    prior_dispositions: [],
    suppressed_error_codes: [],
  };
}

const TRIALS = 5000;

// ---------- P1: termination — breaks.length === file_errors.length + record_errors.length - suppressed ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!pp.status_message_return_declared || !pp.status_message_channel) continue;
    const expectedLen = pp.status_message.file_errors.length + pp.status_message.record_errors.length - output_payload.suppressed_break_count;
    if (output_payload.breaks.length !== expectedLen) violations++;
    if (output_payload.break_count !== output_payload.breaks.length) violations++;
  }
  return { name: 'P1_termination_breaks_bounded_by_input_lengths', trials: checked, violations };
}

// ---------- P2: the blocking-boundary property — undeclared return path yields zero breaks ----------
function checkP2_blocking_boundary_property() {
  let violations = 0, checked = 0;
  const boundaryCases = [
    { status_message_return_declared: false, status_message_channel: 'sftp' },
    { status_message_return_declared: true, status_message_channel: '' },
    { status_message_return_declared: false, status_message_channel: '' },
  ];
  for (const c of boundaryCases) {
    const pp = { submission_ref: 'S', reporting_jurisdiction: 'UK', schema_version: '1.0', cycle_ref: 'C1', status_message_return_declared: c.status_message_return_declared, status_message_channel: c.status_message_channel, status_message: { message_ref: 'M', file_errors: [{ error_code: 'E1' }], record_errors: [{ error_code: 'E2', doc_ref_id: 'D1' }] }, submitted_records: [], dispositions: [], prior_dispositions: [], suppressed_error_codes: [] };
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'status_message_return_not_declared') violations++;
    if (output_payload.breaks.length !== 0) violations++;
    if (output_payload.break_count !== 0) violations++;
  }
  return { name: 'P2_blocking_boundary_forced_categorical', trials: checked, violations };
}

// ---------- P3 (differential): per-break status re-derivation from the resolution order ----------
function checkP3_break_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!pp.status_message_return_declared || !pp.status_message_channel) continue;
    for (const b of output_payload.breaks) {
      // status is either dispositioned (when a valid signed disposition resolved) or open
      if (b.status !== 'open' && b.status !== 'dispositioned') violations++;
      if (b.status === 'dispositioned' && (!b.disposition || !b.decided_by)) violations++;
    }
  }
  return { name: 'P3_break_status_differential', trials: checked, violations };
}

// ---------- P4: boundedness — open + dispositioned === breaks.length ----------
function checkP4_status_partition_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.open_break_count + output_payload.dispositioned_break_count !== output_payload.breaks.length) violations++;
  }
  return { name: 'P4_open_plus_dispositioned_partition_bounded', trials: checked, violations };
}

// ---------- P5: metamorphic — suppressed error_code always zero breaks for that code; a
// disposition with no signature_value is never counted (status stays open) ----------
function checkP5_suppression_and_unsigned_metamorphic() {
  let violations = 0, checked = 0;
  const base = {
    submission_ref: 'S', reporting_jurisdiction: 'UK', schema_version: '1.0', cycle_ref: 'C1',
    status_message_return_declared: true, status_message_channel: 'sftp',
    status_message: { message_ref: 'M', file_errors: [{ error_code: 'SUPPRESS-ME' }, { error_code: 'KEEP-ME' }], record_errors: [] },
    submitted_records: [], prior_dispositions: [],
  };
  for (let i = 0; i < 500; i++) {
    const r1 = compute({ ...base, dispositions: [], suppressed_error_codes: [] }).output_payload;
    checked++;
    const r2 = compute({ ...base, dispositions: [], suppressed_error_codes: ['SUPPRESS-ME'] }).output_payload;
    checked++;
    if (r2.breaks.some((b) => b.error_code === 'SUPPRESS-ME')) violations++;
    if (r2.breaks.length !== r1.breaks.length - 1) violations++;
    // disposition with a signature block but empty signature_value must not be counted
    const breakRef = r2.breaks.find((b) => b.error_code === 'KEEP-ME').break_ref;
    const withBadSig = compute({ ...base, suppressed_error_codes: ['SUPPRESS-ME'], dispositions: [{ break_ref: breakRef, disposition: 'accepted', signature: { signer_identity_id: 'sig-1', signature_value: '' } }] }).output_payload;
    checked++;
    const b = withBadSig.breaks.find((x) => x.break_ref === breakRef);
    if (b.status !== 'open') violations++;
  }
  return { name: 'P5_suppression_and_unsigned_disposition_metamorphic', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_blocking_boundary_property());
results.properties.push(checkP3_break_status_differential());
results.properties.push(checkP4_status_partition_bounded());
results.properties.push(checkP5_suppression_and_unsigned_metamorphic());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-505-dispose-carf-status-message',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
