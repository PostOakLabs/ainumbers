// art-758-hdhp-ppo-break-even.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-105 porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records at bus pin c0d61c8f, GRADES
// PASS-PENDING-XV 2026-10-14, Builder-verifies-at-land 12/12 re-executed 2026-10-19
// per the Tim 2026-10-18T21:20Z extend-ruling).
// kernel_digest_at_authoring: sha256:e95524058ed93d9c2f4c6b7b81d6f58c8094280895ca7b0a2cd51340e51e21fd
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// dollar arithmetic so its outputs match the ported-from page to the digit. The
// properties below assert only relations that are exact under IEEE-754 (equality
// and ordering on already-computed outputs, integer grid multiples, formula
// restatements built from the same operations), never fragile float equals on
// arbitrary draws.
//
// Checks: fixture-oracle gate (the 6 Apex live vectors, the 6 boundary pairs at and
// just past every comparator — $50 grid break-even predicate hdhp<=ppo at 250/350,
// STRICT winner hdhp<ppo at exact tie vs $1 past, STRICT recommendation
// expSpend<beSpend at equality vs just below — and r1..r6, one reachable fixture per
// declared refusal branch); P1 determinism (two runs agree byte-for-byte) and output
// shape (no undefined/NaN/non-finite anywhere in output_payload); P2 the HSA shield
// restated independently (hsa_total_applied == min(emp+addl, coverage limit),
// hsa_tax_shield == hsa_total_applied * margRate/100 with margRate the same /100 the
// kernel applies); P3 the winner/recommendation contract restated from outputs alone
// (winner==='HDHP' iff hdhp_total_at_expected < ppo_total_at_expected; PPO_ALL_LEVELS
// iff break_even_spend===null; PPO_LIKELY iff break_even_spend!==null and expected
// spend < break_even_spend; HDHP_BETTER otherwise); P4 grid discipline: a non-null
// break_even_spend is a multiple of 50 in [0, 20000], the totals evaluated AT it
// satisfy hdhp <= ppo, and one grid notch below (when > 0) satisfies hdhp > ppo
// (first crossing); P5 invalid-domain inputs are refused with a named
// refusal_reason/domain_errors code, null outputs and the ART758_INPUT_REFUSED flag,
// for every declared branch (bad as_of, bad coverage, bad money, bad coinsurance,
// bad tax rate, bad spend); P6 the comparison table restated: spends are the fixed
// key levels plus the expected spend, deduped and ascending, every row carrying
// hdhp_saves == ppo_total - hdhp_total.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-758-hdhp-ppo-break-even.proptest.mjs

import { compute } from '../art-758-hdhp-ppo-break-even.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-758-hdhp-ppo-break-even';

const HSA_LIMITS = { individual: 4400, family: 8750 };
const TABLE_STEPS = [0, 1500, 3000, 5000, 10000, 15000, 20000];

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// Valid draw generator (percent fields stay within [0, 100]; money fields >= 0).
const basePP = () => ({
  as_of: '2026-01-15',
  coverage: 'individual',
  hdhp_premium_monthly: 300,
  hdhp_deductible: 1800,
  hdhp_oop_max: 4000,
  hdhp_coinsurance_pct: 20,
  ppo_premium_monthly: 550,
  ppo_deductible: 500,
  ppo_oop_max: 6000,
  ppo_coinsurance_pct: 30,
  employer_hsa: 500,
  additional_hsa: 1500,
  marginal_tax_rate_pct: 24,
  expected_annual_spend: 4200,
});
const randomValidPP = (rng) => {
  const pp = basePP();
  pp.coverage = pick(rng, ['individual', 'family']);
  pp.hdhp_premium_monthly = Math.round(rng() * 900);
  pp.hdhp_deductible = Math.round(rng() * 7000);
  pp.hdhp_oop_max = pp.hdhp_deductible + Math.round(rng() * 9000);
  pp.hdhp_coinsurance_pct = Math.round(rng() * 100);
  pp.ppo_premium_monthly = Math.round(rng() * 1200);
  pp.ppo_deductible = Math.round(rng() * 5000);
  pp.ppo_oop_max = pp.ppo_deductible + Math.round(rng() * 12000);
  pp.ppo_coinsurance_pct = Math.round(rng() * 100);
  pp.employer_hsa = Math.round(rng() * 3000);
  pp.additional_hsa = Math.round(rng() * 5000);
  pp.marginal_tax_rate_pct = Math.round(rng() * 60);
  pp.expected_annual_spend = Math.round(rng() * 25000);
  return pp;
};

// P1 — determinism + output shape.
function checkP1DeterministicShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75801);
  for (let i = 0; i < 40; i++) {
    const pp = randomValidPP(rng);
    const a = compute(pp), b = compute(pp);
    checked++;
    if (!deepEqual(a.output_payload, b.output_payload)) violations++;
    if (hasBadNumber(a.output_payload)) violations++;
    if (a.output_payload.as_of !== pp.as_of) violations++;
    if (a.output_payload.coverage !== pp.coverage) violations++;
  }
  return { name: 'P1 determinism + output shape', checked, violations };
}

// P2 — HSA shield restated independently.
function checkP2HsaShieldRestatement() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75802);
  for (let i = 0; i < 40; i++) {
    const pp = randomValidPP(rng);
    const out = compute(pp).output_payload;
    const limit = HSA_LIMITS[pp.coverage];
    const applied = Math.min(pp.employer_hsa + pp.additional_hsa, limit);
    checked++;
    if (out.hsa_total_applied !== applied) violations++;
    if (out.hsa_tax_shield !== applied * (pp.marginal_tax_rate_pct / 100)) violations++;
    if (!(out.hsa_total_applied <= limit)) violations++;
  }
  return { name: 'P2 HSA shield restatement', checked, violations };
}

