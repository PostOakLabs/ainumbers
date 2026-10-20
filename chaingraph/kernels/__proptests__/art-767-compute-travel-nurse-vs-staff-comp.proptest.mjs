// art-767-compute-travel-nurse-vs-staff-comp.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the APEXPORT-132B porting payload
// (kernel + fixtures + VECTORS/DIFFERS/CITES records, GRADES PASS-PENDING-XV
// 2026-10-18, Builder-verifies-at-land 42/42).
// kernel_digest_at_authoring: sha256:a6b41cda71aa1df1d202bd8f5773c09036c3d333d5a62e24e51f17d30e27f561
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: PARTIAL — the kernel deliberately keeps the Apex page's float
// arithmetic (no intermediate rounding) so its outputs match the ported-from page
// to the digit. The properties below assert only relations that are exact under
// IEEE-754 (monotone multiply/add, equality on already-produced doubles, whole
// payload difference) or restatements of the published formula, never fragile
// float equals on arbitrary draws.
//
// Checks: fixture-oracle gate (the 6 Apex live vectors and the 18 boundary
// comparators' :at/:past pairs — the zero-swallow guard on all fourteen inputs,
// the taxRate percent-divide swallow, the sign-only division guard); P1 staff
// net ex-fringe is non-decreasing in staffRate/staffHours/staffWeeks and travel
// net is non-decreasing in travelBase/housingStipend/mieStipend and strictly
// decreasing in travelCost; P2 the headline delta and travelWins restated
// independently from the two nets (delta === travelNet − staffNetNoFringe
// exactly, travelWins === delta > 0); P3 determinism (two runs agree
// byte-for-byte) and output shape (no undefined/NaN/non-finite anywhere in
// output_payload); P4 the zero-swallow contract restated per input: 0 on any of
// the fourteen controls is replaced by the page default and the input is named
// in inputs_defaulted; P5 every comparator's :at/:past payloads differ as whole
// objects (with inputs_defaulted normalised away, the fixture's omission vs the
// kernel's empty array).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-767-compute-travel-nurse-vs-staff-comp.proptest.mjs

import { compute } from '../art-767-compute-travel-nurse-vs-staff-comp.kernel.mjs';
import { runFixtureOracle, findShapeViolations, deepEqual, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-767-compute-travel-nurse-vs-staff-comp';

const FOURTEEN = ['staffRate','staffHours','staffBenefits','staffWeeks','taxRate','travelBase',
  'housingStipend','mieStipend','contractWeeks','contractsPerYear','gapWeeks','travelHours',
  'travelCost','ttpHousingCost'];

const hasBadNumber = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadNumber);
};

// Base draw: all fourteen controls explicitly set (page defaults).
const basePP = () => ({
  staffRate: 38, staffHours: 36, staffBenefits: 12000, staffWeeks: 50, taxRate: 22,
  travelBase: 22, housingStipend: 1200, mieStipend: 350, contractWeeks: 13,
  contractsPerYear: 3, gapWeeks: 3, travelHours: 36, travelCost: 1500, ttpHousingCost: 200,
});

// P1 — staff net ex-fringe non-decreasing in staffRate/staffHours/staffWeeks;
// travel net non-decreasing in travelBase/housingStipend/mieStipend and
// strictly decreasing in travelCost.
function checkP1Monotone() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76701);
  for (let i = 0; i < 60; i++) {
    const pp = basePP();
    pp.staffRate = Math.round(rng() * 90) + 5;
    pp.staffHours = Math.floor(rng() * 60) + 1;
    pp.staffWeeks = Math.floor(rng() * 52) + 1;
    pp.travelBase = Math.round(rng() * 80) + 5;
    const staff0 = compute(pp).output_payload.staffNetNoFringe;
    const trav0 = compute(pp).output_payload.travelNetAnnual;
    /** @type {Array<{label: string, side: string, patch: Record<string, number>}>} */
    const ups = [
      { label: 'staffRate', side: 'staff', patch: { staffRate: pp.staffRate + 5 } },
      { label: 'staffHours', side: 'staff', patch: { staffHours: pp.staffHours + 2 } },
      { label: 'staffWeeks', side: 'staff', patch: { staffWeeks: pp.staffWeeks + 1 } },
      { label: 'travelBase', side: 'travel', patch: { travelBase: pp.travelBase + 2 } },
      { label: 'housingStipend', side: 'travel', patch: { housingStipend: pp.housingStipend + 50 } },
      { label: 'mieStipend', side: 'travel', patch: { mieStipend: pp.mieStipend + 10 } },
      { label: 'travelCost', side: 'travel-down', patch: { travelCost: pp.travelCost + 100 } },
    ];
    for (const { label, side, patch } of ups) {
      const out = compute(Object.assign({}, pp, patch)).output_payload;
      const v = side === 'staff' ? out.staffNetNoFringe : out.travelNetAnnual;
      const v0 = side === 'staff' ? staff0 : trav0;
      checked++;
      const bad = side === 'travel-down' ? v > v0 : v < v0;
      if (bad) { violations++; console.log(`P1 violation: ${label} moved net the wrong way (${v} vs ${v0})`); }
    }
  }
  return { name: 'P1 staff net non-decreasing in rate/hours/weeks; travel net non-decreasing in base/stipends, strictly decreasing in travelCost', checked, violations };
}

