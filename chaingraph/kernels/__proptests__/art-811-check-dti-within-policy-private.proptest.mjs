// kernel_digest_at_authoring: sha256:decfd41bf3e450e1251e6cf36e4c3286f4008c9c8cfa831220b10804b8da7cb6
//
// Property-test floor for art-811-check-dti-within-policy-private.
// Class K (integer decision kernel, BigInt arithmetic, no floats; exact-shape refusals).
// §25 ocg-private-input@1 kernel: compute(pp) never recomputes from policy_parameters alone
// (by design), so every property drives buildArtifact(raw) with an explicit private witness,
// the kernel's only real compute path. Zero external dependencies. READ-ONLY with respect to
// the kernel it imports.
//
// spec: research/PRIVATE-PREDICATE-DESIGN-2026-11.md section 2.2 (12 CFR 1026.51(a)(1)(ii))
// human_sign_off: PENDING (this row does not sign; manifest-level signature per spec section 4)
//
// Run: node chaingraph/kernels/__proptests__/art-811-check-dti-within-policy-private.proptest.mjs

import { compute, buildArtifact } from '../art-811-check-dti-within-policy-private.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ID = 'art-811-check-dti-within-policy-private';
const SALT_I = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SALT_D = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
const BPS = [3600, 4300, 4500, 5000];
const pad = (n) => String(n).padStart(20, '0');
const fill = (arr) => { const a = arr.map(pad); while (a.length < 16) a.push(pad(0)); return a; };
const mk = (debts, income, bps, extra = {}) => ({ debts, income: { monthly_income_minor: pad(income) }, income_salt: SALT_I, debts_salt: SALT_D, dti_max_bps: bps, unit: 'USD_cents', as_of: '2026-10-31', ...extra });

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x811A1);
const ri = (n) => Math.floor(rand() * n);
const TRIALS = 2000;

async function oracle() {
  const fx = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', ID + '.fixtures.json'), 'utf8'));
  const dc = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', ID + '.disclosure.json'), 'utf8'));
  const failures = [];
  for (const v of fx.vectors) {
    const w = dc.vectors.find((d) => d.name === v.name && d.pointer === '/witness').input_value;
    const a = await buildArtifact(w);
    if (JSON.stringify(a.output_payload) !== JSON.stringify(v.output_payload)
      || JSON.stringify(a.policy_parameters) !== JSON.stringify(v.policy_parameters)
      || a.execution_hash !== v.golden_hash) failures.push({ name: v.name });
    // each committed pointer re-derives from its own disclosure row
    for (const p of ['/income_commitment', '/debts_commitment']) {
      const row = dc.vectors.find((d) => d.name === v.name && d.pointer === p);
      const w2 = p === '/income_commitment' ? { ...w, income: row.input_value, income_salt: row.salt } : { ...w, debts: row.input_value, debts_salt: row.salt };
      const a2 = await buildArtifact(w2);
      if (a2.policy_parameters[p.slice(1)] !== v.policy_parameters[p.slice(1)]) failures.push({ name: v.name, pointer: p });
    }
  }
  return { total: fx.vectors.length, failures };
}

// P1: verdict equals an independently computed BigInt comparison (income > 0 and sum*10000 <= bps*income).
async function p1() {
  let violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = ri(17);
    const ds = []; let total = 0n;
    for (let k = 0; k < n; k++) { const a = ri(1e6) * 100 + ri(100); ds.push(a); total += BigInt(a); }
    const bps = BPS[ri(4)];
    const income = ri(10) === 0 ? 0n : (ri(2) ? (total * 10000n) / BigInt(bps) + BigInt(ri(3)) - 1n : BigInt(ri(1e6) * 1000));
    const inc = income < 0n ? 0n : income;
    const a = await buildArtifact(mk(fill(ds), inc.toString(), bps));
    const expect = inc > 0n && total * 10000n <= BigInt(bps) * inc;
    if (a.output_payload.dti_within_policy !== expect) violations++;
  }
  return { name: 'P1_verdict_matches_independent_bigint_comparison', trials: TRIALS, violations };
}

