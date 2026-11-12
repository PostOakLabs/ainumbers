// art-707-tsv-tier-cap-ladder — class-K property test floor, authored by ART707-TSV-TIER-CAP-LADDER-1.
// spec: RHC hooks build spec WU-6 (research/rhc-hooks/RHC-HOOKS-BUILD-SPEC-2026-10-03.md), FR 2026-19388 condition F
// kernel_digest_at_authoring: sha256:ec31622899cd563e7242a8382b47262710dadead214839f5029e2dee08ab9e6d
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-707-tsv-tier-cap-ladder.proptest.mjs

import { compute, addCalendarMonths } from '../art-707-tsv-tier-cap-ladder.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-707-tsv-tier-cap-ladder';
const TRIALS = 2000;
const rand = mulberry32(0x707C7);

function isoDate(n) {
  // n days from 2026-01-01, deterministic
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  return d.toISOString().slice(0, 10);
}

// Deterministic random replay: 1-3 stocks, random tier and ADV, 1-8 volume days, 0-2 affiliates.
function mkPP(rng) {
  const tsv = 'TSV-A';
  const affiliates = [];
  const nAff = Math.floor(rng() * 3);
  for (let i = 0; i < nAff; i++) affiliates.push('TSV-' + String.fromCharCode(66 + i));
  const group = [tsv, ...affiliates];
  const nStocks = 1 + Math.floor(rng() * 3);
  const stocks = [];
  const syms = [];
  for (let i = 0; i < nStocks; i++) {
    const sym = 'S' + String(i + 1).padStart(2, '0');
    syms.push(sym);
    const noAdv = rng() < 0.08;
    stocks.push({
      symbol: sym,
      tier: rng() < 0.5 ? 'tier_1' : 'tier_2',
      prior_month_adv_shares: noAdv ? null : 100000 + Math.floor(rng() * 5000000),
    });
  }
  const nDays = 1 + Math.floor(rng() * 8);
  const daily = [];
  for (let i = 0; i < nDays; i++) {
    for (const sym of syms) {
      if (rng() < 0.2) continue;
      const venue = group[Math.floor(rng() * group.length)];
      daily.push({ date: isoDate(Math.floor(rng() * 28)), tsv_id: venue, symbol: sym, shares: Math.floor(rng() * 200000) });
    }
  }
  const prior = [];
  for (const sym of syms) {
    const n = Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) prior.push({ symbol: sym, date: isoDate(Math.floor(rng() * 10)) });
  }
  return { tsv_id: tsv, affiliated_tsv_ids: affiliates, stocks, daily_volume: daily, prior_breaches: prior, as_of_date: isoDate(30) };
}

// Small deterministic single-stock replay used for the pause/ladder properties.
function singleStockPP(breachDays, priorDates) {
  const adv = 1000000; // tier_1 cap = floor(1,000,000 x 25/10000) = 2500
  const daily = [];
  for (let d = 0; d < 20; d++) {
    const date = isoDate(d);
    const shares = breachDays.includes(date) ? 2501 : 2499;
    daily.push({ date, tsv_id: 'TSV-A', symbol: 'AAA', shares });
  }
  return {
    tsv_id: 'TSV-A',
    affiliated_tsv_ids: [],
    stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: adv }],
    daily_volume: daily,
    prior_breaches: priorDates.map((d) => ({ symbol: 'AAA', date: d })),
    as_of_date: isoDate(19),
  };
}

// ---------- P1 (row-mandated): adding volume never removes a breach ----------
function checkP1_addingVolumeNeverRemovesBreach() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const base = compute(pp).output_payload;
    if (base.error) continue;
    checked++;
    // Grow one volume row (same venue+symbol+date, larger shares -> rebuilt input).
    const bump = pp.daily_volume[Math.floor(rand() * pp.daily_volume.length)];
    if (!bump) continue;
    const grown = {
      ...pp,
      daily_volume: pp.daily_volume.filter((r) => r !== bump).concat([{ ...bump, shares: bump.shares + 1 + Math.floor(rand() * 1000) }]),
    };
    const out = compute(grown).output_payload;
    if (out.error) { violations++; continue; }
    for (let k = 0; k < base.per_stock.length; k++) {
      const a = base.per_stock[k];
      const b = out.per_stock.find((s) => s.symbol === a.symbol);
      for (const d of a.breach_dates) {
        if (!b.breach_dates.includes(d)) { violations++; break; }
      }
      if (b.breach_count_including_prior < a.breach_count_including_prior) { violations++; break; }
    }
  }
  return { name: 'P1_adding_volume_never_removes_a_breach', checked, violations };
}

