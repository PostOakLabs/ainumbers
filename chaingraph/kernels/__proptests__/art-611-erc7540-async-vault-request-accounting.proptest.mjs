// art-611-erc7540-async-vault-request-accounting.proptest.mjs — FV property-test FLOOR
// (ETHMATH-VAULT-1).
// kernel_digest_at_authoring: sha256:5cd9dd6c701f8631291807f556d9b14f7f65bf9ccbacc31d2d089ef3a65c0541
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class A -- request state is a pair
// of small integer buckets and a claim sequence over them, enumerable). NOT a proof, NOT Dafny.
//
// float_sensitive: NO. BigInt-only: every amount is a uint256 parsed from a string and every
// division is an explicit floor or ceiling via mulDiv. No IEEE-754 operation exists in the kernel,
// so the float-specific members of the FV-ROUNDING-SUITE-LIB-1 suite are NOT APPLICABLE and are
// recorded as such below rather than silently omitted.
//
// rounding (declared, per ETHMATH-VAULT-1's FV tie-in):
//   mode:      directed -- floor or ceiling, DECLARED BY THE CALLER. This is the material
//              difference from art-610: ERC-4626 fixes a direction per function, ERC-7540 fixes
//              none for a partial claim. The direction is therefore an input, and the properties
//              below assert the kernel HONOURS whichever was declared and REPORTS the alternative
//              -- never that some particular direction is standard-mandated, because none is.
//   precision: exact integer (uint256).
//   rounding_steps: one directed division per partial claim.
//
// NAMED PROPERTIES -- ERC-7540 (Final, Created 2023-10-18, CC0-1.0). Each of the standard's stated
// invariants is a separate named property, for the same reason as art-610: a joint check cannot
// say which invariant regressed.
//
// P0  fixture oracle -- every pinned vector reproduces byte-for-byte.
// P1  claim_rounding is HONOURED: the payout is exactly the declared rounding of the exact
//     rational claim, checked against an independent numerator/denominator oracle in THIS file.
// P2  claim_rounding is DECLARED, NOT MANDATED: running the identical sequence under both
//     directions must produce results that differ on at least one inexact claim, and each run must
//     report the other direction's result alongside its own. A kernel that silently forced one
//     direction would pass P1 and fail here.
// P3  "Requests MUST NOT skip or otherwise short-circuit the Claim state" -- a claim against a leg
//     with nothing claimable is rejected and NEVER draws down pending.
// P4  claims stay within claimable bounds; an overclaim is rejected and changes no state.
// P5  pending and claimable are disjoint: no claim, accepted or rejected, ever alters a pending
//     amount. The two views can never double-count.
// P6  conservation: consumed + remaining == opening, on both sides of both legs, exactly. This is
//     the property that catches a rounding residue being invented or destroyed rather than
//     stranded.
// P7  "all requests of the same requestId MUST become claimable at the same pro-rata rate" -- for
//     a non-zero requestId every accepted claim settles at the bucket's opening rate within one
//     unit of the requested side, and the drift flag fires only when it does not.
// P8  monotonicity: a larger claim never receives less.
// P9  determinism: compute() twice on identical input is byte-identical.
// P10 totality: never throws, always a well-formed payload, for any input including hostile ones.
// P11 forced categorical boundaries: zero amounts, exact-division buckets, dust, uint256 max,
//     requestId conventions, and the declared-context pass-through.
//
// Zero NEW external dependencies -- Node built-ins only.
//
// Run: node chaingraph/kernels/__proptests__/art-611-erc7540-async-vault-request-accounting.proptest.mjs

import { compute } from '../art-611-erc7540-async-vault-request-accounting.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const MAX_UINT256 = (1n << 256n) - 1n;

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-611-erc7540-async-vault-request-accounting.fixtures.json');
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

// ---------- deterministic PRNG (no Math.random) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x7540);

