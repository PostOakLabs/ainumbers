// art-852-murabahah-ibra-settlement — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:ca79e5a1d0d1a47ed618496808021d1fefad63103ba684c8c70ed4996dc786f8
// spec: ISLAMIC-MURABAHAH-IBRA-1 (RESUME-1); pinned rule text retrieved 2026-11-20.
// human_sign_off: PENDING
//
// Checks: fixture oracle over every pinned vector; P1 determinism and output shape;
// P2 the per-period annuity recurrence in integer minor units (half-even profit);
// P3 the early-settlement identity (rebate = deferred profit less permitted charges,
// settlement = outstanding price + instalment due + late charge minus rebate, rebate >= 0);
// P4 every declared refusal branch is reachable and mirrored into warnings;
// P5 the variable-rate per-period rebate is the difference between the two profit bases;
// P6 the non-delivery rebate adds undisbursed principal; P7 buildArtifact_never_throws.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
// Run: node chaingraph/kernels/__proptests__/art-852-murabahah-ibra-settlement.proptest.mjs

import { compute, buildArtifact } from '../art-852-murabahah-ibra-settlement.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-852-murabahah-ibra-settlement';
const SEED = 852;
const N = 240;
const DEN = 120000n;

/**
 * @param {bigint} num
 * @param {bigint} den
 * @returns {bigint}
 */
function divHalfEven(num, den) {
  const neg = num < 0n; const a = neg ? -num : num;
  let q = a / den; const r = a % den; const t = r * 2n;
  if (t > den || (t === den && q % 2n === 1n)) q += 1n;
  return neg ? -q : q;
}

function randPP(rng, opts = {}) {
  const tenor = 1 + Math.floor(rng() * 12);
  const cop = 100000 + Math.floor(rng() * 5000000);
  const cpr = Math.floor(rng() * 100);
  const sp = cop + Math.floor(rng() * cop);
  const instalment = Math.max(2, Math.floor(sp / tenor));
  const pp = {
    authority: 'bnm',
    cost_of_purchase_minor: cop,
    cpr_bp: cpr,
    tenor_months: tenor,
    instalment_minor: instalment,
    selling_price_minor: sp,
  };
  if (rng() < 0.5) pp.selling_price_stated_minor = pp.selling_price_minor + Math.floor(rng() * 10);
  if (opts.epr) pp.epr_periods = [{ from_month: 1, epr_bp: Math.floor(rng() * 600), instalment_minor: 100 + Math.floor(rng() * instalment) }];
  if (opts.settle) {
    pp.settlement_month = 1 + Math.floor(rng() * tenor);
    pp.instalment_due_minor = Math.floor(rng() * instalment);
    pp.late_payment_minor = Math.floor(rng() * 1000);
    const n = Math.floor(rng() * 3);
    if (n > 0) pp.early_settlement_charges = Array.from({ length: n }, (_, i) => ({ cost_type: i % 2 ? 'unrecovered_initial_cost' : 'unrecovered_discount', amount_minor: Math.floor(rng() * 500) }));
  }
  if (opts.nonDelivery) {
    pp.settlement_month = tenor;
    pp.non_delivery = { undisbursed_principal_minor: Math.floor(rng() * cop), first_sign_month: 1 + Math.floor(rng() * tenor) };
    if (pp.non_delivery.first_sign_month > pp.settlement_month) pp.non_delivery.first_sign_month = pp.settlement_month;
  }
  return pp;
}

function checkP1Determinism() {
  const rng = mulberry32(SEED + 1); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPP(rng, { epr: i % 3 === 0, settle: i % 2 === 0 });
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const sv = findShapeViolations(a.output_payload);
    if (sv.length) { violations++; console.log('P1 violation: ' + sv[0]); }
    if (JSON.stringify(a.output_payload.warnings) !== JSON.stringify(a.compliance_flags)) { violations++; console.log('P1 violation: warning mirror'); }
    if (a.output_payload.not_a_shariah_ruling !== true) { violations++; console.log('P1 violation: ruling marker'); }
  }
  return { name: 'P1 determinism, shape, flag mirror and ruling marker', checked, violations };
}

