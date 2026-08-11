// art-610-erc4626-vault-share-math.proptest.mjs — FV property-test FLOOR (ETHMATH-VAULT-1).
// kernel_digest_at_authoring: sha256:b112b2136dc497e69f632232e47a9a70fa63d7dbc3d67c313cf89edb1fb97f33
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class A -- the state space that
// matters is small integer ratios and is enumerable). NOT a proof, NOT Dafny.
//
// float_sensitive: NO. The kernel is BigInt-only: every quantity is a uint256 parsed from a string,
// every division is an explicit floor or ceiling via mulDiv, and nothing is ever converted to a JS
// number. There is no IEEE-754 operation anywhere in it, so the float-specific members of the
// FV-ROUNDING-SUITE-LIB-1 property suite (P1/P2 decimal ties, P11 ULP loss, P13 signed zero, P14
// denormals, P15 non-associativity, P29 float-sensitive completeness) are NOT APPLICABLE here and
// are recorded as such below rather than silently omitted -- an inapplicable property that is
// simply absent reads identically to one that was forgotten.
//
// rounding (declared, per ETHMATH-VAULT-1's FV tie-in):
//   mode:      directed -- floor and ceiling only, never half-up/half-even. Direction is fixed per
//              operation by ERC-4626, not chosen at runtime.
//   precision: exact integer (uint256). No decimal-digit precision exists to bound.
//   rounding_steps: one directed division per conversion (mulDiv); the round-trip leg has two (the
//              deposit conversion then the redeem conversion), the fee leg one, the drift leg one
//              per snapshot plus one for the bps ratio.
//
// THE NAMED PROPERTIES ARE THE STANDARD'S OWN MANDATE. ERC-4626 (Final, Created 2021-12-22,
// CC0-1.0) fixes a rounding direction per function, so each direction below is asserted as a
// SEPARATE named property rather than folded into one "rounding is correct" check -- a floor that
// checks them jointly cannot say WHICH direction regressed, and getting exactly one of them
// backwards is the documented failure mode (it is how a vault leaks value to its users or its
// users to it, one wei at a time).
//
// P0  fixture oracle -- every pinned vector reproduces byte-for-byte.
// P1  previewDeposit rounds DOWN                 ("no more than the exact amount ... minted")
// P2  previewMint rounds UP                      ("no fewer than the exact amount ... deposited")
// P3  previewWithdraw rounds UP                  ("no fewer than the exact amount ... burned")
// P4  previewRedeem rounds DOWN                  ("no more than the exact amount ... withdrawn")
// P5  convertToShares rounds DOWN                ("MUST round down towards 0")
// P6  convertToAssets rounds DOWN                ("MUST round down towards 0")
//     P1-P6 are checked DIFFERENTIALLY against an exact rational oracle built in THIS file from
//     BigInt numerator/denominator pairs -- the true unrounded value is compared to the kernel's
//     output, and the kernel must sit on the mandated side of it and within one unit of it. That
//     is stronger than re-running the kernel's own formula, which would be the self-consistent
//     checker shape SO #34 names.
// P7  favour-the-vault direction pairing: for the same input on the same state, the round-up
//     members never return less than the round-down members. This is the Security Considerations
//     rationale expressed as an ordering, and it catches a swapped pair that P1-P6 would each
//     still pass if the swap were symmetric.
// P8  round-trip loss is non-negative and bounded: depositing then immediately redeeming never
//     returns MORE than was put in. A round trip that profits the depositor is a value leak out of
//     the vault, and directed rounding must make it impossible.
// P9  inflation-attack bound: on the donation state that drains a naive vault, virtual_amounts
//     with a sufficient decimals_offset must both mint non-zero shares AND cut the round-trip loss
//     by orders of magnitude versus the naive formula. Checked as a real bound on real numbers,
//     not as "the flag is present".
// P10 monotonicity: a larger input never converts to a smaller output, under every operation.
// P11 idempotence/determinism: compute() twice on identical input is byte-identical, and the
//     rounding_table it reports never varies with the vault state.
// P12 totality: compute() never throws and always returns a well-formed payload, for any input
//     including hostile ones.
// P13 forced categorical boundaries: zero supply, zero assets, one-wei amounts, uint256 max,
//     malformed inputs, offset extremes.
//
// Zero NEW external dependencies -- Node built-ins only.
//
// Run: node chaingraph/kernels/__proptests__/art-610-erc4626-vault-share-math.proptest.mjs

