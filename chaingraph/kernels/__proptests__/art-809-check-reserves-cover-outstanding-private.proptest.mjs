// kernel_digest_at_authoring: sha256:2334dd7ac0bd3bc00e55268e4dda551e5b5607b0014e87fdce5fc40770015424
//
// Property-test floor for art-809-check-reserves-cover-outstanding-private.
// Class K (integer decision kernel, BigInt arithmetic, no floats; exact-shape refusals).
// §25 ocg-private-input@1 kernel: compute(pp) never recomputes from policy_parameters alone
// (by design), so every property drives buildArtifact(raw) with an explicit private witness,
// the kernel's only real compute path. Zero external dependencies. READ-ONLY with respect to
// the kernel it imports.
//
// spec: research/PRIVATE-PREDICATE-DESIGN-2026-11.md section 2.1 (GENIUS Act s.4(a)(1)(A))
// human_sign_off: PENDING (this row does not sign; manifest-level signature per spec section 4)
//
// Run: node chaingraph/kernels/__proptests__/art-809-check-reserves-cover-outstanding-private.proptest.mjs

import { compute, buildArtifact } from '../art-809-check-reserves-cover-outstanding-private.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ID = 'art-809-check-reserves-cover-outstanding-private';
const SALT_R = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SALT_O = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
const CATS = ['01', '02', '03', '04', '05', '06', '07', '08'];
const pad = (n) => String(n).padStart(20, '0');
const slot = (c, n) => ({ category: c, amount_minor: pad(n) });
const fill = (arr) => { const a = arr.slice(); while (a.length < 16) a.push(slot('00', 0)); return a; };
const mk = (reserves, out, extra = {}) => ({ reserves, outstanding: { outstanding_minor: pad(out) }, reserves_salt: SALT_R, outstanding_salt: SALT_O, unit: 'USD_cents', as_of: '2026-10-31', ...extra });

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x809A1);
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
    for (const p of ['/reserves_commitment', '/outstanding_commitment']) {
      const row = dc.vectors.find((d) => d.name === v.name && d.pointer === p);
      const w2 = p === '/reserves_commitment' ? { ...w, reserves: row.input_value, reserves_salt: row.salt } : { ...w, outstanding: row.input_value, outstanding_salt: row.salt };
      const a2 = await buildArtifact(w2);
      if (a2.policy_parameters[p.slice(1)] !== v.policy_parameters[p.slice(1)]) failures.push({ name: v.name, pointer: p });
    }
  }
  return { total: fx.vectors.length, failures };
}

// P1: verdict equals an independently computed BigInt comparison.
async function p1() {
  let violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + ri(16);
    const slots = []; let total = 0n;
    for (let k = 0; k < n; k++) { const amt = ri(1e9) * 1000 + ri(1000); slots.push(slot(CATS[ri(8)], amt)); total += BigInt(amt); }
    const out = ri(2) ? total + BigInt(ri(3)) - 1n : BigInt(ri(1e9) * 1000);
    const o = out < 0n ? 0n : out;
    const a = await buildArtifact(mk(fill(slots), o.toString()));
    if (a.output_payload.reserves_cover_outstanding !== (total >= o)) violations++;
  }
  return { name: 'P1_verdict_matches_independent_bigint_sum', trials: TRIALS, violations };
}

// P2: monotonic. Raising outstanding never turns false into true; adding reserve never turns true into false.
async function p2() {
  let violations = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const base = ri(1e9) + 1;
    const slots = fill([slot(CATS[ri(8)], base)]);
    const lo = ri(base * 2), hi = lo + ri(1000);
    const [aLo, aHi] = [await buildArtifact(mk(slots, lo)), await buildArtifact(mk(slots, hi))];
    if (aHi.output_payload.reserves_cover_outstanding && !aLo.output_payload.reserves_cover_outstanding) violations++;
    const more = fill([slot(CATS[ri(8)], base), slot(CATS[ri(8)], ri(1000))]);
    const [aS, aM] = [await buildArtifact(mk(slots, hi)), await buildArtifact(mk(more, hi))];
    if (aS.output_payload.reserves_cover_outstanding && !aM.output_payload.reserves_cover_outstanding) violations++;
  }
  return { name: 'P2_monotone_in_outstanding_and_in_reserves', trials: TRIALS / 2, violations };
}

// P3: slot order and category choice do not move the verdict (sum is order- and category-independent).
async function p3() {
  let violations = 0;
  for (let i = 0; i < TRIALS / 4; i++) {
    const slots = Array.from({ length: 16 }, () => slot(CATS[ri(8)], ri(1e6)));
    const out = ri(8e6);
    const rev = slots.slice().reverse().map((s) => slot(CATS[ri(8)], Number(s.amount_minor)));
    const [a, b] = [await buildArtifact(mk(slots, out)), await buildArtifact(mk(rev, out))];
    if (a.output_payload.reserves_cover_outstanding !== b.output_payload.reserves_cover_outstanding) violations++;
  }
  return { name: 'P3_verdict_independent_of_order_and_category_choice', trials: TRIALS / 4, violations };
}

// P4: plaintext exclusion. No amount string and no salt appears anywhere in the serialized artifact;
// output is exactly the one-bit shape; private_inputs pointers resolve to their own commitments.
async function p4() {
  let violations = 0;
  for (let i = 0; i < 200; i++) {
    const slots = fill(Array.from({ length: 1 + ri(16) }, () => slot(CATS[ri(8)], 10000000 + ri(9e8))));
    const out = 10000000 + ri(9e8);
    const w = mk(slots, out, { reserves_salt: Array.from({ length: 64 }, () => '0123456789abcdef'[ri(16)]).join('') });
    const a = await buildArtifact(w);
    const s = JSON.stringify(a);
    if (s.includes(w.reserves_salt) || s.includes(w.outstanding_salt)) violations++;
    if (s.includes(pad(out))) violations++;
    for (const sl of slots) if (sl.category !== '00' && s.includes(sl.amount_minor)) violations++;
    if (Object.keys(a.output_payload).join() !== 'reserves_cover_outstanding,basis,privacy_note,not_legal_advice') violations++;
    for (const e of a.private_inputs) if (a.policy_parameters[e.pointer.slice(1)] !== e.commitment) violations++;
  }
  return { name: 'P4_plaintext_and_salt_excluded_one_bit_output', trials: 200, violations };
}

