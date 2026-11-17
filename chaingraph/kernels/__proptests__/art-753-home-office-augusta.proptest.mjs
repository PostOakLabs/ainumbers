// art-753-home-office-augusta -- class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// Authored against the APEXPORT-139 porting payload (GRADES PASS-PENDING-XV 2026-10-07) and the
// 7F adjudication (APEX-DIFFER-RULING-1 2026-11-02; confirmed 2026-11-13): DIFFERS-04 official wins,
// DIFFERS-06 corporate deduction retained and flagged as a disclosed open legal question.
// kernel_digest_at_authoring: sha256:6d83f8dc0cf5f4459dea7103f7ef5666695670004ec94a3efba9dcf4d0edc3b1
// spec: board/claimed/APEX-PORT-139-LAND-RESUME-1.md (SPEC.md section 12 compute binding, section 17 kernel identity)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: YES -- the core is IEEE-754 dollars exactly as the Apex page computes it.
//
// Checks: fixture-oracle gate (39 vectors: 7 live Apex-page cases, 32 boundary/past vectors);
// P1 the best home-office deduction is never below the regular deduction when the simplified
// method is selectable, and equals the regular deduction when it is not (S-corp gate);
// P2 the S-corp owner-employee gate: simplified_method_selectable is false and the method is
// Regular for every entity_type_ho === 'scorp' input; P3 the gross-income cap bounds both
// methods for non-negative inputs; P4 Augusta: days > 14 yields zero tax-free income, zero
// deduction and zero benefit; the corporate-deduction flag fires exactly when scorp and
// qualifying; P5 determinism and no undefined/non-finite in output_payload; P6 non-finite
// inputs are refused with the named reason and the single refusal flag; P7 buildArtifact
// returns a 64-hex execution_hash; P8 buildArtifact_never_throws on any input, an unhashable
// preimage mints execution_hash null plus hash_refusal; P9 a wrong-typed numeric or an unlisted
// entity is refused with its own code, never coerced.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-753-home-office-augusta.proptest.mjs

import { compute, buildArtifact } from '../art-753-home-office-augusta.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-753-home-office-augusta';

const basePP = () => ({
  office_sq_ft: 200, home_sq_ft: 1800, business_use_pct: null,
  annual_rent_usd: 24000, utilities_usd: 3600, other_home_expenses_usd: 1200,
  gross_business_income_usd: 120000, entity_type_ho: 'soleProp',
  rental_days: 14, daily_rental_rate_usd: 800, corp_tax_rate_pct: 37,
  entity_type_aug: 'scorp', owner_marginal_rate_pct: 32,
});

function jitterPP(rng) {
  const pp = basePP();
  pp.office_sq_ft = 1 + Math.floor(rng() * 500);
  pp.home_sq_ft = 500 + Math.floor(rng() * 4000);
  pp.annual_rent_usd = Math.floor(rng() * 60000);
  pp.utilities_usd = Math.floor(rng() * 8000);
  pp.other_home_expenses_usd = Math.floor(rng() * 5000);
  pp.gross_business_income_usd = 1 + Math.floor(rng() * 250000);
  pp.entity_type_ho = pick(rng, ['soleProp', 'scorp']);
  pp.entity_type_aug = pick(rng, ['soleProp', 'scorp']);
  pp.rental_days = Math.floor(rng() * 30);
  pp.daily_rental_rate_usd = 1 + Math.floor(rng() * 2000);
  pp.corp_tax_rate_pct = 1 + Math.floor(rng() * 40);
  pp.owner_marginal_rate_pct = 1 + Math.floor(rng() * 40);
  return pp;
}

const out = (pp) => compute(pp).output_payload;