function checkP2Schedule() {
  const rng = mulberry32(SEED + 2); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPP(rng);
    const o = compute(pp).output_payload;
    let cop = BigInt(pp.cost_of_purchase_minor);
    const cpr = BigInt(pp.cpr_bp), ins = BigInt(pp.instalment_minor), sp = BigInt(pp.selling_price_minor);
    for (let k = 1; k <= pp.tenor_months; k++) {
      const row = o.schedule[k - 1]; checked++;
      const profit = divHalfEven(cop * cpr, DEN);
      const copPay = ins - profit; cop -= copPay;
      const osp = sp - ins * BigInt(k);
      const def = osp - cop;
      if (row.month !== k || BigInt(row.profit_minor) !== profit || BigInt(row.cop_payment_minor) !== copPay
        || BigInt(row.outstanding_cop_minor) !== cop || BigInt(row.outstanding_selling_price_minor) !== osp
        || BigInt(row.deferred_profit_minor) !== def) {
        violations++; console.log('P2 violation: schedule recurrence at month ' + k); break;
      }
    }
    const residual = BigInt(o.selling_price_stated_minor) - sp;
    if (BigInt(o.selling_price_residual_minor) !== residual || BigInt(o.markup_minor) !== sp - BigInt(pp.cost_of_purchase_minor)) {
      violations++; console.log('P2 violation: selling price residual or markup');
    }
  }
  return { name: 'P2 integer annuity recurrence and named selling-price residual', checked, violations };
}

function checkP3Settlement() {
  const rng = mulberry32(SEED + 3); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPP(rng, { settle: true });
    const o = compute(pp).output_payload;
    if (!o.valid_input) {
      if (o.refusal_code === 'REFUSED_CHARGES_EXCEED_DEFERRED_PROFIT') continue;
      violations++; console.log('P3 violation: unexpected refusal ' + o.refusal_code); continue;
    }
    const s = o.settlement;
    const row = o.schedule[pp.settlement_month - 1];
    const charges = (pp.early_settlement_charges || []).reduce((a, c) => a + c.amount_minor, 0);
    checked++;
    if (s.permitted_charges_minor !== charges || s.ibra_minor !== s.deferred_profit_minor - charges) { violations++; console.log('P3 violation: rebate identity'); }
    if (s.settlement_amount_minor !== s.outstanding_selling_price_minor + s.instalment_due_minor + s.late_payment_minor - s.ibra_minor) { violations++; console.log('P3 violation: settlement identity'); }
    if (s.ibra_minor < 0 || s.deferred_profit_minor !== row.deferred_profit_minor) { violations++; console.log('P3 violation: negative rebate or wrong deferred profit'); }
  }
  return { name: 'P3 early-settlement identity', checked, violations };
}

function checkP4Refusals() {
  const rng = mulberry32(SEED + 4);
  const base = randPP(rng);
  const bad = [
    ['wrong type', null, 'REFUSED_INPUT_WRONG_TYPE'],
    ['float field', { ...base, instalment_minor: 1.5 }, 'REFUSED_FIELD_TYPE'],
    ['present null', { ...base, cpr_bp: null }, 'REFUSED_FIELD_TYPE'],
    ['missing field', (({ cpr_bp, ...rest }) => rest)(base), 'REFUSED_FIELD_MISSING'],
    ['unpinned authority', { ...base, authority: 'other' }, 'REFUSED_AUTHORITY_NOT_PINNED'],
    ['lost profit', { ...base, early_settlement_charges: [{ cost_type: 'lost_profit', amount_minor: 1 }] }, 'REFUSED_CHARGE_LOST_PROFIT'],
    ['marketing', { ...base, early_settlement_charges: [{ cost_type: 'marketing', amount_minor: 1 }] }, 'REFUSED_CHARGE_MARKETING'],
    ['unknown field', { ...base, customer_name: 'x' }, 'REFUSED_FIELD_NOT_ALLOWED'],
    ['prototype key', { ...base, constructor: 1 }, 'REFUSED_FIELD_NOT_ALLOWED'],
    ['bad epr start', { ...base, epr_periods: [{ from_month: 2, epr_bp: 300, instalment_minor: 100 }] }, 'REFUSED_EPR_PERIOD_INVALID'],
    ['unsafe integer field', { ...base, instalment_minor: Number.MAX_SAFE_INTEGER + 2 }, 'REFUSED_INPUT_UNSAFE_NUMBER'],
  ];
  let checked = 0, violations = 0;
  for (const [name, pp, code] of bad) {
    const r = compute(pp); checked++;
    if (r.output_payload.valid_input !== false || r.output_payload.refusal_code !== code) { violations++; console.log('P4 violation: ' + name + ' -> ' + r.output_payload.refusal_code); }
    if (!r.compliance_flags.includes('INPUT_REFUSED') || JSON.stringify(r.output_payload.warnings) !== JSON.stringify(r.compliance_flags)) { violations++; console.log('P4 violation: refusal flag mirror on ' + name); }
  }
  return { name: 'P4 refusal branches reachable and mirrored', checked, violations };
}

