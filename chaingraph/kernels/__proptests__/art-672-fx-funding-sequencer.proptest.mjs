// art-672-fx-funding-sequencer.proptest.mjs -- class-A property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// spec: FX-SEQUENCER-BUILD-SPEC.md (workspace root).
// kernel_digest_at_authoring: sha256:9bad80e815e637279882aa6df6c08104ec2fc2b045ed8f23fbdb9ff8be6ba0c2
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof. float_sensitive: NO -- all math is integer minutes
// (HH:MM strings -> h*60+m), no rounding, no division, no floats.
//
// Checks: fixture-oracle gate (4 vectors, incl. the spec's canonical preimage and the
// opposite-verdict CUTOFF_MISSED vector), determinism, output-shape (no NaN/undefined),
// termination (sequence length bounded by declared leg count), differential re-derivation
// of the ordering + margins + verdict straight from the raw policy_parameters (independent
// of the kernel's own sort/compare), and a re-derivation of the spec's staged canonical
// execution_hash (SO #34: recomputed here from the embedded preimage, never trusted).
//
// Run: node chaingraph/kernels/__proptests__/art-672-fx-funding-sequencer.proptest.mjs

import { compute } from '../art-672-fx-funding-sequencer.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-672-fx-funding-sequencer';
const rand = mulberry32(0x672f11);

// The canonical preimage, embedded verbatim from FX-SEQUENCER-BUILD-SPEC.md (SO #34: the
// hash is RECOMPUTED from this constant, never read from the fixture file or the kernel).
const CANONICAL_PP = {
  settle_date: '2026-10-13',
  trade_confirm_utc: '14:20',
  legs: [
    { ccy: 'EUR', cutoff_utc: '15:00' },
    { ccy: 'USD', cutoff_utc: '21:00' },
  ],
};
const CANONICAL_OUTPUT = {
  sequence: ['EUR', 'USD'],
  margins_minutes: { EUR: 40, USD: 400 },
  all_cutoffs_met: true,
  trace: 'EUR 15:00 - 14:20 = 40 min; USD 21:00 - 14:20 = 400 min; order by tightest first',
  overall: 'FUNDING_SEQUENCED',
};
const CANONICAL_HASH = '1d4984b1e1c6efca36095590507adb92102ce7e1570d0ecc37517893737204fb';

const VALID_TIMES = ['00:00', '05:15', '09:30', '12:45', '14:20', '15:00', '18:30', '21:00', '23:59'];
const CCYS = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'eur', '', 'USDD'];

function isBadTime(t) { return !/^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
function randTime(rng) {
  const t = pick(rng, [...VALID_TIMES, '24:00', 'bad', '']);
  return t === '' ? t : t; // '' is a deliberate malformed case
}
function randCcy(rng) { return pick(rng, CCYS); }

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const legs = [];
  for (let i = 0; i < n; i++) legs.push({ ccy: randCcy(rng), cutoff_utc: randTime(rng) });
  const r = rng();
  if (r < 0.08) return { legs }; // confirm missing
  if (r < 0.12) return {}; // everything missing
  return { settle_date: '2026-10-13', trade_confirm_utc: randTime(rng), legs };
}

// Independent re-derivation of the expected sequencing straight from pp (NOT via the kernel).
function expectedSequence(pp) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(pp.settle_date || ''))) return null;
  const cf = String(pp.trade_confirm_utc || '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cf)) return null;
  const confirmMin = Number(cf.slice(0, 2)) * 60 + Number(cf.slice(3, 5));
  if (!Array.isArray(pp.legs) || pp.legs.length === 0) return null;
  const parsed = [];
  for (let i = 0; i < pp.legs.length; i++) {
    const leg = pp.legs[i] || {};
    const ccy = typeof leg.ccy === 'string' ? leg.ccy : '';
    const cut = typeof leg.cutoff_utc === 'string' ? leg.cutoff_utc : '';
    if (!/^[A-Z]{3}$/.test(ccy) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(cut)) return null;
    parsed.push({ ccy, margin: Number(cut.slice(0, 2)) * 60 + Number(cut.slice(3, 5)) - confirmMin, idx: i, cutoff: cut });
  }
  // duplicate declared currency legs are ambiguous -> INDETERMINATE (matches kernel doctrine)
  const seenCcys = new Set(parsed.map((l) => l.ccy));
  if (seenCcys.size !== parsed.length) return null;
  return parsed;
}

// ---------- P1: determinism -- same pp -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape -- no NaN/undefined anywhere ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3: termination / bounds ----------
function checkP3_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overall === 'INDETERMINATE') continue;
    const legCount = Array.isArray(pp.legs) ? pp.legs.length : 0;
    if (!Array.isArray(output_payload.sequence) || output_payload.sequence.length > legCount) violations++;
    if (!output_payload.margins_minutes || Object.keys(output_payload.margins_minutes).length !== output_payload.sequence.length) violations++;
    if (typeof output_payload.trace !== 'string' || output_payload.trace.length > legCount * 80 + 64) violations++;
  }
  return { name: 'P3_termination_bounded_by_declared_legs', checked, violations };
}

// ---------- P4 (differential): ordering + margins + verdict re-derived from raw pp ----------
function checkP4_sequence_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 1500; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const exp = expectedSequence(pp);
    if (exp === null) {
      if (output_payload.overall !== 'INDETERMINATE') violations++;
      continue;
    }
    if (output_payload.overall === 'INDETERMINATE') { violations++; continue; }
    const sorted = [...exp].sort((a, b) => (a.margin - b.margin) || (a.idx - b.idx));
    const wantSequence = sorted.map((l) => l.ccy);
    const wantMargins = {};
    for (const l of sorted) wantMargins[l.ccy] = l.margin;
    const wantTrace = sorted.map((l) => `${l.ccy} ${l.cutoff} - ${pp.trade_confirm_utc} = ${l.margin} min`).join('; ') + '; order by tightest first';
    const wantAllMet = sorted.every((l) => l.margin >= 0);
    const wantOverall = wantAllMet ? 'FUNDING_SEQUENCED' : 'CUTOFF_MISSED';
    if (JSON.stringify(output_payload.sequence) !== JSON.stringify(wantSequence)) violations++;
    if (JSON.stringify(output_payload.margins_minutes) !== JSON.stringify(wantMargins)) violations++;
    if (output_payload.trace !== wantTrace) violations++;
    if (output_payload.all_cutoffs_met !== wantAllMet) violations++;
    if (output_payload.overall !== wantOverall) violations++;
  }
  return { name: 'P4_sequence_margins_verdict_differential', checked, violations };
}

// ---------- P5: canonical preimage parity, recomputed (SO #34) ----------
async function checkP5_canonical_parity() {
  let violations = 0, checked = 0;
  const { output_payload } = compute(CANONICAL_PP);
  checked++;
  if (JSON.stringify(output_payload) !== JSON.stringify(CANONICAL_OUTPUT)) violations++;
  const { executionHash } = await import('../_hash.mjs');
  const hash = await executionHash(CANONICAL_PP, output_payload);
  checked++;
  if (hash !== CANONICAL_HASH) violations++;
  return { name: 'P5_canonical_preimage_parity_recomputed', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_termination_bounded(),
  checkP4_sequence_differential(),
  await checkP5_canonical_parity(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