// ---------- P2 (row-mandated): adding a prior breach never shortens a pause ----------
function checkP2_priorBreachNeverShortensPause() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const nBreach = 1 + Math.floor(rand() * 4);
    const breachDays = [];
    for (let k = 0; k < nBreach; k++) breachDays.push(isoDate(2 + k * 3));
    const pp = singleStockPP(breachDays, []);
    const base = compute(pp).output_payload;
    if (base.error) { violations++; continue; }
    checked++;
    // Add a prior breach BEFORE the window: the first in-window breach becomes "subsequent",
    // so the pause set can only grow, and any pause window that already existed may only move
    // EARLIER (its start, and the resume date that follows it, never later).
    const out = compute({ ...pp, prior_breaches: [{ symbol: 'AAA', date: isoDate(0) }] }).output_payload;
    if (out.error) { violations++; continue; }
    const a = base.per_stock[0];
    const b = out.per_stock[0];
    // Every pause window that already existed is preserved UNCHANGED (adding a prior breach
    // consumes the pass earlier, so it can only ADD windows, never shorten or move one).
    // (When none existed, there is nothing to preserve — the final check below covers the case.)
    const tail = a.pause_windows.length > 0 ? b.pause_windows.slice(-a.pause_windows.length) : [];
    if (tail.length !== a.pause_windows.length) { violations++; continue; }
    let ok = true;
    for (let k = 0; k < a.pause_windows.length; k++) {
      if (tail[k].start !== a.pause_windows[k].start || tail[k].resume_date !== a.pause_windows[k].resume_date) { ok = false; break; }
    }
    if (!ok) { violations++; continue; }
    // Strongest form: with a prior breach, the first in-window breach itself pauses.
    if (b.pause_windows.length === 0 || b.pause_windows[0].start !== breachDays[0]) { violations++; continue; }
  }
  return { name: 'P2_adding_a_prior_breach_never_shortens_a_pause', checked, violations };
}

// ---------- P3 (row-mandated): affiliate order does not change the output ----------
function checkP3_affiliateOrderInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    if (pp.affiliated_tsv_ids.length < 2) continue;
    checked++;
    const reversed = { ...pp, affiliated_tsv_ids: [...pp.affiliated_tsv_ids].reverse() };
    const a = compute(pp);
    const b = compute(reversed);
    if (a.output_payload.error || b.output_payload.error) {
      // Refusal-branch trial: invariance still requires both sides to agree.
      if (!!a.output_payload.error !== !!b.output_payload.error) violations++;
      continue;
    }
    const ap = a.output_payload, bp = b.output_payload;
    // The affiliate ORDER the caller declared is echoed verbatim, so compare the semantic
    // fields the computation produces: everything except the echoed id lists.
    const strip = (o) => JSON.stringify({ per_stock: o.per_stock, symbol_count: o.symbol_count, status_as_of: o.status_as_of, obligations: o.obligations, assumptions: o.assumptions });
    if (strip(ap) !== strip(bp)) violations++;
  }
  return { name: 'P3_affiliate_order_does_not_change_output', checked, violations };
}

// ---------- P4: refusal contract — named refusals fire with exact codes ----------
const REFUSAL_CONTRACT_CASES = [
  [{ as_of_date: '2026-10-11', stocks: [] }, 'tsv_id_required', 'TSV_ID_REQUIRED'],
  [{ tsv_id: 'X', as_of_date: '2026-13-99', stocks: [] }, 'as_of_date_invalid', 'AS_OF_DATE_INVALID'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', affiliated_tsv_ids: ['X'], stocks: [] }, 'affiliate_equals_tsv', 'AFFILIATE_EQUALS_TSV'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: 'AAA' }, 'stocks_required', 'STOCKS_REQUIRED'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_3', prior_month_adv_shares: 100 }] }, 'stock_tier_invalid', 'STOCK_TIER_INVALID'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 10.5 }] }, 'stock_adv_invalid', 'STOCK_ADV_INVALID'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: -5 }] }, 'stock_adv_not_positive', 'STOCK_ADV_NOT_POSITIVE'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'A', tier: 'tier_1', prior_month_adv_shares: 100 }, { symbol: 'A', tier: 'tier_2', prior_month_adv_shares: 100 }] }, 'stock_symbol_duplicated', 'STOCK_SYMBOL_DUPLICATED'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 100 }], daily_volume: [{ date: '2026-10-01', tsv_id: 'Y', symbol: 'AAA', shares: 1 }] }, 'volume_tsv_unknown', 'VOLUME_TSV_UNKNOWN'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 100 }], daily_volume: [{ date: '2026-10-01', tsv_id: 'X', symbol: 'BBB', shares: 1 }] }, 'volume_symbol_undeclared', 'VOLUME_SYMBOL_UNDECLARED'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 100 }], daily_volume: [{ date: '2026-10-01', tsv_id: 'X', symbol: 'AAA', shares: -1 }] }, 'volume_shares_invalid', 'VOLUME_SHARES_INVALID'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 100 }], daily_volume: [{ date: '2026-10-01', tsv_id: 'X', symbol: 'AAA', shares: 1 }, { date: '2026-10-01', tsv_id: 'X', symbol: 'AAA', shares: 1 }] }, 'volume_entry_duplicated', 'VOLUME_ENTRY_DUPLICATED'],
  [{ tsv_id: 'X', as_of_date: '2026-10-11', stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 100 }], prior_breaches: [{ symbol: 'QQQ', date: '2026-01-01' }] }, 'prior_breach_symbol_undeclared', 'PRIOR_BREACH_SYMBOL_UNDECLARED'],
];
function checkP4_refusalContract() {
  let violations = 0, checked = 0;
  for (const [pp, wantError, wantCode] of REFUSAL_CONTRACT_CASES) {
    const r = compute(pp);
    checked++;
    const out = r.output_payload;
    if (out.error !== wantError) { violations++; continue; }
    if (!r.compliance_flags.includes('INPUT_REFUSED')) violations++;
    const de = (out.domain_errors || [])[0] || {};
    if (de.code !== wantCode) violations++;
    if (typeof out.detail !== 'string' || out.detail.length === 0 || !out.detail.endsWith('.')) violations++;
    if (out.per_stock !== null || out.symbol_count !== null || out.status_as_of !== null) violations++;
  }
  return { name: 'P4_refusal_contract_every_named_refusal_fires_with_exact_code', checked, violations };
}

