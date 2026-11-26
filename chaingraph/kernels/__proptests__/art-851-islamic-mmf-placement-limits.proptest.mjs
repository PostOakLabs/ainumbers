// art-851-islamic-mmf-placement-limits — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:e5682e41688ab0c7625e83bde9262669391b3f54744afdd1243aeafe18edb41f
// spec: ISLAMIC-FINANCE-BUILD-SPEC-2026-11 §7 and §9
// human_sign_off: PENDING
//
// Checks: fixture-oracle gate (every golden vector); P1 determinism and output shape;
// P2 headroom equals cap minus used for every limit; P3 exempt holdings never count toward
// concentration limits; P4 the maturity ladder conserves the total holding amount;
// P5 refusal contract (wrong type, null, float, unsafe integer, prototype name, identifier-like
// token, unsupported type, unpinned authority); P6 buildArtifact_never_throws on unhashable input.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-851-islamic-mmf-placement-limits.proptest.mjs

import { compute, buildArtifact } from '../art-851-islamic-mmf-placement-limits.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-851-islamic-mmf-placement-limits';
const SEED = 851;
const N = 240;
const hasOwnLocal = (o, k) => Object.hasOwn(o, k);
const TYPES = ['sama_money_market_transaction', 'debt_instrument', 'derivative', 'sama_regulated_deposit', 'public_mmf_units', 'fixed_income_fund_units'];

function randPortfolio(rng) {
  const nav = 1000000 + Math.floor(rng() * 9000000);
  const n = 1 + Math.floor(rng() * 8);
  const holdings = [];
  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rng() * TYPES.length)];
    const h = {
      instrument_type: type,
      issuer_token: 'iss_' + i,
      counterparty_token: 'cp_' + (i % 3),
      group_token: 'grp_' + (i % 4),
      amount_minor_units: 1000 + Math.floor(rng() * Math.floor(nav / 30)),
      remaining_maturity_days: Math.floor(rng() * 400),
    };
    if (rng() < 0.25) h.is_saudi_govt = true;
    if (rng() < 0.2) h.is_securitisation = true;
    if (type === 'derivative') { h.is_hedging_derivative = true; h.derivative_issuer_prudential = true; }
    holdings.push(h);
  }
  return { nav_minor_units: nav, liquid_minor_units: Math.floor(rng() * nav / 5), holdings };
}

function checkP1Determinism() {
  const rng = mulberry32(SEED + 1); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPortfolio(rng);
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const sv = findShapeViolations(a.output_payload);
    if (sv.length) { violations++; console.log('P1 violation: ' + sv[0]); }
    if (a.output_payload.not_a_shariah_ruling !== true) { violations++; console.log('P1 violation: missing no-ruling marker'); }
  }
  return { name: 'P1 determinism, shape and no-ruling marker', checked, violations };
}

function checkP2Headroom() {
  const rng = mulberry32(SEED + 2); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const o = compute(randPortfolio(rng)).output_payload;
    if (!o.valid_input) { violations++; console.log('P2 violation: valid portfolio refused: ' + o.domain_errors[0]); continue; }
    for (const l of o.limits) {
      checked++;
      if (l.unit === 'pct') {
        if (l.headroom_bp !== l.cap_bp - l.used_bp) { violations++; console.log('P2 violation: pct headroom on ' + l.id); }
        const expected = l.id === 'liquidity_10pct'
          ? (l.used_bp < l.cap_bp && o.liquidity_met_by_short_maturities !== true)
          : l.used_bp > l.cap_bp;
        if (l.breached !== expected) { violations++; console.log('P2 violation: breach flag on ' + l.id); }
      } else {
        if (l.headroom_scaled !== l.cap_scaled - l.used_scaled) { violations++; console.log('P2 violation: days headroom on ' + l.id); }
        if (l.breached !== (l.used_scaled > l.cap_scaled)) { violations++; console.log('P2 violation: breach flag on ' + l.id); }
      }
    }
  }
  return { name: 'P2 headroom equals cap minus used for every limit', checked, violations };
}

