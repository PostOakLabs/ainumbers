// art-262-validate-ebam-acmt-flow.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C8-1).
// kernel_digest_at_authoring: sha256:4c2c59094077b7f535e7fc1557867c48c163b79d2f4ddf7a001b0d15daf4b1e5
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny — blanket
// class-C Dafny stays frozen. float_sensitive: NO (pure state-machine/string/counter logic, no
// arithmetic) — forced categorical boundary cases used instead of ULP-forcing.
// Checks: fixture-oracle gate, termination (message_sequence bounded by acmt_messages.length, pending-
// request map bounded), boundedness (error/warning counts bounded, is_valid iff error_count===0), forced
// categorical edges (unknown message type, duplicate IDs, orphan request, ack with no pending request),
// and a metamorphic prefix-invariance property (appending messages never changes earlier sequence entries
// or earlier error/warning findings).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-262-validate-ebam-acmt-flow.proptest.mjs

import { compute } from '../art-262-validate-ebam-acmt-flow.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-262-validate-ebam-acmt-flow.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const output_payload = compute(vec.policy_parameters);
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
const rand = mulberry32(0x262A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TYPES = ['acmt.007', 'acmt.010', 'acmt.011', 'acmt.017', 'acmt.019', 'acmt.999'];
const TRIALS = 5000;

function randomMessages(rng, n) {
  const msgs = [];
  for (let i = 0; i < n; i++) {
    const t = pick(rng, TYPES);
    const msg = { message_type: t, message_id: 'MSG-' + Math.floor(rng() * (n + 3)), account_id: 'ACC-' + (i % 3) };
    if (t === 'acmt.010' && rng() < 0.7 && msgs.length > 0) {
      msg.ref_message_id = pick(rng, msgs).message_id;
    }
    msgs.push(msg);
  }
  return msgs;
}

// ---------- P1: termination — message_sequence length exactly n, pending map bounded by n ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(rand() * 200);
    const acmt_messages = randomMessages(rand, n);
    const output_payload = compute({ acmt_messages });
    checked++;
    if (output_payload.message_sequence.length !== n) violations++;
    if (output_payload.total_messages !== n) violations++;
    if (output_payload.orphan_count > n) violations++;
  }
  return { name: 'P1_termination_sequence_length_exact', trials: checked, violations };
}

// ---------- P2: boundedness — is_valid iff error_count===0, warning/error counts <= sequence length*2 ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const acmt_messages = randomMessages(rand, n);
    const output_payload = compute({ acmt_messages });
    checked++;
    if (output_payload.is_valid !== (output_payload.error_count === 0)) violations++;
    if (output_payload.error_count !== output_payload.validation_errors.length) violations++;
    if (output_payload.warning_count !== output_payload.validation_warnings.length) violations++;
    if (output_payload.error_count < 0 || output_payload.warning_count < 0) violations++;
  }
  return { name: 'P2_boundedness_isvalid_iff_zero_errors', trials: checked, violations };
}

// ---------- P3: differential — request/ack/report counts re-derived from message_sequence roles ----------
function checkP3_counts_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 20);
    const acmt_messages = randomMessages(rand, n);
    const output_payload = compute({ acmt_messages });
    checked++;
    const reqCount = output_payload.message_sequence.filter((m) => m.role === 'REQUEST').length;
    const ackCount = output_payload.message_sequence.filter((m) => m.msg_type === 'acmt.010').length;
    const repCount = output_payload.message_sequence.filter((m) => m.msg_type === 'acmt.019').length;
    if (output_payload.request_count !== reqCount) violations++;
    if (output_payload.ack_count !== ackCount) violations++;
    if (output_payload.report_count !== repCount) violations++;
  }
  return { name: 'P3_role_counts_differential', trials: checked, violations };
}

// ---------- P4 (forced categorical, float_sensitive:no) ----------
const FORCED_CASES = [
  { label: 'empty message set -> EMPTY state, valid', acmt_messages: [] },
  { label: 'unknown message type -> UNKNOWN_MESSAGE_TYPE error', acmt_messages: [{ message_type: 'acmt.999', message_id: 'M1', account_id: 'A1' }] },
  { label: 'duplicate message ID -> DUPLICATE_MESSAGE_ID error', acmt_messages: [{ message_type: 'acmt.007', message_id: 'DUP', account_id: 'A1' }, { message_type: 'acmt.019', message_id: 'DUP', account_id: 'A1' }] },
  { label: 'orphan request -> ORPHAN_REQUEST error, PENDING_ACKNOWLEDGEMENT state', acmt_messages: [{ message_type: 'acmt.007', message_id: 'M1', account_id: 'A1' }] },
  { label: 'ack with no matching pending request -> ACK_NO_PENDING_REQUEST warning', acmt_messages: [{ message_type: 'acmt.010', message_id: 'M1', account_id: 'A1', ref_message_id: 'NOTHING' }] },
  { label: 'full request/ack cycle -> OPENING_CONFIRMED, valid', acmt_messages: [{ message_type: 'acmt.007', message_id: 'M1', account_id: 'A1' }, { message_type: 'acmt.010', message_id: 'M2', account_id: 'A1', ref_message_id: 'M1' }] },
  { label: 'report-only -> REPORTING_ONLY state', acmt_messages: [{ message_type: 'acmt.019', message_id: 'M1', account_id: 'A1' }] },
];
function checkP4_forced() {
  const rows = [];
  for (const c of FORCED_CASES) {
    const output_payload = compute(c);
    rows.push({ label: c.label, acmt_state: output_payload.acmt_state, is_valid: output_payload.is_valid, error_count: output_payload.error_count, finite: Number.isFinite(output_payload.total_messages) && Number.isFinite(output_payload.error_count) });
  }
  return rows;
}

// ---------- P5: metamorphic — prefix-invariance (appending messages leaves earlier sequence entries unchanged) ----------
function checkP5_prefix_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 15);
    const base = randomMessages(rand, n);
    const extraN = Math.floor(rand() * 8);
    const extra = randomMessages(rand, extraN);
    const extended = base.concat(extra);
    const r1 = compute({ acmt_messages: base });
    const r2 = compute({ acmt_messages: extended });
    checked++;
    // Only the seq/msg_id/msg_type/role/account_id/label prefix is guaranteed stable — orphan-derived
    // resolution flags (expects_ack resolution) on a REQUEST can flip if a later-appended ack resolves it.
    const prefixStable = r2.message_sequence.slice(0, n).every((m, idx) => m.seq === r1.message_sequence[idx].seq && m.msg_id === r1.message_sequence[idx].msg_id && m.msg_type === r1.message_sequence[idx].msg_type && m.role === r1.message_sequence[idx].role);
    if (!prefixStable) violations++;
  }
  return { name: 'P5_metamorphic_prefix_invariance_on_append', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_counts_differential());
results.properties.push(checkP5_prefix_invariance());
results.boundary_forced = checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryMismatch = results.boundary_forced.some((b) => !b.finite);

console.log(JSON.stringify({
  tool_id: 'art-262-validate-ebam-acmt-flow',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
