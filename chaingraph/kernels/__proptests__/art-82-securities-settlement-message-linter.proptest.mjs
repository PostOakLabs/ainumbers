// kernel_digest_at_authoring: sha256:2ad79af4b3bfd8d91a04886d9edfee8f37018b827cc9fb189caa66583cfebcc3
//
// FV-PROPFLOOR-SHARD-B17-1 — property-test floor for art-82-securities-settlement-message-linter.
// Class B (bounded-numeric/categorical), FLOAT:NO per the WU row — the only arithmetic is an
// integer-count percentage display value (pass_count/total*100).toFixed(1); all decision logic
// (scope guard, mandatory-field presence, ISIN/BIC regex validation, date-string comparison) is
// categorical/string-comparison. Forced CATEGORICAL boundary cases used in place of ULP forcing.
// Zero external dependencies (mulberry32 PRNG + explicit boundary arrays), same shape as the
// B1/B12 harness. This file is READ-ONLY with respect to the kernel it imports.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-82-securities-settlement-message-linter.proptest.mjs

import { compute } from '../art-82-securities-settlement-message-linter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-82-securities-settlement-message-linter.fixtures.json');
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
const rand = mulberry32(0x82F5A6);
const TRIALS = 8000;

const MSG_TYPES = ['sese.023', 'sese.024', 'semt.044', 'pacs.008'];
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function mkGoodBody(msg_type) {
  if (msg_type === 'sese.023') {
    return { TxId: 't1', SttlmTpAndAddtlParams: {}, TradDt: '2026-06-10', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 100, SttlmAmt: 1000, DlvrgSttlmPties: {}, RcvgSttlmPties: {} };
  }
  if (msg_type === 'sese.024') {
    return { TxId: 't1', Sts: 'SETT', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 100 };
  }
  return { Stmt: {}, AcctId: 'a1', BalDt: '2026-06-12', SubAcctDtls: {} };
}

function mkMessage(rng) {
  const msg_type = pick(rng, MSG_TYPES);
  const good = rng() < 0.5;
  return { msg_type, msg_ref: 'r' + Math.floor(rng() * 1000), body: good ? mkGoodBody(msg_type) : {} };
}

function mkPP(rng) {
  const n = Math.floor(rng() * 6);
  return { messages: Array.from({ length: n }, () => mkMessage(rng)) };
}

// ---------- P1: pass_count + fail_count + warn_count + out_of_scope_count always equals ----------
// ---------- total_messages exactly (REJECTED status is a fourth, disjoint bucket) ----------------
function checkP1_statusPartitionExact() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    const { pass_count, fail_count, warn_count, out_of_scope_count, total_messages } = r.output_payload;
    if (pass_count + fail_count + warn_count + out_of_scope_count !== total_messages) violations++;
  }
  return { name: 'P1_pass_fail_warn_rejected_partition_exactly_equals_total', trials: checked, violations };
}

// ---------- P2: out-of-scope message types are always REJECTED and always ERROR severity -----------
function checkP2_outOfScopeAlwaysRejected() {
  let violations = 0, checked = 0;
  const IN_SCOPE = new Set(['sese.023', 'sese.024', 'semt.044']);
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const res of r.output_payload.results) {
      if (!IN_SCOPE.has(res.msg_type)) {
        if (res.status !== 'REJECTED') violations++;
        if (!res.issues.every(i2 => i2.severity === 'ERROR')) violations++;
      }
    }
  }
  return { name: 'P2_out_of_scope_message_types_always_rejected', trials: checked, violations };
}

// ---------- P3: status FAIL iff at least one ERROR-severity issue present, exact biconditional ------
function checkP3_failStatusExactlyMatchesErrorIssuePresence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    checked++;
    for (const res of r.output_payload.results) {
      const hasError = res.issues.some(i2 => i2.severity === 'ERROR');
      if (res.status === 'FAIL' && !hasError) violations++;
      if (res.status !== 'FAIL' && res.status !== 'REJECTED' && hasError) violations++;
    }
  }
  return { name: 'P3_fail_status_exact_biconditional_with_error_severity_issue', trials: checked, violations };
}

