// art-847-cashleg-window-exposure -- class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:f6b6083f08783b09c31d60bfb2b53d3071d81e19741d4f968f05d0633973eb71
// spec: CASHLEG-WINDOW-EXPOSURE-NODE-1 (RESUME-1 premise corrections)
// human_sign_off: PENDING
//
// Checks: fixture-oracle gate (every golden vector); P1 determinism and no undefined or
// non-finite value in output_payload; P2 verdict and exposure agree (ATOMIC_POSSIBLE iff
// exposure 0, exposure never negative, next window open never before the token leg);
// P3 exposure_principal_seconds equals principal x exposure_seconds exactly;
// P4 carry is non-decreasing in the funding rate, zero at rate 0, and within half a minor
// unit of the exact quotient (half-even); P5 a Fedwire-shaped weekday calendar never opens
// on a declared holiday business day and always opens at 21:00 ET (UTC 01:00 or 02:00);
// P6 refusal contract (wrong type, float, null, prototype-name keys ignored);
// P7 buildArtifact_never_throws on inputs the shared canonicalizer cannot hash.
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-847-cashleg-window-exposure.proptest.mjs

import { compute, buildArtifact } from '../art-847-cashleg-window-exposure.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-847-cashleg-window-exposure';
const SEED = 847;
const N = 300;

const iso = (s) => new Date(s * 1000).toISOString().slice(0, 19) + 'Z';
const T0 = Date.UTC(2026, 0, 5) / 1000;

function fedwire() {
  return {
    rail_id: 'fedwire-funds-service', calendar_version: 'pt', source_pin: 'pt',
    covers_from: '2026-01-01', covers_to: '2027-12-31',
    window_rules: [{ weekdays: [1, 2, 3, 4, 5], open_day_offset: -1, open_local: '21:00', close_day_offset: 0, close_local: '19:00' }],
    utc_offset_segments: [
      { from_date: '2026-01-01', to_date: '2026-03-07', offset_minutes: -300 },
      { from_date: '2026-03-08', to_date: '2026-10-31', offset_minutes: -240 },
      { from_date: '2026-11-01', to_date: '2027-03-13', offset_minutes: -300 },
      { from_date: '2027-03-14', to_date: '2027-11-06', offset_minutes: -240 },
      { from_date: '2027-11-07', to_date: '2027-12-31', offset_minutes: -300 },
    ],
    holidays: ['2026-01-19', '2026-02-16', '2026-05-25', '2026-09-07', '2026-11-26', '2026-12-25'],
  };
}
const randPrincipal = (rng) => String(1 + Math.floor(rng() * 1e12));
function randDirect(rng) {
  const t = T0 + Math.floor(rng() * 20 * 86400);
  const ws = [];
  let cur = t - Math.floor(rng() * 3 * 86400);
  const n = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const open = cur + Math.floor(rng() * 2 * 86400);
    const close = open + 1 + Math.floor(rng() * 40000);
    ws.push({ open_utc: iso(open), close_utc: iso(close) });
    cur = close;
  }
  const pp = { token_leg_time: iso(t), as_of: iso(t), principal_minor_units: randPrincipal(rng), cash_leg_open_windows: ws, horizon_days: 1 + Math.floor(rng() * 10) };
  if (rng() < 0.7) pp.funding_rate_bp = Math.floor(rng() * 2000);
  return pp;
}
function randFedwire(rng) {
  const t = T0 + Math.floor(rng() * 300 * 86400);
  return { token_leg_time: iso(t), as_of: iso(t), principal_minor_units: randPrincipal(rng), rail_calendar: fedwire() };
}

function checkP1Determinism() {
  const rng = mulberry32(SEED + 1); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = i % 2 ? randDirect(rng) : randFedwire(rng);
    const a = compute(pp), b = compute(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; console.log('P1 violation: nondeterministic'); }
    const sv = findShapeViolations(a.output_payload);
    if (sv.length) { violations++; console.log('P1 violation: ' + sv[0]); }
  }
  return { name: 'P1 determinism and output shape', checked, violations };
}

