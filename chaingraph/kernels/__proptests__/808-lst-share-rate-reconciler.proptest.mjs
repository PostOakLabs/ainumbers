// 808-lst-share-rate-reconciler — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:330964aa99e13c91d491f4f54bbdfe8156cdd849024312d4d122a2353ec80e72
// spec: research/ETH-LST-SHARERATE-BUILD-SPEC-AMENDED-2026-11.md (rules R1-R10, fixtures F1-F8)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof. The kernel is BigInt-only, so the float-specific members of
// the rounding suite are not applicable and are not silently omitted here.
//
// rounding: directed (floor); precision exact integer; one floor division per conversion, two per
// wrap-then-unwrap round-trip leg.
//
// P0  fixture oracle: every pinned vector reproduces byte-for-byte.
// P1  balance is the exact floor of holder*N/D (checked against the rational inequality
//     b*D <= holder*N < (b+1)*D, not by re-running the formula).
// P2  wrap and unwrap are exact floors, same differential check against the rational inequality.
// P3  round-trip: unwrap(wrap(a)) <= a and 0 <= loss <= ceil(N/D).
// P4  fee dilution is non-negative for any F below D.
// P5  external shares and declared totals never change a conversion (balance depends on N, D only).
// P6  totality: compute() never throws on hostile input; flags are [] or ['INPUT_REFUSED'].
// P7  determinism: two calls on identical input are byte-identical.
// P8  forced boundaries: 2^128-1 refused, 2^128-2 accepted, zero N/D refused, zero unwrap refused.
//
// Run: node chaingraph/kernels/__proptests__/808-lst-share-rate-reconciler.proptest.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { compute, buildArtifact } from '../808-lst-share-rate-reconciler.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '808-lst-share-rate-reconciler';
const CASES = 500;

// Deterministic generator (no Math.random): 32-bit LCG widened to BigInt.
let seed = 0x808n;
function next() {
  seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
  return seed >> 11n;
}
function randBig(bits) {
  let v = 0n;
  for (let i = 0; i < bits; i += 53) v = (v << 53n) | next();
  return v & ((1n << BigInt(bits)) - 1n);
}
function genState() {
  const bits = [8, 20, 64, 100, 126][Number(next() % 5n)];
  const N = randBig(bits) + 1n;
  const D = randBig(bits) + 1n;
  const X = next() % 3n === 0n ? 0n : randBig(Math.min(bits, 60));
  return { N, D, X };
}
/** @param {bigint} a @param {bigint} b @returns {bigint} */
function ceilDiv(a, b) { return a % b === 0n ? a / b : a / b + 1n; }
const snapOf = (st, extra) => Object.assign({ snapshot_id: 'S', internal_ether: st.N.toString(), internal_shares: st.D.toString(), external_shares: st.X.toString() }, extra || {});

function p1() {
  let violations = 0;
  for (let i = 0; i < CASES; i++) {
    const st = genState();
    const h = randBig(100);
    const r = compute({ holder_shares: h.toString(), snapshots: [snapOf(st)] });
    const b = BigInt(r.output_payload.snapshots[0].balance);
    if (!(b * st.D <= h * st.N && h * st.N < (b + 1n) * st.D)) violations++;
  }
  return { name: 'P1_balance_is_exact_floor', checked: CASES, violations };
}

function p2() {
  let violations = 0;
  for (let i = 0; i < CASES; i++) {
    const st = genState();
    const a = randBig(100) + 1n;
    const r = compute({ holder_shares: '1', snapshots: [snapOf(st)], wrap_ops: [{ snapshot_id: 'S', amount: a.toString() }], unwrap_ops: [{ snapshot_id: 'S', amount: a.toString() }] });
    const w = BigInt(r.output_payload.wraps[0].shares_out);
    const u = BigInt(r.output_payload.unwraps[0].ether_out);
    if (!(w * st.N <= a * st.D && a * st.D < (w + 1n) * st.N)) violations++;
    if (!(u * st.D <= a * st.N && a * st.N < (u + 1n) * st.D)) violations++;
  }
  return { name: 'P2_wrap_and_unwrap_are_exact_floors', checked: CASES * 2, violations };
}

