// art-684-intercompany-elimination-netting — class-K property-test FLOOR. Authored by INTERCOMPANY-ELIM-BUILD-1
// per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:095706cb39c4376c2a3782381693f0cb72986cfd7fabe8cc894cef4d385aece3
// spec: INTERCOMPANY-ELIM-BUILD-SPEC.md (canonical preimage, execution_hash pinned at staging:
// 2ef81e5259e39f897169eaeb311de0ae3b15bb4fdfa94d7160cf3642aadd4eb4)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-684-intercompany-elimination-netting.proptest.mjs

import { compute } from '../art-684-intercompany-elimination-netting.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-684-intercompany-elimination-netting';

// 2dp half-up, same declaration as the kernel — re-derived here so a kernel
// regression cannot pass by matching its own bug.
function round2(n) {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}

function randomPair(rng, tag) {
  const cents = Math.floor(rng() * 1000000); // whole-cents amounts, [0, 10000)
  const cents2 = rng() < 0.3 ? cents : Math.floor(rng() * 1000000);
  return { a: `SUB-${tag}-A`, b: `SUB-${tag}-B`, a_receivable: cents / 100, b_payable: cents2 / 100 };
}

function randomPairs(rng) {
  const n = 1 + Math.floor(rng() * 4);
  const out = [];
  for (let i = 0; i < n; i++) out.push(randomPair(rng, i));
  return out;
}

// P1: matching arithmetic consistency. matched_pairs counts a_receivable ==
// b_payable (after 2dp half-up), elimination_total is the sum of min sides,
// unmatched_residual is the sum of mismatch differences, overall is
// GAPS_FOUND exactly when a mismatch exists.
function checkMatchingArithmetic() {
  const rng = mulberry32(684);
  let checked = 0; const violations = [];
  for (let i = 0; i < 300; i++) {
    const pairs = randomPairs(rng);
    const { output_payload: op, compliance_flags } = compute({ pairs });
    checked++;
    let matched = 0; let elim = 0; let residual = 0; const mm = [];
    for (const p of pairs) {
      const a = round2(p.a_receivable); const b = round2(p.b_payable);
      elim = round2(elim + Math.min(a, b));
      if (a === b) matched++;
      else { residual = round2(residual + round2(a - b)); mm.push({ a: p.a, b: p.b, difference: round2(a - b) }); }
    }
    if (op.matched_pairs !== matched) violations.push(`matched_pairs ${op.matched_pairs} != ${matched}`);
    if (op.mismatched_pairs !== mm.length) violations.push(`mismatched_pairs ${op.mismatched_pairs} != ${mm.length}`);
    if (op.elimination_total !== elim) violations.push(`elimination_total ${op.elimination_total} != ${elim}`);
    if (op.unmatched_residual !== residual) violations.push(`unmatched_residual ${op.unmatched_residual} != ${residual}`);
    if (JSON.stringify(op.mismatches) !== JSON.stringify(mm)) violations.push('mismatches list diverged');
    const expectedOverall = mm.length > 0 ? 'GAPS_FOUND' : 'ALL_MATCHED';
    if (op.overall !== expectedOverall) violations.push(`overall ${op.overall} != ${expectedOverall}`);
    if (compliance_flags.length !== 0) violations.push(`unexpected flags ${compliance_flags.join(',')}`);
    if (typeof op.trace !== 'string' || !op.trace.startsWith('eliminate ')) violations.push('trace missing');
  }
  return { name: 'matching_arithmetic_consistency', checked, violations: violations.length };
}