function checkP2VerdictExposure() {
  const rng = mulberry32(SEED + 2); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = i % 2 ? randDirect(rng) : randFedwire(rng);
    const o = compute(pp).output_payload;
    checked++;
    if (!o.valid_input) { violations++; console.log('P2 violation: valid input refused ' + o.domain_errors[0]); continue; }
    if (o.verdict === 'NO_WINDOW_IN_HORIZON') {
      if (o.exposure_seconds !== null || o.next_cash_window_open !== null) { violations++; console.log('P2 violation: null window carries a value'); }
      continue;
    }
    const t = Date.parse(pp.token_leg_time) / 1000, nx = Date.parse(o.next_cash_window_open) / 1000;
    if (o.exposure_seconds < 0 || nx - t !== o.exposure_seconds) { violations++; console.log('P2 violation: exposure does not equal next open minus token'); }
    if ((o.verdict === 'ATOMIC_POSSIBLE') !== (o.exposure_seconds === 0)) { violations++; console.log('P2 violation: verdict and exposure disagree'); }
    if (o.exposure_seconds === 0 && o.crosses_weekend !== false) { violations++; console.log('P2 violation: zero exposure crosses a weekend'); }
  }
  return { name: 'P2 verdict, exposure and next open agree', checked, violations };
}

function checkP3PrincipalSeconds() {
  const rng = mulberry32(SEED + 3); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = i % 2 ? randDirect(rng) : randFedwire(rng);
    const o = compute(pp).output_payload;
    if (!o.valid_input || o.exposure_seconds === null) continue;
    checked++;
    if (o.exposure_principal_seconds !== (BigInt(pp.principal_minor_units) * BigInt(o.exposure_seconds)).toString()) { violations++; console.log('P3 violation: principal-seconds product'); }
  }
  return { name: 'P3 exposure_principal_seconds is the exact product', checked, violations };
}

function checkP4Carry() {
  const rng = mulberry32(SEED + 4); let checked = 0, violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randDirect(rng);
    const lo = Math.floor(rng() * 1000), hi = lo + Math.floor(rng() * 1000);
    const a = compute({ ...pp, funding_rate_bp: lo }).output_payload;
    const b = compute({ ...pp, funding_rate_bp: hi }).output_payload;
    const z = compute({ ...pp, funding_rate_bp: 0 }).output_payload;
    if (a.exposure_seconds === null) { checked++; if (a.carry_cost_minor_units !== null) { violations++; console.log('P4 violation: carry without window'); } continue; }
    checked++;
    if (BigInt(a.carry_cost_minor_units) > BigInt(b.carry_cost_minor_units)) { violations++; console.log('P4 violation: carry decreased with rate'); }
    if (z.carry_cost_minor_units !== '0') { violations++; console.log('P4 violation: zero rate carries cost'); }
    const num = BigInt(pp.principal_minor_units) * BigInt(a.exposure_seconds) * BigInt(lo), den = 10000n * 31536000n;
    const c = BigInt(a.carry_cost_minor_units);
    if (2n * c * den < 2n * num - den || 2n * c * den > 2n * num + den) { violations++; console.log('P4 violation: carry not within half a unit of the exact quotient'); }
  }
  return { name: 'P4 carry monotone in rate, zero at zero, within half a unit', checked, violations };
}

function checkP5FedwireShape() {
  const rng = mulberry32(SEED + 5); let checked = 0, violations = 0;
  const hol = new Set(fedwire().holidays);
  for (let i = 0; i < N; i++) {
    const pp = randFedwire(rng);
    const o = compute(pp).output_payload;
    checked++;
    if (!o.valid_input || o.verdict === 'NO_WINDOW_IN_HORIZON') { violations++; console.log('P5 violation: no window within 14 days on a weekday calendar'); continue; }
    if (o.verdict === 'WINDOWED') {
      const open = new Date(Date.parse(o.next_cash_window_open));
      const h = open.getUTCHours();
      if (open.getUTCMinutes() !== 0 || (h !== 1 && h !== 2)) { violations++; console.log('P5 violation: window does not open at 21:00 ET'); }
      const close = new Date(Date.parse(o.next_cash_window_close));
      const bizDay = new Date(close.getTime() - 3600000).toISOString().slice(0, 10); // 19:00 ET close is 23:00/00:00 UTC; minus an hour lands on the business day
      if (hol.has(bizDay)) { violations++; console.log('P5 violation: window belongs to a holiday business day'); }
    }
    if (o.exposure_seconds > 100 * 3600) { violations++; console.log('P5 violation: exposure past 100 hours on a weekday calendar'); }
  }
  return { name: 'P5 Fedwire-shaped calendar opens at 21:00 ET, never on a holiday business day', checked, violations };
}