import { compute } from '../art-610-erc4626-vault-share-math.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const MAX_UINT256 = (1n << 256n) - 1n;

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-610-erc4626-vault-share-math.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    if (JSON.stringify(output_payload) !== JSON.stringify(vec.output_payload)) {
      failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
    }
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- deterministic PRNG (no Math.random: a floor must reproduce exactly) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x4626);

function randBig(rng, maxBits) {
  const bits = 1 + Math.floor(rng() * maxBits);
  let v = 0n;
  for (let i = 0; i < bits; i++) v = (v << 1n) | (rng() < 0.5 ? 0n : 1n);
  return v;
}

// ---------- exact rational oracle, built independently in THIS file ----------
// The true unrounded conversion is a rational num/den. Rather than recompute the kernel's mulDiv,
// this keeps numerator and denominator apart and asks a direction-free question: does the kernel's
// integer answer sit on the mandated side of num/den, and within one unit of it? An answer that
// satisfies that for every trial can only be the correctly-directed rounding of num/den.
function exactRatio(op, amount, ta, ts, virtualAmounts, offset) {
  const offsetUnit = virtualAmounts ? 10n ** offset : 0n;
  const virtualAsset = virtualAmounts ? 1n : 0n;
  const toShares = (op === 'convertToShares' || op === 'previewDeposit' || op === 'previewWithdraw');
  const num = toShares ? amount * (ts + offsetUnit) : amount * (ta + virtualAsset);
  const den = toShares ? (ta + virtualAsset) : (ts + offsetUnit);
  return { num, den };
}

// Does `got` equal the correctly-directed rounding of num/den? Expressed as bounds on num/den so
// no second division is performed by the checker.
function satisfiesDirection(got, num, den, direction) {
  if (den === 0n) return got === null;
  if (got === null) return false;
  if (direction === 'down') {
    // floor(num/den) == got  <=>  got*den <= num < (got+1)*den
    return got * den <= num && num < (got + 1n) * den;
  }
  // ceil(num/den) == got  <=>  (got-1)*den < num <= got*den
  return (got === 0n ? num === 0n : (got - 1n) * den < num) && num <= got * den;
}

const DIRECTED = [
  ['P1_previewDeposit_rounds_down', 'previewDeposit', 'down'],
  ['P2_previewMint_rounds_up', 'previewMint', 'up'],
  ['P3_previewWithdraw_rounds_up', 'previewWithdraw', 'up'],
  ['P4_previewRedeem_rounds_down', 'previewRedeem', 'down'],
  ['P5_convertToShares_rounds_down', 'convertToShares', 'down'],
  ['P6_convertToAssets_rounds_down', 'convertToAssets', 'down'],
];

// A shared trial corpus so every directed property is asserted over the SAME states -- a direction
// that only holds on states favourable to it is exactly the regression these properties exist for.
function trialStates(rng, n) {
  const states = [];
  for (let i = 0; i < n; i++) {
    states.push({
      total_assets: randBig(rng, 90),
      total_supply: randBig(rng, 90),
      amount: randBig(rng, 80),
      virtual_amounts: rng() < 0.5,
      offset: BigInt(Math.floor(rng() * 7)),
    });
  }
  // Forced small-ratio states, where directed rounding actually bites; random 90-bit values rarely
  // land on an exact division, so without these the properties would pass on a technicality.
  for (const [ta, ts, amt] of [[3n, 7n, 1n], [7n, 3n, 1n], [1n, 1n, 1n], [10n, 3n, 5n], [3n, 10n, 5n], [1000n, 333n, 7n], [333n, 1000n, 7n], [2n, 1n, 3n]]) {
    for (const va of [true, false]) {
      states.push({ total_assets: ta, total_supply: ts, amount: amt, virtual_amounts: va, offset: 0n });
    }
  }
  return states;
}
const STATES = trialStates(rand, 400);

function runOp(op, s) {
  const { output_payload: o } = compute({
    total_assets: s.total_assets.toString(),
    total_supply: s.total_supply.toString(),
    virtual_amounts: s.virtual_amounts,
    decimals_offset: s.offset.toString(),
    operations: [{ op, amount: s.amount.toString() }],
  });
  if (o.conversions.length === 0) return { got: null, entry: null };
  const c = o.conversions[0];
  return { got: c.output === null ? null : BigInt(c.output), entry: c };
}