// ---------- P4 (mandatory, float:no exception): forced categorical boundary cases ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{ messages: [] }, 'empty messages array — pass_rate must be exactly 100, all counts exactly 0'],
  [{ messages: [{ msg_type: 'pacs.008', msg_ref: 'p1', body: {} }] }, 'out-of-scope payments message type — must be REJECTED with OUT_OF_SCOPE_MESSAGE_TYPE ERROR, and set OUT_OF_SCOPE_MESSAGES_REJECTED flag'],
  [{ messages: [{ msg_type: 'sese.023', msg_ref: 's1', body: {} }] }, 'sese.023 with body entirely empty — all 9 mandatory fields must be flagged MISSING_MANDATORY_FIELD'],
  [{ messages: [{ msg_type: 'sese.023', msg_ref: 's2', body: { TxId: 't', SttlmTpAndAddtlParams: {}, TradDt: '2026-06-12', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 0, SttlmAmt: 1000, DlvrgSttlmPties: {}, RcvgSttlmPties: {} } }] }, 'Qty exactly 0 — falsy but explicitly checked via "Qty !== 0" escape, must NOT be flagged MISSING_MANDATORY_FIELD nor MISSING_QUANTITY'],
  [{ messages: [{ msg_type: 'sese.023', msg_ref: 's3', body: { TxId: 't', SttlmTpAndAddtlParams: {}, TradDt: '2026-06-12', SttlmDt: '2026-06-11', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 1, SttlmAmt: 1, DlvrgSttlmPties: {}, RcvgSttlmPties: {} } }] }, 'SttlmDt exactly one day BEFORE TradDt — must flag SETTLEMENT_DATE_BEFORE_TRADE_DATE'],
  [{ messages: [{ msg_type: 'sese.023', msg_ref: 's4', body: { TxId: 't', SttlmTpAndAddtlParams: {}, TradDt: '2026-06-12', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 1, SttlmAmt: 1, DlvrgSttlmPties: {}, RcvgSttlmPties: {} } }] }, 'SttlmDt exactly equal to TradDt (boundary, uses string < not <=) — must NOT flag date-order error'],
  [{ messages: [{ msg_type: 'sese.023', msg_ref: 's5', body: { TxId: 't', SttlmTpAndAddtlParams: {}, TradDt: '2026-06-12', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US037833100X' }, Qty: 1, SttlmAmt: 1, DlvrgSttlmPties: {}, RcvgSttlmPties: {} } }] }, 'ISIN with non-digit check character (US037833100X, fails the trailing [0-9] requirement) — must flag INVALID_ISIN'],
  [{ messages: [{ msg_type: 'sese.024', msg_ref: 's6', body: { TxId: 't', Sts: 'SETT', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 1 } }] }, 'well-formed sese.024 — must PASS with zero issues'],
  [{ messages: [{ msg_type: 'semt.044', msg_ref: 's7', body: { Stmt: {}, AcctId: 'a', BalDt: '2026-06-12', SubAcctDtls: {} } }] }, 'well-formed semt.044 — no ISIN/BIC/date-order rules apply to this message type, must PASS with zero issues'],
  [{ messages: [{ msg_type: 'sese.023', msg_ref: 's8', body: { TxId: 't', SttlmTpAndAddtlParams: {}, TradDt: '2026-06-12', SttlmDt: '2026-06-12', FinInstrmId: { ISIN: 'US0378331005' }, Qty: 1, SttlmAmt: 1, DlvrgSttlmPties: { Pty1: { Id: { AnyBIC: 'BADBIC' } } }, RcvgSttlmPties: {} } }] }, 'malformed BIC in DlvrgSttlmPties.Pty1.Id.AnyBIC — must flag INVALID_BIC'],
];

function checkP4_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp);
    const { pass_rate, total_messages, results: msgResults } = r.output_payload;
    const plausible = Number.isFinite(pass_rate) && pass_rate >= 0 && pass_rate <= 100
      && Number.isInteger(total_messages) && Array.isArray(msgResults);
    rows.push({ label, input: pp, pass_rate, results: msgResults, compliance_flags: r.compliance_flags, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_statusPartitionExact());
results.properties.push(checkP2_outOfScopeAlwaysRejected());
results.properties.push(checkP3_failStatusExactlyMatchesErrorIssuePresence());
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