function randBig(rng, maxBits) {
  const bits = 1 + Math.floor(rng() * maxBits);
  let v = 0n;
  for (let i = 0; i < bits; i++) v = (v << 1n) | (rng() < 0.5 ? 0n : 1n);
  return v;
}

// Shared trial corpus: a claimable bucket plus a claim sequence that stays within it.
function trialCases(rng, n) {
  const cases = [];
  for (let i = 0; i < n; i++) {
    const cin = randBig(rng, 40) + 1n;
    const cout = randBig(rng, 40) + 1n;
    const nClaims = 1 + Math.floor(rng() * 3);
    const claims = [];
    let left = cin;
    for (let c = 0; c < nClaims && left > 0n; c++) {
      const take = left === 1n ? 1n : (randBig(rng, 40) % left) + 1n;
      claims.push({ leg: 'deposit', unit: 'requested', amount: take.toString() });
      left -= take;
    }
    cases.push({ request_id: rng() < 0.5 ? '0' : '5', cin, cout, claims });
  }
  // Forced small ratios, where directed rounding actually bites.
  for (const [cin, cout] of [[1000n, 333n], [333n, 1000n], [3n, 7n], [7n, 3n], [1n, 1n], [10n, 10n], [1000000n, 7n]]) {
    cases.push({ request_id: '5', cin, cout, claims: [{ leg: 'deposit', unit: 'requested', amount: (cin > 2n ? cin / 3n : 1n).toString() }] });
  }
  return cases;
}
const CASES = trialCases(rand, 250);

function runCase(c, rounding) {
  return compute({
    request_id: c.request_id,
    claim_rounding: rounding,
    deposit: { pending_assets: '100', claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() },
    claims: c.claims,
  }).output_payload;
}

// ---------- exact rational oracle, built independently in THIS file ----------
// A 'requested'-unit claim of `amount` against a bucket whose opening rate is cout/cin pays out
// amount*cout/cin. Numerator and denominator are kept apart so the checker performs no division of
// its own that could share a bug with the kernel's.
function satisfiesDirection(got, num, den, direction) {
  if (den === 0n) return got === null;
  if (got === null) return false;
  if (direction === 'down') return got * den <= num && num < (got + 1n) * den;
  return (got === 0n ? num === 0n : (got - 1n) * den < num) && num <= got * den;
}

// ---------- P1: declared rounding is honoured ----------
function checkP1_declared_rounding_honoured() {
  let violations = 0, checked = 0, inexact = 0;
  const examples = [];
  for (const direction of ['down', 'up']) {
    for (const c of CASES) {
      const o = runCase(c, direction);
      for (const cl of o.claims) {
        if (cl.rejected) continue;
        checked++;
        if (cl.rounding_direction !== direction) { violations++; continue; }
        const num = BigInt(cl.consumed_requested) * c.cout;
        const den = c.cin;
        if (num % den !== 0n) inexact++;
        if (!satisfiesDirection(BigInt(cl.received), num, den, direction)) {
          violations++;
          if (examples.length < 3) examples.push({ direction, cin: c.cin.toString(), cout: c.cout.toString(), consumed: cl.consumed_requested, received: cl.received });
        }
      }
    }
  }
  if (inexact === 0) violations++; // a directed-rounding property that never divided inexactly proved nothing
  return { name: 'P1_declared_claim_rounding_is_honoured', trials: checked, inexact_divisions_seen: inexact, violations, examples };
}

