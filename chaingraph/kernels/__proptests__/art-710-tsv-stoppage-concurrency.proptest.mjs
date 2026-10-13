// art-710-tsv-stoppage-concurrency — class-K property test floor, authored by ART710-TSV-STOPPAGE-CONCURRENCY-1.
// spec: RHC hooks build spec Addendum art-710 (research/rhc-hooks/RHC-HOOKS-BUILD-SPEC-2026-10-03.md),
// SEC TSV Exemption condition H (FR 2026-19388, 91 Fed. Reg. 60176, Sept. 22, 2026)
// kernel_digest_at_authoring: sha256:84b418029d581a8af38697a855ca3030fb85d96380fbb23cca59f75a77e13cd1
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-710-tsv-stoppage-concurrency.proptest.mjs

import { compute } from '../art-710-tsv-stoppage-concurrency.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-710-tsv-stoppage-concurrency';
const TRIALS = 2000;
const rand = mulberry32(0x710CB);

const KINDS = ['halt', 'suspension', 'mwcb'];

function rngPick(rng, n) { return Math.floor(rng() * n); }

// A random but well-formed input: stoppages with random intervals, trades scattered
// inside and outside them, a halt record per stoppage (sometimes deliberately not
// covering), notices (sometimes missing), and a random tolerance.
function mkBase(rng) {
  const nStops = 1 + rngPick(rng, 3);
  const stoppages = [];
  const haltRecords = [];
  const notices = [];
  const trades = [];
  for (let i = 0; i < nStops; i++) {
    const symbol = 'SYM' + i;
    const start = rngPick(rng, 100000);
    const openEnded = rng() < 0.15;
    const end = openEnded ? null : start + 1 + rngPick(rng, 50000);
    stoppages.push({ symbol, start_ts: start, end_ts: end, kind: KINDS[rngPick(rng, KINDS.length)] });
    // halt record: usually covering, sometimes short (uncovered stoppage)
    const short = rng() < 0.25;
    haltRecords.push({
      symbol,
      start_ts: short ? start + 1 : start,
      end_ts: openEnded
        ? (rng() < 0.8 ? null : start + 5000)
        : (short ? start + Math.max(0, (end - start) >> 1) : end),
    });
    if (rng() < 0.9) notices.push({ symbol, ts: start + rngPick(rng, 5000) });
    const nTrades = rngPick(rng, 4);
    for (let j = 0; j < nTrades; j++) {
      // scatter: half inside the interval, half anywhere
      const hi = (end ?? start + 50000) - start;
      const ts = rng() < 0.5 ? start + rngPick(rng, Math.max(1, hi)) : rngPick(rng, 160000);
      trades.push({ symbol, ts, trade_id: 'T-' + i + '-' + j });
    }
  }
  return {
    stoppages,
    tsv_trades: trades,
    tsv_halt_records: haltRecords,
    participant_notices: notices,
    concurrency_tolerance_ms: rng() < 0.5 ? 0 : rngPick(rng, 3000),
  };
}

// Independent reference: half-open membership [start, end).
function refInside(ts, s) {
  return ts >= s.start_ts && (s.end_ts === null || ts < s.end_ts);
}

// ---------- P1 (row-mandated): adding a trade outside all stoppages never adds a violation ----------
function checkP1_outsideTradeAddsNothing() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkBase(rand);
    const before = compute(pp).output_payload;
    if (before.error) continue;
    const outside = {
      symbol: 'ZZZ' + rngPick(rand, 100000),
      ts: rngPick(rand, 160000),
      trade_id: 'OUTSIDE-' + i,
    };
    const after = compute({ ...pp, tsv_trades: [...pp.tsv_trades, outside] }).output_payload;
    checked++;
    if (after.violations.length !== before.violations.length) violations++;
    if (after.counts.trades_flagged !== before.counts.trades_flagged) violations++;
    if (after.counts.trades_during_stoppages !== before.counts.trades_during_stoppages) violations++;
    // a trade in a symbol with no stoppage can never be flagged
    if (after.violations.some((v) => v.trade_id === outside.trade_id)) violations++;
  }
  return { name: 'P1_trade_outside_all_stoppages_never_adds_a_violation', checked, violations };
}

