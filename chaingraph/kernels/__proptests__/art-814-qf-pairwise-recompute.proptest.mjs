// art-814-qf-pairwise-recompute -- class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:bbfed88877a9fdee108d9e5f9d8630c385c5189a03ffbe826ac2f334413f311f
// spec: research/QF-PIN-2026-11.md (row QF-PRIMARY-1); node metadata cites the pinned excerpts.
// human_sign_off: PENDING
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-814-qf-pairwise-recompute.proptest.mjs

import { compute } from '../art-814-qf-pairwise-recompute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-814-qf-pairwise-recompute';
const ROUNDS = 150;

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// A random small round. When squares is true every amount is a perfect square.
function randomRound(rng, squares) {
  const nP = randInt(rng, 1, 4);
  const nC = randInt(rng, 1, 5);
  const rows = [];
  for (let p = 0; p < nP; p++) {
    for (let c = 0; c < nC; c++) {
      if (rng() < 0.6) {
        const r = randInt(rng, 1, 30);
        rows.push({ project: 'p' + p, contributor: 'c' + c, amount: squares ? r * r : randInt(rng, 1, 900) });
      }
    }
  }
  if (rows.length === 0) rows.push({ project: 'p0', contributor: 'c0', amount: squares ? 4 : 5 });
  return rows;
}

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// Independent closed form for perfect squares: (sum of roots)^2 - sum of amounts, per project.
function closedForm(rows) {
  const per = {};
  for (const r of rows) {
    const k = r.project;
    per[k] = per[k] || { roots: 0, total: 0 };
    per[k].roots += Math.round(Math.sqrt(r.amount));
    per[k].total += r.amount;
  }
  const out = {};
  for (const k of Object.keys(per)) out[k] = per[k].roots * per[k].roots - per[k].total;
  return out;
}

function checkClosedFormIdentity() {
  const rng = mulberry32(0x814a);
  let checked = 0, violations = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const rows = randomRound(rng, true);
    const digits = randInt(rng, 0, 6);
    const res = compute({ mode: 'plain', matching_pool: 1000, sqrt_scale_digits: digits, contributions: rows }).output_payload;
    const cf = closedForm(rows);
    checked++;
    const S2 = 10n ** BigInt(2 * digits);
    for (const p of res.projects) {
      if (BigInt(p.raw_subsidy_scaled) !== BigInt(cf[p.project]) * S2 || p.matches_closed_form !== true) violations++;
    }
  }
  return { name: 'plain_mode_equals_closed_form_QF_identity_on_perfect_squares', checked, violations };
}

function checkPoolSumExact() {
  const rng = mulberry32(0x814b);
  let checked = 0, violations = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const rows = randomRound(rng, false);
    const pool = randInt(rng, 0, 100000);
    const mode = rng() < 0.5 ? 'plain' : 'pairwise_bounded';
    const res = compute({ mode, matching_pool: pool, pairwise_m: randInt(rng, 1, 5000), contributions: rows }).output_payload;
    checked++;
    const sum = res.projects.reduce((a, p) => a + p.match, 0);
    const anySub = res.projects.some((p) => p.raw_subsidy_scaled !== '0');
    if (anySub ? sum !== pool : sum !== 0) violations++;
    if (res.sum_check.allocated !== sum || res.sum_check.allocated + res.sum_check.undistributed !== pool) violations++;
  }
  return { name: 'normalized_matches_sum_to_pool_exactly_or_zero_when_no_subsidy', checked, violations };
}

function checkCapNeverExceedsPool() {
  const rng = mulberry32(0x814c);
  let checked = 0, violations = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const rows = randomRound(rng, false);
    const pool = randInt(rng, 0, 400);
    const res = compute({ mode: 'plain', allocation: 'cap_at_pool', matching_pool: pool, contributions: rows }).output_payload;
    checked++;
    if (res.sum_check.allocated > pool || res.sum_check.undistributed < 0) violations++;
  }
  return { name: 'cap_at_pool_never_allocates_more_than_the_pool', checked, violations };
}

function checkRowOrderInvariance() {
  const rng = mulberry32(0x814d);
  let checked = 0, violations = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const rows = randomRound(rng, false);
    const mode = rng() < 0.5 ? 'plain' : 'pairwise_bounded';
    const base = { mode, matching_pool: 777, pairwise_m: 40, contributions: rows };
    const a = JSON.stringify(compute(base).output_payload);
    const b = JSON.stringify(compute({ ...base, contributions: shuffled(rng, rows) }).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'result_is_independent_of_row_order', checked, violations };
}