// P3 — winner/recommendation contract restated from outputs alone.
function checkP3WinnerRecommendation() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75803);
  for (let i = 0; i < 60; i++) {
    const pp = randomValidPP(rng);
    const out = compute(pp).output_payload;
    checked++;
    const hdhpWins = out.hdhp_total_at_expected < out.ppo_total_at_expected;
    if ((out.winner === 'HDHP') !== hdhpWins) violations++;
    if (out.savings !== Math.abs(out.hdhp_total_at_expected - out.ppo_total_at_expected)) violations++;
    if (out.recommendation === 'PPO_ALL_LEVELS' && out.break_even_spend !== null) violations++;
    if (out.recommendation === 'PPO_LIKELY' && !(out.break_even_spend !== null && pp.expected_annual_spend < out.break_even_spend)) violations++;
    if (out.recommendation === 'HDHP_BETTER' && !(out.break_even_spend !== null && pp.expected_annual_spend >= out.break_even_spend)) violations++;
    if (out.break_even_spend === null && out.recommendation !== 'PPO_ALL_LEVELS') violations++;
  }
  return { name: 'P3 winner/recommendation contract', checked, violations };
}

// P4 — grid discipline: multiple of 50 in range, <= at the crossing, > one notch below.
function checkP4GridDiscipline() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75804);
  for (let i = 0; i < 60; i++) {
    const pp = randomValidPP(rng);
    const out = compute(pp).output_payload;
    const be = out.break_even_spend;
    checked++;
    if (be === null) continue;
    if (be % 50 !== 0 || be < 0 || be > 20000) violations++;
    if (be === 0) continue;
    const atBe = compute({ ...pp, expected_annual_spend: be }).output_payload;
    if (!(atBe.hdhp_total_at_expected <= atBe.ppo_total_at_expected)) violations++;
    const below = be - 50;
    if (below >= 0) {
      const atBelow = compute({ ...pp, expected_annual_spend: below }).output_payload;
      if (below === 0 ? !(atBelow.hdhp_total_at_expected > atBelow.ppo_total_at_expected)
                      : !(atBelow.hdhp_total_at_expected > atBelow.ppo_total_at_expected)) violations++;
    }
  }
  return { name: 'P4 grid discipline (first crossing)', checked, violations };
}

// P5 — refusal taxonomy: every declared branch fires with a named reason.
function checkP5RefusalTaxonomy() {
  let checked = 0, violations = 0;
  /** @type {Array<[string, (pp: object) => object]>} */
  const seeds = [
    ['REFUSED_BAD_AS_OF', (pp) => ({ ...pp, as_of: '2026-02-30' })],
    ['REFUSED_BAD_AS_OF', (pp) => ({ ...pp, as_of: 20260115 })],
    ['REFUSED_BAD_COVERAGE', (pp) => ({ ...pp, coverage: 'family+' })],
    ['REFUSED_BAD_MONEY', (pp) => ({ ...pp, hdhp_deductible: -1 })],
    ['REFUSED_BAD_MONEY', (pp) => ({ ...pp, ppo_oop_max: '6000' })],
    ['REFUSED_BAD_MONEY', (pp) => ({ ...pp, employer_hsa: Infinity })],
    ['REFUSED_BAD_COINSURANCE', (pp) => ({ ...pp, hdhp_coinsurance_pct: 101 })],
    ['REFUSED_BAD_COINSURANCE', (pp) => ({ ...pp, ppo_coinsurance_pct: -5 })],
    ['REFUSED_BAD_TAX_RATE', (pp) => ({ ...pp, marginal_tax_rate_pct: 140 })],
    ['REFUSED_BAD_SPEND', (pp) => { const q = { ...pp }; delete q.expected_annual_spend; return q; }],
    ['REFUSED_BAD_SPEND', (pp) => ({ ...pp, expected_annual_spend: -100 })],
  ];
  for (const [code, mutate] of seeds) {
    const out = compute(mutate(basePP()));
    checked++;
    if (out.output_payload.refusal_reason !== code) violations++;
    if (!Array.isArray(out.output_payload.domain_errors) || out.output_payload.domain_errors[0]?.code !== code) violations++;
    if (out.output_payload.winner !== null || out.output_payload.break_even_spend !== null) violations++;
    if (out.compliance_flags[0] !== 'ART758_INPUT_REFUSED') violations++;
  }
  return { name: 'P5 refusal taxonomy (named, nulling, flagged)', checked, violations };
}

// P6 — comparison table restated: deduped ascending steps + expected, saves restated.
function checkP6ComparisonTable() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75805);
  for (let i = 0; i < 40; i++) {
    const pp = randomValidPP(rng);
    const out = compute(pp).output_payload;
    checked++;
    const spends = out.comparison_table.map((r) => r.spend);
    const expected = [...new Set(TABLE_STEPS.concat([pp.expected_annual_spend]))].sort((a, b) => a - b);
    if (!deepEqual(spends, expected)) violations++;
    for (const row of out.comparison_table) {
      if (row.hdhp_saves !== row.ppo_total - row.hdhp_total) violations++;
    }
  }
  return { name: 'P6 comparison table restatement', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1DeterministicShape(),
  checkP2HsaShieldRestatement(),
  checkP3WinnerRecommendation(),
  checkP4GridDiscipline(),
  checkP5RefusalTaxonomy(),
  checkP6ComparisonTable(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — APEXPORT-105 port (Apex #105, AL-112).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