// P2: invalid-domain rejection — malformed inputs always fail closed with named
// errors, null output fields, and never a partially computed verdict.
function checkFailClosed() {
  const rng = mulberry32(6841);
  let checked = 0; const violations = [];
  const badInputs = [
    {},
    { pairs: null },
    { pairs: [] },
    { pairs: 'SUB-1' },
    { pairs: [{}] },
    { pairs: [{ a: '', b: 'SUB-2', a_receivable: 5, b_payable: 5 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: 5, b_payable: -5 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: '5', b_payable: 5 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: Number.NaN, b_payable: 5 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: Number.POSITIVE_INFINITY, b_payable: 5 }] },
  ];
  for (const pp of badInputs) {
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) violations.push('no domain_errors on malformed input');
    if (op.matched_pairs !== null || op.elimination_total !== null || op.overall !== null) {
      violations.push('fail-closed payload did not null every output field');
    }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations.push('DOMAIN_ERROR flag missing');
  }
  // fuzz: random junk shapes must never throw and never produce a computable verdict
  for (let i = 0; i < 200; i++) {
    const junk = {};
    const r = rng();
    if (r >= 0.3) {
      junk.pairs = r < 0.5 ? (rng() < 0.5 ? null : 42) : [{ a: rng() < 0.5 ? 'SUB-1' : null, b: 'SUB-2', a_receivable: rng() < 0.5 ? 10 : 'x', b_payable: 10 }];
    }
    const { output_payload: op } = compute(junk);
    checked++;
    const ps = junk.pairs;
    const valid = Array.isArray(ps) && ps.length > 0 && ps.every((p) => p && typeof p === 'object'
      && typeof p.a === 'string' && p.a.length > 0 && typeof p.b === 'string' && p.b.length > 0
      && typeof p.a_receivable === 'number' && Number.isFinite(p.a_receivable) && p.a_receivable >= 0
      && typeof p.b_payable === 'number' && Number.isFinite(p.b_payable) && p.b_payable >= 0);
    if ((op.overall === 'GAPS_FOUND' || op.overall === 'ALL_MATCHED') && !valid) {
      violations.push('computable verdict reached from a malformed input');
    }
    if (valid && Array.isArray(op.domain_errors)) violations.push('well-formed input was refused');
  }
  return { name: 'fail_closed_rejection', checked, violations: violations.length };
}

// P3: determinism — identical inputs produce byte-identical outputs across repeated calls.
function checkDeterminism() {
  const rng = mulberry32(6842);
  let checked = 0; const violations = [];
  for (let i = 0; i < 100; i++) {
    const pp = { pairs: randomPairs(rng) };
    const a = compute(pp); const b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) violations.push('repeated compute() diverged');
  }
  return { name: 'determinism', checked, violations: violations.length };
}

// P4: output shape — success path carries exactly the seven pinned fields,
// no NaN/undefined anywhere.
function checkOutputShape() {
  const rng = mulberry32(6843);
  let checked = 0; const violations = [];
  const SUCCESS_KEYS = ['matched_pairs', 'mismatched_pairs', 'elimination_total', 'unmatched_residual', 'mismatches', 'trace', 'overall'];
  const FAIL_KEYS = SUCCESS_KEYS.concat(['domain_errors']);
  for (let i = 0; i < 200; i++) {
    const good = rng() < 0.5;
    const pp = good ? { pairs: randomPairs(rng) } : { pairs: null };
    const { output_payload: op } = compute(pp);
    checked++;
    const keys = Object.keys(op).sort().join(',');
    const expectedKeys = (good ? SUCCESS_KEYS : FAIL_KEYS).slice().sort().join(',');
    if (keys !== expectedKeys) violations.push(`payload keys ${keys} != ${expectedKeys}`);
    const shape = findShapeViolations(op);
    if (shape.length) violations.push(shape.join('; '));
    if (good && !(op.overall === 'GAPS_FOUND' || op.overall === 'ALL_MATCHED')) violations.push('bad overall on success path');
  }
  return { name: 'output_shape_pinned', checked, violations: violations.length };
}

// P5: gap-closure monotonicity — raising the payable side of a mismatched pair
// to the receivable value turns the pair matched, reduces the residual, and can
// only move the verdict GAPS_FOUND -> ALL_MATCHED, never the reverse.
function checkGapClosureMonotonicity() {
  const rng = mulberry32(6844);
  let checked = 0; const violations = [];
  for (let i = 0; i < 200; i++) {
    const pairs = randomPairs(rng);
    const A = { pairs };
    const repaired = pairs.map((p) => ({ ...p, b_payable: p.a_receivable }));
    const B = { pairs: repaired };
    const a = compute(A).output_payload;
    const b = compute(B).output_payload;
    checked++;
    if (b.mismatched_pairs !== 0) violations.push('repaired input still reports mismatches');
    if (b.unmatched_residual !== 0) violations.push('repaired input retains residual');
    if (a.overall === 'ALL_MATCHED' && b.overall === 'GAPS_FOUND') violations.push('repair created a gap');
    if (b.elimination_total < a.elimination_total) violations.push('repair reduced the elimination total');
  }
  return { name: 'gap_closure_monotonicity', checked, violations: violations.length };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkMatchingArithmetic(),
  checkFailClosed(),
  checkDeterminism(),
  checkOutputShape(),
  checkGapClosureMonotonicity(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — INTERCOMPANY-ELIM-BUILD-1.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
