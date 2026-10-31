// 789-issuer-yield-share — class-K property-test floor. Authored per FV-PBT-FLOOR-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:1b264cd3f3357e855df6188ba39e68a97025932eda97349ed04d2c80e3dcdb8e
// spec: board/queued/ISSUER-YIELD-SHARE-CHECK-1.md (aggregate split recompute + issuer-yield trace)
// human_sign_off: PENDING (node lands deferred)
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/789-issuer-yield-share.proptest.mjs

import { compute } from '../789-issuer-yield-share.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, pick } from './_pbt-common.mjs';

const KERNEL_ID = '789-issuer-yield-share';

function basePP(over) {
  return Object.assign({
    profile: 'genius_enacted',
    period: { days: 30, avg_reserve_value_minor: 250000000, reserve_yield_bp: 425 },
    split: [{ party_role: 'issuer', fixed_minor: 349315 }, { party_role: 'platform', fixed_minor: 305650 }, { party_role: 'distributor', fixed_minor: 218322 }],
    holder_rewards: [],
  }, over);
}

// Class-A: determinism — compute() twice, byte-identical output_payload.
function checkDeterminism() {
  const rng = mulberry32(789001);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = basePP({ period: { days: 1 + Math.floor(rng() * 365), avg_reserve_value_minor: Math.floor(rng() * 1e9), reserve_yield_bp: Math.floor(rng() * 5000) } });
    if (!deepEqual(compute(pp).output_payload, compute(pp).output_payload)) violations++;
    checked++;
  }
  return { name: 'determinism_output_payload_stable', checked, violations };
}

// Class-B: rounding conformance — recomputed income equals floor(floor(v*bp/1e4)*d/365);
// each bp share equals floor(income*bp/1e4).
function checkRoundingRule() {
  const rng = mulberry32(789002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const days = 1 + Math.floor(rng() * 365);
    const avg = Math.floor(rng() * 1e10);
    const bp = Math.floor(rng() * 5000);
    const r = compute(basePP({ period: { days, avg_reserve_value_minor: avg, reserve_yield_bp: bp } })).output_payload;
    const want = Math.floor(Math.floor(avg * bp / 10000) * days / 365);
    if (r.income.reserve_income_minor !== want) violations++;
    checked++;
    const share = Math.floor(r.income.reserve_income_minor * 2500 / 10000);
    const r2 = compute(basePP({ period: { days, avg_reserve_value_minor: avg, reserve_yield_bp: bp }, split: [{ party_role: 'issuer', share_bp: 2500 }] })).output_payload;
    if (r2.income.shares[0].amount_minor !== share) violations++;
    checked++;
  }
  return { name: 'rounding_floor_rule_conformance', checked, violations };
}

// Class-A: conservation — a fixed split summing exactly to income conserves; the same
// split perturbed by +1 minor does not.
function checkConservation() {
  const rng = mulberry32(789003);
  let checked = 0, violations = 0;
  for (let i = 0; i < 50; i++) {
    const income = Math.floor(rng() * 5e6);
    const a = Math.floor(income / 3), b = Math.floor(income / 4), c = income - a - b;
    const ok = compute(basePP({ period: { days: 30, reserve_income_minor: income }, split: [{ party_role: 'issuer', fixed_minor: a }, { party_role: 'platform', fixed_minor: b }, { party_role: 'distributor', fixed_minor: c }] })).output_payload;
    if (ok.income.conserving !== true) violations++;
    checked++;
    const bad = compute(basePP({ period: { days: 30, reserve_income_minor: income }, split: [{ party_role: 'issuer', fixed_minor: a + 1 }, { party_role: 'platform', fixed_minor: b }, { party_role: 'distributor', fixed_minor: c }] })).output_payload;
    if (bad.income.conserving !== false) violations++;
    checked++;
  }
  return { name: 'split_conservation_invariant', checked, violations };
}

// Class-K: verdict mapping over the declared reward domain — issuer payer =>
// ISSUER_YIELD_PRESENT; non-issuer payer funded from reserve_income => REVIEW;
// otherwise NO_ISSUER_YIELD.
function checkVerdictMapping() {
  const rng = mulberry32(789004);
  const payers = ['issuer', 'platform', 'distributor', 'custodian'];
  const funds = ['reserve_income', 'distributor_margin', 'other'];
  const conds = ['holding', 'activity', 'none'];
  let checked = 0, violations = 0;
  for (let i = 0; i < 90; i++) {
    const payer = pick(rng, payers), from = pick(rng, funds), cond = pick(rng, conds);
    const r = compute(basePP({ period: { days: 31, reserve_income_minor: 300000 }, split: [{ party_role: 'issuer', fixed_minor: 150000 }, { party_role: 'platform', fixed_minor: 90000 }, { party_role: 'distributor', fixed_minor: 60000 }], holder_rewards: [{ payer_role: payer, funded_from: from, value_minor: 1000, conditioned_on: cond }] })).output_payload;
    const want = payer === 'issuer' ? 'ISSUER_YIELD_PRESENT' : (from === 'reserve_income' ? 'REVIEW' : 'NO_ISSUER_YIELD');
    if (r.verdict !== want) violations++;
    checked++;
    if (r.profile !== 'genius_enacted' || r.proposed !== false) violations++;
    checked++;
  }
  return { name: 'verdict_maps_payer_and_funding_source', checked, violations };
}

// Class-A: invalid-domain rejection — unknown profile, malformed period, malformed
// split and malformed rewards all refuse with MALFORMED_INPUT_REFUSED.
function checkRefusals() {
  const rng = mulberry32(789005);
  const bad = [
    basePP({ profile: 'clarity_proposed' }),
    basePP({ period: { days: 0, reserve_income_minor: 5 } }),
    basePP({ period: { days: 30, avg_reserve_value_minor: -1, reserve_yield_bp: 100 } }),
    basePP({ period: { days: 30, reserve_income_minor: 12.5 } }),
    basePP({ split: [] }),
    basePP({ split: [{ party_role: 'Bad Role', fixed_minor: 1 }] }),
    basePP({ split: [{ party_role: 'issuer' }] }),
    basePP({ split: [{ party_role: 'issuer', share_bp: 12000 }] }),
    basePP({ holder_rewards: null }),
    basePP({ holder_rewards: [{ payer_role: 'issuer', funded_from: 'share_buyback', value_minor: 1, conditioned_on: 'holding' }] }),
    basePP({ holder_rewards: [{ payer_role: 'issuer', funded_from: 'reserve_income', value_minor: -5, conditioned_on: 'holding' }] }),
    basePP({ holder_rewards: [{ payer_role: 'issuer', funded_from: 'reserve_income', value_minor: 1, conditioned_on: 'loyalty' }] }),
  ];
  let checked = 0, violations = 0;
  for (const pp of bad) {
    const r = compute(pp);
    if (r.output_payload.verdict !== 'refused') violations++;
    if (!r.compliance_flags.includes('MALFORMED_INPUT_REFUSED')) violations++;
    checked++;
  }
  void rng;
  return { name: 'invalid_domain_refused_reachable', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkRoundingRule(),
  checkConservation(),
  checkVerdictMapping(),
  checkRefusals(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — authored (5 properties + golden fixture oracle).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
