// art-749-solana-paychan-voucher-verifier — class-A property-test floor
// (SOLANA-PAYCHAN-VOUCHER-VERIFIER-1). REPLACE-of-scaffold per KERNEL-SCAFFOLD-1.
// kernel_digest_at_authoring: sha256:2fb93736b7dac55c9dc08aa9c3af3972db469b9610b00385a26c0de10abe31c6
// spec: workspace-root research/solana-dvp-hook-in-2026-10-15.md Addendum C items 2-5,
// behaviour ported from the pinned payment-channels clauses @3ffa4d67
// (clause-snapshot-registry.json entries "payment-channels README voucher wire format",
// "payment-channels verify_voucher on-chain checks", "payment-channels OPEN_SLOT_WINDOW + ratchet").
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-749-solana-paychan-voucher-verifier.proptest.mjs

import { compute } from '../art-749-solana-paychan-voucher-verifier.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-749-solana-paychan-voucher-verifier';

// ---------- independent reference: voucher encode/decode (from the pinned wire table) ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s;
}
function encodeVoucher(channel32, cumulative, expiresAt) {
  const out = new Uint8Array(50);
  out[0] = 0x56; out[1] = 0x01;
  out.set(channel32, 2);
  let c = cumulative;
  for (let i = 0; i < 8; i++) { out[34 + i] = Number(c & 0xffn); c >>= 8n; }
  let e = BigInt.asUintN(64, expiresAt);
  for (let i = 0; i < 8; i++) { out[42 + i] = Number(e & 0xffn); e >>= 8n; }
  return out;
}
function toHex(b) { let s = ''; for (const x of b) s += x.toString(16).padStart(2, '0'); return s; }

function baseCase(rng) {
  const channel = new Uint8Array(32);
  for (let i = 0; i < 32; i++) channel[i] = Math.floor(rng() * 256);
  const cumulative = BigInt(Math.floor(rng() * 2 ** 31) + 1);
  const deposit = cumulative + BigInt(Math.floor(rng() * 2 ** 20));
  const settled = BigInt(Math.floor(rng() * Number(cumulative)));
  const now = 1700000000n;
  const expired = rng() < 0.5;
  const expiresAt = expired ? now - BigInt(Math.floor(rng() * 100000) + 1) : 0n;
  return { channel, cumulative, deposit, settled, now, expiresAt };
}

// P1 layout round-trip: for randomized vouchers, the kernel's parsed fields equal an
// INDEPENDENT little-endian re-encode from the pinned wire table, and a fully valid
// voucher passes all six checks with settle_delta = cumulative - settled.
function p1LayoutRoundTrip() {
  const rng = mulberry32(0xa74901);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const t = baseCase(rng);
    const hex = toHex(encodeVoucher(t.channel, t.cumulative, t.expiresAt));
    const { output_payload: op } = compute({
      voucher_hex: hex, channel_pda: b58encode(t.channel),
      deposit_ceiling: t.deposit.toString(), settled_watermark: t.settled.toString(),
      current_time: t.now.toString(),
    });
    const expired = t.expiresAt !== 0n;
    const expectAll = !expired; // every other term is chosen valid
    if (op.all_pass !== expectAll) violations++;
    if (expired && op.checks.not_expired !== false) violations++;
    if (op.cumulative_amount !== t.cumulative.toString()) violations++;
    if (op.expires_at !== t.expiresAt.toString()) violations++;
    if (op.settle_delta !== (t.cumulative - t.settled).toString()) violations++;
    if (op.channel_id_hex !== toHex(t.channel)) violations++;
    if (JSON.stringify(op.pinned_constants.magic) !== '[86,1]') violations++;
    checked += 5;
  }
  return { name: 'P1 layout round-trip vs independent LE re-encode', checked, violations };
}