function checkP6Refusals() {
  const rng = mulberry32(SEED + 6); let checked = 0, violations = 0;
  for (const bad of [null, undefined, 5, 'x', [], true]) {
    checked++;
    const o = compute(bad).output_payload;
    if (o.valid_input !== false || !/^REFUSED_INPUT_WRONG_TYPE/.test(o.domain_errors[0])) { violations++; console.log('P6 violation: non-object not refused'); }
  }
  const p = randDirect(rng); delete p.funding_rate_bp;
  for (const delta of [{ principal_minor_units: 12.5 }, { principal_minor_units: 7 }, { principal_minor_units: '0' }, { principal_minor_units: '012' }, { funding_rate_bp: 0.5 }, { funding_rate_bp: null }, { funding_rate_bp: '10' }, { token_leg_time: null }, { as_of: undefined }, { horizon_days: 0 }]) {
    checked++;
    const o = compute({ ...p, ...delta }).output_payload;
    if (o.valid_input !== false || o.verdict !== null || o.exposure_seconds !== null) { violations++; console.log('P6 violation: accepted ' + JSON.stringify(Object.keys(delta))); }
  }
  const proto = JSON.parse(JSON.stringify(p).slice(0, -1) + ',"constructor":5,"toString":"x","__proto__":{"funding_rate_bp":9}}');
  checked++;
  if (JSON.stringify(compute(proto).output_payload) !== JSON.stringify(compute(p).output_payload)) { violations++; console.log('P6 violation: prototype-name keys changed the output'); }
  return { name: 'P6 refusal contract and prototype-name keys', checked, violations };
}

async function checkP7BuildArtifactNeverThrows() {
  let checked = 0, violations = 0;
  /** @type {any} */ let deep = 1; for (let i = 0; i < 600; i++) deep = [deep];
  const wide = new Array(1000001).fill(0);
  const rng = mulberry32(SEED + 7);
  for (const delta of [{ funding_rate_bp: 1e300 }, { zzz: Infinity }, { zzz: NaN }, { zzz: { a: [Number.MAX_SAFE_INTEGER + 2] } }, { zzz: deep }, { zzz: wide }]) {
    checked++;
    try {
      const art = await buildArtifact({ ...randDirect(rng), ...delta });
      const r = art.hash_refusal;
      if (art.execution_hash !== null || !r || !/^REFUSED_INPUT_(UNSAFE_NUMBER|HASH_LIMIT)$/.test(r.reason)) { violations++; console.log('P7 violation: artifact shape'); }
      if (art.output_payload.valid_input !== false) { violations++; console.log('P7 violation: compute accepted hostile input'); }
    } catch (e) { violations++; console.log('P7 violation: buildArtifact threw: ' + String(e.message).slice(0, 80)); }
  }
  for (const pp of [randDirect(rng), randFedwire(rng), { ...randDirect(rng), principal_minor_units: 5 }, null, 5, []]) {
    checked++;
    try {
      const art = await buildArtifact(pp);
      if (!/^[0-9a-f]{64}$/.test(art.execution_hash) || art.hash_refusal !== undefined) { violations++; console.log('P7 violation: clean input lost its hash'); }
    } catch (e) { violations++; console.log('P7 violation: buildArtifact threw on clean input: ' + String(e.message).slice(0, 80)); }
  }
  return { name: 'buildArtifact_never_throws (null hash + hash_refusal on unhashable, hash on clean)', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
void pick;
const properties = [
  checkP1Determinism(), checkP2VerdictExposure(), checkP3PrincipalSeconds(), checkP4Carry(),
  checkP5FedwireShape(), checkP6Refusals(), await checkP7BuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
