// art-676-proxy-voting-record — class-K property-test FLOOR. Authored by PROXY-VOTING-BUILD-1
// per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:684f0bd52c60833ce89a99a4aa4d3936af39acf0c8f4df688c3a77bd4fdeea81
// spec: PROXY-VOTING-BUILD-SPEC.md (canonical preimage, execution_hash pinned at staging)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-676-proxy-voting-record.proptest.mjs

import { compute } from '../art-676-proxy-voting-record.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-676-proxy-voting-record';

const MS_PER_DAY = 86400000;

// Deterministic date helpers over the declared YYYY-MM-DD domain.
function utcDays(s) {
  const y = Number(s.slice(0, 4)); const mo = Number(s.slice(5, 7)); const d = Number(s.slice(8, 10));
  return Date.UTC(y, mo - 1, d) / MS_PER_DAY;
}
function daysStr(n) {
  // format a day offset (0..40) as an ISO date in September/October 2026
  const t = Date.UTC(2026, 8, 1) + n * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

// P1: entitlement/sum + deadline arithmetic consistency on the success path.
// For random well-formed inputs: entitled_shares = sum(shares); days_before_deadline equals
// the UTC calendar difference; instruction_within_deadline === (days >= 0); overall matches.
function checkRecordArithmetic() {
  const rng = mulberry32(676);
  let checked = 0; const violations = [];
  for (let i = 0; i < 300; i++) {
    const nPos = 1 + Math.floor(rng() * 4);
    const positions = [];
    let sum = 0;
    for (let j = 0; j < nPos; j++) {
      const shares = 1 + Math.floor(rng() * 100000);
      positions.push({ account: `ACCT-${i}-${j}`, shares });
      sum += shares;
    }
    const recN = Math.floor(rng() * 30);
    const dlN = recN + Math.floor(rng() * 40) - 5; // sometimes after received (late path is still computable)
    const pp = {
      meeting: { record_date: daysStr(recN), vote_deadline: daysStr(dlN) },
      positions,
      instruction: { received: daysStr(recN + Math.floor(rng() * 30)), direction: 'for' },
    };
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    const expectedDays = (utcDays(pp.meeting.vote_deadline) - utcDays(pp.instruction.received));
    if (op.entitled_shares !== sum) violations.push(`entitled_shares ${op.entitled_shares} != sum ${sum}`);
    if (op.days_before_deadline !== expectedDays) violations.push(`days ${op.days_before_deadline} != ${expectedDays}`);
    if (op.instruction_within_deadline !== (expectedDays >= 0)) violations.push('within_deadline inconsistent with days');
    const expectedOverall = expectedDays >= 0 ? 'VOTE_RECORDED' : 'INSTRUCTION_LATE';
    if (op.overall !== expectedOverall) violations.push(`overall ${op.overall} != ${expectedOverall}`);
    if (compliance_flags.length !== 0) violations.push(`unexpected flags ${compliance_flags.join(',')}`);
    if (typeof op.trace !== 'string' || !op.trace.includes('deadline')) violations.push('trace missing');
  }
  return { name: 'record_arithmetic_consistency', checked, violations: violations.length };
}

// P2: invalid-domain rejection — malformed inputs always fail closed with named errors,
// null record fields, and never a partially computed value.
function checkFailClosed() {
  const rng = mulberry32(6761);
  let checked = 0; const violations = [];
  const badInputs = [
    {},
    { meeting: null, positions: null, instruction: null },
    { meeting: { record_date: '2026-13-40', vote_deadline: '2026-10-01' }, positions: [{ account: 'A', shares: 10 }], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: 'not-a-date' }, positions: [{ account: 'A', shares: 10 }], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-02-30' }, positions: [{ account: 'A', shares: 10 }], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-10-01' }, positions: [], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-10-01' }, positions: [{ account: '', shares: 10 }], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-10-01' }, positions: [{ account: 'A', shares: 0 }], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-10-01' }, positions: [{ account: 'A', shares: 10.5 }], instruction: { received: '2026-09-20', direction: 'for' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-10-01' }, positions: [{ account: 'A', shares: 10 }], instruction: { received: '2026-09-20', direction: 'maybe' } },
    { meeting: { record_date: '2026-09-15', vote_deadline: '2026-10-01' }, positions: [{ account: 'A', shares: 10 }], instruction: { received: '2026-09-20' } },
  ];
  for (const pp of badInputs) {
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) violations.push('no domain_errors on malformed input');
    if (op.entitled_shares !== null || op.instruction_within_deadline !== null || op.days_before_deadline !== null || op.overall !== null) {
      violations.push('fail-closed payload did not null every record field');
    }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations.push('DOMAIN_ERROR flag missing');
  }
  // fuzz: random junk shapes must never throw and never produce a computable record
  for (let i = 0; i < 200; i++) {
    const junk = {};
    const keys = ['meeting', 'positions', 'instruction'];
    for (const k of keys) {
      const r = rng();
      if (r < 0.3) continue; // absent
      if (r < 0.5) junk[k] = null;
      else if (r < 0.7) junk[k] = Math.floor(rng() * 100);
      else if (k === 'positions') junk[k] = [{ account: rng() < 0.5 ? 'A' : 5, shares: rng() < 0.5 ? -3 : 'x' }];
      else junk[k] = { [k === 'meeting' ? 'record_date' : 'received']: rng() < 0.5 ? '2026-09-15' : 42 };
    }
    const { output_payload: op } = compute(junk);
    checked++;
    if (op.overall === 'VOTE_RECORDED' || op.overall === 'INSTRUCTION_LATE') {
      if (!Array.isArray(op.domain_errors)) violations.push('computable verdict reached without declared inputs');
    }
  }
  return { name: 'fail_closed_rejection', checked, violations: violations.length };
}

