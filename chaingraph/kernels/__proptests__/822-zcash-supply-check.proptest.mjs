// 822-zcash-supply-check — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (four pinned pools, values-only, a
// closed refusal set enumerated in the sibling reachability fixtures, values
// bounded so every figure stays exactly representable), and the arithmetic is
// pure integer addition, so the conservation identity is checked EXACTLY, not
// approximately. Properties below run over a committed mulberry32 seed
// (deterministic) plus a fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:ecd45135a8bfa2914477eb4fae02af99493c4b310dc995deea317bed2e7d73ac
// spec: VITALIK-LENS-PLANS-2026-11-02.md PLAN I step 4 — recompute total shielded
//   supply and the no-counterfeiting arithmetic from pasted pool balances; the node
//   states it cannot check the chain itself. Pinned text: research/clause-snapshots/
//   zcash-2026-11/protocol.tex Chain Value Pool Balances (registered digest
//   sha256:874beb9279aace6bd4d43cf74d604342a475e570b2b2e9ed39971136af6b1efb).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/822-zcash-supply-check.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../822-zcash-supply-check.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '822-zcash-supply-check';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.fixtures.json'), 'utf8'),
);
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261103;
const N = 200;

const POOLS = ['transparent', 'sprout', 'sapling', 'orchard'];
const POOL_BOUND = 1125899906842624; // kernel's declared per-pool bound (2^50)
const CLAIMED_BOUND = 4503599627370496; // kernel's declared claimed-supply bound (2^52)

/** Random VALID policy_parameters: integer pools within the declared bound. */
function randomValidPp(rng) {
  const pools = {};
  let sum = 0;
  for (const p of POOLS) {
    // integers in [0, 2^48]: inside the declared bound, sums stay exact
    const v = Math.floor(rng() * 281474976710656); // 2^48
    pools[p] = v;
    sum += v;
  }
  const pp = { pools, claimed_supply_zat: sum };
  if (rng() < 0.5) {
    pp.claimed_supply_zat = sum + Math.floor(rng() * 2000000000001) - 1000000000000;
  }
  if (pp.claimed_supply_zat > CLAIMED_BOUND) pp.claimed_supply_zat = sum;
  if (pp.claimed_supply_zat < -CLAIMED_BOUND) pp.claimed_supply_zat = sum;
  return pp;
}

// P0b — CONFORMANCE FIXTURE PROVENANCE: every conformance vector carries an
// independent_oracle (source + source_digest + derivation).
function checkFixtureProvenance() {
  let checked = 0;
  let violations = 0;
  for (const vec of FIXTURES.vectors) {
    checked++;
    const o = vec.independent_oracle;
    if (!o || !o.source || !o.source_digest || !o.derivation) violations++;
  }
  return { name: 'P0b-every-conformance-vector-has-independent-oracle', checked, violations };
}

// P1 — DETERMINISM: identical inputs, identical payload and flags, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1-determinism-committed-seed', checked, violations };
}

// P2 — CONSERVATION IDENTITY, EXACT: over the random corpus (no negative pools)
// recomputed_total_zat equals the integer pool sum exactly, delta_zat equals
// recomputed_total_zat - claimed_supply_zat exactly, and the verdict is conserved
// exactly when delta_zat is 0 and supply_mismatch otherwise.
function checkConservationIdentity() {
  const rng = mulberry32(SEED + 1);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const sum = pp.pools.transparent + pp.pools.sprout + pp.pools.sapling + pp.pools.orchard;
    const { output_payload, compliance_flags } = compute(pp);
    checked += 3;
    if (output_payload.recomputed_total_zat !== sum) violations++;
    if (output_payload.delta_zat !== sum - pp.claimed_supply_zat) violations++;
    const expectedVerdict = sum - pp.claimed_supply_zat === 0 ? 'conserved' : 'supply_mismatch';
    if (output_payload.verdict !== expectedVerdict) violations++;
    const mismatchFlagged = compliance_flags.indexOf('SUPPLY_MISMATCH') !== -1;
    if (mismatchFlagged !== (sum - pp.claimed_supply_zat !== 0)) violations++;
  }
  return { name: 'P2-conservation-identity-exact', checked, violations };
}

// P3 — NON-NEGATIVITY: whenever a pool value is negative the per-pool flag fires,
// the pool is named in negative_pools, the verdict is negative_pool_balance, and
// the verdict is never conserved (the pinned negative-balance consensus rule as a
// property of the kernel over the corpus).
function checkNonNegativity() {
  const rng = mulberry32(SEED + 2);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const pick = POOLS[Math.floor(rng() * POOLS.length)];
    const neg = -Math.floor(rng() * 100000000000) - 1; // negative, integer, in bound
    pp.pools[pick] = neg;
    const { output_payload, compliance_flags } = compute(pp);
    const flag = 'NEGATIVE_POOL_' + pick.toUpperCase();
    checked += 4;
    if (compliance_flags.indexOf(flag) === -1) violations++;
    if (output_payload.negative_pools.indexOf(pick) === -1) violations++;
    if (output_payload.verdict !== 'negative_pool_balance') violations++;
    if (output_payload.manual_review_required !== true) violations++;
  }
  return { name: 'P3-negative-pool-named-and-never-conserved', checked, violations };
}