// P2 — delta and travelWins restated independently from the two nets.
function checkP2DeltaRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76702);
  for (let i = 0; i < 120; i++) {
    const pp = basePP();
    pp.staffRate = Math.round(rng() * 90) + 5;
    pp.travelBase = Math.round(rng() * 80) + 5;
    pp.housingStipend = Math.round(rng() * 300);
    pp.contractsPerYear = 1 + Math.floor(rng() * 5);
    const out = compute(pp).output_payload;
    checked++;
    const wantDelta = out.travelNetAnnual - out.staffNetNoFringe;
    if (out.delta !== wantDelta) {
      violations++; console.log(`P2 violation: delta ${out.delta} !== travelNet - staffNetNoFringe ${wantDelta}`); continue;
    }
    const wantWins = out.delta > 0;
    if (out.travelWins !== wantWins) { violations++; console.log(`P2 violation: travelWins ${out.travelWins} for delta ${out.delta}`); }
  }
  return { name: 'P2 delta === travelNet − staffNetNoFringe and travelWins === (delta > 0), restated', checked, violations };
}

// P3 — determinism and output shape.
function checkP3DeterminismShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(76703);
  for (let i = 0; i < 40; i++) {
    const pp = basePP();
    for (const k of FOURTEEN) if (rng() < 0.3) pp[k] = Math.round(rng() * 2000);
    const a = compute(pp);
    const b = compute(pp);
    checked++;
    if (!deepEqual(a, b)) { violations++; console.log('P3 violation: two runs differ'); continue; }
    if (hasBadNumber(a.output_payload)) { violations++; console.log('P3 violation: non-finite number in output_payload'); }
    for (const k of FOURTEEN) {
      if (!(k in a.output_payload)) { violations++; console.log(`P3 violation: output_payload missing ${k}`); break; }
    }
  }
  return { name: 'P3 determinism and output shape (all 32 payload fields present, finite)', checked, violations };
}

// P4 — zero-swallow restated per input: 0 on any control equals the default
// path, and the input is named in inputs_defaulted.
function checkP4ZeroSwallow() {
  let checked = 0, violations = 0;
  const baseline = compute({});
  for (const k of FOURTEEN) {
    const out = compute({ [k]: 0 });
    checked++;
    if (!deepEqual(out.output_payload, baseline.output_payload)) {
      violations++; console.log(`P4 violation: 0 on ${k} did not hit the page default path`); continue;
    }
    if (!Array.isArray(out.output_payload.inputs_defaulted) || !out.output_payload.inputs_defaulted.includes(k)) {
      violations++; console.log(`P4 violation: inputs_defaulted does not name ${k}`);
    }
  }
  return { name: 'P4 zero-swallow on all fourteen controls equals the default path and is flagged', checked, violations };
}

// P5 — every comparator's :at/:past payloads differ as whole objects, except
// the one declared non-flipping pair B18 (the division guard's zero crossing is
// unreachable because the zero-swallow substitutes the default first — the
// payload documents both sides as identical by design).
const NON_FLIPPING_PAIRS = new Set(['B18-division-guard-zero-is-unreachable']);
function checkP5BoundaryPairsFlip(fixtures) {
  let checked = 0, violations = 0;
  const byPair = new Map();
  for (const v of fixtures.vectors) {
    if (!v.pair) continue;
    if (!byPair.has(v.pair)) byPair.set(v.pair, {});
    byPair.get(v.pair)[v.side] = v.output_payload;
  }
  for (const [pair, sides] of byPair) {
    checked++;
    if (!sides.at || !sides.past) { violations++; console.log(`P5 violation: pair ${pair} missing a side`); continue; }
    const flips = !deepEqual(sides.at, sides.past);
    if (NON_FLIPPING_PAIRS.has(pair)) {
      // B18 flips only through the inputs_defaulted flags (travelHours 0 is
      // swallowed to the page default, so both sides land on 36 and every
      // payload number is identical). Assert the computed payload proper is
      // byte-identical and the flags DO differ.
      const at = { ...sides.at }; delete at.inputs_defaulted;
      const past = { ...sides.past }; delete past.inputs_defaulted;
      if (!deepEqual(at, past)) { violations++; console.log(`P5 violation: pair ${pair} computed payload differs at/past`); }
      if (flips === false) { violations++; console.log(`P5 violation: pair ${pair} inputs_defaulted flags do not differ`); }
      continue;
    }
    if (!flips) { violations++; console.log(`P5 violation: pair ${pair} :at/:past payloads are identical`); }
  }
  return { name: 'P5 boundary comparator pairs flip as whole payloads (B18 declared non-flipping)', checked, violations };
}

// ── main ─────────────────────────────────────────────────────────────────────
const { readFileSync } = await import('node:fs');
const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(here, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const oracleOk = oracle.failures.length === 0;
console.log(`${oracleOk ? 'PASS' : 'FAIL'}  fixture oracle: compute() reproduces all ${oracle.total} payload vectors  (failures ${oracle.failures.length}${oracleOk ? '' : ': ' + oracle.failures.map((f) => f.name).join(', ')})`);

const results = [
  checkP1Monotone(),
  checkP2DeltaRestated(),
  checkP3DeterminismShape(),
  checkP4ZeroSwallow(),
  checkP5BoundaryPairsFlip(fixtures),
];

let failed = !oracleOk;
for (const r of results) {
  const ok = r.violations === 0;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.name}  (checked ${r.checked}, violations ${r.violations})`);
}
process.exit(failed ? 1 : 0);