// P1 -- best method is the larger candidate when selectable, the regular one when not.
function checkP1BestMethod() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75301);
  for (let i = 0; i < 60; i++) {
    const o = out(jitterPP(rng));
    checked++;
    const expected = o.simplified_method_selectable ? Math.max(o.regular_deduction_usd, o.simplified_deduction_usd) : o.regular_deduction_usd;
    if (o.best_home_office_deduction_usd !== expected) { violations++; console.log(`P1 violation: best ${o.best_home_office_deduction_usd} != ${expected}`); }
  }
  return { name: 'P1 best deduction = max(selectable candidates)', checked, violations };
}

// P2 -- DIFFERS-04: an S-corp owner-employee never gets the simplified method.
function checkP2ScorpGate() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75302);
  for (let i = 0; i < 40; i++) {
    const pp = { ...jitterPP(rng), entity_type_ho: 'scorp' };
    const o = out(pp);
    checked++;
    if (o.simplified_method_selectable !== false || o.best_home_office_method !== 'Regular') { violations++; console.log('P2 violation: scorp got simplified'); }
    const so = out({ ...pp, entity_type_ho: 'soleProp' });
    checked++;
    if (so.simplified_method_selectable !== true) { violations++; console.log('P2 violation: soleProp lost simplified'); }
  }
  return { name: 'P2 S-corp owner-employee gate (DIFFERS-04)', checked, violations };
}

// P3 -- gross-income cap bounds both methods (DIFFERS-01), non-negative inputs.
function checkP3GrossCap() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75303);
  for (let i = 0; i < 60; i++) {
    const o = out(jitterPP(rng));
    checked += 2;
    if (o.regular_deduction_usd > o.gross_business_income_usd) { violations++; console.log('P3 violation: regular above cap'); }
    if (o.simplified_deduction_usd > o.gross_business_income_usd) { violations++; console.log('P3 violation: simplified above cap'); }
  }
  return { name: 'P3 gross-income cap bounds both methods', checked, violations };
}

// P4 -- Augusta: past 14 days nothing is excluded or deducted; the disclosure flag tracks scorp + qualifying.
function checkP4Augusta() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75304);
  for (let i = 0; i < 60; i++) {
    const pp = jitterPP(rng);
    const r = compute(pp);
    const o = r.output_payload;
    const flag = r.compliance_flags.includes('ART753_CORP_DEDUCTION_BARRED_TEXT_280A_G_1');
    const want = pp.entity_type_aug === 'scorp' && pp.rental_days <= 14;
    checked += 2;
    if (flag !== want) { violations++; console.log('P4 violation: open-question flag mismatch'); }
    if (o.qualifies_280a_g_day_test === false && (o.augusta_tax_free_income_usd !== 0 || o.augusta_corp_deduction_usd !== 0 || o.augusta_tax_benefit_usd !== 0)) { violations++; console.log('P4 violation: benefit past 14 days'); }
  }
  return { name: 'P4 Augusta 14-day boundary and open-question flag (DIFFERS-06)', checked, violations };
}

// P5 -- determinism + shape.
function checkP5DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(75305);
  for (let i = 0; i < 40; i++) {
    const pp = jitterPP(rng);
    const a = compute(pp), b = compute(pp);
    checked += 2;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P5 violation: non-deterministic'); }
    const v = findShapeViolations(a.output_payload);
    if (v.length) { violations++; console.log('P5 violation: ' + v[0]); }
  }
  return { name: 'P5 determinism and no undefined/non-finite', checked, violations };
}

// P6 -- non-finite inputs are refused by name, never propagated (DIFFERS-07).
function checkP6Refusal() {
  let checked = 0, violations = 0;
  for (const key of ['annual_rent_usd', 'utilities_usd', 'gross_business_income_usd', 'daily_rental_rate_usd', 'office_sq_ft']) {
    for (const bad of [Infinity, -Infinity]) {
      const r = compute({ ...basePP(), [key]: bad });
      checked++;
      if (r.output_payload.refusal_reason !== 'REFUSED_NON_FINITE_INPUT' || r.compliance_flags.length !== 1 || r.compliance_flags[0] !== 'ART753_INPUT_REFUSED' || r.output_payload.combined_tax_benefit_usd !== null) {
        violations++; console.log(`P6 violation: ${key}=${bad} not refused`);
      }
    }
  }
  return { name: 'P6 non-finite inputs refused by name', checked, violations };
}