// P2 boundary pins at the exact pinned comparisons (mirror of verify_parsed):
// cumulative == deposit passes, deposit+1 fails; cumulative == settled is STALE
// (the source check is settled >= cumulative -> fail, i.e. strictly greater required);
// expires_at == now fails, expires_at == now+1 passes, expires_at == 0 always passes.
function p2Boundaries() {
  const rng = mulberry32(0xa74902);
  let checked = 0, violations = 0;
  const channel = new Uint8Array(32).fill(7);
  const pda = b58encode(channel);
  const run = (cum, exp, now, dep, wat) => {
    const { output_payload: op, compliance_flags } = compute({
      voucher_hex: toHex(encodeVoucher(channel, cum, exp)), channel_pda: pda,
      deposit_ceiling: dep.toString(), settled_watermark: wat.toString(), current_time: now.toString(),
    });
    return { checks: op.checks, all: op.all_pass, flags: compliance_flags };
  };
  let r = run(1000n, 0n, 500n, 1000n, 400n);
  if (!r.checks.cumulative_within_deposit_ceiling || !r.all) violations++; checked++;
  r = run(1001n, 0n, 500n, 1000n, 400n);
  if (r.checks.cumulative_within_deposit_ceiling || r.flags[0] !== 'OVER_DEPOSIT') violations++; checked++;
  r = run(401n, 0n, 500n, 5000n, 400n);
  if (!r.checks.cumulative_above_settled_watermark) violations++; checked++;
  r = run(400n, 0n, 500n, 5000n, 400n);
  if (r.checks.cumulative_above_settled_watermark || r.flags[0] !== 'STALE_WATERMARK') violations++; checked++;
  r = run(401n, 0n, 500n, 5000n, 401n);
  if (r.checks.cumulative_above_settled_watermark) violations++; checked++;
  r = run(1000n, 500n, 500n, 5000n, 400n);
  if (r.checks.not_expired || r.flags[0] !== 'VOUCHER_EXPIRED') violations++; checked++;
  r = run(1000n, 501n, 500n, 5000n, 400n);
  if (!r.checks.not_expired) violations++; checked++;
  r = run(1000n, -5n, 500n, 5000n, 400n);
  if (r.checks.not_expired) violations++; checked++;
  // wrong channel and wrong magic with all other terms valid
  const other = new Uint8Array(32).fill(9);
  r = (() => { const out = compute({
    voucher_hex: toHex(encodeVoucher(other, 1000n, 0n)), channel_pda: pda,
    deposit_ceiling: '5000', settled_watermark: '400', current_time: '500' });
    return { checks: out.output_payload.checks, all: out.output_payload.all_pass, flags: out.compliance_flags }; })();
  if (r.checks.channel_id_matches_pda || r.flags[0] !== 'CHANNEL_MISMATCH') violations++; checked++;
  r = (() => { const bad = encodeVoucher(channel, 1000n, 0n); bad[0] = 0x57;
    const out = compute({
    voucher_hex: toHex(bad), channel_pda: pda,
    deposit_ceiling: '5000', settled_watermark: '400', current_time: '500' });
    return { checks: out.output_payload.checks, all: out.output_payload.all_pass, flags: out.compliance_flags }; })();
  if (r.checks.magic_is_56_01 || r.flags[0] !== 'VOUCHER_BAD_MAGIC') violations++; checked++;
  return { name: 'P2 boundary pins (deposit cap, strict watermark, expiry, channel, magic)', checked, violations };
}

// P3 refusal pins: every named refusal fires with its exact code, INPUT_REFUSED flags
// and a detail naming the offending field.
function p3Refusals() {
  const rng = mulberry32(0xa74903);
  let checked = 0, violations = 0;
  const channel = new Uint8Array(32).fill(3);
  const good = {
    voucher_hex: toHex(encodeVoucher(channel, 10n, 0n)), channel_pda: b58encode(channel),
    deposit_ceiling: '100', settled_watermark: '0', current_time: '1',
  };
  const cases = /** @type {[string, Record<string, unknown>][]} */ ([
    ['VOUCHER_MALFORMED', { ...good, voucher_hex: 'zz' }],
    ['VOUCHER_MALFORMED', { ...good, voucher_hex: '56010' }],  // odd length
    ['VOUCHER_MALFORMED', { ...good, voucher_hex: 42 }],
    ['CHANNEL_PDA_INVALID', { ...good, channel_pda: '0OIl' }], // excluded base58 chars
    ['CHANNEL_PDA_INVALID', { ...good, channel_pda: 'abc' }],
    ['DEPOSIT_CEILING_INVALID', { ...good, deposit_ceiling: '-1' }],
    ['DEPOSIT_CEILING_INVALID', { ...good, deposit_ceiling: '18446744073709551616' }],
    ['SETTLED_WATERMARK_INVALID', { ...good, settled_watermark: '1.5' }],
    ['CURRENT_TIME_INVALID', { ...good, current_time: 'abc' }],
    ['SECOND_VOUCHER_MALFORMED', { ...good, second_voucher_hex: 'nothex' }],
  ]);
  for (const entry of cases) {
    const code = entry[0];
    const pp = /** @type {Record<string, unknown>} */ (entry[1]);
    const { output_payload: op, compliance_flags } = compute(pp);
    if (op.error !== code.toLowerCase()) violations++;
    if (JSON.stringify(compliance_flags) !== '["INPUT_REFUSED"]') violations++;
    if (!op.domain_errors || op.domain_errors[0].code !== code) violations++;
    if (!op.detail || op.detail.length < 5) violations++;
    checked += 4;
  }
  // u64 boundary accepted: deposit ceiling at U64_MAX
  const { output_payload: op2, compliance_flags: f2 } = compute({ ...good, deposit_ceiling: '18446744073709551615' });
  if (f2.length !== 0 || !op2.all_pass) violations++;
  checked++;
  return { name: 'P3 refusal pins + u64 boundary acceptance', checked, violations };
}

