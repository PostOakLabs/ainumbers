// art-856-ijarah-imbt-schedule — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:cfa22c770322cabb01b638a8453fab7c1d326e9e72cab595dcad7ec5b3af1e3f
// spec: ISLAMIC-FINANCE-BUILD-SPEC-2026-11 §4 and §9
// human_sign_off: PENDING
//
// Checks: fixture-oracle gate (every golden vector); P1 determinism and output shape;
// P2 every benchmark-determined rental row sits within [floor, cap] and its clamp flags
// agree with the bound that bound it; P3 a total loss with no proven lessee fault stops
// rent from the loss month and a proven fault keeps rent running with restoration on the
// lessee; P4 schedule totals conserve (payable plus stopped equals scheduled, no negative
// rows); P5 refusal contract (wrong type, null, float, unsafe integer, prototype-name keys,
// unpinned authority, null equals absent); P6 buildArtifact_never_throws on unhashable input.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-856-ijarah-imbt-schedule.proptest.mjs

import { compute, buildArtifact } from '../art-856-ijarah-imbt-schedule.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-856-ijarah-imbt-schedule';
const SEED = 856;
const N = 240;
const hasOwnLocal = (o, k) => Object.hasOwn(o, k);
const BASES = ['fixed', 'benchmark', 'hybrid'];
const MODES = ['sale', 'conditional_hibah', 'wad_to_hibah'];
const EXCEPTIONS = ['not_offered', 'rejected_by_all_operators', 'more_competitive_cost'];

/** @param {function} rng */
function randSchedule(rng) {
  const tenor = 6 + Math.floor(rng() * 30);
  const basis = BASES[Math.floor(rng() * BASES.length)];
  const pp = {
    asset_cost_minor_units: 10000000 + Math.floor(rng() * 90000000),
    tenor_months: tenor,
    rental_basis: basis,
    margin_bp: Math.floor(rng() * 600),
    takaful_minor_units_per_month: 5000 + Math.floor(rng() * 40000),
    transfer_mode: MODES[Math.floor(rng() * MODES.length)],
  };
  if (pp.transfer_mode === 'sale') pp.transfer_price_minor_units = Math.floor(rng() * 5000000);
  if (rng() < 0.5) pp.maintenance_minor_units_per_month = Math.floor(rng() * 30000);
  if (basis === 'benchmark' || basis === 'hybrid') {
    pp.benchmark_path_bp = [];
    for (let i = 0; i < tenor; i++) pp.benchmark_path_bp.push(Math.floor(rng() * 900));
    pp.floor_rental_minor_units = 100000 + Math.floor(rng() * 100000);
    pp.cap_rental_minor_units = pp.floor_rental_minor_units + 50000 + Math.floor(rng() * 300000);
  }
  if (basis === 'hybrid') pp.fixed_component_minor_units = Math.floor(rng() * 200000);
  if (rng() < 0.3) {
    pp.total_loss_month = 1 + Math.floor(rng() * (tenor - 1));
    pp.takaful_recovery_minor_units = Math.floor(rng() * pp.asset_cost_minor_units);
    if (rng() < 0.5) pp.lessee_fault = true;
  }
  return pp;
}

function checkP1Determinism() {
  const rng = mulberry32(SEED + 1); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randSchedule(rng);
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const sv = findShapeViolations(a.output_payload);
    if (sv.length) { violations++; console.log('P1 violation: ' + sv[0]); }
    if (a.output_payload.not_a_shariah_ruling !== true) { violations++; console.log('P1 violation: missing no-ruling marker'); }
    if (a.output_payload.schedule.length !== pp.tenor_months) { violations++; console.log('P1 violation: schedule row count'); }
  }
  return { name: 'P1 determinism, shape and no-ruling marker', checked, violations };
}

