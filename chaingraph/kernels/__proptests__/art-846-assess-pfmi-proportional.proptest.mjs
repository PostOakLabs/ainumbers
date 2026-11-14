// art-846-assess-pfmi-proportional — class-K property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:be69ab19112e05d4429f68929527ac80e97eabea3e7ce35f90742b432cd8c8b3
// human_sign_off: builder-authored 2026-10-29 — synthetic inputs only.
//
// SCOPE: floor tier only. NOT a proof.
// float_sensitive: NO (counting/sorting logic only; coverage_pct is a rounded ratio).
// Checks: fixture-oracle gate, tier-map parity (kernel config vs the data file beside the kernel),
// termination/bounded scope, enum boundedness + gap-register ordering, rating-downgrade monotonicity
// (a worse rating never reduces the gap burden), invalid-domain rejection (REACHABLE refusals), and
// determinism. Zero external dependencies.
//
// Run: node chaingraph/kernels/__proptests__/art-846-assess-pfmi-proportional.proptest.mjs

import { compute, buildArtifact, buildTierMap } from '../art-846-assess-pfmi-proportional.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const KERNEL_ID = 'art-846-assess-pfmi-proportional';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x0781A);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TIERS = ['systemic', 'prominent', 'small'];
const SYSTEMS = ['payment_system', 'fast_payment_system', 'rtgs'];
const RATINGS = ['observed', 'broadly_observed', 'partly_observed', 'not_observed', 'not_applicable'];
const SEVERITY_RANK = { violation: 0, critical: 1, high: 2, moderate: 3 };
const TRIALS = 4000;

const TIER_MAP = buildTierMap();
function scopeFor(tier, systemType, linked) {
  return Object.keys(TIER_MAP.principles)
    .filter((id) => TIER_MAP.principles[id].cells[systemType][tier].value !== 'not_applicable')
    .concat(linked ? Object.keys(TIER_MAP.linked_fps_module) : []);
}
function randomOperatorCase(rng) {
  const tier = pick(rng, TIERS);
  const st = pick(rng, SYSTEMS);
  const linked = rng() < 0.3;
  const scope = scopeFor(tier, st, linked);
  const ratings = scope
    .filter(() => rng() < 0.9)
    .map((id) => {
      const entry = { id, rating: pick(rng, RATINGS) };
      if (rng() < 0.25) entry.target_date = String(2026 + Math.floor(rng() * 5)) + '-0' + (1 + Math.floor(rng() * 9)) + '-1' + Math.floor(rng() * 9);
      return entry;
    });
  return { role: 'operator', tier, system_type: st, linked_system: linked, ratings };
}

// ---------- P0: fixture oracle (scaffold harness) ----------

// ---------- P1: tier-map parity — kernel config rebuild deep-equals the data file beside the kernel ----------
function checkP1_tierMapParity() {
  const file = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-846-assess-pfmi-proportional.tier-map.json'), 'utf8'));
  const built = buildTierMap();
  const violations = JSON.stringify(built) === JSON.stringify(file) ? 0 : 1;
  return { name: 'P1_tier_map_parity_with_data_file', trials: 1, violations };
}

// ---------- P2: termination / bounded scope — scope size fixed by (tier, system_type, linked); summary sums to scope ----------
function checkP2_boundedScope() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const c = randomOperatorCase(rand);
    const { output_payload } = compute(c);
    const expected = scopeFor(c.tier, c.system_type, c.linked_system).length;
    checked++;
    if (output_payload.principles_in_scope.length !== expected) violations++;
    const s = output_payload.summary_by_rating;
    const sum = s.observed + s.broadly_observed + s.partly_observed + s.not_observed + s.not_applicable + s.unrated;
    if (sum !== expected) violations++;
  }
  return { name: 'P2_termination_bounded_scope', trials: checked, violations };
}

// ---------- P3: enum boundedness + ordering — severities in the 4-value set; register sorted by severity rank then id; plan by date ----------
function checkP3_enumAndOrdering() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const c = randomOperatorCase(rand);
    const { output_payload, compliance_flags } = compute(c);
    checked++;
    if (compliance_flags.includes('INPUT_REFUSED')) violations++;
    if (!(output_payload.coverage_pct >= 0 && output_payload.coverage_pct <= 100)) violations++;
    for (const g of output_payload.gap_register) {
      if (!(g.severity in SEVERITY_RANK)) { violations++; break; }
    }
    for (let j = 1; j < output_payload.gap_register.length; j++) {
      const a = output_payload.gap_register[j - 1];
      const b = output_payload.gap_register[j];
      if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[b.severity]) violations++;
      if (SEVERITY_RANK[a.severity] === SEVERITY_RANK[b.severity] && !(a.id < b.id)) violations++;
    }
    for (let j = 1; j < output_payload.action_plan.length; j++) {
      if (output_payload.action_plan[j - 1].target_date > output_payload.action_plan[j].target_date) violations++;
    }
  }
  return { name: 'P3_enum_boundedness_and_ordering', trials: checked, violations };
}