// ---------- P2: the direction is declared, not mandated ----------
function checkP2_direction_is_declared_not_mandated() {
  let violations = 0, checked = 0, diverged = 0;
  for (const c of CASES) {
    const dn = runCase(c, 'down');
    const up = runCase(c, 'up');
    checked++;
    if (dn.claim_rounding_used !== 'down' || up.claim_rounding_used !== 'up') { violations++; continue; }
    // every accepted claim must report what the other direction would have produced
    for (const cl of dn.claims) {
      if (cl.rejected) continue;
      if (cl.received_if_rounded_other_way === null) { violations++; break; }
    }
    const dnRecv = dn.claims.filter((x) => !x.rejected).map((x) => x.received).join(',');
    const upRecv = up.claims.filter((x) => !x.rejected).map((x) => x.received).join(',');
    if (dnRecv !== upRecv) diverged++;
    // the invariant list must say, in words, that no direction is mandated
    const inv = dn.invariants.find((i) => i.name === 'partial_claim_rounding_direction_is_declared_not_mandated');
    if (!inv || inv.holds !== true) violations++;
  }
  // if NO case diverged, the two directions are not actually distinguishable and P1 was vacuous
  if (diverged === 0) violations++;
  return { name: 'P2_claim_rounding_is_declared_not_mandated', trials: checked, cases_where_direction_changed_payout: diverged, violations };
}

// ---------- P3: a claim never skips the Claimable state ----------
function checkP3_never_skips_claim_state() {
  let violations = 0, checked = 0;
  const shapes = [
    { deposit: { pending_assets: '1000' }, claims: [{ leg: 'deposit', unit: 'requested', amount: '1' }] },
    { redeem: { pending_shares: '900' }, claims: [{ leg: 'redeem', unit: 'requested', amount: '500' }] },
    { deposit: { pending_assets: '1000' }, redeem: { pending_shares: '900' }, claims: [{ leg: 'deposit', unit: 'received', amount: '1' }, { leg: 'redeem', unit: 'requested', amount: '1' }] },
  ];
  for (const pp of shapes) {
    const o = compute(pp).output_payload;
    checked++;
    // every claim rejected ...
    if (!o.claims.every((c) => c.rejected === true)) violations++;
    // ... the invariant reports it ...
    const inv = o.invariants.find((i) => i.name === 'claim_never_skips_claimable_state');
    if (!inv || inv.holds !== false) violations++;
    // ... and pending is untouched
    if (pp.deposit && o.closing.deposit.pending_assets !== pp.deposit.pending_assets) violations++;
    if (pp.redeem && o.closing.redeem.pending_shares !== pp.redeem.pending_shares) violations++;
    if (o.closing.deposit.claimed_assets !== '0' || o.closing.redeem.claimed_shares !== '0') violations++;
  }
  return { name: 'P3_claim_never_skips_claimable_state', trials: checked, violations };
}

// ---------- P4: overclaim rejected, state unchanged ----------
function checkP4_overclaim_rejected_state_unchanged() {
  let violations = 0, checked = 0;
  for (const c of CASES.slice(0, 120)) {
    const o = compute({
      request_id: c.request_id,
      deposit: { pending_assets: '50', claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() },
      claims: [{ leg: 'deposit', unit: 'requested', amount: (c.cin + 1n).toString() }],
    }).output_payload;
    checked++;
    if (o.claims[0].rejected !== true) violations++;
    // rejected claim must leave the bucket exactly as it opened
    if (o.closing.deposit.claimable_assets !== c.cin.toString()) violations++;
    if (o.closing.deposit.claimable_shares !== c.cout.toString()) violations++;
    if (o.closing.deposit.claimed_assets !== '0') violations++;
    const inv = o.invariants.find((i) => i.name === 'claim_within_claimable_bounds');
    if (!inv || inv.holds !== false) violations++;
  }
  return { name: 'P4_overclaim_rejected_and_state_unchanged', trials: checked, violations };
}

// ---------- P5: pending never moves ----------
function checkP5_pending_and_claimable_disjoint() {
  let violations = 0, checked = 0;
  for (const c of CASES) {
    for (const direction of ['down', 'up']) {
      const o = compute({
        request_id: c.request_id, claim_rounding: direction,
        deposit: { pending_assets: '777', claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() },
        redeem: { pending_shares: '888' },
        claims: c.claims,
      }).output_payload;
      checked++;
      if (o.opening.deposit.pending_assets !== '777' || o.closing.deposit.pending_assets !== '777') violations++;
      if (o.opening.redeem.pending_shares !== '888' || o.closing.redeem.pending_shares !== '888') violations++;
      const inv = o.invariants.find((i) => i.name === 'pending_and_claimable_disjoint');
      if (!inv || inv.holds !== true) violations++;
    }
  }
  return { name: 'P5_pending_never_altered_by_a_claim', trials: checked, violations };
}