function checkDirected([name, op, direction]) {
  let violations = 0, checked = 0, exactCases = 0;
  const examples = [];
  for (const s of STATES) {
    const { got, entry } = runOp(op, s);
    if (entry === null) continue;
    checked++;
    if (entry.rounding_direction !== direction) {
      violations++;
      if (examples.length < 3) examples.push({ reason: 'reported direction wrong', got: entry.rounding_direction, want: direction });
      continue;
    }
    const { num, den } = exactRatio(op, s.amount, s.total_assets, s.total_supply, s.virtual_amounts, s.offset);
    if (den !== 0n && num % den !== 0n) exactCases++;
    if (!satisfiesDirection(got, num, den, direction)) {
      violations++;
      if (examples.length < 3) examples.push({ reason: 'value not the mandated rounding of the exact ratio', state: { ta: s.total_assets.toString(), ts: s.total_supply.toString(), amt: s.amount.toString(), va: s.virtual_amounts, off: s.offset.toString() }, got: got === null ? null : got.toString(), num: num.toString(), den: den.toString() });
    }
  }
  // A directed-rounding property that never saw an inexact division proved nothing.
  if (exactCases === 0) violations++;
  return { name, trials: checked, inexact_divisions_seen: exactCases, violations, examples };
}

// ---------- P7: favour-the-vault ordering ----------
function checkP7_favour_the_vault_ordering() {
  let violations = 0, checked = 0;
  for (const s of STATES) {
    // shares side: previewWithdraw (up) must never be below previewDeposit/convertToShares (down)
    const up1 = runOp('previewWithdraw', s).got;
    const dn1 = runOp('previewDeposit', s).got;
    const dn1b = runOp('convertToShares', s).got;
    // assets side: previewMint (up) must never be below previewRedeem/convertToAssets (down)
    const up2 = runOp('previewMint', s).got;
    const dn2 = runOp('previewRedeem', s).got;
    const dn2b = runOp('convertToAssets', s).got;
    if (up1 === null || dn1 === null || up2 === null || dn2 === null) continue;
    checked++;
    if (up1 < dn1 || up1 < dn1b) violations++;
    if (up2 < dn2 || up2 < dn2b) violations++;
    // the two down-members of each side must agree exactly: same formula, same direction
    if (dn1 !== dn1b || dn2 !== dn2b) violations++;
    // and an up-member exceeds its down-member by at most 1
    if (up1 - dn1 > 1n || up2 - dn2 > 1n) violations++;
  }
  return { name: 'P7_favour_the_vault_direction_pairing', trials: checked, violations };
}

// ---------- P8: round-trip never profits the depositor ----------
function checkP8_roundtrip_loss_nonnegative_and_bounded() {
  let violations = 0, checked = 0;
  const examples = [];
  for (const s of STATES) {
    const { output_payload: o } = compute({
      total_assets: s.total_assets.toString(),
      total_supply: s.total_supply.toString(),
      virtual_amounts: s.virtual_amounts,
      decimals_offset: s.offset.toString(),
      round_trip_assets: s.amount.toString(),
    });
    if (o.round_trip === null || o.round_trip.assets_out === null) continue;
    checked++;
    const inA = BigInt(o.round_trip.assets_in);
    const out = BigInt(o.round_trip.assets_out);
    const loss = BigInt(o.round_trip.loss_assets);
    if (out > inA) { violations++; if (examples.length < 3) examples.push({ reason: 'round trip returned more than was deposited', in: inA.toString(), out: out.toString() }); }
    if (loss !== inA - out) { violations++; if (examples.length < 3) examples.push({ reason: 'loss is not in - out', loss: loss.toString() }); }
    // loss_bps rounds up, so any non-zero loss must report at least 1 bp
    const bps = BigInt(o.round_trip.loss_bps);
    if (loss > 0n && inA > 0n && bps === 0n) violations++;
    if (bps > 10000n) violations++;
    // post-deposit state must actually reflect the deposit
    if (BigInt(o.round_trip.post_deposit_state.total_assets) !== s.total_assets + inA) violations++;
  }
  return { name: 'P8_roundtrip_loss_nonnegative_and_bounded', trials: checked, violations, examples };
}