function checkP5VariableRate() {
  const rng = mulberry32(SEED + 5); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPP(rng, { epr: true });
    const o = compute(pp).output_payload;
    if (!o.valid_input) { violations++; console.log('P5 violation: valid variable-rate input refused'); continue; }
    if (!o.variable_rate_applied) { violations++; console.log('P5 violation: variable-rate flag missing'); }
    for (const row of o.schedule) {
      checked++;
      if (row.period_ibra_minor !== row.profit_minor - row.epr_profit_minor) { violations++; console.log('P5 violation: per-period rebate'); break; }
      if (row.epr_instalment_minor !== pp.epr_periods[0].instalment_minor) { violations++; console.log('P5 violation: EPR instalment mirror'); break; }
    }
  }
  return { name: 'P5 variable-rate per-period rebate', checked, violations };
}

function checkP6NonDelivery() {
  const rng = mulberry32(SEED + 6); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPP(rng, { nonDelivery: true });
    const r = compute(pp);
    const o = r.output_payload;
    if (!o.valid_input || o.non_delivery === null) { violations++; console.log('P6 violation: non-delivery branch absent (' + o.refusal_code + ')'); continue; }
    const nd = o.non_delivery;
    const charges = (pp.early_settlement_charges || []).reduce((a, c) => a + c.amount_minor, 0);
    checked++;
    if (nd.ibra_total_minor !== nd.ibra_on_deferred_profit_minor + pp.non_delivery.undisbursed_principal_minor - charges) { violations++; console.log('P6 violation: rebate composition'); }
    if (nd.ibra_on_undisbursed_minor !== pp.non_delivery.undisbursed_principal_minor) { violations++; console.log('P6 violation: undisbursed rebate'); }
    if (!r.compliance_flags.includes('NON_DELIVERY_APPLIED')) { violations++; console.log('P6 violation: flag'); }
  }
  return { name: 'P6 non-delivery rebate adds undisbursed principal', checked, violations };
}

async function checkP7NeverThrows() {
  const rng = mulberry32(SEED + 7);
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  for (const delta of [{ zzz: Infinity }, { zzz: NaN }, { zzz: 1e300 }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide }]) {
    checked++;
    try {
      const art = await buildArtifact({ ...randPP(rng), ...delta });
      if (art.execution_hash !== null || !art.hash_refusal || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(art.hash_refusal.reason)) { violations++; console.log('P7 violation: artifact hash-refusal shape'); }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P7 violation: accepted hostile input'); }
    } catch (e) { violations++; console.log('P7 violation: buildArtifact threw: ' + String(e.message).slice(0, 80)); }
  }
  for (const pp of [randPP(rng), randPP(rng, { settle: true }), null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P7 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log('P7 violation: buildArtifact threw on clean input: ' + String(e.message).slice(0, 80)); }
  }
  return { name: 'buildArtifact_never_throws', checked, violations };
}

let oracle;
try { oracle = runFixtureOracle(KERNEL_ID, compute); }
catch (e) { oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] }; }
const properties = [
  checkP1Determinism(), checkP2Schedule(), checkP3Settlement(), checkP4Refusals(),
  checkP5VariableRate(), checkP6NonDelivery(), await checkP7NeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
