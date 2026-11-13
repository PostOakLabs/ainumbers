// art-840-gl-flux-explainer -- class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:fda91e239e839e06f7c52ae68c92b17a5f7954ced16de736d58aa5be26aefccd
// spec: board row GL-FLUX-EXPLAIN-NODE-1 (SECOND-OPINION-ESTATE-REVIEW-2026-11-06 idea 7)
// human_sign_off: PENDING
//
// Properties:
//   P1 sorted order stable: breaches are ordered by abs movement desc, ties by account id asc.
//   P2 unexplained set equals breaches minus explained.
//   P3 gate is blocked iff the unexplained set is non-empty; clear iff no breach and none unexplained.
//   P4 independent recompute parity: a second implementation in plain Number arithmetic (balances
//      kept small so every product is exact) agrees on the breach set and the bps floor.
//   P5 determinism: two calls on the same input are byte-identical.
//   P6 refusals carry INPUT_REFUSED and no gate status.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-840-gl-flux-explainer.proptest.mjs

import { compute } from '../art-840-gl-flux-explainer.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-840-gl-flux-explainer';
const N = 400;

function genCase(rng) {
  const n = 1 + Math.floor(rng() * 8);
  const accounts = [];
  const prior = [];
  const current = [];
  for (let i = 0; i < n; i++) {
    const id = 'ACC_' + String.fromCharCode(65 + i);
    accounts.push(id);
    const p = rng() < 0.15 ? 0 : Math.floor(rng() * 2000001) - 1000000;
    const c = rng() < 0.2 ? p : Math.floor(rng() * 2000001) - 1000000;
    prior.push({ account_id: id, minor_units: p });
    current.push({ account_id: id, minor_units: c });
  }
  const codes = ['C1', 'C2', 'C3'];
  const explanations = [];
  const m = Math.floor(rng() * (n + 2));
  for (let i = 0; i < m; i++) {
    const target = rng() < 0.1 ? 'NOT_DECLARED' : accounts[Math.floor(rng() * n)];
    explanations.push({ account_id: target, explanation_id: pick(rng, codes) });
  }
  return {
    accounts,
    prior_balances: prior,
    current_balances: current,
    threshold_policy: {
      abs_minor_units: pick(rng, [0, 1000, 50000, 400000]),
      pct_bps: pick(rng, [0, 100, 2500, 10000]),
      rule: pick(rng, ['either', 'both']),
      zero_prior_rule: pick(rng, ['abs_only', 'any_movement']),
    },
    reason_codes: codes,
    explanations,
  };
}

// Second, independent implementation (Number arithmetic, no BigInt, no shared helpers).
function reference(pp) {
  const th = pp.threshold_policy;
  const explained = new Set(pp.explanations.map((e) => e.account_id));
  const out = [];
  for (let i = 0; i < pp.accounts.length; i++) {
    const id = pp.accounts[i];
    const p = pp.prior_balances[i].minor_units;
    const c = pp.current_balances[i].minor_units;
    const mv = Math.abs(c - p);
    let breach;
    let bps = 'NOT_EVALUATED';
    if (p === 0) {
      if (th.zero_prior_rule === 'any_movement') breach = mv !== 0;
      else breach = th.abs_minor_units > 0 && mv >= th.abs_minor_units && true;
      if (th.zero_prior_rule === 'abs_only' && th.abs_minor_units === 0) breach = false;
    } else {
      bps = String(Math.floor((mv * 10000) / Math.abs(p)));
      const aOn = th.abs_minor_units > 0;
      const bOn = th.pct_bps > 0;
      const aHit = aOn && mv >= th.abs_minor_units;
      const bHit = bOn && mv * 10000 >= th.pct_bps * Math.abs(p);
      if (!aOn && !bOn) breach = false;
      else if (th.rule === 'both') breach = (!aOn || aHit) && (!bOn || bHit);
      else breach = aHit || bHit;
    }
    out.push({ id, mv, bps, breach, explained: explained.has(id) });
  }
  return out;
}