// ---------- P4: downgrade monotonicity — worsening one rating never reduces total severity burden or raises the worst severity ----------
function checkP4_downgradeMonotone() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const c = randomOperatorCase(rand);
    if (c.ratings.length === 0) continue;
    const base = compute(c).output_payload;
    const graded = c.ratings.filter((r) => r.rating !== 'not_applicable');
    if (graded.length === 0) continue; // property holds among graded levels only; n/a crossings are contract-defined, not monotone
    const j = c.ratings.indexOf(graded[Math.floor(rand() * graded.length)]);
    const worse = { ...c.ratings[j], rating: 'not_observed' };
    const c2 = { ...c, ratings: c.ratings.map((r, k) => (k === j ? worse : r)) };
    const after = compute(c2).output_payload;
    const burden = (out) => out.gap_register.reduce((t, g) => t + (4 - SEVERITY_RANK[g.severity]), 0); // higher = worse
    checked++;
    if (burden(after) < burden(base)) violations++;
    const worstBase = Math.min(...base.gap_register.map((g) => SEVERITY_RANK[g.severity]), 99);
    const worstAfter = Math.min(...after.gap_register.map((g) => SEVERITY_RANK[g.severity]), 99);
    if (worstAfter > worstBase) violations++;
  }
  return { name: 'P4_downgrade_monotonicity', trials: checked, violations };
}

// ---------- P5: invalid-domain rejection — every refusal branch is reachable and flags INPUT_REFUSED ----------
function checkP5_refusalsReachable() {
  let violations = 0, checked = 0;
  const bad = [
    { role: 'regulator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'ra', rating: 'observed' }] }, // ROLE_INVALID
    { role: 'operator', tier: 'huge', system_type: 'rtgs', ratings: [{ id: 'p01', rating: 'observed' }] }, // TIER_INVALID
    { role: 'operator', tier: 'small', system_type: 'chips', ratings: [{ id: 'p01', rating: 'observed' }] }, // SYSTEM_TYPE_INVALID
    { role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [] }, // RATINGS_MISSING
    { role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'p99', rating: 'observed' }] }, // RATING_ID_UNKNOWN
    { role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'p01', rating: 'mostly' }] }, // RATING_INVALID
    { role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'p01', rating: 'observed' }, { id: 'p01', rating: 'observed' }] }, // RATING_DUPLICATE
    { role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'p01', rating: 'observed', target_date: 'soon' }] }, // TARGET_DATE_INVALID
    { role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'fps_ownership', rating: 'observed' }] }, // module id without linked_system
    { role: 'authority', ratings: [{ id: 'p01', rating: 'observed' }] }, // principle id under authority role
  ];
  for (const pp of bad) {
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (!output_payload.error || !compliance_flags.includes('INPUT_REFUSED')) violations++;
  }
  return { name: 'P5_invalid_domain_rejections_reachable', trials: checked, violations };
}

// ---------- P6: determinism — identical pp, identical output bytes ----------
function checkP6_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const c = randomOperatorCase(rand);
    const a = JSON.stringify(compute(c));
    const b = JSON.stringify(compute(c));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P6_determinism', trials: checked, violations };
}

// ---------- P7: buildArtifact_never_throws + linked_system input contract ----------
// Unhashable input mints a null execution_hash with a hash_refusal beside it; a clean input gets a
// 64-hex hash. linked_system present but not a boolean refuses; only an absent key defaults.
async function checkP7_buildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  const base = () => ({ role: 'operator', tier: 'small', system_type: 'rtgs', ratings: [{ id: 'p01', rating: 'observed' }] });
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const hostile = [{ zzz: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide }];
  for (const delta of hostile) {
    checked++;
    try {
      const art = await buildArtifact({ ...base(), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) violations++;
      if (/e\+3\d\d|Infinity|9007199254740992/.test(JSON.stringify(r))) violations++;
      if (!art.compliance_flags.includes('INPUT_REFUSED')) violations++;
    } catch (e) { violations++; console.log('P7 violation: buildArtifact threw: ' + String(e.message).slice(0, 80)); }
  }
  for (const v of [null, '', 0, {}, 'true', 1, []]) {
    checked++;
    const { output_payload, compliance_flags } = compute({ ...base(), linked_system: v });
    if (output_payload.error !== 'linked_system_invalid' || !compliance_flags.includes('INPUT_REFUSED')) violations++;
  }
  for (const v of [true, false, undefined]) {
    checked++;
    const { compliance_flags } = compute({ ...base(), linked_system: v });
    if (compliance_flags.includes('INPUT_REFUSED')) violations++;
  }
  // target_date, when present, is a calendar-valid ISO string; null, arrays, numbers, '' and bad dates refuse.
  for (const v of ['2026-02-31', '2026-13-45', '0000-00-00', '2025-02-29', null, ['2026-06-30'], 20260630, '']) {
    checked++;
    const pp = base(); pp.ratings[0] = { id: 'p01', rating: 'not_observed', target_date: v };
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.error !== 'target_date_invalid' || !compliance_flags.includes('INPUT_REFUSED')) violations++;
  }
  for (const v of ['2028-02-29', '2000-02-29', undefined]) {
    checked++;
    const pp = base(); pp.ratings[0] = { id: 'p01', rating: 'not_observed', target_date: v };
    if (compute(pp).compliance_flags.includes('INPUT_REFUSED')) violations++;
  }
  for (const pp of [base(), null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) violations++;
    } catch (e) { violations++; console.log('P7 violation: threw on clean input: ' + String(e.message).slice(0, 80)); }
  }
  return { name: 'P7_buildArtifact_never_throws_and_linked_system_contract', trials: checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_tierMapParity(),
  checkP2_boundedScope(),
  checkP3_enumAndOrdering(),
  checkP4_downgradeMonotone(),
  checkP5_refusalsReachable(),
  checkP6_determinism(),
  await checkP7_buildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — authored 2026-10-29 (PFMI-PROPORTIONAL-SA-1).`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
