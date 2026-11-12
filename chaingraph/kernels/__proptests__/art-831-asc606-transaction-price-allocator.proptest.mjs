// art-831-asc606-transaction-price-allocator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:c6185d0d37a2913677f42e82d0d1d7db31d9ef003d1097823fd6016cfe2ebf8c
// spec: ASC606-ALLOCATION-NODE-1 board row (allocation by declared method; integer minor units)
// human_sign_off: PENDING
//
// Properties: allocations always sum to the price; a declared cap is never silently exceeded;
// permuting the obligations permutes the output; independent BigInt recompute parity; both rounding
// rules; refusals are INDETERMINATE with no allocations.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-831-asc606-transaction-price-allocator.proptest.mjs

import { compute } from '../art-831-asc606-transaction-price-allocator.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-831-asc606-transaction-price-allocator';
const N_CASES = 400;
const ROUNDING = ['largest_remainder', 'half_up_remainder_to_largest'];
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// Random valid case: proportional or assigned discount, optional caps, either rounding rule.
function genCase(rng) {
  const n = randInt(rng, 1, 6);
  const obligations = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const ssp = randInt(rng, 1, 100000);
    total += ssp;
    const o = { id: IDS[i], ssp_minor: ssp };
    if (rng() < 0.3) o.cap_minor = randInt(rng, 0, 100000);
    obligations.push(o);
  }
  const price = randInt(rng, 0, Math.floor(total * 1.2));
  const assign = rng() < 0.4;
  const pp = {
    transaction_price_minor: price,
    obligations,
    rounding_rule: pick(rng, ROUNDING),
    residual_approach: 'off',
    discount_handling: assign ? 'assign' : 'proportional',
  };
  if (assign) pp.discount_assigned_ids = obligations.filter(() => rng() < 0.6).map((o) => o.id);
  if (assign && pp.discount_assigned_ids.length === 0) pp.discount_assigned_ids = [obligations[0].id];
  return pp;
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Independent reference: Hamilton / half-up allocation over exact fractions, keyed by id.
function reference(pp) {
  const P = BigInt(pp.transaction_price_minor);
  const items = pp.obligations.map((o) => ({ id: o.id, ssp: BigInt(o.ssp_minor) }));
  const S = items.reduce((s, x) => s + x.ssp, 0n);
  let weights; // exact weights w_i with target = P * w_i / W
  let W;
  if (pp.discount_handling === 'assign' && P < S) {
    const listed = new Set(pp.discount_assigned_ids);
    const L = items.filter((x) => listed.has(x.id)).reduce((s, x) => s + x.ssp, 0n);
    const D = S - P;
    if (D > L) return null;
    W = P * L; // P * den
    weights = items.map((x) => (listed.has(x.id) ? x.ssp * (L - D) : x.ssp * L));
    // target_i = weights_i / L ; compare on the common scale of L
    W = L;
    return finish(items, weights, W, P, pp.rounding_rule);
  }
  if (P < S && pp.discount_handling === 'none') return null;
  return finish(items, items.map((x) => P * x.ssp), S, P, pp.rounding_rule);
}

function finish(items, nums, den, P, rule) {
  const out = new Map();
  const fr = items.map((x, i) => ({ id: x.id, ssp: x.ssp, fl: nums[i] / den, rm: nums[i] % den }));
  if (rule === 'largest_remainder') {
    let left = P - fr.reduce((s, x) => s + x.fl, 0n);
    const ranked = fr.slice().sort((p, q) => (p.rm !== q.rm ? (p.rm > q.rm ? -1 : 1) : p.ssp !== q.ssp ? (p.ssp > q.ssp ? -1 : 1) : p.id < q.id ? -1 : 1));
    for (const x of fr) out.set(x.id, x.fl);
    for (const x of ranked) {
      if (left <= 0n) break;
      out.set(x.id, out.get(x.id) + 1n);
      left -= 1n;
    }
  } else {
    let tot = 0n;
    for (const x of fr) { const v = x.fl + (x.rm * 2n >= den ? 1n : 0n); out.set(x.id, v); tot += v; }
    const biggest = fr.slice().sort((p, q) => (p.ssp !== q.ssp ? (p.ssp > q.ssp ? -1 : 1) : p.id < q.id ? -1 : 1))[0];
    out.set(biggest.id, out.get(biggest.id) + (P - tot));
  }
  return out;
}

function checkSumsToPrice(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const { output_payload: o, compliance_flags } = compute(pp);
    if (o.indeterminate) { if (!compliance_flags.includes('INDETERMINATE')) violations++; continue; }
    const sum = o.allocations.reduce((s, a) => s + a.allocated_minor, 0);
    if (sum !== pp.transaction_price_minor || o.total_allocated_minor !== sum) violations++;
  }
  return { name: 'allocations_sum_exactly_to_price', checked: N_CASES, violations };
}

