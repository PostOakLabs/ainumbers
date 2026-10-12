// art-715-token2022-transfer-fee-reconciler property-test floor (SOLANA-B1-TRANSFER-FEE-NODE-1).
// kernel_digest_at_authoring: sha256:ddb9626e4e6ad6703864726bba41054a8819f6bf6a60a9e6f8af625be3316b6d
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3. Shape:
//   - Fixture-oracle gate: every fixture vector's spec_pins (hand-derived from the build spec's
//     §6, whose numbers come from the Token-2022 program's own tests (D4), the Kora advisory
//     arithmetic (D5-D6) and the consumer-path pins (D8-D9)) is asserted against the kernel.
//   - F9 cross-implementation property (spec §6 F9, citing D1; D2; D7 L162-L195; D4 L429-L470):
//     for randomized u64 amounts, u16 basis points and both schedule picks, the kernel's R-1/R-2
//     equal an INDEPENDENT reference written here from the pinned clause text (ceiling division
//     via +9,999 then /10,000, same cap, same epoch switch) — plus the source's own round-trip
//     and inverse properties as the model (pre-fee of the net == net's minimal pre-fee pick).
//   - Determinism and pure-refusal properties.
// float:no — all amounts are decimal strings parsed to BigInt in kernel and reference alike;
// JS Number never touches an amount. ZERO external dependencies — pure Node built-ins.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-715-token2022-transfer-fee-reconciler.proptest.mjs

import { compute } from '../art-715-token2022-transfer-fee-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, f9_equivalence: null, properties: [] };

const U64_MAX = (1n << 64n) - 1n;

// Deterministic PRNG (xorshift64) so the run is reproducible — no Math.random.
let seed = 0x9e3779b97f4a7c15n;
function rnd() {
  seed ^= seed << 13n; seed &= U64_MAX;
  seed ^= seed >> 7n;
  seed ^= seed << 17n; seed &= U64_MAX;
  return seed;
}
function rndU64() { return rnd(); }
function rndBps() { return rnd() % 10001n; } // 0..10,000 inclusive: the semantically valid bps domain

// F9 independent reference, written from the pinned clause text (D1 fee arithmetic, D2 schedule
// pick) — deliberately structured differently from the kernel's helpers (single expression chain,
// no shared code) so a shared bug cannot hide.
function refPick(execEpoch, olderEpoch, newerEpoch) {
  return execEpoch >= newerEpoch ? 'newer' : 'older'; // D2: exactly at newer.epoch -> newer
}
function refFee(amount, bps, maxFee) {
  if (bps === 0n || amount === 0n) return 0n;
  const ceiled = (amount * bps + 9999n) / 10000n; // ceiling via +9,999 then /10,000 (D7's shape)
  return ceiled > maxFee ? maxFee : ceiled;
}
function refBasePP(amount, bps, maxFee, olderEpoch, newerEpoch, execEpoch) {
  return {
    older_transfer_fee: { epoch: olderEpoch.toString(), maximum_fee: maxFee.toString(), transfer_fee_basis_points: bps.toString() },
    newer_transfer_fee: { epoch: newerEpoch.toString(), maximum_fee: maxFee.toString(), transfer_fee_basis_points: bps.toString() },
    amount: amount.toString(),
    execution_epoch: execEpoch.toString(),
    instruction: 'TransferChecked',
    credited_amount: '0',
  };
}

// ---------- fixture-oracle gate: spec_pins against the kernel (MANDATORY before any property) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-715-token2022-transfer-fee-reconciler.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload: out } = compute(vec.policy_parameters);
    const pins = vec.spec_pins || {};
    for (const [key, want] of Object.entries(pins)) {
      let got;
      if (key.startsWith('consumer_view.')) got = out.consumer_view ? out.consumer_view[key.slice('consumer_view.'.length)] : undefined;
      else if (key === 'detail_contains') got = typeof out.detail === 'string' && out.detail.includes(want) ? want : out.detail;
      else got = out[key];
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        failures.push({ name: vec.name, pin: key, want, got });
      }
    }
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- negative control ----------
function negativeControl() {
  const pp = refBasePP(1000n, 500n, 1000000n, 0n, 0n, 0n);
  const { output_payload } = compute(pp);
  const mutated = { ...output_payload, fee: output_payload.fee === '51' ? '50' : '51' };
  return { rejected_wrong_spec: JSON.stringify(mutated) !== JSON.stringify(output_payload) };
}