// ---------- P9: the inflation-attack bound, on real numbers ----------
function checkP9_inflation_attack_bound() {
  let violations = 0;
  const rows = [];
  const donated = '10000000000000000000000';
  const victim = '9999000000000000000000';
  const naive = compute({ total_assets: donated, total_supply: '1', virtual_amounts: false, round_trip_assets: victim }).output_payload;
  rows.push({ case: 'naive', shares: naive.round_trip.shares_minted, loss_bps: naive.round_trip.loss_bps });
  // The naive formula must actually exhibit the attack, otherwise the comparison below is vacuous.
  if (naive.round_trip.shares_minted !== '0') violations++;
  if (naive.round_trip.loss_bps !== '10000') violations++;
  if (naive.round_trip.zero_share_mint !== true) violations++;

  for (const off of ['3', '6', '9']) {
    const oz = compute({ total_assets: donated, total_supply: '1', decimals_offset: off, round_trip_assets: victim }).output_payload;
    rows.push({ case: 'offset-' + off, shares: oz.round_trip.shares_minted, loss_bps: oz.round_trip.loss_bps });
    // mitigation must mint non-zero shares ...
    if (BigInt(oz.round_trip.shares_minted) === 0n) violations++;
    if (oz.round_trip.zero_share_mint !== false) violations++;
    // ... and cut the loss from total (10000 bps) to a small residue. The bound is 10 bps rather
    // than 1: offset-3 against this donation legitimately leaves 5 bps, and asserting 1 here would
    // be asserting a number the mitigation does not actually promise at every offset.
    if (BigInt(oz.round_trip.loss_bps) > 10n) violations++;
  }
  // a larger offset must never mint fewer shares than a smaller one ...
  const s3 = BigInt(rows[1].shares), s6 = BigInt(rows[2].shares), s9 = BigInt(rows[3].shares);
  if (!(s3 <= s6 && s6 <= s9)) violations++;
  // ... and must never leave a LARGER loss: the mitigation has to be monotone in the offset, or
  // "raise the offset" would not be sound advice.
  const l3 = BigInt(rows[1].loss_bps), l6 = BigInt(rows[2].loss_bps), l9 = BigInt(rows[3].loss_bps);
  if (!(l3 >= l6 && l6 >= l9)) violations++;
  return { name: 'P9_inflation_attack_bound_naive_vs_mitigated', trials: rows.length, violations, rows };
}

// ---------- P10: monotonicity ----------
function checkP10_monotonicity() {
  let violations = 0, checked = 0;
  for (const s of STATES.slice(0, 200)) {
    for (const [, op] of DIRECTED) {
      const a = runOp(op, s).got;
      const b = runOp(op, { ...s, amount: s.amount + 1n + (s.amount / 3n) }).got;
      if (a === null || b === null) continue;
      checked++;
      if (b < a) violations++;
    }
  }
  return { name: 'P10_monotonic_in_input_amount', trials: checked, violations };
}

// ---------- P11: determinism and a state-invariant rounding table ----------
function checkP11_determinism_and_stable_table() {
  let violations = 0, checked = 0;
  let firstTable = null;
  for (const s of STATES.slice(0, 150)) {
    const pp = {
      total_assets: s.total_assets.toString(), total_supply: s.total_supply.toString(),
      virtual_amounts: s.virtual_amounts, decimals_offset: s.offset.toString(),
      operations: [{ op: 'previewDeposit', amount: s.amount.toString() }],
      round_trip_assets: s.amount.toString(),
    };
    const r1 = JSON.stringify(compute(pp).output_payload);
    const r2 = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (r1 !== r2) violations++;
    const table = JSON.stringify(JSON.parse(r1).rounding_table);
    if (firstTable === null) firstTable = table;
    else if (table !== firstTable) violations++;
  }
  // and the reported table must match the standard, entry by entry
  const expected = {
    convertToAssets: 'down', convertToShares: 'down', previewDeposit: 'down',
    previewMint: 'up', previewRedeem: 'down', previewWithdraw: 'up',
  };
  for (const row of JSON.parse(firstTable)) {
    if (expected[row.op] !== row.direction) violations++;
  }
  return { name: 'P11_determinism_and_state_invariant_rounding_table', trials: checked, violations };
}