// P4 mutant kill: flipping ANY single byte of a valid voucher message changes the
// kernel's decision surface (checks/all_pass/fields), i.e. the check suite is
// sensitive to every wire byte; byte 0/1 flips change magic, 2..34 the channel
// binding, 34..42 the amount against terms chosen to make each flip detectable.
function p4MutantKill() {
  const rng = mulberry32(0xa74904);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const channel = new Uint8Array(32);
    for (let k = 0; k < 32; k++) channel[k] = Math.floor(rng() * 256);
    const cumulative = BigInt(Math.floor(rng() * 2 ** 30) + 2);
    const orig = encodeVoucher(channel, cumulative, 0n);
    const pp = {
      voucher_hex: toHex(orig), channel_pda: b58encode(channel),
      deposit_ceiling: cumulative.toString(), settled_watermark: '0', current_time: '1',
    };
    const base = JSON.stringify(compute(pp).output_payload);
    for (let pos = 0; pos < 50; pos++) {
      for (const bit of [1, 128]) {
        const mut = orig.slice();
        mut[pos] ^= bit;
        const out = JSON.stringify(compute({ ...pp, voucher_hex: toHex(mut) }).output_payload);
        if (out === base) violations++;
        checked++;
      }
    }
  }
  return { name: 'P4 single-byte mutant kill over all 50 offsets (2 bits each)', checked, violations };
}

// P5 supersession semantics + determinism + output shape.
function p5SupersessionAndShape() {
  const rng = mulberry32(0xa74905);
  let checked = 0, violations = 0;
  const channel = new Uint8Array(32).fill(11);
  const pda = b58encode(channel);
  const ppOf = (cum) => ({
    voucher_hex: toHex(encodeVoucher(channel, cum, 0n)), channel_pda: pda,
    deposit_ceiling: '100000', settled_watermark: '0', current_time: '1',
  });
  let r = compute({ ...ppOf(1000n), second_voucher_hex: toHex(encodeVoucher(channel, 1000n, 0n)) });
  if (r.output_payload.second_voucher.superseded_by_first !== true) violations++; checked++;
  r = compute({ ...ppOf(1000n), second_voucher_hex: toHex(encodeVoucher(channel, 999n, 0n)) });
  if (r.output_payload.second_voucher.superseded_by_first !== true) violations++; checked++;
  r = compute({ ...ppOf(1000n), second_voucher_hex: toHex(encodeVoucher(channel, 1001n, 0n)) });
  if (r.output_payload.second_voucher.superseded_by_first !== false) violations++; checked++;
  // second voucher for a different channel / bad magic / bad length is flagged, not compared
  const other = new Uint8Array(32).fill(12);
  r = compute({ ...ppOf(1000n), second_voucher_hex: toHex(encodeVoucher(other, 1n, 0n)) });
  if (r.output_payload.second_voucher.superseded_by_first !== null || r.compliance_flags[0] !== 'SECOND_VOUCHER_CHANNEL_MISMATCH') violations++; checked++;
  // determinism over 3 identical runs
  const once = JSON.stringify(compute(ppOf(500n)));
  for (let i = 0; i < 2; i++) if (JSON.stringify(compute(ppOf(500n))) !== once) violations++;
  checked += 2;
  // output shape: no undefined / non-finite anywhere, valid and refusal paths alike
  for (const op of [compute(ppOf(500n)).output_payload, compute({}).output_payload]) {
    const v = findShapeViolations(op);
    if (v.length !== 0) violations += v.length;
    checked++;
  }
  // out-of-scope statement present on both paths
  if (!/NOT verified/i.test(compute(ppOf(500n)).output_payload.out_of_scope)) violations++;
  if (!/NOT verified/i.test(compute({}).output_payload.out_of_scope)) violations++;
  checked += 2;
  return { name: 'P5 supersession semantics + determinism + output shape + scope statement', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  p1LayoutRoundTrip(),
  p2Boundaries(),
  p3Refusals(),
  p4MutantKill(),
  p5SupersessionAndShape(),
];
console.log(`[${KERNEL_ID}] class-A floor property test — SOLANA-PAYCHAN-VOUCHER-VERIFIER-1.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