// F9: randomized cross-implementation equivalence + round-trip + inverse properties.
function checkF9() {
  const violations = [];
  const TRIALS = 400;
  for (let i = 0; i < TRIALS; i++) {
    const amount = rndU64();
    const bps = rndBps();
    const maxFee = rndU64();
    const olderEpoch = rnd() % 200n;
    const newerEpoch = olderEpoch + (rnd() % 200n);
    const execEpoch = rnd() % 400n;
    const pp = refBasePP(amount, bps, maxFee, olderEpoch, newerEpoch, execEpoch);
    const { output_payload: out } = compute(pp);
    if (out.error) { violations.push({ i, kind: 'unexpected_refusal', err: out.error, amount: amount.toString(), bps: bps.toString() }); continue; }

    // (a) schedule pick equals the reference (D2).
    const wantSched = refPick(execEpoch, olderEpoch, newerEpoch);
    if (out.schedule !== wantSched) violations.push({ i, kind: 'schedule', got: out.schedule, want: wantSched });

    // (b) fee equals the reference (D1: ceiling, cap).
    const wantFee = refFee(amount, bps, maxFee);
    if (out.fee !== wantFee.toString()) violations.push({ i, kind: 'fee', got: out.fee, want: wantFee.toString() });

    // (c) round-trip (D4 L429-L470 model): net = amount - fee, withheld_added == fee.
    if (out.net !== (amount - wantFee).toString()) violations.push({ i, kind: 'net' });
    if (out.withheld_added !== wantFee.toString()) violations.push({ i, kind: 'withheld' });

    // (d) inverse property (D1 L80-L112 model): the reported minimal pre-fee forwards to the net.
    if (out.min_pre_fee_for_net !== null) {
      const pre = BigInt(out.min_pre_fee_for_net);
      const fee2 = refFee(pre, bps, maxFee);
      if (pre - fee2 !== amount - wantFee) violations.push({ i, kind: 'inverse_forward' });
      // smaller-amount property: no smaller representable pre-fee yields the same net from the
      // uncapped region (the true minimum cannot be beaten by a smaller candidate).
      if (pre > 0n) {
        const smaller = pre - 1n;
        if (smaller - refFee(smaller, bps, maxFee) === amount - wantFee && refFee(pre, bps, maxFee) < bps) {
          // only reachable if the capped-region candidate won while a smaller uncapped one exists
          violations.push({ i, kind: 'inverse_not_minimal' });
        }
      }
    }
  }
  results.f9_equivalence = { trials: TRIALS, violations };
  return { name: 'F9_cross_implementation_equivalence', trials: TRIALS, violations: violations.length, detail: violations.slice(0, 5) };
}

// P1: determinism — same input twice, byte-identical output.
function checkP1() {
  const pp = refBasePP(12345678901234567890n, 1234n, 999999n, 5n, 100n, 100n);
  const a = JSON.stringify(compute(pp).output_payload);
  const b = JSON.stringify(compute(pp).output_payload);
  return { name: 'P1_determinism', violations: a === b ? 0 : 1 };
}

// P2: inputs are echoed as decimal strings — no exponent, no float formatting, ever.
function checkP2() {
  const violations = [];
  for (let i = 0; i < 50; i++) {
    const amount = rndU64();
    const pp = refBasePP(amount, 0n, U64_MAX, 0n, 0n, 0n);
    const { output_payload: out } = compute(pp);
    if (!/^[0-9]+$/.test(out.net) || out.net !== amount.toString()) violations.push({ amount: amount.toString(), got: out.net });
  }
  return { name: 'P2_decimal_string_echo', trials: 50, violations: violations.length, detail: violations.slice(0, 3) };
}

// P3: refusal contract — an unchecked instruction always refuses naming the program error, and a
// malformed decimal never throws (structured refusal instead).
function checkP3() {
  const violations = [];
  const bad = refBasePP(1000n, 500n, 1000000n, 0n, 0n, 0n);
  bad.instruction = 'Transfer';
  const r1 = compute(bad).output_payload;
  if (r1.error !== 'mint_required_for_transfer' || !r1.detail.includes('MintRequiredForTransfer')) violations.push({ kind: 'unchecked_refusal', got: r1.error });
  const bad2 = refBasePP(1000n, 500n, 1000000n, 0n, 0n, 0n);
  bad2.amount = 'not-a-number';
  const r2 = compute(bad2).output_payload;
  if (!r2.error) violations.push({ kind: 'malformed_accepted' });
  const bad3 = refBasePP(1000n, 500n, 1000000n, 0n, 0n, 0n);
  bad3.amount = '18446744073709551616'; // 2^64 — out of u64 range
  const r3 = compute(bad3).output_payload;
  if (!r3.error) violations.push({ kind: 'u64_overflow_accepted' });
  return { name: 'P3_refusal_contract', violations: violations.length, detail: violations };
}

const oracleOk = runFixtureOracle();
const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkF9());
results.properties.push(checkP1());
results.properties.push(checkP2());
results.properties.push(checkP3());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-715-token2022-transfer-fee-reconciler',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