// P3: determinism — identical inputs produce byte-identical outputs across repeated calls.
function checkDeterminism() {
  const rng = mulberry32(6762);
  let checked = 0; const violations = [];
  for (let i = 0; i < 100; i++) {
    const pp = {
      meeting: { record_date: daysStr(Math.floor(rng() * 20)), vote_deadline: daysStr(20 + Math.floor(rng() * 20)) },
      positions: [{ account: 'A1', shares: 1 + Math.floor(rng() * 9999) }],
      instruction: { received: daysStr(Math.floor(rng() * 30)), direction: 'against' },
    };
    const a = compute(pp); const b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) violations.push('repeated compute() diverged');
  }
  return { name: 'determinism', checked, violations: violations.length };
}

// P4: output shape — success path carries exactly the five pinned record fields,
// no NaN/undefined anywhere, whole shares and whole days.
function checkOutputShape() {
  const rng = mulberry32(6763);
  let checked = 0; const violations = [];
  const SUCCESS_KEYS = ['entitled_shares', 'instruction_within_deadline', 'days_before_deadline', 'trace', 'overall'];
  const FAIL_KEYS = ['entitled_shares', 'instruction_within_deadline', 'days_before_deadline', 'trace', 'overall', 'domain_errors'];
  for (let i = 0; i < 200; i++) {
    const good = rng() < 0.5;
    const pp = good
      ? { meeting: { record_date: daysStr(0), vote_deadline: daysStr(30) }, positions: [{ account: 'A', shares: 5 }], instruction: { received: daysStr(3), direction: 'withhold' } }
      : { meeting: { record_date: 'bad' }, positions: [], instruction: { received: null, direction: 7 } };
    const { output_payload: op } = compute(pp);
    checked++;
    const keys = Object.keys(op).sort().join(',');
    const expectedKeys = (good ? SUCCESS_KEYS : FAIL_KEYS).slice().sort().join(',');
    if (keys !== expectedKeys) violations.push(`payload keys ${keys} != ${expectedKeys}`);
    const shape = findShapeViolations(op);
    if (shape.length) violations.push(shape.join('; '));
    if (good && (!Number.isInteger(op.entitled_shares) || !Number.isInteger(op.days_before_deadline))) {
      violations.push('shares and days must be whole numbers');
    }
  }
  return { name: 'output_shape_pinned', checked, violations: violations.length };
}

// P5: monotonicity — moving the received date later by one day decreases
// days_before_deadline by exactly one and can only flip the verdict from recorded to late.
function checkDeadlineMonotonicity() {
  const rng = mulberry32(6764);
  let checked = 0; const violations = [];
  for (let i = 0; i < 200; i++) {
    const dlN = 10 + Math.floor(rng() * 20);
    const recN = Math.floor(rng() * 25);
    const mk = (n) => ({
      meeting: { record_date: daysStr(0), vote_deadline: daysStr(dlN) },
      positions: [{ account: 'A1', shares: 100 }],
      instruction: { received: daysStr(n), direction: 'for' },
    });
    const a = compute(mk(recN)).output_payload;
    const b = compute(mk(recN + 1)).output_payload;
    checked++;
    if (b.days_before_deadline !== a.days_before_deadline - 1) violations.push('one later day did not decrease days by exactly 1');
    if (a.overall === 'INSTRUCTION_LATE' && b.overall === 'VOTE_RECORDED') violations.push('verdict flipped recorded-ward on a later received date');
    if (a.instruction_within_deadline && !b.instruction_within_deadline && a.days_before_deadline !== 0) violations.push('deadline crossed at other than day 0');
  }
  return { name: 'deadline_monotonicity', checked, violations: violations.length };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkRecordArithmetic(),
  checkFailClosed(),
  checkDeterminism(),
  checkOutputShape(),
  checkDeadlineMonotonicity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — PROXY-VOTING-BUILD-1.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
