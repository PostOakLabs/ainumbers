import { executionHash } from './_hash.mjs';

// art-707-tsv-tier-cap-ladder — replays a tokenized-stock venue's (TSV's) daily per-symbol share
// volume and distinct-symbol counts, aggregated across the TSV and its declared affiliates, against
// the SEC TSV Exemption's tier caps and the condition F stepped-compliance ladder, and emits the
// pause windows the ladder forces.
//
// The rules implemented (each derived from FR 2026-19388, 91 FR 60174-76, 22 Sep 2026, condition F;
// the node-level citations live in the node metadata per KERNEL-CITATION-CLASS-1):
//   R1 volume cap: per stock per day, summed over the TSV + affiliates, against
//      floor(prior_month_adv_shares x bps / 10000) with bps 25 (tier_1) or 250 (tier_2);
//      a breach is volume STRICTLY GREATER than the cap ("cannot exceed"/"exceeds").
//   R2 symbol cap: distinct symbols per tier per day across the same group, against 75 / 250,
//      breach strictly greater.
//   R3 ladder (volume only): the first breach in a given stock requires no action; every later
//      breach in that stock forces an immediate three-month pause in that stock, affiliates
//      included. The order states no reset or look-back window — the node applies none.
//   R4 symbol-count breaches get no first-breach pass; the order states the consequence (the TSV
//      would not meet the conditions of the TSV Exemption) and states no pause for them, so the
//      node reports the obligation and imposes no pause.
//   R5 pause window: start = breach date; resume date = start plus three calendar months, clamped
//      to the month's last day when the day does not exist (31 Jan + 3 months -> 30 Apr).
//
// Integer share arithmetic everywhere; the only rounding is the cap floor, which is stated in the
// output assumptions and is the conservative direction (a floor never inflates a cap).
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, where TextEncoder/atob/btoa/URL
// are ABSENT (GUEST-BUILTIN-GATE-1). This kernel needs no UTF-8 encoding, so no encoder is carried.

const TOOL_ID = 'art-707-tsv-tier-cap-ladder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_tsv_tier_cap_ladder',
  mandate_type: 'compliance_control', gpu: false,
};

const TIERS = ['tier_1', 'tier_2'];
const TIER_BPS = { tier_1: 25, tier_2: 250 };
const TIER_SYMBOL_CAP = { tier_1: 75, tier_2: 250 };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Structural AND calendar validity: 2026-13-99 matches the shape but is not a date.
function isRealDate(s) {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }

// R4 (MR-R4-NULL-REGRESSION-GATE-1): an explicit null must get exactly the absent
// form's answer. Strip nulls to undefined at entry so every downstream path —
// defaults, refusals, Number() coercion — sees the two forms identically.
function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      per_stock: null,
      symbol_count: null,
      status_as_of: null,
      obligations: [],
      assumptions: [],
    },
    compliance_flags: ['INPUT_REFUSED'],
  };
}

// Calendar-month arithmetic: breach date + 3 months, clamped to the month's last day
// (2026-01-31 -> 2026-04-30). Returns the resume date ("three months from the date the TSV
// exceeded the volume threshold", 91 FR 60175).
export function addCalendarMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12; // 0-based month
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, dim);
  return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');
}