function checkP2BoundsAndClampFlags() {
  const rng = mulberry32(SEED + 2); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randSchedule(rng);
    if (pp.rental_basis === 'fixed') continue;
    const o = compute(pp).output_payload;
    if (!o.valid_input) { violations++; console.log('P2 violation: valid benchmark input refused: ' + o.domain_errors[0]); continue; }
    checked++;
    const floor = BigInt(pp.floor_rental_minor_units), cap = BigInt(pp.cap_rental_minor_units);
    for (const row of o.schedule) {
      const component = pp.rental_basis === 'hybrid'
        ? BigInt(row.rental_minor_units) - BigInt(pp.fixed_component_minor_units)
        : BigInt(row.rental_minor_units);
      if (component < floor || component > cap) { violations++; console.log('P2 violation: month ' + row.month + ' outside bounds'); }
      if (row.clamped_to_floor && component !== floor) { violations++; console.log('P2 violation: floor flag without binding'); }
      if (row.clamped_to_cap && component !== cap) { violations++; console.log('P2 violation: cap flag without binding'); }
      if (!row.clamped_to_floor && !row.clamped_to_cap && row.benchmark_bp === null) { violations++; console.log('P2 violation: benchmark row lost its path value'); }
    }
    const sawFloor = o.schedule.some((r) => r.clamped_to_floor), sawCap = o.schedule.some((r) => r.clamped_to_cap);
    if (sawFloor !== o.warnings.includes('RENTAL_CLAMPED_FLOOR')) { violations++; console.log('P2 violation: floor flag mirror'); }
    if (sawCap !== o.warnings.includes('RENTAL_CLAMPED_CAP')) { violations++; console.log('P2 violation: cap flag mirror'); }
  }
  return { name: 'P2 benchmark rentals within floor and cap with agreeing clamp flags', checked, violations };
}

function checkP3LossSemantics() {
  const rng = mulberry32(SEED + 3); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randSchedule(rng);
    if (!hasOwnLocal(pp, 'total_loss_month')) continue;
    const o = compute(pp).output_payload;
    if (!o.valid_input) { violations++; console.log('P3 violation: valid loss input refused: ' + o.domain_errors[0]); continue; }
    checked++;
    const fault = pp.lessee_fault === true;
    if (o.total_loss.lessee_fault !== fault) { violations++; console.log('P3 violation: fault echo'); }
    if (o.total_loss.rent_stops_from_loss_month !== !fault) { violations++; console.log('P3 violation: rent-stop direction'); }
    if (o.total_loss.restoration_borne_by !== (fault ? 'lessee' : 'lessor')) { violations++; console.log('P3 violation: restoration bearer'); }
    for (const row of o.schedule) {
      const stops = !fault && row.month >= pp.total_loss_month;
      if (stops && row.rental_due_minor_units !== '0') { violations++; console.log('P3 violation: rent paid after no-fault loss month ' + row.month); }
      if (!stops && row.rental_due_minor_units !== row.rental_minor_units) { violations++; console.log('P3 violation: due differs from scheduled on a live month'); }
    }
  }
  return { name: 'P3 no-fault loss stops rent from the loss month; fault keeps rent running', checked, violations };
}

function checkP4TotalsConserve() {
  const rng = mulberry32(SEED + 4); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randSchedule(rng);
    const o = compute(pp).output_payload;
    if (!o.valid_input) continue;
    checked++;
    let scheduled = 0n, due = 0n, maint = 0n, prot = 0n;
    for (const row of o.schedule) {
      scheduled += BigInt(row.rental_minor_units);
      due += BigInt(row.rental_due_minor_units);
      maint += BigInt(row.lessor_maintenance_minor_units);
      prot += BigInt(row.lessor_protection_minor_units);
    }
    if (scheduled !== BigInt(o.totals.scheduled_rentals_minor_units)) { violations++; console.log('P4 violation: scheduled total'); }
    if (due !== BigInt(o.totals.payable_rentals_minor_units)) { violations++; console.log('P4 violation: payable total'); }
    if (maint !== BigInt(o.totals.lessor_maintenance_total_minor_units)) { violations++; console.log('P4 violation: maintenance total'); }
    if (prot !== BigInt(o.totals.lessor_protection_total_minor_units)) { violations++; console.log('P4 violation: protection total'); }
    if (BigInt(o.totals.payable_rentals_minor_units) > BigInt(o.totals.scheduled_rentals_minor_units)) { violations++; console.log('P4 violation: payable exceeds scheduled'); }
    const perProtection = BigInt(pp.takaful_minor_units_per_month);
    if (prot !== perProtection * BigInt(pp.tenor_months)) { violations++; console.log('P4 violation: protection line not per month'); }
  }
  return { name: 'P4 schedule totals conserve the monthly rows', checked, violations };
}