function checkOrder(cases) {
  let v = 0;
  for (const pp of cases) {
    const b = compute(pp).output_payload.breaches;
    for (let i = 1; i < b.length; i++) {
      const x = b[i - 1], y = b[i];
      const ok = x.abs_movement_minor_units > y.abs_movement_minor_units || (x.abs_movement_minor_units === y.abs_movement_minor_units && x.account_id < y.account_id);
      if (!ok) v++;
    }
    if (b.some((r, i) => r.rank !== i + 1)) v++;
  }
  return { name: 'P1_breach_order_stable', checked: cases.length, violations: v };
}

function checkUnexplained(cases) {
  let v = 0;
  for (const pp of cases) {
    const o = compute(pp).output_payload;
    const want = o.breaches.filter((b) => !o.accounts.find((a) => a.account_id === b.account_id).explanation_ids.length).map((b) => b.account_id);
    if (!deepEqual(want, o.unexplained_breaches)) v++;
  }
  return { name: 'P2_unexplained_equals_breaches_minus_explained', checked: cases.length, violations: v };
}

function checkGate(cases) {
  let v = 0;
  for (const pp of cases) {
    const o = compute(pp).output_payload;
    const blocked = o.unexplained_breaches.length > 0;
    if ((o.gate_status === 'blocked') !== blocked) v++;
    if (o.gate_status === 'clear' && o.breaches.length !== 0) v++;
    if (o.breaches.length === 0 && o.gate_status !== 'clear') v++;
    if (!blocked && o.breaches.length > 0 && o.gate_status !== 'review_required') v++;
  }
  return { name: 'P3_gate_blocked_iff_unexplained', checked: cases.length, violations: v };
}

function checkParity(cases) {
  let v = 0;
  for (const pp of cases) {
    const o = compute(pp).output_payload;
    const ref = reference(pp);
    for (const r of ref) {
      const row = o.accounts.find((a) => a.account_id === r.id);
      if (!row || row.breach !== r.breach || row.movement_bps !== r.bps || row.abs_movement_minor_units !== r.mv) v++;
    }
    const wantBreaches = ref.filter((r) => r.breach).map((r) => r.id).sort();
    if (!deepEqual(wantBreaches, o.breaches.map((b) => b.account_id).sort())) v++;
  }
  return { name: 'P4_independent_recompute_parity', checked: cases.length, violations: v };
}

function checkDeterminism(cases) {
  let v = 0;
  for (const pp of cases) {
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(JSON.parse(JSON.stringify(pp))))) v++;
  }
  return { name: 'P5_deterministic', checked: cases.length, violations: v };
}

function checkRefusals(rng) {
  let v = 0;
  let checked = 0;
  for (let i = 0; i < 100; i++) {
    const pp = genCase(rng);
    const kind = i % 4;
    if (kind === 0) pp.explanations.push(/** @type {any} */ ({ account_id: pp.accounts[0], explanation_id: 'C1', note: 'text' }));
    else if (kind === 1) pp.accounts.push('ACCT' + '123456789');
    else if (kind === 2) pp.explanations.push({ account_id: pp.accounts[0], explanation_id: 'UNDECLARED' });
    else delete pp.threshold_policy.zero_prior_rule;
    const r = compute(pp);
    checked++;
    if (!(r.compliance_flags.length === 1 && r.compliance_flags[0] === 'INPUT_REFUSED' && r.output_payload.gate_status === null)) v++;
  }
  return { name: 'P6_refusals_flag_and_no_gate', checked, violations: v };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const rng = mulberry32(840);
const cases = [];
for (let i = 0; i < N; i++) cases.push(genCase(rng));
const properties = [
  checkOrder(cases),
  checkUnexplained(cases),
  checkGate(cases),
  checkParity(cases),
  checkDeterminism(cases),
  checkRefusals(rng),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