function checkCapNeverSilentlyExceeded(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const { output_payload: o, compliance_flags } = compute(pp);
    if (o.indeterminate) continue;
    const exceeded = o.allocations.filter((a) => a.cap_minor !== null && a.allocated_minor > a.cap_minor);
    const flagged = compliance_flags.includes('ALLOCATION_EXCEEDS_CAP');
    if ((exceeded.length > 0) !== flagged) violations++;
    if (!flagged && o.allocations.some((a) => a.cap_minor !== null && a.allocated_minor > a.cap_minor)) violations++;
    if (o.allocations.some((a) => a.cap_exceeded !== (a.cap_minor !== null && a.allocated_minor > a.cap_minor))) violations++;
  }
  return { name: 'cap_exceedance_is_flagged_never_silent', checked: N_CASES, violations };
}

function checkPermutationInvariance(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const shuffled = { ...pp, obligations: shuffle(rng, pp.obligations) };
    const a = compute(pp).output_payload;
    const b = compute(shuffled).output_payload;
    const key = (o) => JSON.stringify(o.allocations.slice().sort((x, y) => (x.id < y.id ? -1 : 1)));
    if (a.indeterminate !== b.indeterminate || key(a) !== key(b)) violations++;
  }
  return { name: 'permuting_obligations_permutes_output', checked: N_CASES, violations };
}

function checkReferenceParity(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const ref = reference(pp);
    const o = compute(pp).output_payload;
    if (ref === null) { if (!o.indeterminate) violations++; continue; }
    if (o.indeterminate) { violations++; continue; }
    for (const a of o.allocations) if (BigInt(a.allocated_minor) !== ref.get(a.id)) violations++;
  }
  return { name: 'independent_bigint_recompute_parity', checked: N_CASES, violations };
}

function checkProportionalBounds(rng) {
  // Largest remainder under proportional handling stays within one minor unit of the exact share.
  let violations = 0;
  let checked = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    pp.discount_handling = 'proportional';
    delete pp.discount_assigned_ids;
    pp.rounding_rule = 'largest_remainder';
    const o = compute(pp).output_payload;
    if (o.indeterminate) continue;
    checked++;
    const S = BigInt(o.total_ssp_minor);
    const P = BigInt(pp.transaction_price_minor);
    for (const a of o.allocations) {
      const exactFloor = (P * BigInt(a.ssp_minor)) / S;
      const diff = BigInt(a.allocated_minor) - exactFloor;
      if (diff < 0n || diff > 1n) violations++;
    }
  }
  return { name: 'largest_remainder_within_one_unit_of_exact_share', checked, violations };
}

function checkResidual(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const n = randInt(rng, 1, 5);
    const obligations = [];
    let others = 0;
    for (let k = 0; k < n; k++) { const s = randInt(rng, 1, 50000); others += s; obligations.push({ id: IDS[k], ssp_minor: s }); }
    obligations.push({ id: 'z', ssp_minor: null, residual_candidate: true });
    const price = randInt(rng, 0, others * 2);
    const pp = { transaction_price_minor: price, obligations, rounding_rule: pick(rng, ROUNDING), residual_approach: 'on', residual_obligation_id: 'z', discount_handling: 'none' };
    const { output_payload: o, compliance_flags } = compute(pp);
    const z = o.allocations.find((a) => a.id === 'z');
    const sum = o.allocations.reduce((s, a) => s + a.allocated_minor, 0);
    if (sum !== price || z.allocated_minor !== price - others) violations++;
    if ((price - others <= 0) !== compliance_flags.includes('RESIDUAL_NEGATIVE_OR_ZERO')) violations++;
  }
  return { name: 'residual_takes_the_remainder_and_flags_non_positive', checked: N_CASES, violations };
}

function checkRefusals(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const which = i % 4;
    if (which === 0) pp.obligations[0].ssp_minor = null;
    else if (which === 1) pp.obligations.push({ ...pp.obligations[0] });
    else if (which === 2) delete pp.rounding_rule;
    else pp.transaction_price_minor = -1;
    const { output_payload: o, compliance_flags } = compute(pp);
    if (!o.indeterminate || o.allocations.length !== 0 || !compliance_flags.includes('INDETERMINATE')) violations++;
  }
  return { name: 'missing_or_invalid_facts_refuse_indeterminate', checked: N_CASES, violations };
}

function checkDeterminismAndWarningsMirror(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genCase(rng);
    const a = compute(pp);
    const b = compute(JSON.parse(JSON.stringify(pp)));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if ((a.output_payload.warnings.length > 0) !== (a.compliance_flags.length > 0)) violations++;
  }
  return { name: 'deterministic_and_warnings_mirror_flags', checked: N_CASES, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkSumsToPrice(mulberry32(1)),
  checkCapNeverSilentlyExceeded(mulberry32(2)),
  checkPermutationInvariance(mulberry32(3)),
  checkReferenceParity(mulberry32(4)),
  checkProportionalBounds(mulberry32(5)),
  checkResidual(mulberry32(6)),
  checkRefusals(mulberry32(7)),
  checkDeterminismAndWarningsMirror(mulberry32(8)),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