function checkP3ExemptNeverCounts() {
  const rng = mulberry32(SEED + 3); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPortfolio(rng);
    const exempt = pp.holdings.filter((h) => h.is_saudi_govt === true && h.instrument_type === 'debt_instrument');
    if (exempt.length === 0) continue;
    const kept = { ...pp, holdings: pp.holdings.filter((h) => !(h.is_saudi_govt === true && h.instrument_type === 'debt_instrument')) };
    if (kept.holdings.length === 0) continue;
    const a = compute(pp).output_payload, b = compute(kept).output_payload;
    if (!a.valid_input || !b.valid_input) continue;
    checked++;
    const ids = ['securitisation_10pct', 'single_issuer_10pct', 'single_counterparty_25pct', 'same_group_25pct'];
    for (const id of ids) {
      const la = a.limits.find((l) => l.id === id), lb = b.limits.find((l) => l.id === id);
      if (la.used_bp !== lb.used_bp) { violations++; console.log('P3 violation: exempt holding counted in ' + id); }
    }
  }
  return { name: 'P3 exempt holdings never count toward concentration limits', checked, violations };
}

function checkP4LadderConserves() {
  const rng = mulberry32(SEED + 4); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randPortfolio(rng);
    const o = compute(pp).output_payload;
    if (!o.valid_input) continue;
    checked++;
    const total = pp.holdings.reduce((s, h) => s + BigInt(h.amount_minor_units), 0n);
    const ladder = o.placement_ladder.reduce((s, b) => s + BigInt(b.amount_minor_units), 0n);
    if (total !== ladder) { violations++; console.log('P4 violation: ladder does not conserve amount'); }
    const counts = o.placement_ladder.reduce((s, b) => s + b.holdings, 0);
    if (counts !== pp.holdings.length) { violations++; console.log('P4 violation: ladder does not conserve holding count'); }
  }
  return { name: 'P4 maturity ladder conserves amount and count', checked, violations };
}

function checkP5Refusals() {
  const base = randPortfolio(mulberry32(SEED + 5));
  let checked = 0, violations = 0;
  for (const bad of [null, undefined, 5, 'x', [], true]) {
    checked++;
    const o = compute(bad).output_payload;
    if (o.valid_input !== false || !/^REFUSED_INPUT_WRONG_TYPE/.test(o.domain_errors[0])) { violations++; console.log('P5 violation: non-object not refused'); }
  }
  const deltas = [
    { nav_minor_units: null }, { nav_minor_units: 1000000.5 },
    { nav_minor_units: Number.MAX_SAFE_INTEGER + 2 }, { nav_minor_units: '1000000' },
    { liquid_minor_units: -1 }, { holdings: [] },
    { authority: 'sc_malaysia' },
  ];
  for (const delta of deltas) {
    checked++;
    const o = compute({ ...base, ...delta }).output_payload;
    if (o.valid_input !== false || o.refusal_code === null) { violations++; console.log('P5 violation: accepted ' + JSON.stringify(delta)); }
  }
  for (const key of ['authority', 'liquid_minor_units', 'wal_days']) {
    checked++;
    const absent = { ...base };
    if (hasOwnLocal(absent, key)) delete absent[key];
    const explicitNull = { ...absent, [key]: null };
    if (JSON.stringify(compute(absent).output_payload) !== JSON.stringify(compute(explicitNull).output_payload)) {
      violations++; console.log('P5 violation: null form differs from absent form for ' + key);
    }
  }
  for (const token of ['issuer_token', 'counterparty_token', 'group_token']) {
    for (const value of ['SA123456789', 'constructor', '__proto__', 7, null]) {
      checked++;
      const holdings = [{ ...base.holdings[0], [token]: value }];
      const o = compute({ ...base, holdings }).output_payload;
      if (o.valid_input !== false) { violations++; console.log('P5 violation: accepted token ' + token + '=' + String(value)); }
    }
  }
  checked++;
  const proto = JSON.parse(JSON.stringify(base).slice(0, -1) + ',"constructor":5,"toString":"x","__proto__":{"nav_minor_units":9}}');
  if (JSON.stringify(compute(proto).output_payload) !== JSON.stringify(compute(base).output_payload)) {
    violations++; console.log('P5 violation: prototype-name keys changed the output');
  }
  return { name: 'P5 refusal contract and prototype-name keys', checked, violations };
}

async function checkP6BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const rng = mulberry32(SEED + 6);
  for (const delta of [{ zzz: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide }]) {
    checked++;
    try {
      const art = await buildArtifact({ ...randPortfolio(rng), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log('P6 violation: artifact shape'); }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P6 violation: compute accepted hostile input'); }
    } catch (e) { violations++; console.log('P6 violation: buildArtifact threw: ' + String(e && e.message).slice(0, 80)); }
  }
  for (const pp of [randPortfolio(rng), null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P6 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log('P6 violation: buildArtifact threw on clean input: ' + String(e && e.message).slice(0, 80)); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
}

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1Determinism(), checkP2Headroom(), checkP3ExemptNeverCounts(), checkP4LadderConserves(),
  checkP5Refusals(), await checkP6BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