function checkP5Refusals() {
  const base = randSchedule(mulberry32(SEED + 5));
  if ((base.rental_basis === 'benchmark' || base.rental_basis === 'hybrid') === false) {
    base.rental_basis = 'fixed'; delete base.benchmark_path_bp; delete base.floor_rental_minor_units; delete base.cap_rental_minor_units; delete base.fixed_component_minor_units;
  }
  let checked = 0, violations = 0;
  for (const bad of [null, undefined, 5, 'x', [], true]) {
    checked++;
    const o = compute(bad).output_payload;
    if (o.valid_input !== false || !/^REFUSED_INPUT_WRONG_TYPE/.test(o.domain_errors[0])) { violations++; console.log('P5 violation: non-object not refused'); }
  }
  const deltas = [
    { asset_cost_minor_units: null }, { asset_cost_minor_units: 100000000.5 },
    { asset_cost_minor_units: Number.MAX_SAFE_INTEGER + 2 }, { tenor_months: 0 },
    { tenor_months: 361 }, { rental_basis: 'indexed' }, { transfer_mode: 'gift' },
    { margin_bp: -1 }, { authority: 'aaoifi' },
    { conventional_insurance_exception: 'not_offered' },
    { rental_revisions: [{ month: 3, rental_minor_units: 999999 }] },
    { wad_purchase_trigger: 'voluntary_early_purchase' },
  ];
  for (const delta of deltas) {
    checked++;
    const o = compute({ ...base, ...delta }).output_payload;
    if (o.valid_input !== false || o.refusal_code === null) { violations++; console.log('P5 violation: accepted ' + JSON.stringify(delta)); }
  }
  for (const key of ['maintenance_minor_units_per_month', 'takaful_minor_units_per_month', 'total_loss_month',
    'lessee_fault', 'takaful_recovery_minor_units', 'wad_purchase_trigger', 'rental_revisions',
    'mutual_revision_agreed', 'conventional_insurance_exception', 'insurance_minor_units_per_month']) {
    checked++;
    const absent = { ...base };
    if (hasOwnLocal(absent, key)) delete absent[key];
    const explicitNull = { ...absent, [key]: null };
    if (JSON.stringify(compute(absent).output_payload) !== JSON.stringify(compute(explicitNull).output_payload)) {
      violations++; console.log('P5 violation: null form differs from absent form for ' + key);
    }
  }
  checked++;
  const proto = JSON.parse(JSON.stringify(base).slice(0, -1) + ',"constructor":5,"toString":"x","__proto__":{"asset_cost_minor_units":9}}');
  if (JSON.stringify(compute(proto).output_payload) !== JSON.stringify(compute(base).output_payload)) {
    violations++; console.log('P5 violation: prototype-name keys changed the output');
  }
  checked++;
  const noTakaful = { ...base };
  delete noTakaful.takaful_minor_units_per_month;
  if (compute(noTakaful).output_payload.refusal_code !== 'REFUSED_TAKAFUL_MISSING') { violations++; console.log('P5 violation: missing takaful not refused'); }
  return { name: 'P5 refusal contract, null-equals-absent, prototype-name keys', checked, violations };
}

async function checkP6BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const rng = mulberry32(SEED + 6);
  for (const delta of [{ zzz: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide }]) {
    checked++;
    try {
      const art = await buildArtifact({ ...randSchedule(rng), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log('P6 violation: artifact shape'); }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P6 violation: compute accepted hostile input'); }
    } catch (e) { violations++; console.log('P6 violation: buildArtifact threw: ' + String(e && e.message).slice(0, 80)); }
  }
  for (const pp of [randSchedule(rng), null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (/^[0-9a-f]{64}$/.test(String(art.execution_hash)) === (art.execution_hash === null)) { violations++; console.log('P6 violation: clean input lost its hash'); }
      if (art.execution_hash === null && !art.hash_refusal) { violations++; console.log('P6 violation: null hash without refusal'); }
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
  checkP1Determinism(), checkP2BoundsAndClampFlags(), checkP3LossSemantics(), checkP4TotalsConserve(),
  checkP5Refusals(), await checkP6BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