// P4 — MIRROR AND PARTITION: manual_review_required is true exactly when the
// flag set is non-empty and exactly when the verdict is not conserved; the four
// verdicts are mutually exclusive; a conserved payload carries zero flags and an
// empty issues array.
function checkMirrorAndPartition() {
  const rng = mulberry32(SEED + 3);
  let checked = 0;
  let violations = 0;
  const verdicts = ['refused', 'conserved', 'supply_mismatch', 'negative_pool_balance'];
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    if (rng() < 0.3) delete pp.claimed_supply_zat; // refusal mix in the corpus
    const { output_payload, compliance_flags } = compute(pp);
    checked += 3;
    if (output_payload.manual_review_required !== (compliance_flags.length > 0)) violations++;
    if (output_payload.manual_review_required !== (output_payload.verdict !== 'conserved')) violations++;
    if (verdicts.indexOf(output_payload.verdict) === -1) violations++;
    if (output_payload.verdict === 'conserved' && (compliance_flags.length !== 0 || output_payload.issues.length !== 0)) violations++;
  }
  return { name: 'P4-mirror-and-verdict-partition', checked, violations };
}

// P5 — REFUSAL TOTALITY AND NO ECHO: any non-numeric value, unknown pool name,
// missing pool, absent claimed supply, fractional value, or over-bound value is
// refused with the declared flag, manual_review_required true, no numeric verdict
// fields, and the refused value is never echoed anywhere in the payload.
function checkRefusalTotality() {
  const rng = mulberry32(SEED + 4);
  let checked = 0;
  let violations = 0;
  const marker = 'secret-acct-string-' + SEED;
  const cases = [
    {
      name: 'string-value',
      flag: 'NON_NUMERIC_VALUE_REFUSED',
      mutate: (pp) => { pp.pools.orchard = marker; },
    },
    {
      name: 'unknown-pool',
      flag: 'UNKNOWN_POOL_NAME_REFUSED',
      mutate: (pp) => { pp.pools.lockbox = 1; },
    },
    {
      name: 'absent-claimed',
      flag: 'CLAIMED_SUPPLY_MISSING_REFUSED',
      mutate: (pp) => { delete pp.claimed_supply_zat; },
    },
    {
      name: 'missing-pool',
      flag: 'MISSING_POOL_REFUSED',
      mutate: (pp) => { delete pp.pools.sapling; },
    },
    {
      name: 'fractional',
      flag: 'NON_INTEGER_ZATOSHI_REFUSED',
      mutate: (pp) => { pp.pools.sapling = 1.5; },
    },
    {
      name: 'over-bound',
      flag: 'VALUE_ABOVE_SAFE_ARITHMETIC_BOUND_REFUSED',
      mutate: (pp) => { pp.pools.transparent = POOL_BOUND + 1; },
    },
  ];
  for (let i = 0; i < N; i++) {
    for (const c of cases) {
      const pp = randomValidPp(rng);
      c.mutate(pp);
      const r = compute(pp);
      const payloadText = JSON.stringify(r.output_payload);
      checked += 4;
      if (r.compliance_flags.indexOf(c.flag) === -1) violations++;
      if (r.output_payload.verdict !== 'refused') violations++;
      if (r.output_payload.manual_review_required !== true) violations++;
      if (payloadText.indexOf(marker) !== -1) violations++; // never echo a refused value
    }
  }
  return { name: 'P5-refusal-totality-no-echo', checked, violations };
}

// P6 — COMMITTED REACHABILITY VECTORS: every declared refusal path still fires
// its declared flags on the committed fixture inputs.
function checkReachabilityRefires() {
  let checked = 0;
  let violations = 0;
  for (const vec of REACH.vectors) {
    const r = compute(vec.policy_parameters);
    checked++;
    const allFire = vec.observed_flags.every((f) => r.compliance_flags.indexOf(f) !== -1);
    if (!allFire || r.output_payload.manual_review_required !== true) violations++;
  }
  return { name: 'P6-committed-reachability-vectors-refire', checked, violations };
}

// P7 — OUTPUT SHAPE: no NaN / undefined / non-finite anywhere in any output over
// the corpus plus structural edge inputs (empty pp, pools object only, non-object
// pools, boolean claimed supply).
function checkShape() {
  const rng = mulberry32(SEED + 6);
  let checked = 0;
  let violations = 0;
  const paths = [
    {},
    { pools: {} },
    { pools: 'nope', claimed_supply_zat: 1 },
    { pools: { transparent: 1, sprout: 2, sapling: 3, orchard: 4 }, claimed_supply_zat: true },
    randomValidPp(rng),
  ];
  for (let i = 0; i < N; i++) paths.push(randomValidPp(rng));
  for (const pp of paths) {
    const { output_payload } = compute(pp);
    checked++;
    violations += findShapeViolations(output_payload).length;
  }
  return { name: 'P7-output-shape-no-nonfinite', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkFixtureProvenance(),
  checkDeterminism(),
  checkConservationIdentity(),
  checkNonNegativity(),
  checkMirrorAndPartition(),
  checkRefusalTotality(),
  checkReachabilityRefires(),
  checkShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — Zcash chain value pool supply check (values-only, chain never verified).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