// P2: monotone. Raising debts never turns false into true; raising income never turns true into false;
// raising the threshold never turns true into false.
async function p2() {
  let violations = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const inc = ri(1e8) + 1, d = ri(1e8), bump = ri(1000);
    const bps = BPS[ri(4)];
    const [lo, hi] = [await buildArtifact(mk(fill([d]), inc, bps)), await buildArtifact(mk(fill([d + bump]), inc, bps))];
    if (hi.output_payload.dti_within_policy && !lo.output_payload.dti_within_policy) violations++;
    const [i1, i2] = [await buildArtifact(mk(fill([d]), inc, bps)), await buildArtifact(mk(fill([d]), inc + bump, bps))];
    if (i1.output_payload.dti_within_policy && !i2.output_payload.dti_within_policy) violations++;
    const [t1, t2] = [await buildArtifact(mk(fill([d]), inc, 3600)), await buildArtifact(mk(fill([d]), inc, 5000))];
    if (t1.output_payload.dti_within_policy && !t2.output_payload.dti_within_policy) violations++;
  }
  return { name: 'P2_monotone_in_debts_income_and_threshold', trials: TRIALS / 4, violations };
}

// P3: slot order does not move the verdict (sum is order-independent).
async function p3() {
  let violations = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const ds = Array.from({ length: 16 }, () => ri(1e6));
    const inc = ri(2e7) + 1, bps = BPS[ri(4)];
    const [a, b] = [await buildArtifact(mk(fill(ds), inc, bps)), await buildArtifact(mk(fill(ds.slice().reverse()), inc, bps))];
    if (a.output_payload.dti_within_policy !== b.output_payload.dti_within_policy) violations++;
  }
  return { name: 'P3_verdict_independent_of_slot_order', trials: TRIALS / 4, violations };
}

// P4: plaintext exclusion. No amount string and no salt appears anywhere in the serialized artifact;
// output is exactly the one-bit shape; private_inputs pointers resolve to their own commitments.
async function p4() {
  let violations = 0;
  for (let i = 0; i < 200; i++) {
    const ds = Array.from({ length: 1 + ri(16) }, () => 10000000 + ri(9e8));
    const inc = 10000000 + ri(9e8);
    const w = mk(fill(ds), inc, BPS[ri(4)], { income_salt: Array.from({ length: 64 }, () => '0123456789abcdef'[ri(16)]).join('') });
    const a = await buildArtifact(w);
    const s = JSON.stringify(a);
    if (s.includes(w.income_salt) || s.includes(w.debts_salt)) violations++;
    if (s.includes(pad(inc))) violations++;
    for (const d of ds) if (s.includes(pad(d))) violations++;
    if (Object.keys(a.output_payload).join() !== 'dti_within_policy,basis,privacy_note,not_legal_advice') violations++;
    if (Object.keys(a.policy_parameters).join() !== 'income_commitment,debts_commitment,dti_max_bps,unit,as_of,citation') violations++;
    for (const e of a.private_inputs) if (a.policy_parameters[e.pointer.slice(1)] !== e.commitment) violations++;
  }
  return { name: 'P4_plaintext_and_salt_excluded_one_bit_output', trials: 200, violations };
}

// P5: commitment determinism and salt sensitivity (hiding: a different salt moves only its own commitment).
async function p5() {
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const w = mk(fill([ri(1e6)]), ri(1e6) + 1, BPS[ri(4)]);
    const [a, b] = [await buildArtifact(w), await buildArtifact(w)];
    if (a.execution_hash !== b.execution_hash) violations++;
    const c = await buildArtifact({ ...w, income_salt: 'f'.repeat(64) });
    if (c.policy_parameters.income_commitment === a.policy_parameters.income_commitment) violations++;
    if (c.policy_parameters.debts_commitment !== a.policy_parameters.debts_commitment) violations++;
  }
  return { name: 'P5_commitment_deterministic_and_salt_sensitive', trials: 100, violations };
}

