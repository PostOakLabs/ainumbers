// art-693-intercompany-elimination-workflow — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:fddbc87ce7d0c598bd8da52286c1bbb5253b79e226f3eb54fb3fc5d8b31def2e
// spec: INTERCOMPANY-ELIM-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-693-intercompany-elimination-workflow.proptest.mjs

import { compute } from '../art-693-intercompany-elimination-workflow.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-693-intercompany-elimination-workflow';

// Same 2dp half-up rounding the kernel declares — an independent restatement of
// the named rule, written from the spec, not imported from the kernel.
function round2(n) {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}

// Deterministic synthetic declared-pair generator (LCG over small cent-true
// amounts) — never Math.random(), the floor must be reproducible byte-for-byte.
function randomPairs(rng, n) {
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rng() * 100000) / 100;
    const twoSided = rng() < 0.5;
    const delta = Math.floor(rng() * 5000) / 100;
    pairs.push({
      a: `ENT-${i}A`,
      b: `ENT-${i}B`,
      a_receivable: a,
      b_payable: twoSided ? a : round2(a + delta),
    });
  }
  return pairs;
}

// Class-A: the elimination identity — elimination_total equals the sum of the
// smaller rounded side of every declared pair; unmatched_residual equals the sum
// of the mismatch differences; the mismatches list carries exactly the pairs
// whose rounded sides differ, in declared order, with the exact difference.
function checkEliminationIdentity() {
  const rng = mulberry32(693);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 300; i++) {
    const pairs = randomPairs(rng, 1 + Math.floor(rng() * 6));
    const { output_payload } = compute({ pairs });
    let elim = 0;
    let resid = 0;
    const wantMismatches = [];
    let matched = 0;
    for (const p of pairs) {
      const a = round2(p.a_receivable);
      const b = round2(p.b_payable);
      elim = round2(elim + Math.min(a, b));
      if (a === b) matched++;
      else {
        const d = round2(a - b);
        resid = round2(resid + d);
        wantMismatches.push({ a: p.a, b: p.b, difference: d });
      }
    }
    checked++;
    if (output_payload.elimination_total !== elim) violations++;
    if (output_payload.unmatched_residual !== resid) violations++;
    if (output_payload.matched_pairs !== matched) violations++;
    if (output_payload.mismatched_pairs !== wantMismatches.length) violations++;
    if (JSON.stringify(output_payload.mismatches) !== JSON.stringify(wantMismatches)) violations++;
  }
  return { name: 'elimination-identity-sum-of-min-sides', checked, violations };
}

// Class-B: verdict enum is exactly the two declared paths — GAPS_FOUND iff at
// least one declared pair mismatches, else ALL_MATCHED; and the trace always
// restates the elimination total and names the residual.
function checkVerdictTracksMismatches() {
  const rng = mulberry32(1693);
  let checked = 0;
  let violations = 0;
  const cases = [
    {
      pp: { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: 50000, b_payable: 50000 }] },
      want: 'ALL_MATCHED',
    },
    {
      pp: { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: 50000, b_payable: 50000 }, { a: 'SUB-1', b: 'SUB-3', a_receivable: 20000, b_payable: 18000 }] },
      want: 'GAPS_FOUND',
    },
  ];
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (output_payload.overall !== c.want) violations++;
  }
  for (let i = 0; i < 200; i++) {
    const pairs = randomPairs(rng, 1 + Math.floor(rng() * 5));
    const { output_payload } = compute({ pairs });
    const want = output_payload.mismatched_pairs > 0 ? 'GAPS_FOUND' : 'ALL_MATCHED';
    checked++;
    if (output_payload.overall !== want) violations++;
    checked++;
    if (!output_payload.trace.includes(`= ${String(output_payload.elimination_total)}`)) violations++;
    if (!output_payload.trace.includes('residual')) violations++;
  }
  return { name: 'verdict-enum-tracks-mismatch-count', checked, violations };
}

// Class-K invalid-domain rejection: each malformed declared input throws (never
// silently computes), and no partial output escapes.
function checkInvalidDomainRejection() {
  const good = { a: 'SUB-1', b: 'SUB-2', a_receivable: 100, b_payable: 100 };
  const bad = [
    null,
    {},
    { pairs: [] },
    { pairs: 'SUB-1' },
    { pairs: [null] },
    { pairs: [42] },
    { pairs: [{ b: 'SUB-2', a_receivable: 100, b_payable: 100 }] },
    { pairs: [{ a: '', b: 'SUB-2', a_receivable: 100, b_payable: 100 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: 100 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', b_payable: 100 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: '100', b_payable: 100 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: -1, b_payable: 100 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: NaN, b_payable: 100 }] },
    { pairs: [{ a: 'SUB-1', b: 'SUB-2', a_receivable: Infinity, b_payable: 100 }] },
    { pairs: [good, { a: 'SUB-3', b: 'SUB-4', a_receivable: 1, b_payable: -5 }] },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    let threw = false;
    try { compute(pp); } catch { threw = true; }
    checked++;
    if (!threw) violations++;
  }
  return { name: 'invalid-domain-rejection-throws', checked, violations };
}

// Output-shape: every computable output_payload carries exactly the seven
// canonical-parity members (the spec's canonical preimage shape); the canonical
// trace is byte-exact; the 2dp half-up declaration appears in the trace exactly
// when a declared amount is not an integer; determinism over repeats.
function checkOutputShapeTraceAndDeterminism() {
  const canonical = {
    pairs: [
      { a: 'SUB-1', b: 'SUB-2', a_receivable: 50000, b_payable: 50000 },
      { a: 'SUB-1', b: 'SUB-3', a_receivable: 20000, b_payable: 18000 },
    ],
  };
  let checked = 0;
  let violations = 0;
  const KEYS = ['elimination_total', 'matched_pairs', 'mismatched_pairs', 'mismatches', 'overall', 'trace', 'unmatched_residual'];
  const a = compute(canonical).output_payload;
  const b = compute(canonical).output_payload;
  checked++;
  if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  checked++;
  if (JSON.stringify(Object.keys(a).sort()) !== JSON.stringify(KEYS)) violations++;
  checked++;
  if (a.trace !== 'eliminate min(20000,18000)=18000 + matched 50000 = 68000; residual 20000-18000=2000') violations++;
  const frac = compute({ pairs: [{ a: 'A', b: 'B', a_receivable: 10.005, b_payable: 10.01 }] }).output_payload;
  checked++;
  if (!frac.trace.includes('2dp half-up')) violations++;
  checked++;
  if (a.trace.includes('2dp half-up')) violations++;
  const allMatched = compute({ pairs: [{ a: 'A', b: 'B', a_receivable: 5, b_payable: 5 }] }).output_payload;
  checked++;
  if (allMatched.trace !== 'eliminate matched 5 = 5; residual 0') violations++;
  return { name: 'output-shape-trace-declaration-determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkEliminationIdentity(),
  checkVerdictTracksMismatches(),
  checkInvalidDomainRejection(),
  checkOutputShapeTraceAndDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — Intercompany Elimination and Netting Workflow.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