function cmpDate(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

/**
 * compute(pp) — pure decision kernel. Evidence artifact only: it replays the caller-supplied
 * record and reports breaches, pause windows and the obligations the order states; it never
 * states or implies that the venue is compliant.
 *
 * pp: {
 *   tsv_id: string,
 *   affiliated_tsv_ids?: string[],
 *   stocks: [{ symbol, tier: 'tier_1'|'tier_2', prior_month_adv_shares: int|null }],
 *   daily_volume?: [{ date, tsv_id, symbol, shares: int }],
 *   symbols_traded?: [{ date, tsv_id, symbol }],
 *   prior_breaches?: [{ symbol, date }],
 *   as_of_date: 'YYYY-MM-DD',
 * }
 */
export function compute(pp) {
  pp = deNull(pp || {});

  const tsvId = pp.tsv_id;
  if (typeof tsvId !== 'string' || tsvId.trim() === '') {
    return refusal('TSV_ID_REQUIRED', 'tsv_id must be a non-empty string naming the venue being replayed; got ' + JSON.stringify(tsvId ?? null) + '.');
  }
  const asOf = pp.as_of_date;
  if (typeof asOf !== 'string' || !isRealDate(asOf)) {
    return refusal('AS_OF_DATE_INVALID', 'as_of_date must be a YYYY-MM-DD date; got ' + JSON.stringify(asOf ?? null) + '.');
  }
  const affiliates = pp.affiliated_tsv_ids === undefined ? [] : pp.affiliated_tsv_ids;
  if (!Array.isArray(affiliates) || affiliates.some((a) => typeof a !== 'string' || a.trim() === '')) {
    return refusal('AFFILIATED_TSV_IDS_INVALID', 'affiliated_tsv_ids, when present, must be an array of non-empty strings; got ' + JSON.stringify(pp.affiliated_tsv_ids ?? null) + '.');
  }
  if (affiliates.includes(tsvId)) {
    return refusal('AFFILIATE_EQUALS_TSV', 'affiliated_tsv_ids must not repeat the venue\u2019s own tsv_id (' + tsvId + '); the venue\u2019s volume is already included.');
  }
  const group = [tsvId, ...affiliates];

  const stocksIn = pp.stocks;
  if (!Array.isArray(stocksIn)) {
    return refusal('STOCKS_REQUIRED', 'stocks must be an array of { symbol, tier, prior_month_adv_shares }; got ' + JSON.stringify(stocksIn ?? null) + '.');
  }
  const stockBySymbol = new Map();
  for (let i = 0; i < stocksIn.length; i++) {
    const s = deNull(stocksIn[i] || {});
    const sym = s.symbol;
    if (typeof sym !== 'string' || sym.trim() === '') {
      return refusal('STOCK_SYMBOL_REQUIRED', 'stocks[' + i + '].symbol must be a non-empty string; got ' + JSON.stringify(sym ?? null) + '.');
    }
    if (stockBySymbol.has(sym)) {
      return refusal('STOCK_SYMBOL_DUPLICATED', 'stocks[' + i + '] repeats symbol ' + sym + '; each symbol must be declared once.');
    }
    const tier = s.tier;
    if (!TIERS.includes(tier)) {
      return refusal('STOCK_TIER_INVALID', 'stocks[' + i + '] (' + sym + ') tier must be one of "tier_1" or "tier_2" (caller-declared, no LULD lookup); got ' + JSON.stringify(tier ?? null) + '.');
    }
    const adv = s.prior_month_adv_shares;
    if (adv !== undefined && !isInt(adv)) {
      return refusal('STOCK_ADV_INVALID', 'stocks[' + i + '] (' + sym + ') prior_month_adv_shares, when present, must be an integer share count; got ' + JSON.stringify(s.prior_month_adv_shares ?? null) + '. Pass null or omit it to have the stock reported INDETERMINATE.');
    }
    if (adv !== undefined && adv <= 0) {
      return refusal('STOCK_ADV_NOT_POSITIVE', 'stocks[' + i + '] (' + sym + ') prior_month_adv_shares must be a positive integer when present; got ' + adv + '.');
    }
    stockBySymbol.set(sym, { symbol: sym, tier, prior_month_adv_shares: adv === undefined ? null : adv });
  }

  const dailyIn = pp.daily_volume === undefined ? [] : pp.daily_volume;
  if (!Array.isArray(dailyIn)) {
    return refusal('DAILY_VOLUME_INVALID', 'daily_volume, when present, must be an array of { date, tsv_id, symbol, shares }; got ' + JSON.stringify(pp.daily_volume ?? null) + '.');
  }
  const volByKey = new Map(); // symbol \0 date -> shares summed over the declared group
  const volRowSeen = new Set(); // tsv_id \0 symbol \0 date
  for (let i = 0; i < dailyIn.length; i++) {
    const r = deNull(dailyIn[i] || {});
    if (typeof r.date !== 'string' || !isRealDate(r.date)) {
      return refusal('VOLUME_DATE_INVALID', 'daily_volume[' + i + '].date must be a YYYY-MM-DD date; got ' + JSON.stringify(r.date ?? null) + '.');
    }
    if (typeof r.tsv_id !== 'string' || !group.includes(r.tsv_id)) {
      return refusal('VOLUME_TSV_UNKNOWN', 'daily_volume[' + i + '].tsv_id (' + JSON.stringify(r.tsv_id ?? null) + ') is neither tsv_id nor a member of affiliated_tsv_ids; this node aggregates only the declared group.');
    }
    if (!stockBySymbol.has(r.symbol)) {
      return refusal('VOLUME_SYMBOL_UNDECLARED', 'daily_volume[' + i + '] references symbol ' + JSON.stringify(r.symbol ?? null) + ', which is not declared in stocks[]; declare every symbol before replaying its volume.');
    }
    if (!isInt(r.shares) || r.shares < 0) {
      return refusal('VOLUME_SHARES_INVALID', 'daily_volume[' + i + '].shares must be a non-negative integer share count; got ' + JSON.stringify(r.shares ?? null) + '.');
    }
    const key = r.symbol + '\u0000' + r.date;
    const rowKey = r.tsv_id + '\u0000' + key;
    if (volRowSeen.has(rowKey)) {
      return refusal('VOLUME_ENTRY_DUPLICATED', 'daily_volume[' + i + '] repeats (tsv_id, date, symbol) (' + r.tsv_id + ', ' + r.date + ', ' + r.symbol + '); submit one row per venue per day per symbol — rows for the venue and its affiliates are aggregated.');
    }
    volRowSeen.add(rowKey);
    volByKey.set(key, (volByKey.get(key) || 0) + r.shares);
  }

  const symTradedIn = pp.symbols_traded === undefined ? null : pp.symbols_traded;
  if (symTradedIn !== null && !Array.isArray(symTradedIn)) {
    return refusal('SYMBOLS_TRADED_INVALID', 'symbols_traded, when present, must be an array of { date, tsv_id, symbol }; got ' + JSON.stringify(symTradedIn ?? null) + '.');
  }
  // Symbol days per tier: tier -> date -> Set(symbol). When symbols_traded is absent, derive
  // from daily_volume (a day with reported volume is a day the symbol traded).
  const symDays = { tier_1: new Map(), tier_2: new Map() };
  const addSymDay = (date, symbol) => {
    const tier = stockBySymbol.get(symbol).tier;
    if (!symDays[tier].has(date)) symDays[tier].set(date, new Set());
    symDays[tier].get(date).add(symbol);
  };
  if (symTradedIn !== null) {
    for (let i = 0; i < symTradedIn.length; i++) {
      const r = deNull(symTradedIn[i] || {});
      if (typeof r.date !== 'string' || !isRealDate(r.date)) {
        return refusal('SYMBOL_DAY_DATE_INVALID', 'symbols_traded[' + i + '].date must be a YYYY-MM-DD date; got ' + JSON.stringify(r.date ?? null) + '.');
      }
      if (typeof r.tsv_id !== 'string' || !group.includes(r.tsv_id)) {
        return refusal('SYMBOL_DAY_TSV_UNKNOWN', 'symbols_traded[' + i + '].tsv_id (' + JSON.stringify(r.tsv_id ?? null) + ') is neither tsv_id nor a member of affiliated_tsv_ids.');
      }
      if (!stockBySymbol.has(r.symbol)) {
        return refusal('SYMBOL_DAY_SYMBOL_UNDECLARED', 'symbols_traded[' + i + '] references symbol ' + JSON.stringify(r.symbol ?? null) + ', which is not declared in stocks[].');
      }
      addSymDay(r.date, r.symbol);
    }
  } else {
    for (const key of volByKey.keys()) {
      const nul = key.indexOf('\u0000');
      addSymDay(key.slice(nul + 1), key.slice(0, nul));
    }
  }

  const priorIn = pp.prior_breaches === undefined ? [] : pp.prior_breaches;
  if (!Array.isArray(priorIn)) {
    return refusal('PRIOR_BREACHES_INVALID', 'prior_breaches, when present, must be an array of { symbol, date }; got ' + JSON.stringify(pp.prior_breaches ?? null) + '.');
  }
  const priorBySymbol = new Map();
  for (let i = 0; i < priorIn.length; i++) {
    const r = deNull(priorIn[i] || {});
    if (typeof r.date !== 'string' || !isRealDate(r.date)) {
      return refusal('PRIOR_BREACH_DATE_INVALID', 'prior_breaches[' + i + '].date must be a YYYY-MM-DD date; got ' + JSON.stringify(r.date ?? null) + '.');
    }
    if (!stockBySymbol.has(r.symbol)) {
      return refusal('PRIOR_BREACH_SYMBOL_UNDECLARED', 'prior_breaches[' + i + '] references symbol ' + JSON.stringify(r.symbol ?? null) + ', which is not declared in stocks[].');
    }
    if (!priorBySymbol.has(r.symbol)) priorBySymbol.set(r.symbol, []);
    priorBySymbol.get(r.symbol).push(r.date);
  }

  // Dates present in the record, ascending.
  const allDates = [...new Set([...volByKey.keys()].map((k) => k.slice(k.indexOf('\u0000') + 1)))].sort();

  const per_stock = [];
  const obligations = [];
  const obligationsSeen = new Set();
  const addObligation = (text) => { if (!obligationsSeen.has(text)) { obligationsSeen.add(text); obligations.push(text); } };

  for (const stock of stockBySymbol.values()) {
    const bps = TIER_BPS[stock.tier];
    const adv = stock.prior_month_adv_shares;
    const cap = adv === null ? null : Math.floor((adv * bps) / 10000);

    // In-window volume breaches, ascending.
    const breachDates = [];
    const daily = [];
    for (const date of allDates) {
      const vol = volByKey.get(stock.symbol + '\u0000' + date);
      if (vol === undefined) continue;
      const breached = cap !== null && vol > cap;
      if (breached) breachDates.push(date);
      daily.push({ date, volume_shares: vol, cap_shares: cap, breached });
    }

    // Ladder history: prior breaches (caller-recorded) first, then the in-window breaches.
    const priors = (priorBySymbol.get(stock.symbol) || []).slice().sort();
    const firstEver = priors.length > 0 ? priors[0] : (breachDates.length > 0 ? breachDates[0] : null);

    const pause_windows = [];
    if (firstEver !== null) {
      for (const d of breachDates) {
        if (cmpDate(d, firstEver) > 0) {
          pause_windows.push({
            start: d,
            resume_date: addCalendarMonths(d, 3),
            trigger: 'subsequent volume breach — the TSV must immediately pause trading in this Tokenized NMS Stock for three months, affiliated TSVs included (91 FR 60175 and fn. 75)',
            obligations: [
              'Immediately notify TSV Participants of the pause in trading through any regular means of communication (91 FR 60175-76).',
              'Amend the TSV\u2019s public Notice within five business days of the pause (91 FR 60175-76).',
            ],
          });
        }
      }
    }

    // Status as of as_of_date: paused when as_of_date lies in [start, resume_date).
    let status = 'TRADING';
    if (cap === null) {
      status = 'INDETERMINATE';
    } else {
      let pausedUntil = null;
      for (const w of pause_windows) {
        if (cmpDate(asOf, w.start) >= 0 && cmpDate(asOf, w.resume_date) < 0) {
          if (pausedUntil === null || cmpDate(w.resume_date, pausedUntil) > 0) pausedUntil = w.resume_date;
        }
      }
      if (pausedUntil !== null) status = 'PAUSED_UNTIL ' + pausedUntil;
    }

    per_stock.push({
      symbol: stock.symbol,
      tier: stock.tier,
      prior_month_adv_shares: adv,
      volume_cap_bps: bps,
      daily_cap_shares: cap,
      daily,
      breach_dates: breachDates,
      prior_breach_dates: priors,
      breach_count_including_prior: priors.length + breachDates.length,
      first_breach_pass_used: firstEver !== null,
      pause_windows,
      paused_as_of: status,
    });

    if (pause_windows.length > 0) {
      addObligation('Volume ladder (91 FR 60175): after the first time a TSV exceeds the volume threshold in a given Tokenized NMS Stock, each subsequent exceedance requires the TSV to immediately pause trading in that stock for three months, and affiliated TSVs must accordingly pause trading in the same stock (fn. 75). The first exceedance itself required no action beyond not exceeding the thresholds going forward.');
      addObligation('Pause record (91 FR 60175-76): each time the TSV has paused trading in a Tokenized NMS Stock in connection with the volume threshold — TSV-initiated or pursuant to the condition — it must immediately notify its TSV Participants through any regular means of communication and amend its public Notice within five business days.');
    }
  }

  // Symbol counts per tier per day, against the 75 / 250 symbol caps (R2/R4).
  const symbol_count = [];
  const symBreachCount = { tier_1: 0, tier_2: 0 };
  for (const tier of TIERS) {
    const cap = TIER_SYMBOL_CAP[tier];
    const dates = [...symDays[tier].keys()].sort();
    for (const date of dates) {
      const distinct = symDays[tier].get(date).size;
      const breached = distinct > cap;
      if (breached) symBreachCount[tier]++;
      symbol_count.push({ date, tier, distinct_symbols: distinct, symbol_cap: cap, breached });
    }
  }
  if (symBreachCount.tier_1 + symBreachCount.tier_2 > 0) {
    addObligation('Symbol caps (91 FR 60174): Tier 1 Tokenized NMS Stock traded on a TSV cannot exceed 75 symbols and 0.25 percent of the prior month\u2019s average daily share volume; Tier 2 cannot exceed 250 symbols and 2.5 percent. Volume and symbol counts are aggregated across the TSV and its affiliated TSVs.');
    addObligation('Symbol-count breach consequence (91 FR 60175, fn. 74): the stepped-compliance first-breach pass applies only to the volume limitations, not to the limitations on the number of symbols — a TSV that exceeds the symbol number thresholds would not meet the conditions of the TSV Exemption. The order states no pause for a symbol-count exceedance, so this node reports it and imposes none.');
  }

  const assumptions = [
    'Reset-window assumption: the order states no reset or look-back window for the volume-breach ladder, so the node applies none — the first-breach pass is consumed once per stock across all supplied data (prior_breaches plus the replayed window) and is never restored (91 FR 60175).',
    'Pause arithmetic assumption: a pause starts on the breach date and the stock may resume trading three calendar months from that date (91 FR 60175), with month-end clamping when the day does not exist (31 Jan + 3 months = 30 Apr); the resume date itself is a trading day (the window is [start, resume_date)).',
    'Rounding statement (the only rounding): the daily volume cap in integer shares is floor(prior_month_adv_shares x 25/10000) for tier_1 and floor(prior_month_adv_shares x 250/10000) for tier_2 (91 FR 60174); a breach is volume strictly greater than the cap ("exceeds"). The floor is the conservative direction — it never inflates a cap.',
    'Ordering assumption: where a prior breach and an in-window breach share a date, the prior breach is treated as the earlier one.',
    'Breach-during-pause assumption: a breach date falling inside an existing pause window is still recorded and still triggers its own three-month pause from that date; the order does not address trading that should not have occurred during a pause, so the node records rather than judges it.',
    'Exclusions: tiers and prior-month ADV are caller-declared — the node performs no LULD Plan lookup and no effective-transaction-reporting-plan lookup (91 FR 60174 defines the ADV denominator as reported by such a plan); a stock with no declared prior-month ADV is reported INDETERMINATE rather than given an assumed ADV; aggregation covers only the declared tsv_id and affiliated_tsv_ids; the node never looks up LULD trading halts. This is an evidence artifact only: it never states or implies that the venue is, or is not, compliant.',
  ];

  const output_payload = {
    tsv_id: tsvId,
    affiliated_tsv_ids: affiliates,
    as_of_date: asOf,
    per_stock,
    symbol_count,
    status_as_of: per_stock.reduce((acc, s) => { acc[s.symbol] = s.paused_as_of; return acc; }, {}),
    obligations,
    assumptions,
    note: 'Evidence replay only: breaches, pause windows and the obligations the order states, computed over caller-supplied data. It never states that the venue is compliant.',
  };

  return { output_payload, compliance_flags: [] };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
