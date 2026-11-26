// art-715-token2022-transfer-fee-reconciler property-test floor (SOLANA-B1-TRANSFER-FEE-NODE-1).
// kernel_digest_at_authoring: sha256:c414a3768622106b76dff42ac67c64552af24be5aae08474f240c16e0f676cdc
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
//
// ATTEMPT-3 KILL POWER (SOLANA-B1 attempt-2, 7F-V466 word, 2026-10-13 — the ART705 attempt-3
// shape): P4 refusal pins (every named refusal fires with its exact code, its INPUT_REFUSED
// flag array, its domain_errors entry and a detail naming the offending field), P5
// series-guard + compliance-flag-array + mode-naming pins (divergent-schedule epoch boundary
// sweep, exact compliance_flags arrays including the multi-flag order, instruction-mode naming
// for fee_mismatch/declared_fee, consumer-view boundary grid, inverse candidate-series pins),
// F9 strengthened to draw INDEPENDENT per-side fee configs so the schedule pick feeds the fee,
// and the fixture-oracle leg now GATES the exit code (it printed before; it must fail the run).
// Covered classes only: refusal / series-guard (+ the compliance-flag arrays inside the same
// word). Kernel bytes untouched — this file remains READ-ONLY w.r.t. the kernel.

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
  const raw = BigInt(amount) * BigInt(bps); // BigInt() coercion keeps tsc from inferring number
  const ceiled = (raw + 9999n) / 10000n; // ceiling via +9,999 then /10,000 (D7's shape)
  return ceiled > BigInt(maxFee) ? BigInt(maxFee) : ceiled;
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
// ATTEMPT-3 (7F-V466 series-guard): the two schedules draw INDEPENDENT bps/maxFee so the
// epoch pick feeds the fee (with identical confs a flipped pick changes only the schedule
// name); the credited amount alternates net/amount/net-1 so all three reconciliation arms and
// both comparison senses run across the population; the echo fields (execution_epoch,
// credited_amount) are pinned so output-shape mutants cannot hide behind unpinned fields.
function checkF9() {
  const violations = [];
  const TRIALS = 400;
  for (let i = 0; i < TRIALS; i++) {
    const amount = rndU64();
    const bpsO = rndBps(), bpsN = rndBps();       // independent per-side fee configs
    const maxO = rndU64(), maxN = rndU64();
    const olderEpoch = rnd() % 200n;
    const newerEpoch = olderEpoch + (rnd() % 200n);
    const execEpoch = rnd() % 400n;
    const pp = {
      older_transfer_fee: { epoch: olderEpoch.toString(), maximum_fee: maxO.toString(), transfer_fee_basis_points: bpsO.toString() },
      newer_transfer_fee: { epoch: newerEpoch.toString(), maximum_fee: maxN.toString(), transfer_fee_basis_points: bpsN.toString() },
      amount: amount.toString(),
      execution_epoch: execEpoch.toString(),
      instruction: 'TransferChecked',
      credited_amount: '0',
    };
    // (a) schedule pick decides the ACTIVE config, fee and net follow it (D2 + D1).
    const wantSched = refPick(execEpoch, olderEpoch, newerEpoch);
    const actBps = wantSched === 'newer' ? bpsN : bpsO;
    const actMax = wantSched === 'newer' ? maxN : maxO;
    const wantFee = refFee(amount, actBps, actMax);
    // NET_UNDERFLOW is a structured refusal, not a wrong number (bps may exceed 10,000 in u16).
    if (wantFee > amount) continue;
    // rotate the credited arm: net -> MATCH, amount -> OVER when fee > 0, net-1 -> UNDER.
    const credited = i % 3 === 0 ? amount - wantFee : (i % 3 === 1 ? amount : (amount > 0n ? amount - wantFee - 1n : 0n));
    pp.credited_amount = credited.toString();
    const { output_payload: out } = compute(pp);
    if (out.error) { violations.push({ i, kind: 'unexpected_refusal', err: out.error, amount: amount.toString(), bpsO: bpsO.toString(), bpsN: bpsN.toString() }); continue; }

    if (out.schedule !== wantSched) violations.push({ i, kind: 'schedule', got: out.schedule, want: wantSched });

    if (out.fee !== wantFee.toString()) violations.push({ i, kind: 'fee', got: out.fee, want: wantFee.toString() });

    // (b) round-trip (D4 L429-L470 model): net = amount - fee, withheld_added == fee.
    if (out.net !== (amount - wantFee).toString()) violations.push({ i, kind: 'net' });
    if (out.withheld_added !== wantFee.toString()) violations.push({ i, kind: 'withheld' });

    // (c) reconciliation arm + signed difference (R-7), pinned exactly per arm.
    const wantRec = credited === amount - wantFee ? 'MATCH' : (credited > amount - wantFee ? 'OVER_CREDITED' : 'UNDER_CREDITED');
    if (out.reconciliation !== wantRec) violations.push({ i, kind: 'reconciliation', got: out.reconciliation, want: wantRec });
    const wantDiff = credited === amount - wantFee ? '0' : (credited > amount - wantFee ? (credited - (amount - wantFee)).toString() : '-' + ((amount - wantFee) - credited).toString());
    if (out.credited_minus_net !== wantDiff) violations.push({ i, kind: 'credited_minus_net', got: out.credited_minus_net, want: wantDiff });

    // (d) echo pins: the input epochs and credited amount come back as their decimal strings.
    if (out.execution_epoch !== execEpoch.toString()) violations.push({ i, kind: 'epoch_echo' });
    if (out.credited_amount !== credited.toString()) violations.push({ i, kind: 'credited_echo' });
    if (out.verifier_epoch !== null) violations.push({ i, kind: 'verifier_echo_when_absent' });
    if (out.fee_mismatch !== null || out.declared_fee !== null) violations.push({ i, kind: 'withfee_fields_on_plain_checked' });

    // (e) inverse property (D1 L80-L112 model): the reported minimal pre-fee forwards to the net.
    if (out.min_pre_fee_for_net !== null) {
      const pre = BigInt(out.min_pre_fee_for_net);
      const fee2 = refFee(pre, actBps, actMax);
      if (pre - fee2 !== amount - wantFee) violations.push({ i, kind: 'inverse_forward' });
      // smaller-amount property: no smaller representable pre-fee yields the same net from the
      // uncapped region (the true minimum cannot be beaten by a smaller candidate).
      if (pre > 0n) {
        const smaller = pre - 1n;
        if (smaller - refFee(smaller, actBps, actMax) === amount - wantFee && refFee(pre, actBps, actMax) < actBps) {
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

// P4: refusal contract — every named refusal fires with its exact code, its INPUT_REFUSED
// compliance-flag array, a one-entry domain_errors carrying the code, every computed output
// field null, and a detail naming the offending field AND the rejected value (the ART705
// attempt-3 refusal-pin shape; covered class: refusal survivors).
function goodPP() {
  return refBasePP(1000n, 500n, 1000000n, 1n, 100n, 100n);
}
// fullPP — a complete pp with BOTH schedules sharing one fee config (the F5 shape) plus the
// optional credited/required/WithFee/verifier fields the fixed grids need; refBasePP only
// builds the bare F9 shape (credited '0', plain TransferChecked).
function fullPP(amount, bps, maxFee, execEpoch, extra = {}) {
  return {
    older_transfer_fee: { epoch: '1', maximum_fee: maxFee.toString(), transfer_fee_basis_points: bps.toString() },
    newer_transfer_fee: { epoch: '100', maximum_fee: maxFee.toString(), transfer_fee_basis_points: bps.toString() },
    amount: amount.toString(),
    execution_epoch: execEpoch,
    instruction: 'TransferChecked',
    credited_amount: '0',
    ...extra,
  };
}
/** @type {[string, (pp: any) => void, string, string[]][]} — case name, pp mutation, expected refusal code, detail needles */
const REFUSAL_CASES = [
  ['older null', (pp) => { pp.older_transfer_fee = null; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee must be an object']],
  ['older a number', (pp) => { pp.older_transfer_fee = 5; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee must be an object']],
  ['older an array', (pp) => { pp.older_transfer_fee = []; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee must be an object']],
  ['newer missing entirely', (pp) => { delete pp.newer_transfer_fee; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee must be an object']],
  ['older.epoch missing', (pp) => { delete pp.older_transfer_fee.epoch; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.epoch is required']],
  ['older.maximum_fee missing', (pp) => { delete pp.older_transfer_fee.maximum_fee; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.maximum_fee is required']],
  ['older.bps missing', (pp) => { delete pp.older_transfer_fee.transfer_fee_basis_points; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.transfer_fee_basis_points is required']],
  ['newer.epoch missing', (pp) => { delete pp.newer_transfer_fee.epoch; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee.epoch is required']],
  ['newer.maximum_fee missing', (pp) => { delete pp.newer_transfer_fee.maximum_fee; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee.maximum_fee is required']],
  ['newer.bps missing', (pp) => { delete pp.newer_transfer_fee.transfer_fee_basis_points; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee.transfer_fee_basis_points is required']],
  ['older.epoch leading junk', (pp) => { pp.older_transfer_fee.epoch = 'x12'; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.epoch must be a decimal string', '"x12"']],
  ['older.epoch trailing junk', (pp) => { pp.older_transfer_fee.epoch = '12x'; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.epoch must be a decimal string', '"12x"']],
  ['older.epoch float notation', (pp) => { pp.older_transfer_fee.epoch = '1e3'; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.epoch must be a decimal string', '"1e3"']],
  ['older.epoch negative', (pp) => { pp.older_transfer_fee.epoch = '-1'; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.epoch must be a decimal string', '"-1"']],
  ['older.epoch empty string', (pp) => { pp.older_transfer_fee.epoch = ''; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.epoch must be a decimal string', '""']],
  ['newer.maximum_fee above u64', (pp) => { pp.newer_transfer_fee.maximum_fee = '18446744073709551616'; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee.maximum_fee must be a decimal string', '"18446744073709551616"']],
  ['newer.maximum_fee not a string', (pp) => { pp.newer_transfer_fee.maximum_fee = 77; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee.maximum_fee must be a decimal string', '77']],
  ['older.bps above u16', (pp) => { pp.older_transfer_fee.transfer_fee_basis_points = '65536'; }, 'FEE_SCHEDULE_MALFORMED', ['older_transfer_fee.transfer_fee_basis_points must be a decimal string', '"65536"']],
  ['newer.bps above u16', (pp) => { pp.newer_transfer_fee.transfer_fee_basis_points = '99999'; }, 'FEE_SCHEDULE_MALFORMED', ['newer_transfer_fee.transfer_fee_basis_points must be a decimal string', '"99999"']],
  ['execution_epoch junk prefix', (pp) => { pp.execution_epoch = 'x2'; }, 'EXECUTION_EPOCH_INVALID', ['execution_epoch must be a decimal string', '"x2"']],
  ['execution_epoch junk suffix', (pp) => { pp.execution_epoch = '2x'; }, 'EXECUTION_EPOCH_INVALID', ['execution_epoch must be a decimal string', '"2x"']],
  ['execution_epoch above u64', (pp) => { pp.execution_epoch = '18446744073709551616'; }, 'EXECUTION_EPOCH_INVALID', ['execution_epoch must be a decimal string']],
  ['amount not numeric', (pp) => { pp.amount = 'not-a-number'; }, 'AMOUNT_INVALID', ['amount must be a decimal string', '"not-a-number"']],
  ['instruction plain Transfer', (pp) => { pp.instruction = 'Transfer'; }, 'MINT_REQUIRED_FOR_TRANSFER', ['MintRequiredForTransfer', '"Transfer"']],
  ['instruction wrong case', (pp) => { pp.instruction = 'transferchecked'; }, 'MINT_REQUIRED_FOR_TRANSFER', ['MintRequiredForTransfer', '"transferchecked"']],
  ['instruction empty', (pp) => { pp.instruction = ''; }, 'MINT_REQUIRED_FOR_TRANSFER', ['MintRequiredForTransfer', '""']],
  ['declared_fee junk on WithFee', (pp) => { pp.instruction = 'TransferCheckedWithFee'; pp.declared_fee = 'NaN'; }, 'DECLARED_FEE_INVALID', ['declared_fee must be a decimal string', '"NaN"']],
  ['declared_fee missing on WithFee', (pp) => { pp.instruction = 'TransferCheckedWithFee'; }, 'DECLARED_FEE_INVALID', ['declared_fee must be a decimal string']],
  ['credited float notation', (pp) => { pp.credited_amount = '1e3'; }, 'CREDITED_AMOUNT_INVALID', ['credited_amount must be a decimal string', '"1e3"']],
  ['credited leading space', (pp) => { pp.credited_amount = ' 50'; }, 'CREDITED_AMOUNT_INVALID', ['credited_amount must be a decimal string']],
  ['verifier_epoch negative', (pp) => { pp.verifier_epoch = '-1'; }, 'VERIFIER_EPOCH_INVALID', ['verifier_epoch must be a decimal string', '"-1"']],
  ['required_amount junk suffix', (pp) => { pp.required_amount = '5x'; }, 'REQUIRED_AMOUNT_INVALID', ['required_amount must be a decimal string', '"5x"']],
  ['net underflow bps 20000', (pp) => { pp.older_transfer_fee.transfer_fee_basis_points = '20000'; pp.newer_transfer_fee.transfer_fee_basis_points = '20000'; pp.older_transfer_fee.maximum_fee = '18446744073709551615'; pp.newer_transfer_fee.maximum_fee = '18446744073709551615'; }, 'NET_UNDERFLOW', ['(2000)', '(1000)', 'underflow']],
];
const REFUSED_NULL_FIELDS = ['schedule', 'fee', 'net', 'withheld_added', 'min_pre_fee_for_net', 'reconciliation', 'credited_minus_net', 'epoch_race', 'consumer_view'];
function checkP4_refusalMatrix() {
  const violations = [];
  for (const [name, mutate, wantCode, needles] of REFUSAL_CASES) {
    const pp = goodPP();
    mutate(pp);
    const r = compute(pp);
    const out = r.output_payload;
    if (out.error !== wantCode.toLowerCase()) { violations.push({ case: name, kind: 'error', got: out.error, want: wantCode.toLowerCase() }); continue; }
    if (JSON.stringify(r.compliance_flags) !== JSON.stringify(['INPUT_REFUSED'])) violations.push({ case: name, kind: 'flags', got: JSON.stringify(r.compliance_flags) });
    if (!Array.isArray(out.domain_errors) || out.domain_errors.length !== 1 || out.domain_errors[0].code !== wantCode) violations.push({ case: name, kind: 'domain_errors', got: JSON.stringify(out.domain_errors) });
    for (const f of REFUSED_NULL_FIELDS) if (out[f] !== null) violations.push({ case: name, kind: 'not-null:' + f });
    for (const needle of needles) if (!String(out.detail || '').includes(needle)) violations.push({ case: name, kind: 'detail', missing: needle });
  }
  return { name: 'P4_refusal_matrix', cases: REFUSAL_CASES.length, violations: violations.length, detail: violations.slice(0, 5) };
}

// P5: series-guard + compliance-flag-array + mode-naming pins (ART705 attempt-3 shape;
// covered classes: series-guard survivors and the compliance-flag arrays).
function checkP5_seriesGuardAndFlagPins() {
  const violations = [];
  const push = (kind, got, want) => violations.push({ kind, got: JSON.stringify(got), want: JSON.stringify(want) });
  const DIV_OLDER = { epoch: '100', maximum_fee: '10', transfer_fee_basis_points: '100' }; // fee(min(ceil(a*100/1e4),10))
  const DIV_NEWER = { epoch: '100', maximum_fee: '5000', transfer_fee_basis_points: '1' };  // fee(min(ceil(a*1/1e4),5000))
  const mkPP = (execEpoch, extra = {}) => ({
    older_transfer_fee: { ...DIV_OLDER }, newer_transfer_fee: { ...DIV_NEWER },
    amount: '1000000', execution_epoch: execEpoch, instruction: 'TransferChecked',
    credited_amount: '999900', ...extra,
  });
  // (a) Divergent-schedule epoch boundary sweep: at exactly newer.epoch the NEWER schedule and
  // its bps/max apply (D2 L152-L157); one epoch below, the older; the pick feeds fee and net.
  const wantFor = (execEpoch) => {
    const sched = BigInt(execEpoch) >= 100n ? 'newer' : 'older';
    const bps = BigInt(sched === 'newer' ? DIV_NEWER.transfer_fee_basis_points : DIV_OLDER.transfer_fee_basis_points);
    const max = BigInt(sched === 'newer' ? DIV_NEWER.maximum_fee : DIV_OLDER.maximum_fee);
    const raw = 1000000n * bps;
    const ceiled = (raw + 9999n) / 10000n;
    const fee = ceiled > max ? max : ceiled;
    return { sched, fee, net: 1000000n - fee };
  };
  for (const execEpoch of ['99', '100', '101', '0', '5', '18446744073709551615']) {
    const want = wantFor(execEpoch);
    const out = compute(mkPP(execEpoch)).output_payload;
    if (out.schedule !== want.sched) push('sweep:schedule@' + execEpoch, out.schedule, want.sched);
    if (out.fee !== want.fee.toString()) push('sweep:fee@' + execEpoch, out.fee, want.fee.toString());
    if (out.net !== want.net.toString()) push('sweep:net@' + execEpoch, out.net, want.net.toString());
    if (out.epoch_race !== null) push('sweep:epoch_race@' + execEpoch, out.epoch_race, null);
    if (out.execution_epoch !== execEpoch) push('sweep:epoch_echo@' + execEpoch, out.execution_epoch, execEpoch);
  }
  // (b) Epoch-race guard: the race fires iff the verifier epoch picks the OTHER schedule; the
  // flag array is exactly one entry, and same-side verifier epochs stay clean (R-8).
  for (const [execEpoch, verifierEpoch, wantRace] of [['100', '99', 'EPOCH_SCHEDULE_DIVERGENCE'], ['99', '100', 'EPOCH_SCHEDULE_DIVERGENCE'], ['100', '101', null], ['99', '50', null], ['101', '0', 'EPOCH_SCHEDULE_DIVERGENCE'], ['100', '100', null]]) {
    const r = compute(mkPP(execEpoch, { verifier_epoch: verifierEpoch }));
    const out = r.output_payload;
    if (out.epoch_race !== wantRace) push('race@' + execEpoch + '/' + verifierEpoch, out.epoch_race, wantRace);
    const wantFlags = wantRace ? [wantRace] : [];
    if (JSON.stringify(r.compliance_flags) !== JSON.stringify(wantFlags)) push('race:flags@' + execEpoch + '/' + verifierEpoch, r.compliance_flags, wantFlags);
    if (out.verifier_epoch !== verifierEpoch) push('race:verifier_echo@' + execEpoch + '/' + verifierEpoch, out.verifier_epoch, verifierEpoch);
  }
  // (c) Compliance-flag arrays on SUCCESS outputs, pinned exactly (order included): clean,
  // single-flag, and the three-flag combination in the kernel's emission order.
  {
    const clean = compute(mkPP('100'));
    if (JSON.stringify(clean.compliance_flags) !== JSON.stringify([])) push('flags:clean', clean.compliance_flags, []);
    const mismatch = compute(mkPP('100', { instruction: 'TransferCheckedWithFee', declared_fee: '49' }));
    if (JSON.stringify(mismatch.compliance_flags) !== JSON.stringify(['FEE_MISMATCH'])) push('flags:mismatch', mismatch.compliance_flags, ['FEE_MISMATCH']);
    if (mismatch.output_payload.fee_mismatch !== 'FeeMismatch') push('fee_mismatch:code', mismatch.output_payload.fee_mismatch, 'FeeMismatch');
    if (mismatch.output_payload.declared_fee !== '49') push('declared_fee:echo', mismatch.output_payload.declared_fee, '49');
    const matchFee = compute(mkPP('100', { instruction: 'TransferCheckedWithFee', declared_fee: '100' }));
    if (JSON.stringify(matchFee.compliance_flags) !== JSON.stringify([])) push('flags:withfee-match', matchFee.compliance_flags, []);
    if (matchFee.output_payload.fee_mismatch !== null) push('fee_mismatch:null-when-matching', matchFee.output_payload.fee_mismatch, null);
    if (matchFee.output_payload.declared_fee !== '100') push('declared_fee:echo2', matchFee.output_payload.declared_fee, '100');
    // plain TransferChecked must NOT emit WithFee fields (mode naming).
    if (clean.output_payload.fee_mismatch !== null) push('fee_mismatch:null-when-plain', clean.output_payload.fee_mismatch, null);
    if (clean.output_payload.declared_fee !== null) push('declared_fee:null-when-plain', clean.output_payload.declared_fee, null);
    // all three flags at once: race + mismatch + consumer divergence (required == the gross
    // amount makes static accept while the net is short), in emission order.
    const all3 = compute(mkPP('100', { instruction: 'TransferCheckedWithFee', declared_fee: '49', verifier_epoch: '99', required_amount: '1000000' }));
    if (JSON.stringify(all3.compliance_flags) !== JSON.stringify(['EPOCH_SCHEDULE_DIVERGENCE', 'FEE_MISMATCH', 'CONSUMER_PATH_DIVERGENCE'])) push('flags:all3', all3.compliance_flags, ['EPOCH_SCHEDULE_DIVERGENCE', 'FEE_MISMATCH', 'CONSUMER_PATH_DIVERGENCE']);
    if (all3.output_payload.epoch_race !== 'EPOCH_SCHEDULE_DIVERGENCE') push('all3:race', all3.output_payload.epoch_race, 'EPOCH_SCHEDULE_DIVERGENCE');
    if (all3.output_payload.fee_mismatch !== 'FeeMismatch') push('all3:mismatch', all3.output_payload.fee_mismatch, 'FeeMismatch');
  }
  // (d) Reconciliation grid (R-7): F5 shape amount 1000 bps 500 -> fee 50 net 950; the three
  // arms and their exact signed differences.
  {
    const arm = (credited, wantRec, wantDiff) => {
      const rr = compute(fullPP(1000n, 500n, 1000000n, '100', { credited_amount: credited }));
      const out = rr.output_payload;
      if (out.reconciliation !== wantRec) push('reconciliation@' + credited, out.reconciliation, wantRec);
      if (out.credited_minus_net !== wantDiff) push('credited_minus_net@' + credited, out.credited_minus_net, wantDiff);
      if (out.credited_amount !== credited) push('credited_echo@' + credited, out.credited_amount, credited);
      if (JSON.stringify(rr.compliance_flags) !== JSON.stringify([])) push('reconciliation:flags@' + credited, rr.compliance_flags, []);
    };
    arm('950', 'MATCH', '0');
    arm('1000', 'OVER_CREDITED', '50');
    arm('900', 'UNDER_CREDITED', '-50');
    arm('949', 'UNDER_CREDITED', '-1');
    arm('951', 'OVER_CREDITED', '1');
  }
  // (e) Consumer-view boundary grid (R-9): bps 100 on 1000 -> fee 10 net 990; every
  // static/balance/divergence combination around the gross and net boundaries.
  {
    const cvCase = (required, wantStatic, wantBalance) => {
      const r = compute(fullPP(1000n, 100n, 1000000n, '100', { credited_amount: '990', required_amount: required }));
      const out = r.output_payload;
      const cv = out.consumer_view || {};
      if (cv.x402_static_path_accept !== wantStatic) push('cv:static@' + required, cv.x402_static_path_accept, wantStatic);
      if (cv.x402_balance_delta_path_accept !== wantBalance) push('cv:balance@' + required, cv.x402_balance_delta_path_accept, wantBalance);
      const wantDiv = wantStatic !== wantBalance;
      if (cv.consumer_path_divergence !== wantDiv) push('cv:divergence@' + required, cv.consumer_path_divergence, wantDiv);
      if (cv.required_amount !== required) push('cv:echo@' + required, cv.required_amount, required);
      const wantFlags = wantDiv ? ['CONSUMER_PATH_DIVERGENCE'] : [];
      if (JSON.stringify(r.compliance_flags) !== JSON.stringify(wantFlags)) push('cv:flags@' + required, r.compliance_flags, wantFlags);
      if (typeof cv.note !== 'string' || !cv.note.includes('never mentions transfer fees')) push('cv:note', cv.note, 'note text');
    };
    cvCase('1001', false, false); // above gross: both reject
    cvCase('1000', true, false);  // gross match, net short  (the x402 divergence, F10 shape)
    cvCase('991', false, false);  // between net and gross: both reject the middle point
    cvCase('990', false, true);   // exact net match: balance-delta accepts
    cvCase('989', false, true);   // below net: static rejects, balance-delta accepts
  }
  // (f) Inverse candidate-series pins (R-6): the capped-only region (bps == 10,000), the
  // zero-bps identity incl. the u64 boundary, the tie-break, the rejected uncapped candidate
  // falling through to the capped one, and the capped candidate that lands exactly on
  // u64::MAX (the pre > U64_MAX guard boundary).
  {
    const inv = (amount, bps, maxFee, want) => {
      const out = compute(fullPP(amount, bps, maxFee, '100')).output_payload;
      if (out.error) { push('inverse:error', out.error, null); return; }
      if (out.min_pre_fee_for_net !== want) push('inverse', out.min_pre_fee_for_net, want);
    };
    inv(5n, 10000n, 77n, '77');                    // fee 5, net 0, capped-only region: pre = maxFee
    inv(10n, 10000n, 5n, '10');                    // fee caps at 5, net 5, capped candidate 5+5 = 10
    inv(18446744073709551615n, 0n, 5n, '18446744073709551615'); // bps 0 identity at the u64 boundary
    inv(10n, 1000n, 18446744073709551615n, '10');  // F8 tie-break inline: net 9, uncapped 10, capped overflows
    inv(1000n, 100n, 1n, '1000');                  // uncapped candidate rejected (1009!=999), capped 999+1 wins
    inv(5n, 10000n, 18446744073709551615n, '18446744073709551615'); // capped candidate exactly u64::MAX
    inv(1000n, 500n, 18446744073709551615n, '1000'); // capped candidate overflows u64, uncapped wins
    inv(5n, 5000n, 5n, '4');                       // fee 3, net 2: uncapped 4 wins, capped 7 rejected
  }
  // (g) deNull pins: top-level null optionals are treated as absent (success, null echo), not
  // as malformed strings; a null declared_fee on WithFee still refuses.
  {
    const r = compute(mkPP('100', { verifier_epoch: null, required_amount: null }));
    const out = r.output_payload;
    if (out.error) push('denull:error', out.error, null);
    if (out.verifier_epoch !== null) push('denull:verifier', out.verifier_epoch, null);
    if (out.consumer_view !== null) push('denull:consumer_view', out.consumer_view, null);
    if (JSON.stringify(r.compliance_flags) !== JSON.stringify([])) push('denull:flags', r.compliance_flags, []);
    const r2 = compute(mkPP('100', { instruction: 'TransferCheckedWithFee', declared_fee: null }));
    if (r2.output_payload.error !== 'declared_fee_invalid') push('denull:declared_fee', r2.output_payload.error, 'declared_fee_invalid');
    if (JSON.stringify(r2.compliance_flags) !== JSON.stringify(['INPUT_REFUSED'])) push('denull:declared_fee:flags', r2.compliance_flags, ['INPUT_REFUSED']);
  }
  // (h) u16 boundary success: bps 65535 with amount 0 is a VALID (refusing-underflow-free)
  // input shape — fee 0 via amount == 0; and the plain note field is present and names Kora.
  {
    const r = compute(refBasePP(0n, 65535n, 1000n, 1n, 100n, 100n));
    const out = r.output_payload;
    if (out.error) push('u16:error', out.error, null);
    if (out.fee !== '0' || out.net !== '0') push('u16:fee', [out.fee, out.net], ['0', '0']);
    if (typeof out.note !== 'string' || !out.note.includes('Kora')) push('note:missing', out.note, 'Kora note');
  }
  return { name: 'P5_series_guard_and_flag_pins', violations: violations.length, detail: violations.slice(0, 8) };
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
results.properties.push(checkP4_refusalMatrix());
results.properties.push(checkP5_seriesGuardAndFlagPins());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-715-token2022-transfer-fee-reconciler',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

// ATTEMPT-3 (7F-V466): the fixture-oracle leg GATES the exit code. It printed before and a
// fixture-pin failure alone exited 0 — the single largest kill-power hole this floor had.
process.exit(oracleOk && !anyPropertyViolation ? 0 : 1);