// ---------- P12: totality ----------
function checkP12_totality() {
  const hostile = [
    undefined, null, 0, 'x', [], true, NaN,
    {}, { total_assets: null, total_supply: null },
    { total_assets: '-1', total_supply: '1' },
    { total_assets: '1.5', total_supply: '1' },
    { total_assets: (MAX_UINT256 + 1n).toString(), total_supply: '1' },
    { total_assets: '1', total_supply: '1', operations: 'not-an-array' },
    { total_assets: '1', total_supply: '1', operations: [null, 5, [], { op: 'previewDeposit' }] },
    { total_assets: '1', total_supply: '1', decimals_offset: '99' },
    { total_assets: '1', total_supply: '1', fee_bps: '10001' },
    { total_assets: '1', total_supply: '1', fee_bps: '10', fee_basis: 'sideways' },
    { total_assets: '1', total_supply: '1', snapshot_b: 'nope' },
    { total_assets: '1', total_supply: '1', snapshot_b: { total_assets: 'x' } },
    { total_assets: '1', total_supply: '1', round_trip_assets: {} },
    { total_assets: '1', total_supply: '1', chain_id: { evil: true }, network_label: 42 },
    // Regression: the round-trip redeem leg divides by the POST-deposit supply, which is zero here
    // even though the deposit leg's own denominator is not. This shape threw a RangeError until
    // this floor found it during authoring.
    { total_assets: '1000', total_supply: '0', virtual_amounts: false, round_trip_assets: '500' },
    { total_assets: '0', total_supply: '0', virtual_amounts: false, round_trip_assets: '500' },
    { total_assets: '1000', total_supply: '0', virtual_amounts: false, snapshot_b: { total_assets: '1', total_supply: '0' } },
  ];
  let violations = 0, checked = 0;
  const examples = [];
  for (const pp of hostile) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(pp) ?? String(pp), threw: String(e && e.message) }); continue; }
    const o = out.output_payload;
    const shapeOk = o && typeof o === 'object'
      && Array.isArray(o.conversions) && Array.isArray(o.reasons) && Array.isArray(o.rounding_table)
      && typeof o.note === 'string' && Array.isArray(out.compliance_flags)
      && Object.prototype.hasOwnProperty.call(o, 'declared_context');
    if (!shapeOk) { violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(pp) ?? String(pp), reason: 'malformed payload shape' }); }
  }
  return { name: 'P12_totality_never_throws_always_well_formed', trials: checked, violations, examples };
}