// ---------- P6: conservation ----------
function checkP6_conservation() {
  let violations = 0, checked = 0;
  const examples = [];
  for (const c of CASES) {
    for (const direction of ['down', 'up']) {
      const o = runCase(c, direction);
      checked++;
      const remIn = BigInt(o.closing.deposit.claimable_assets);
      const remOut = BigInt(o.closing.deposit.claimable_shares);
      const clIn = BigInt(o.closing.deposit.claimed_assets);
      const clOut = BigInt(o.closing.deposit.claimed_shares);
      if (remIn + clIn !== c.cin) { violations++; if (examples.length < 3) examples.push({ side: 'requested', cin: c.cin.toString(), rem: remIn.toString(), claimed: clIn.toString() }); }
      if (remOut + clOut !== c.cout) { violations++; if (examples.length < 3) examples.push({ side: 'received', cout: c.cout.toString(), rem: remOut.toString(), claimed: clOut.toString() }); }
      // dust is a REPORT of a stranded side, so it must agree with the closing numbers
      if (remIn === 0n && remOut > 0n && o.dust.deposit_shares_stranded !== remOut.toString()) violations++;
    }
  }
  return { name: 'P6_conservation_consumed_plus_remaining_equals_opening', trials: checked, violations, examples };
}

// ---------- P7: single pro-rata rate for a non-zero requestId ----------
function checkP7_single_prorata_rate() {
  let violations = 0, checked = 0;
  for (const c of CASES) {
    const o = compute({
      request_id: '5',
      deposit: { pending_assets: '0', claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() },
      claims: c.claims,
    }).output_payload;
    checked++;
    const inv = o.invariants.find((i) => i.name === 'single_prorata_rate_for_nonzero_request_id');
    if (!inv) { violations++; continue; }
    if (inv.applicable !== true) violations++;
    // every accepted claim settled at the bucket's opening rate: the flag must not have fired,
    // because this kernel applies one fixed rate by construction
    if (inv.holds !== true) violations++;
    for (const cl of o.claims) {
      if (cl.rejected || cl.settled_rate_scaled === null) continue;
      if (cl.opening_rate_scaled === null) violations++;
    }
    // and with requestId 0 the property must report itself INAPPLICABLE rather than silently true
    const agg = compute({
      request_id: '0',
      deposit: { claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() },
      claims: c.claims,
    }).output_payload.invariants.find((i) => i.name === 'single_prorata_rate_for_nonzero_request_id');
    if (!agg || agg.applicable !== false) violations++;
  }
  return { name: 'P7_single_prorata_rate_for_nonzero_request_id', trials: checked, violations };
}

// ---------- P8: monotonicity ----------
function checkP8_monotonicity() {
  let violations = 0, checked = 0;
  for (const c of CASES) {
    if (c.cin < 4n) continue;
    const small = compute({ deposit: { claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() }, claims: [{ leg: 'deposit', unit: 'requested', amount: (c.cin / 4n).toString() }] }).output_payload.claims[0];
    const large = compute({ deposit: { claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() }, claims: [{ leg: 'deposit', unit: 'requested', amount: (c.cin / 2n).toString() }] }).output_payload.claims[0];
    if (small.rejected || large.rejected) continue;
    checked++;
    if (BigInt(large.received) < BigInt(small.received)) violations++;
  }
  return { name: 'P8_monotonic_larger_claim_never_receives_less', trials: checked, violations };
}