// ---------- P2 (row-mandated): widening a stoppage never removes a violation ----------
function checkP2_wideningNeverRemoves() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkBase(rand);
    // a notice at exactly start_ts exists before widening and still exists after
    // (widening only moves the start earlier), so NO_PARTICIPANT_NOTICE can never be
    // cured by widening — latency is measured, never graded, so its change is inert
    pp.participant_notices = pp.stoppages.map((s) => ({ symbol: s.symbol, ts: s.start_ts }));
    // tolerance 0: a non-zero trailing tolerance would let widening itself move the
    // tolerated window over an already-flagged trade, which is a tolerance effect,
    // not a widening removal
    pp.concurrency_tolerance_ms = 0;
    const before = compute(pp).output_payload;
    if (before.error) continue;
    const widened = pp.stoppages.map((s) => ({
      ...s,
      start_ts: Math.max(0, s.start_ts - 1 - rngPick(rand, 1000)),
      end_ts: s.end_ts === null ? null : s.end_ts + 1 + rngPick(rand, 1000),
    }));
    const after = compute({ ...pp, stoppages: widened }).output_payload;
    checked++;
    // every violation class count is monotone non-decreasing under widening
    for (const t of ['TRADE_DURING_STOPPAGE', 'HALT_RECORD_NOT_COVERING', 'NO_PARTICIPANT_NOTICE']) {
      const b = before.violations.filter((v) => v.type === t).length;
      const a = after.violations.filter((v) => v.type === t).length;
      if (a < b) violations++;
    }
  }
  return { name: 'P2_widening_a_stoppage_never_removes_a_violation', checked, violations };
}

// ---------- P3: per-stoppage trades_during matches an independent half-open reference ----------
function checkP3_halfOpenReferenceCounts() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkBase(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.error) continue;
    for (const row of r.per_stoppage) {
      const s = pp.stoppages.find((x) => x.symbol === row.symbol && x.start_ts === row.start_ts);
      const ref = pp.tsv_trades.filter((t) => t.symbol === row.symbol && refInside(t.ts, s));
      if (row.trades_during !== ref.length) violations++;
      // a trade at exactly the closed end boundary is outside a half-open interval
      if (s.end_ts !== null) {
        const atEnd = pp.tsv_trades.filter((t) => t.symbol === row.symbol && t.ts === s.end_ts);
        if (ref.some((t) => t.ts === s.end_ts)) violations++;
        if (row.trades_during + atEnd.length < ref.length) violations++;
      }
      // flagged + tolerated = during
      if (row.trades_flagged + row.trades_within_tolerance !== row.trades_during) violations++;
      // flagged trades really are beyond tolerance
      const tol = r.concurrency_tolerance_ms;
      for (const v of r.violations.filter((v2) => v2.type === 'TRADE_DURING_STOPPAGE' && v2.symbol === row.symbol)) {
        const leadingTolerated = v.trade_ts < s.start_ts + tol;
        const trailingTolerated = s.end_ts !== null && v.trade_ts >= s.end_ts - tol;
        if (leadingTolerated || trailingTolerated) violations++;
      }
    }
  }
  return { name: 'P3_trades_during_matches_independent_half_open_reference', checked, violations };
}

// ---------- P4: notice latency is a measured value, never graded ----------
function checkP4_noticeLatencyMeasuredNotGraded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkBase(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.error) continue;
    for (const row of r.per_stoppage) {
      const ref = pp.participant_notices
        .filter((n) => n.symbol === row.symbol && n.ts >= row.start_ts)
        .sort((a, b) => a.ts - b.ts)[0];
      const expect = ref === undefined ? null : ref.ts - row.start_ts;
      if (row.notice_latency_ms !== expect) violations++;
      if (expect !== null && expect < 0) violations++;
      // coverage bookkeeping agrees with the halt records
      const s = pp.stoppages.find((x) => x.symbol === row.symbol && x.start_ts === row.start_ts);
      const refCovered = pp.tsv_halt_records.some((h) => h.symbol === row.symbol
        && h.start_ts <= s.start_ts
        && ((s.end_ts === null && h.end_ts === null)
          || (s.end_ts !== null && h.end_ts !== null && h.end_ts >= s.end_ts)));
      if (row.covered !== refCovered) violations++;
    }
    // no pass/fail grade anywhere in the output
    if (JSON.stringify(r).includes('notice_latency_ok')) violations++;
    if (JSON.stringify(r).includes('latency_pass')) violations++;
  }
  return { name: 'P4_notice_latency_measured_never_graded', checked, violations };
}