// P6 (refusals, every refused branch is reachable): wrong shape must throw, never seal.
async function p6() {
  const good = mk(fill([5]), 100, 4500);
  const cases = [
    ['15 slots', { ...good, debts: good.debts.slice(0, 15) }],
    ['17 slots', { ...good, debts: good.debts.concat([pad(0)]) }],
    ['19-digit debt', { ...good, debts: ['0'.repeat(18) + '5', ...good.debts.slice(1)] }],
    ['21-digit debt', { ...good, debts: ['0'.repeat(20) + '5', ...good.debts.slice(1)] }],
    ['non-digit debt', { ...good, debts: ['-' + '0'.repeat(18) + '5', ...good.debts.slice(1)] }],
    ['numeric debt', { ...good, debts: [5, ...good.debts.slice(1)] }],
    ['debt slot as object', { ...good, debts: [{ amount_minor: pad(5) }, ...good.debts.slice(1)] }],
    ['debts not array', { ...good, debts: {} }],
    ['extra income key', { ...good, income: { monthly_income_minor: pad(100), note: 'x' } }],
    ['income 19 digits', { ...good, income: { monthly_income_minor: '0'.repeat(18) + '5' } }],
    ['income missing key', { ...good, income: {} }],
    ['threshold 4000 not in list', { ...good, dti_max_bps: 4000 }],
    ['threshold as string', { ...good, dti_max_bps: '4500' }],
    ['threshold absent', { ...good, dti_max_bps: undefined }],
    ['short salt', { ...good, income_salt: 'ab'.repeat(16) }],
    ['non-hex salt', { ...good, debts_salt: 'zz'.repeat(32) }],
    ['salt reused across inputs', { ...good, debts_salt: good.income_salt }],
    ['bad unit', { ...good, unit: 'USD cents!' }],
    ['bad as_of', { ...good, as_of: '31/10/2026' }],
  ];
  let violations = 0; const missed = [];
  for (const [label, w] of cases) {
    let threw = false;
    try { await buildArtifact(w); } catch { threw = true; }
    if (!threw) { violations++; missed.push(label); }
  }
  return { name: 'P6_every_malformed_witness_is_refused', trials: cases.length, violations, missed };
}

// P7 (mandatory boundary forcing): equality, one minor unit either side, zero income, ceiling.
async function p7() {
  const rows = [];
  const check = async (label, w, expect) => {
    const a = await buildArtifact(w);
    rows.push({ label, verdict: a.output_payload.dti_within_policy, plausible: a.output_payload.dti_within_policy === expect });
  };
  await check('debts exactly at 4500 bps of income', mk(fill([4500]), 10000, 4500), true);
  await check('debts one minor unit over 4500 bps', mk(fill([4501]), 10000, 4500), false);
  await check('debts one minor unit under 4500 bps', mk(fill([4499]), 10000, 4500), true);
  await check('zero income with zero debts', mk(fill([]), 0, 5000), false);
  await check('zero income with debts', mk(fill([1]), 0, 5000), false);
  await check('income 1 with zero debts', mk(fill([]), 1, 3600), true);
  await check('income 1 with debt 1 at 5000 bps', mk(fill([1]), 1, 5000), false);
  const big = '99999999999999999999';
  await check('16 ceiling debts vs ceiling income, sum beyond 2^64', { ...mk(Array.from({ length: 16 }, () => big), 0, 5000), income: { monthly_income_minor: big } }, false);
  await check('ceiling income, debt 1, 3600 bps', { ...mk(fill([1]), 0, 3600), income: { monthly_income_minor: big } }, true);
  return rows;
}

const orc = await oracle();
if (orc.failures.length) { console.error('FIXTURE ORACLE FAILED', JSON.stringify(orc.failures)); process.exit(1); }
const decoy = compute({});
if (decoy.dti_within_policy !== null) { console.error('compute() decoy returned a non-null verdict'); process.exit(1); }

const properties = [await p1(), await p2(), await p3(), await p4(), await p5(), await p6()];
const boundary = await p7();
const anyViolation = properties.some((p) => p.violations > 0);
const anyImplausible = boundary.some((b) => !b.plausible);
console.log(JSON.stringify({ fixture_oracle_total: orc.total, compute_decoy_ok: true, properties, boundary_forced: boundary, any_property_violation: anyViolation, any_boundary_implausible: anyImplausible }, null, 2));
process.exit(anyViolation || anyImplausible ? 1 : 0);