// ---------- P9: determinism ----------
function checkP9_determinism() {
  let violations = 0, checked = 0;
  for (const c of CASES.slice(0, 150)) {
    const pp = {
      request_id: c.request_id,
      deposit: { pending_assets: '13', claimable_assets: c.cin.toString(), claimable_shares: c.cout.toString() },
      redeem: { pending_shares: '17' },
      claims: c.claims,
    };
    checked++;
    if (JSON.stringify(compute(pp).output_payload) !== JSON.stringify(compute(pp).output_payload)) violations++;
  }
  return { name: 'P9_determinism', trials: checked, violations };
}

// ---------- P10: totality ----------
function checkP10_totality() {
  const hostile = [
    undefined, null, 0, 'x', [], true, NaN, {},
    { deposit: 'not-an-object' },
    { deposit: [] },
    { deposit: { claimable_assets: '-1', claimable_shares: '1' } },
    { deposit: { claimable_assets: '1.5', claimable_shares: '1' } },
    { deposit: { claimable_assets: (MAX_UINT256 + 1n).toString(), claimable_shares: '1' } },
    { deposit: { claimable_assets: '10', claimable_shares: '0' } },
    { deposit: { claimable_assets: '0', claimable_shares: '10' } },
    { claims: 'not-an-array' },
    { deposit: { claimable_assets: '10', claimable_shares: '10' }, claims: [null, 5, [], { leg: 'sideways' }, { leg: 'deposit', unit: 'weird', amount: '1' }, { leg: 'deposit', amount: 'x' }] },
    { request_id: 'not-a-number' },
    { request_id: '-4' },
    { claim_rounding: 'nearest' },
    { claim_rounding: 42 },
    { deposit: { claimable_assets: '10', claimable_shares: '10' }, chain_id: { evil: true }, network_label: [] },
    { deposit: { claimable_assets: MAX_UINT256.toString(), claimable_shares: MAX_UINT256.toString() }, claims: [{ leg: 'deposit', unit: 'requested', amount: MAX_UINT256.toString() }] },
  ];
  let violations = 0, checked = 0;
  const examples = [];
  for (const pp of hostile) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(pp) ?? String(pp), threw: String(e && e.message) }); continue; }
    const o = out.output_payload;
    const shapeOk = o && typeof o === 'object'
      && Array.isArray(o.claims) && Array.isArray(o.reasons) && Array.isArray(o.invariants)
      && typeof o.note === 'string' && Array.isArray(out.compliance_flags)
      && Object.prototype.hasOwnProperty.call(o, 'declared_context');
    if (!shapeOk) { violations++; if (examples.length < 3) examples.push({ input: JSON.stringify(pp) ?? String(pp), reason: 'malformed payload shape' }); }
  }
  return { name: 'P10_totality_never_throws_always_well_formed', trials: checked, violations, examples };
}