// ---------- P5: boundary forcing — exactly-at-cap is not a breach; cap+1 is; 75 vs 76 symbols ----------
function checkP5_boundaries() {
  let violations = 0, checked = 0;
  // adv 4,000,000 tier_1 -> floor(4,000,000 x 25/10000) = 10,000 exactly.
  const mk = (shares) => compute({
    tsv_id: 'TSV-A', affiliated_tsv_ids: [],
    stocks: [{ symbol: 'AAA', tier: 'tier_1', prior_month_adv_shares: 4000000 }],
    daily_volume: [{ date: '2026-10-01', tsv_id: 'TSV-A', symbol: 'AAA', shares }],
    as_of_date: '2026-10-02',
  }).output_payload.per_stock[0];
  checked++;
  if (mk(10000).breach_dates.length !== 0) violations++;   // exactly at cap: "exceeds" is strict
  checked++;
  if (mk(10001).breach_dates.length !== 1) violations++;   // cap+1 breaches
  // 75 vs 76 symbols on a day (tier_1), group-aggregated across affiliates.
  const syms = (n) => Array.from({ length: n }, (_, i) => 'S' + String(i + 1).padStart(3, '0'));
  const mkSym = (n, split) => compute({
    tsv_id: 'TSV-A', affiliated_tsv_ids: split.length > 1 ? ['TSV-B'] : [],
    stocks: syms(n).map((s) => ({ symbol: s, tier: 'tier_1', prior_month_adv_shares: 40000000 })),
    symbols_traded: syms(n).map((s, i) => ({ date: '2026-10-01', tsv_id: i < split[0] ? 'TSV-A' : 'TSV-B', symbol: s })),
    daily_volume: syms(n).map((s, i) => ({ date: '2026-10-01', tsv_id: i < split[0] ? 'TSV-A' : 'TSV-B', symbol: s, shares: 1 })),
    as_of_date: '2026-10-02',
  }).output_payload.symbol_count;
  checked++;
  if (mkSym(75, [75]).some((r) => r.breached)) violations++;      // 75th symbol: no breach
  checked++;
  if (!mkSym(76, [76]).every((r) => r.breached)) violations++;    // 76th symbol: breach
  checked++;
  const splitRows = mkSym(76, [38, 38]);
  if (splitRows.length === 0 || !splitRows.every((r) => r.breached)) violations++; // split across affiliates still aggregates to 76
  checked++;
  if (addCalendarMonths('2026-01-31', 3) !== '2026-04-30') violations++;
  checked++;
  if (addCalendarMonths('2026-03-31', 3) !== '2026-06-30') violations++;
  checked++;
  if (addCalendarMonths('2028-02-29', 3) !== '2028-05-29') violations++;
  return { name: 'P5_cap_and_symbol_boundaries_plus_month_end_clamp', checked, violations };
}

// ---------- P6: output shape — evidence-only contract on every success ----------
function checkP6_outputShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const pp = mkPP(rand);
    const r = compute(pp);
    const out = r.output_payload;
    checked++;
    if (out.error) continue;
    if (!Array.isArray(out.per_stock) || !Array.isArray(out.symbol_count) || !Array.isArray(out.obligations) || !Array.isArray(out.assumptions)) { violations++; continue; }
    if (typeof out.status_as_of !== 'object' || out.status_as_of === null) { violations++; continue; }
    if (!out.assumptions.some((a) => /no reset or look-back window/.test(a))) violations++;
    if (!out.assumptions.some((a) => /floor\(/.test(a))) violations++;
    if (!out.assumptions.some((a) => /never states or implies that the venue is/.test(a))) violations++;
    // every stock's daily rows agree: breached iff volume strictly greater than cap (cap non-null)
    for (const s of out.per_stock) {
      for (const d of s.daily) {
        if (s.daily_cap_shares !== null && d.breached !== (d.volume_shares > s.daily_cap_shares)) { violations++; break; }
        if (s.daily_cap_shares === null && d.breached) { violations++; break; }
      }
    }
  }
  return { name: 'P6_output_shape_and_evidence_only_contract', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_addingVolumeNeverRemovesBreach(),
  checkP2_priorBreachNeverShortensPause(),
  checkP3_affiliateOrderInvariance(),
  checkP4_refusalContract(),
  checkP5_boundaries(),
  checkP6_outputShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — ${properties.length} properties.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