function checkPairwiseNeverExceedsPlain() {
  const rng = mulberry32(0x814e);
  let checked = 0, violations = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const rows = randomRound(rng, false);
    const plain = compute({ mode: 'plain', matching_pool: 100, contributions: rows }).output_payload;
    const bound = compute({ mode: 'pairwise_bounded', matching_pool: 100, pairwise_m: randInt(rng, 1, 3000), contributions: rows }).output_payload;
    checked++;
    for (let i = 0; i < plain.projects.length; i++) {
      if (BigInt(bound.projects[i].raw_subsidy_scaled) > BigInt(plain.projects[i].raw_subsidy_scaled)) violations++;
    }
  }
  return { name: 'pairwise_bounded_subsidy_never_exceeds_plain_subsidy_per_project', checked, violations };
}

function checkSingleContributorZero() {
  const rng = mulberry32(0x814f);
  let checked = 0, violations = 0;
  for (let n = 0; n < ROUNDS; n++) {
    const amt = randInt(rng, 1, 100000);
    const mode = rng() < 0.5 ? 'plain' : 'pairwise_bounded';
    const res = compute({ mode, matching_pool: 50, pairwise_m: 9, contributions: [{ project: 'solo', contributor: 'a', amount: amt }] }).output_payload;
    checked++;
    if (res.projects[0].raw_subsidy_scaled !== '0' || res.projects[0].match !== 0) violations++;
  }
  return { name: 'one_contributor_earns_no_subsidy_in_either_mode', checked, violations };
}

function checkCollusionBound() {
  // Two contributors put W into each of n projects with one shared pair coefficient per
  // project pair of totals; the total pairwise-bounded subsidy stays below 2*M per pair
  // summed over the shared projects' coupling, checked here as a loose 2*M*projects bound.
  const rng = mulberry32(0x8140);
  let checked = 0, violations = 0;
  for (let n = 0; n < 60; n++) {
    const M = randInt(rng, 1, 500);
    const W = randInt(rng, 100000, 900000000);
    const nProj = randInt(rng, 1, 5);
    const rows = [];
    for (let p = 0; p < nProj; p++) { rows.push({ project: 'q' + p, contributor: 'a', amount: W }); rows.push({ project: 'q' + p, contributor: 'b', amount: W }); }
    const res = compute({ mode: 'pairwise_bounded', matching_pool: 1, pairwise_m: M, sqrt_scale_digits: 4, contributions: rows }).output_payload;
    const total = res.projects.reduce((a, p) => a + BigInt(p.raw_subsidy_scaled), 0n);
    checked++;
    if (total > BigInt(2 * M) * 10n ** 8n) violations++;
  }
  return { name: 'colluding_pair_subsidy_stays_below_2M_in_pairwise_bounded_mode', checked, violations };
}

function checkRefusals() {
  const bad = [
    { mode: 'x', matching_pool: 1, contributions: [{ project: 'p', contributor: 'a', amount: 4 }] },
    { mode: 'plain', matching_pool: 1.5, contributions: [{ project: 'p', contributor: 'a', amount: 4 }] },
    { mode: 'plain', matching_pool: 1, contributions: [] },
    { mode: 'plain', matching_pool: 1, contributions: [{ project: 'p q', contributor: 'a', amount: 4 }] },
    { mode: 'plain', matching_pool: 1, contributions: [{ project: 'p', contributor: 'a@b.c', amount: 4 }] },
    { mode: 'plain', matching_pool: 1, contributions: [{ project: 'p', contributor: 'a', amount: 0 }] },
    { mode: 'plain', matching_pool: 1, contributions: [{ project: 'p', contributor: 'a', amount: '4' }] },
    { mode: 'pairwise_bounded', matching_pool: 1, contributions: [{ project: 'p', contributor: 'a', amount: 4 }] },
  ];
  let violations = 0;
  for (const pp of bad) {
    const r = compute(pp);
    if (r.output_payload.ok !== false || r.compliance_flags.length !== 1) violations++;
  }
  return { name: 'invalid_domain_is_refused_with_a_named_error', checked: bad.length, violations };
}

function checkDeterminism() {
  const rng = mulberry32(0x8141);
  let checked = 0, violations = 0;
  for (let n = 0; n < 40; n++) {
    const pp = { mode: 'pairwise_bounded', matching_pool: 500, pairwise_m: 30, contributions: randomRound(rng, false) };
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(JSON.parse(JSON.stringify(pp))))) violations++;
  }
  return { name: 'compute_is_deterministic', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkClosedFormIdentity(),
  checkPoolSumExact(),
  checkCapNeverExceedsPool(),
  checkRowOrderInvariance(),
  checkPairwiseNeverExceedsPlain(),
  checkSingleContributorZero(),
  checkCollusionBound(),
  checkRefusals(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