// P5: commitment determinism and salt sensitivity (hiding: a different salt moves the commitment).
async function p5() {
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const w = mk(fill([slot(CATS[ri(8)], ri(1e6))]), ri(1e6));
    const [a, b] = [await buildArtifact(w), await buildArtifact(w)];
    if (a.execution_hash !== b.execution_hash) violations++;
    const c = await buildArtifact({ ...w, reserves_salt: 'f'.repeat(64) });
    if (c.policy_parameters.reserves_commitment === a.policy_parameters.reserves_commitment) violations++;
    if (c.policy_parameters.outstanding_commitment !== a.policy_parameters.outstanding_commitment) violations++;
  }
  return { name: 'P5_commitment_deterministic_and_salt_sensitive', trials: 100, violations };
}

// P6 (refusals, every refused branch is reachable): wrong shape must throw, never seal.
async function p6() {
  const good = mk(fill([slot('01', 5)]), 5);
  const cases = [
    ['15 slots', { ...good, reserves: good.reserves.slice(0, 15) }],
    ['17 slots', { ...good, reserves: good.reserves.concat([slot('00', 0)]) }],
    ['19-digit amount', { ...good, reserves: [{ category: '01', amount_minor: '0'.repeat(18) + '5' }, ...good.reserves.slice(1)] }],
    ['21-digit amount', { ...good, reserves: [{ category: '01', amount_minor: '0'.repeat(20) + '5' }, ...good.reserves.slice(1)] }],
    ['non-digit amount', { ...good, reserves: [{ category: '01', amount_minor: '-' + '0'.repeat(18) + '5' }, ...good.reserves.slice(1)] }],
    ['numeric amount', { ...good, reserves: [{ category: '01', amount_minor: 5 }, ...good.reserves.slice(1)] }],
    ['category 09', { ...good, reserves: [slot('09', 5), ...good.reserves.slice(1)] }],
    ['category 1 (width)', { ...good, reserves: [slot('1', 5), ...good.reserves.slice(1)] }],
    ['pad slot nonzero', { ...good, reserves: [slot('00', 5), ...good.reserves.slice(1)] }],
    ['extra slot key', { ...good, reserves: [{ ...slot('01', 5), memo: 'x' }, ...good.reserves.slice(1)] }],
    ['extra outstanding key', { ...good, outstanding: { outstanding_minor: pad(5), note: 'x' } }],
    ['outstanding 19 digits', { ...good, outstanding: { outstanding_minor: '0'.repeat(18) + '5' } }],
    ['reserves not array', { ...good, reserves: {} }],
    ['short salt', { ...good, reserves_salt: 'ab'.repeat(16) }],
    ['non-hex salt', { ...good, outstanding_salt: 'zz'.repeat(32) }],
    ['salt reused across inputs', { ...good, outstanding_salt: good.reserves_salt }],
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

// P7 (mandatory boundary forcing): equality, one minor unit either side, zero, ceiling.
async function p7() {
  const rows = [];
  const check = async (label, w, expect) => {
    const a = await buildArtifact(w);
    rows.push({ label, verdict: a.output_payload.reserves_cover_outstanding, plausible: a.output_payload.reserves_cover_outstanding === expect });
  };
  await check('reserves exactly equal outstanding', mk(fill([slot('01', 100)]), 100), true);
  await check('reserves one minor unit below outstanding', mk(fill([slot('01', 99)]), 100), false);
  await check('reserves one minor unit above outstanding', mk(fill([slot('01', 101)]), 100), true);
  await check('all empty vs zero outstanding', mk(fill([]), 0), true);
  await check('all empty vs one outstanding', mk(fill([]), 1), false);
  const big = '99999999999999999999';
  await check('single slot at 20-digit ceiling vs ceiling', { ...mk(fill([{ category: '08', amount_minor: big }]), 0), outstanding: { outstanding_minor: big } }, true);
  await check('sum of 16 ceiling slots exceeds 2^64 and 2^53, still exact', { ...mk(Array.from({ length: 16 }, () => ({ category: '03', amount_minor: big })), 0), outstanding: { outstanding_minor: big } }, true);
  await check('ceiling minus one in one slot vs ceiling', { ...mk(fill([{ category: '02', amount_minor: '99999999999999999998' }]), 0), outstanding: { outstanding_minor: big } }, false);
  return rows;
}

const orc = await oracle();
if (orc.failures.length) { console.error('FIXTURE ORACLE FAILED', JSON.stringify(orc.failures)); process.exit(1); }
const decoy = compute({});
if (decoy.reserves_cover_outstanding !== null) { console.error('compute() decoy returned a non-null verdict'); process.exit(1); }

const properties = [await p1(), await p2(), await p3(), await p4(), await p5(), await p6()];
const boundary = await p7();
const anyViolation = properties.some((p) => p.violations > 0);
const anyImplausible = boundary.some((b) => !b.plausible);
console.log(JSON.stringify({ fixture_oracle_total: orc.total, compute_decoy_ok: true, properties, boundary_forced: boundary, any_property_violation: anyViolation, any_boundary_implausible: anyImplausible }, null, 2));
process.exit(anyViolation || anyImplausible ? 1 : 0);