// ---------- P5: refusal contract — kill power over malformed inputs ----------
function checkP5_refusalContract() {
  let violations = 0, checked = 0;
  const base = mkBase(rand);
  const cases = [];
  cases.push([{ ...base, concurrency_tolerance_ms: -1 }, 'tolerance_invalid']);
  cases.push([{ ...base, concurrency_tolerance_ms: 1.5 }, 'tolerance_invalid']);
  cases.push([{ ...base, stoppages: [] }, 'stoppages_invalid']);
  cases.push([{ ...base, stoppages: [{ ...base.stoppages[0], kind: 'holiday' }] }, 'stoppage_entry_invalid']);
  cases.push([{ ...base, stoppages: [{ ...base.stoppages[0], end_ts: base.stoppages[0].start_ts - 1 }] }, 'stoppage_entry_invalid']);
  cases.push([{ ...base, stoppages: 'all' }, 'stoppages_invalid']);
  cases.push([{ ...base, tsv_trades: [{ symbol: 'X', ts: 5, trade_id: '' }] }, 'trade_entry_invalid']);
  cases.push([{ ...base, tsv_trades: [{ symbol: 'X', ts: -5, trade_id: 'T' }] }, 'trade_entry_invalid']);
  cases.push([{ ...base, tsv_trades: [{ symbol: 'X', ts: 5, trade_id: 'DUP' }, { symbol: 'X', ts: 6, trade_id: 'DUP' }] }, 'trade_id_duplicate']);
  cases.push([{ ...base, tsv_halt_records: [{ symbol: 'X', start_ts: 0, end_ts: 1e16 }] }, 'halt_record_entry_invalid']);
  cases.push([{ ...base, participant_notices: [{ symbol: 'X', ts: null }] }, 'notice_entry_invalid']);
  cases.push([{ ...base, tsv_trades: null }, 'trades_invalid']);
  cases.push([{ ...base, tsv_halt_records: 'none' }, 'halt_records_invalid']);
  cases.push([{ ...base, participant_notices: 42 }, 'notices_invalid']);
  for (const [pp, code] of cases) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.error !== code) violations++;
    if (r.compliance_flags[0] !== 'INPUT_REFUSED') violations++;
    if (!r.output_payload.domain_errors || r.output_payload.domain_errors.length !== 1) violations++;
  }
  return { name: 'P5_refusal_contract_kill_power', checked, violations };
}

// ---------- P6: output shape, determinism and the evidence-only contract ----------
function checkP6_outputShapeDeterminism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const pp = mkBase(rand);
    const a = compute(pp); const b = compute(pp);
    const out = a.output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (out.error) continue;
    if (!Array.isArray(out.violations) || !Array.isArray(out.per_stoppage) || !Array.isArray(out.assumptions)) violations++;
    if (out.concurrency_tolerance_ms !== (pp.concurrency_tolerance_ms ?? 0)) violations++;
    if (!out.assumptions.some((x) => /HALF-OPEN/.test(x))) violations++;
    if (!out.assumptions.some((x) => /measured value/.test(x))) violations++;
    if (!out.assumptions.some((x) => /never reads a chain/.test(x))) violations++;
    for (const v of out.violations) {
      if (!['TRADE_DURING_STOPPAGE', 'HALT_RECORD_NOT_COVERING', 'NO_PARTICIPANT_NOTICE'].includes(v.type)) violations++;
    }
  }
  return { name: 'P6_output_shape_determinism_evidence_only', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_outsideTradeAddsNothing(),
  checkP2_wideningNeverRemoves(),
  checkP3_halfOpenReferenceCounts(),
  checkP4_noticeLatencyMeasuredNotGraded(),
  checkP5_refusalContract(),
  checkP6_outputShapeDeterminism(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test — ' + properties.length + ' properties.');
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