function p3() {
  let violations = 0;
  for (let i = 0; i < CASES; i++) {
    const st = genState();
    const a = randBig(100) + 1n;
    const r = compute({ holder_shares: '1', snapshots: [snapOf(st)], wrap_ops: [{ snapshot_id: 'S', amount: a.toString() }] });
    const w = r.output_payload.wraps[0];
    const loss = BigInt(w.round_trip_loss);
    if (loss < 0n || loss > ceilDiv(st.N, st.D) || w.loss_within_bound !== true) violations++;
    if (BigInt(w.round_trip_ether_back) > a) violations++;
  }
  return { name: 'P3_round_trip_loss_within_ceil_N_over_D', checked: CASES, violations };
}

function p4() {
  let violations = 0;
  for (let i = 0; i < CASES; i++) {
    const st = genState();
    const F = st.D > 1n ? next() % st.D : 0n;
    const h = randBig(100);
    const r = compute({ holder_shares: h.toString(), snapshots: [snapOf(st, { shares_minted_as_fees: F.toString() })] });
    if (BigInt(r.output_payload.snapshots[0].fee.fee_dilution) < 0n) violations++;
  }
  return { name: 'P4_fee_dilution_non_negative', checked: CASES, violations };
}

function p5() {
  let violations = 0;
  for (let i = 0; i < CASES; i++) {
    const st = genState();
    const h = randBig(100);
    const a = compute({ holder_shares: h.toString(), snapshots: [snapOf({ N: st.N, D: st.D, X: 0n })] });
    const b = compute({ holder_shares: h.toString(), snapshots: [snapOf(st, { declared_total_shares: '7', declared_total_pooled_ether: '9' })] });
    if (a.output_payload.snapshots[0].balance !== b.output_payload.snapshots[0].balance) violations++;
  }
  return { name: 'P5_external_shares_and_declared_totals_never_enter_a_conversion', checked: CASES, violations };
}

function p6() {
  const hostile = [undefined, null, 0, 'x', [], {}, { holder_shares: -1 }, { holder_shares: '1.5', snapshots: 3 }, { holder_shares: '1', snapshots: [null] },
    { holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: '1e9', internal_shares: '1' }] },
    { holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: '5', internal_shares: '2' }], wrap_ops: 'no', unwrap_ops: 7 },
    { holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: '5', internal_shares: '2' }], wrap_ops: [null, { snapshot_id: 'A', amount: 'z' }] }];
  let violations = 0;
  for (const pp of hostile) {
    try {
      const r = compute(pp);
      const f = r.compliance_flags;
      if (!(f.length === 0 || (f.length === 1 && f[0] === 'INPUT_REFUSED'))) violations++;
      if (!Array.isArray(r.output_payload.snapshots)) violations++;
    } catch (e) { violations++; }
  }
  return { name: 'P6_totality_never_throws_flags_are_empty_or_INPUT_REFUSED', checked: hostile.length, violations };
}

function p7() {
  let violations = 0;
  for (let i = 0; i < 100; i++) {
    const st = genState();
    const pp = { holder_shares: randBig(90).toString(), snapshots: [snapOf(st)] };
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
  }
  return { name: 'P7_determinism', checked: 100, violations };
}

function p8() {
  const max = (1n << 128n) - 1n;
  const base = { snapshots: [{ snapshot_id: 'A', internal_ether: '1000', internal_shares: '3' }] };
  const flag = (pp) => compute(pp).compliance_flags.join(',');
  const checks = [
    flag({ holder_shares: max.toString(), ...base }) === 'INPUT_REFUSED',
    flag({ holder_shares: (max - 1n).toString(), ...base }) === '',
    flag({ holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: '1000', internal_shares: '0' }] }) === 'INPUT_REFUSED',
    flag({ holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: '0', internal_shares: '3' }] }) === 'INPUT_REFUSED',
    flag({ holder_shares: '1', ...base, unwrap_ops: [{ snapshot_id: 'A', amount: '0' }] }) === 'INPUT_REFUSED',
    flag({ holder_shares: '1', ...base, wrap_ops: [{ snapshot_id: 'A', amount: '0' }] }) === 'INPUT_REFUSED',
    flag({ holder_shares: '1', ...base, wrap_ops: [{ snapshot_id: 'A', amount: '333' }] }) === '',
    flag({ holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: (1n << 128n).toString(), internal_shares: '3' }] }) === 'INPUT_REFUSED',
  ];
  return { name: 'P8_forced_boundaries', checked: checks.length, violations: checks.filter((c) => !c).length };
}