// ---------- P11: forced categorical boundaries ----------
function checkP11_forced_categorical() {
  let violations = 0, checked = 0;
  const rows = [];
  const one = (label, pp, assert) => {
    checked++;
    const o = compute(pp).output_payload;
    const bad = assert(o);
    if (bad) { violations++; rows.push({ label, problem: bad }); }
  };

  one('exact-division-bucket-drains-with-no-dust', { deposit: { claimable_assets: '1000', claimable_shares: '10' }, claims: [{ leg: 'deposit', unit: 'requested', amount: '1000' }] },
    (o) => (o.closing.deposit.claimable_assets !== '0' || o.closing.deposit.claimable_shares !== '0' || o.dust.deposit_shares_stranded !== '0') ? 'expected a clean drain with no dust' : null);
  one('rounding-down-twice-strands-dust', { deposit: { claimable_assets: '1000', claimable_shares: '333' }, claims: [{ leg: 'deposit', unit: 'requested', amount: '300' }, { leg: 'deposit', unit: 'requested', amount: '700' }] },
    (o) => o.dust.deposit_shares_stranded === '0' ? 'expected stranded dust from two floored claims' : null);
  one('zero-amount-claim-receives-zero-and-consumes-zero', { deposit: { claimable_assets: '1000', claimable_shares: '333' }, claims: [{ leg: 'deposit', unit: 'requested', amount: '0' }] },
    (o) => (o.claims[0].received !== '0' || o.claims[0].consumed_requested !== '0' || o.claims[0].rejected) ? 'a zero claim should be accepted as a no-op' : null);
  one('received-unit-claim-consumes-the-requested-side', { redeem: { claimable_shares: '400', claimable_assets: '1200' }, claims: [{ leg: 'redeem', unit: 'received', amount: '600' }] },
    (o) => (o.claims[0].consumed_requested !== '200' || o.claims[0].received !== '600') ? 'received-unit claim did not invert the rate correctly' : null);
  one('request-id-zero-is-the-aggregate-convention', { request_id: '0', deposit: { claimable_assets: '10', claimable_shares: '10' } },
    (o) => o.aggregate_by_controller !== true ? 'requestId 0 must be the aggregate convention' : null);
  one('request-id-nonzero-is-discrete', { request_id: '9', deposit: { claimable_assets: '10', claimable_shares: '10' } },
    (o) => o.aggregate_by_controller !== false ? 'a non-zero requestId must be discrete' : null);
  one('hex-request-id-zero-is-also-aggregate', { request_id: '0x0', deposit: { claimable_assets: '10', claimable_shares: '10' } },
    (o) => o.aggregate_by_controller !== true ? '0x0 must be treated as the aggregate convention' : null);
  one('absent-legs-default-to-empty-not-error', {},
    (o) => (o.reasons.length !== 0 || o.opening.deposit.pending_assets !== '0') ? 'an empty request should be a valid empty state' : null);
  one('half-declared-bucket-is-rejected-with-a-reason', { deposit: { claimable_assets: '5', claimable_shares: '0' } },
    (o) => !o.reasons.some((r) => r.indexOf('no pro-rata rate') !== -1) ? 'expected a named reason for a rate-less bucket' : null);
  one('declared-context-carried-verbatim', { deposit: { claimable_assets: '10', claimable_shares: '10' }, chain_id: '424242', network_label: 'anything at all' },
    (o) => (o.declared_context.chain_id !== '424242' || o.declared_context.network_label !== 'anything at all') ? 'declared context not carried through verbatim' : null);

  // chain_id must never be a selector.
  const base = { deposit: { claimable_assets: '1000', claimable_shares: '333' }, claims: [{ leg: 'deposit', unit: 'requested', amount: '301' }] };
  const asA = compute({ ...base, chain_id: '1', network_label: 'one' }).output_payload;
  const asB = compute({ ...base, chain_id: '8453', network_label: 'another' }).output_payload;
  checked++;
  const stripCtx = (o) => JSON.stringify({ ...o, declared_context: null });
  if (stripCtx(asA) !== stripCtx(asB)) { violations++; rows.push({ label: 'chain_id-is-never-a-selector', problem: 'output differed between two declared chain_ids' }); }

  return { name: 'P11_forced_categorical_boundary_cases', trials: checked, violations, rows };
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

results.properties.push(checkP1_declared_rounding_honoured());
results.properties.push(checkP2_direction_is_declared_not_mandated());
results.properties.push(checkP3_never_skips_claim_state());
results.properties.push(checkP4_overclaim_rejected_state_unchanged());
results.properties.push(checkP5_pending_and_claimable_disjoint());
results.properties.push(checkP6_conservation());
results.properties.push(checkP7_single_prorata_rate());
results.properties.push(checkP8_monotonicity());
results.properties.push(checkP9_determinism());
results.properties.push(checkP10_totality());
results.properties.push(checkP11_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-611-erc7540-async-vault-request-accounting',
  float_sensitive: false,
  rounding: { mode: 'directed-declared-by-caller', precision: 'exact-integer-uint256', rounding_steps: 1 },
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  not_applicable: NOT_APPLICABLE,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