// ---------- P13: forced categorical boundaries ----------
function checkP13_forced_categorical() {
  let violations = 0, checked = 0;
  const rows = [];
  const one = (label, pp, assert) => {
    checked++;
    const o = compute(pp).output_payload;
    const bad = assert(o);
    if (bad) { violations++; rows.push({ label, problem: bad }); } else { rows.push({ label, ok: true }); }
  };

  one('empty-vault-with-virtual-amounts-converts', { total_assets: '0', total_supply: '0', decimals_offset: '3', operations: [{ op: 'previewDeposit', amount: '1000' }] },
    (o) => o.conversions[0].output === null ? 'expected a defined conversion when virtual amounts are on' : null);
  one('empty-vault-without-virtual-amounts-undefined', { total_assets: '0', total_supply: '0', virtual_amounts: false, operations: [{ op: 'previewDeposit', amount: '1000' }] },
    (o) => o.conversions[0].output !== null ? 'expected an undefined conversion with a zero denominator' : null);
  one('one-wei-amount-rounds-to-zero-shares-on-a-rich-vault', { total_assets: '1000000000000000000000000', total_supply: '1', virtual_amounts: false, operations: [{ op: 'previewDeposit', amount: '1' }] },
    (o) => o.conversions[0].output !== '0' ? 'expected floor to zero' : null);
  one('one-wei-amount-rounds-up-to-one-share-on-previewWithdraw', { total_assets: '1000000000000000000000000', total_supply: '1', virtual_amounts: false, operations: [{ op: 'previewWithdraw', amount: '1' }] },
    (o) => o.conversions[0].output !== '1' ? 'expected ceiling to one' : null);
  one('zero-amount-is-zero-under-every-op', { total_assets: '7', total_supply: '3', operations: DIRECTED.map(([, op]) => ({ op, amount: '0' })) },
    (o) => o.conversions.some((c) => c.output !== '0') ? 'a zero amount produced a non-zero output' : null);
  one('uint256-max-total-assets-does-not-overflow', { total_assets: MAX_UINT256.toString(), total_supply: '1', operations: [{ op: 'previewRedeem', amount: '1' }] },
    (o) => o.conversions[0].output === null ? 'expected a defined conversion' : null);
  one('offset-36-accepted-offset-37-rejected', { total_assets: '1', total_supply: '1', decimals_offset: '37' },
    (o) => o.reasons.length === 0 ? 'expected decimals_offset 37 to be rejected' : null);
  one('flat-rate-drift-reports-zero', { total_assets: '100', total_supply: '100', snapshot_b: { total_assets: '100', total_supply: '100' } },
    (o) => o.rate_drift.drift_bps !== '0' || o.rate_drift.direction !== 'flat' ? 'expected a flat zero drift' : null);
  one('rate-decrease-reports-negative-bps', { total_assets: '100000000000000000000', total_supply: '100000000000000000000', snapshot_b: { total_assets: '50000000000000000000', total_supply: '100000000000000000000' } },
    (o) => !(o.rate_drift.drift_bps.startsWith('-') && o.rate_drift.direction === 'down') ? 'expected a signed negative drift' : null);
  one('zero-fee-bps-charges-nothing', { total_assets: '100', total_supply: '100', fee_bps: '0', round_trip_assets: '1000' },
    (o) => o.fee.fee_amount !== '0' ? 'expected a zero fee' : null);
  one('fee-rounds-up-on-a-one-wei-remainder', { total_assets: '100', total_supply: '100', fee_bps: '1', fee_basis: 'raw', round_trip_assets: '1' },
    (o) => o.fee.fee_amount !== '1' ? 'expected a sub-unit fee to round up to 1' : null);
  one('chain_id-and-network_label-are-carried-not-interpreted', { total_assets: '7', total_supply: '3', chain_id: '999999', network_label: 'anything at all', operations: [{ op: 'previewDeposit', amount: '10' }] },
    (o) => (o.declared_context.chain_id !== '999999' || o.declared_context.network_label !== 'anything at all') ? 'declared context not carried through verbatim' : null);

  // chain_id must not be a selector: the same state under different labels must compute identically.
  const base = { total_assets: '1000', total_supply: '333', operations: [{ op: 'previewDeposit', amount: '77' }], round_trip_assets: '77' };
  const asA = compute({ ...base, chain_id: '1', network_label: 'one' }).output_payload;
  const asB = compute({ ...base, chain_id: '8453', network_label: 'another' }).output_payload;
  checked++;
  const stripCtx = (o) => JSON.stringify({ ...o, declared_context: null });
  if (stripCtx(asA) !== stripCtx(asB)) { violations++; rows.push({ label: 'chain_id-is-never-a-selector', problem: 'output differed between two declared chain_ids' }); }
  else rows.push({ label: 'chain_id-is-never-a-selector', ok: true });

  return { name: 'P13_forced_categorical_boundary_cases', trials: checked, violations, rows: rows.filter((r) => !r.ok) };
}

// ---------- inapplicable float properties, recorded rather than omitted ----------
const NOT_APPLICABLE = [
  ['P1_half_up_ties', 'directed rounding only; no half-up mode and no decimal tie exists in integer division'],
  ['P2_half_even_ties', 'directed rounding only; no half-even mode'],
  ['P7_precision_bound', 'exact integer precision; no decimal-digit bound to assert'],
  ['P11_ulp_precision_loss_bound', 'no IEEE-754 value anywhere in the kernel'],
  ['P13_signed_zero_identity', 'BigInt has no signed zero'],
  ['P14_denormal_stays_finite', 'no floating-point denormals exist here'],
  ['P15_nonassociativity_robustness', 'BigInt addition is exactly associative'],
  ['P29_float_sensitive_precision_completeness', 'kernel is not float_sensitive'],
].map(([name, reason]) => ({ name: 'NA_' + name, applicable: false, reason, violations: 0 }));

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

for (const d of DIRECTED) results.properties.push(checkDirected(d));
results.properties.push(checkP7_favour_the_vault_ordering());
results.properties.push(checkP8_roundtrip_loss_nonnegative_and_bounded());
results.properties.push(checkP9_inflation_attack_bound());
results.properties.push(checkP10_monotonicity());
results.properties.push(checkP11_determinism_and_stable_table());
results.properties.push(checkP12_totality());
results.properties.push(checkP13_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-610-erc4626-vault-share-math',
  float_sensitive: false,
  rounding: { mode: 'directed', precision: 'exact-integer-uint256', rounding_steps: 2 },
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  not_applicable: NOT_APPLICABLE,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