// P9 (808-FIX-1) -- the page's inline compute() mirrors the kernel on every
// golden, including output_payload.issues on both the refused and clean paths.
// Mutation mode (same two-way detection as art-215 / pnr-01): run-mutation-tier.mjs copies
// only the kernel import graph + fixtures into %TEMP%\ain-mutation-tier-<pid>\, never the
// node page, so P9 cannot read it there (CI shard 0/6 ENOENT on #3238). P9 tests the PAGE,
// not the kernel under mutation, and page parity stays enforced by this file's standalone
// repo-checkout run and by check-page-kernel-parity.mjs. Skip it in mutation mode only.
const P9_MUTATION_MODE =
  process.env.__STRYKER_ACTIVE_MUTANT__ !== undefined ||
  dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/').includes('/ain-mutation-tier-');
function p9PageParity() {
  const here = dirname(fileURLToPath(import.meta.url));
  if (P9_MUTATION_MODE) return { name: 'page_compute_matches_kernel_on_all_goldens', checked: 0, violations: 0 };
  const html = readFileSync(join(here, '..', '..', '808-lst-share-rate-reconciler.html'), 'utf8');
  const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const stub = { getElementById: () => ({ textContent: '', value: '', style: {}, classList: { add() {} } }), createElement: () => ({ click() {} }) };
  const sandbox = /** @type {any} */ ({ console, crypto: globalThis.crypto, TextEncoder, URL, Blob: function () {}, document: stub });
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const fx = JSON.parse(readFileSync(join(here, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'));
  let violations = 0;
  for (const v of fx.vectors) {
    const a = JSON.stringify(sandbox.compute(structuredClone(v.policy_parameters)).output_payload);
    const b = JSON.stringify(compute(structuredClone(v.policy_parameters)).output_payload);
    if (a !== b) { violations++; console.error(`P9 page parity mismatch: ${v.name}`); }
  }
  return { name: 'page_compute_matches_kernel_on_all_goldens', checked: fx.vectors.length, violations };
}

// P10 (D6) -- buildArtifact_never_throws: unhashable preimages mint a null hash
// with hash_refusal; clean inputs keep the 64-hex execution_hash.
async function p10NeverThrow() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const base = { holder_shares: '1', snapshots: [{ snapshot_id: 'A', internal_ether: '1000', internal_shares: '3' }] };
  const hostile = [
    { zzz: NaN }, { zzz: 1e300 }, { zzz: Infinity }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } },
    { holder_shares: NaN }, { holder_shares: 1e300 }, { zzz: deep }, { zzz: new Array(1000001).fill(0) },
    { zzz: 5n }, { zzz: { a: [5n] } }, { zzz: [5n] },
  ];
  for (const delta of hostile) {
    checked++;
    try {
      const art = await buildArtifact({ ...base, ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log(`P10 violation: ${Object.keys(delta)[0]} artifact shape`); }
      if (/e\+3\d\d|Infinity|9007199254740992/.test(JSON.stringify(r))) { violations++; console.log('P10 violation: hostile value echoed'); }
    } catch (e) { violations++; console.log(`P10 violation: buildArtifact threw: ${String(e.message).slice(0, 80)}`); }
  }
  for (const pp of [base, null, undefined, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P10 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log(`P10 violation: buildArtifact threw on clean input: ${String(e.message).slice(0, 80)}`); }
  }
  return { name: 'buildArtifact_never_throws', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [p1(), p2(), p3(), p4(), p5(), p6(), p7(), p8(), p9PageParity(), await p10NeverThrow()];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