// P7 -- the artifact carries a canonical execution hash.
async function checkP7Artifact() {
  let checked = 0, violations = 0;
  const art = await buildArtifact(basePP());
  checked++;
  if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.tool_id !== KERNEL_ID) { violations++; console.log('P7 violation: artifact shape'); }
  return { name: 'P7 buildArtifact carries a 64-hex execution_hash', checked, violations };
}

// P8 -- buildArtifact_never_throws: hostile inputs mint an artifact; an unhashable preimage
// carries execution_hash null plus hash_refusal.
async function checkP8NeverThrows() {
  let checked = 0, violations = 0;
  const deep = (n) => { let o = null; for (let i = 0; i < n; i++) o = [o]; return o; };
  const cyc = {}; cyc.self = cyc;
  const hostile = [undefined, null, 0, 'x', [], {}, { ...basePP(), extra: deep(600) }, { ...basePP(), extra: cyc }, { ...basePP(), extra: 1n }, { ...basePP(), extra: Number.MAX_SAFE_INTEGER * 4 }, { ...basePP(), extra: NaN }, { ...basePP(), office_sq_ft: 'a' }];
  for (const pp of hostile) {
    checked++;
    try {
      const a = await buildArtifact(pp);
      const hashed = /^[0-9a-f]{64}$/.test(a.execution_hash || '');
      const refused = a.execution_hash === null && a.hash_refusal && typeof a.hash_refusal.reason === 'string';
      if (!hashed && !refused) { violations++; console.log('P8 violation: neither hash nor hash_refusal'); }
    } catch (e) { violations++; console.log('P8 violation: threw ' + String((e && e.message) || e)); }
  }
  return { name: 'P8 buildArtifact_never_throws', checked, violations };
}

// P9 -- typed refusal: no Number() coercion on caller numerics, exact entity allowlist.
function checkP9TypedRefusal() {
  let checked = 0, violations = 0;
  const numeric = ['office_sq_ft', 'home_sq_ft', 'business_use_pct', 'annual_rent_usd', 'utilities_usd', 'other_home_expenses_usd', 'gross_business_income_usd', 'rental_days', 'daily_rental_rate_usd', 'corp_tax_rate_pct', 'owner_marginal_rate_pct'];
  for (const f of numeric) {
    for (const bad of ['5', '', true, [1], {}]) {
      const r = compute({ ...basePP(), [f]: bad });
      checked++;
      if (r.output_payload.refusal_reason !== 'REFUSED_WRONG_TYPE_' + f.toUpperCase() || r.output_payload.combined_tax_benefit_usd !== null) { violations++; console.log('P9 violation: ' + f + ' wrong type not refused'); }
    }
  }
  for (const [f, code] of [['entity_type_ho', 'REFUSED_ENTITY_TYPE_HO_NOT_ALLOWED'], ['entity_type_aug', 'REFUSED_ENTITY_TYPE_AUG_NOT_ALLOWED']]) {
    for (const bad of ['llc', 'SCORP', 'scorp ', '', 1, null, undefined, true, {}]) {
      const r = compute({ ...basePP(), [f]: bad });
      checked++;
      if (r.output_payload.refusal_reason !== code) { violations++; console.log('P9 violation: ' + f + ' unlisted value not refused'); }
    }
  }
  return { name: 'P9 typed refusal, exact entity allowlist', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1BestMethod(),
  checkP2ScorpGate(),
  checkP3GrossCap(),
  checkP4Augusta(),
  checkP5DeterminismShape(),
  checkP6Refusal(),
  await checkP7Artifact(),
  await checkP8NeverThrows(),
  checkP9TypedRefusal(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
