/**
 * art-576-emir3-active-account-representativeness-classifier.kernel.mjs
 *
 * CAPMKT wave (CAPMKT-WAVE-BUILD-SPEC.md Sec.2, CAPMKT-EMIR3AAR-1) -- classifies
 * an EU counterparty's Active Account Requirement (AAR) posture under EMIR
 * Article 7a (as inserted by Regulation (EU) 2024/2987, "EMIR 3.0") against
 * three obligations: whether the active-account obligation applies and is
 * met, whether the representativeness obligation applies and is met, and
 * whether a reporting submission falls within the applicable Article 10
 * reporting window. Local EMIR coverage today (art-153..158) is trade-report
 * field/lifecycle/UTI/UPI validation only -- this node is a distinct
 * self-check surface for the AAR, not a duplicate.
 *
 * CITATIONS (re-verify against the primary text before relying on any figure
 * here -- this build re-verified against EUR-Lex, not a law-firm summary):
 *   - Article 7a(1) EMIR (inserted by Regulation (EU) 2024/2987, OJ L,
 *     2024/2987, 24.12.2024): the active-account obligation itself -- an
 *     in-scope counterparty "shall hold... at least one active account at a
 *     CCP authorised under Article 14" for the categories in paragraph 6.
 *   - Article 7a(6) EMIR: the in-scope categories -- "(a) interest rate
 *     derivatives denominated in euro or Polish zloty; (b) short-term
 *     interest rate derivatives denominated in euro."
 *   - Article 7a(4) EMIR: the representativeness carve-out -- "shall not
 *     apply to counterparties with a notional clearing volume outstanding of
 *     less than EUR 6 billion in the derivative contracts referred to in
 *     paragraph 6," and the minimum-trade rule -- "counterparties shall
 *     clear, on [an] annual average basis, at least five trades in each of
 *     the most relevant subcategories per class of derivative contracts and
 *     per reference period."
 *   - Commission Delegated Regulation (EU) 2026/305 (the AAR RTS; ESMA final
 *     report 2025-06-19, Commission adoption 2025-10-29, OJ publication
 *     2026-02-06, entry into force 2026-02-26): Articles 4-6 define the
 *     subcategory bucketing tables (Annex I) this kernel encodes below;
 *     Article 10 sets the reporting cadence -- "last day of January and...
 *     last day of July each year," first submission "no earlier than six
 *     months from 26 February 2026." Spec states the first report as a
 *     dated fact (2026-07-31, already past at build date 2026-08-07); this
 *     kernel treats that date as the first cycle anchor rather than
 *     re-deriving it, per the spec's own instruction.
 *
 * SUBCATEGORY BUCKETING (RTS Annex I, deterministic table lookup on
 * caller-declared trade size and maturity -- no market data, no network):
 *   eur_fixed_float (Art 4, Table 1): size EUR-mn [0-25],(25-50],(50+);
 *     maturity months [0-60],(60-120],(120-180],(180+)
 *   eur_ois         (Art 4, Table 2): size EUR-mn [0-25],(25-100],(100+);
 *     maturity months [0-12],(12-24],(24-60],(60+)
 *   eur_fra         (Art 4, Table 3): size EUR-mn [0-75],(75-200],(200+);
 *     maturity months [0-6],(6-12],(12-18],(18+)
 *   pln_fixed_float (Art 5, Table 4): single bucket, any size, any maturity
 *   pln_fra         (Art 5, Table 5): single bucket, any size, any maturity
 *   eur_stir_euribor(Art 6, Table 7): any size; maturity months
 *     [0-6],(6-12],(12-24],(24+)
 *   eur_stir_ester  (Art 6, Table 8): any size; maturity months
 *     [0-6],(6-12],(12-24],(24+)
 *
 * WHAT THIS KERNEL DOES NOT DO. It does not derive which of a class's
 * buckets are ESMA's "most relevant" subcategories for a reference period --
 * that is a market-wide volume ranking published externally, not computable
 * from one counterparty's own trades, and is taken here as a caller-declared
 * fact (subcategory_designations[].most_relevant), named in not_proven[].
 * The 5-trades-per-bucket test is annualized by simple linear scaling from
 * the caller-declared reference_period_months, a documented simplification.
 * It is not legal advice, and does not determine whether any given trade
 * qualifies as "cleared" under Article 7a beyond the caller's own
 * declaration.
 *
 * FINITE GATE. Every branch resolves to a defined verdict; no unrecognised
 * trade class, missing size/maturity, or empty array reaches NaN/undefined.
 * Unusable inputs are coerced and named in rejected_inputs[], never
 * silently dropped.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() --
 * every date is caller-declared and parsed as plain Y-M-D integers.
 *
 * Spec: CAPMKT-WAVE-BUILD-SPEC.md Sec.2, Sec.Common.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-576-emir3-active-account-representativeness-classifier';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'classify_emir3_active_account_status',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const SIX_BILLION_EUR_MINOR_UNITS = 6000000000 * 100; // EUR 6,000,000,000.00 in minor units (cents).
const FIRST_REPORTING_DEADLINE = '2026-07-31'; // Art 10(2) RTS anchor; spec states as a dated fact.
const REPORTING_DEADLINE_ANCHOR_ISO_DATE = '2026-02-26'; // RTS entry into force.

const CLASS_DEFS = {
  eur_fixed_float: {
    category: 'eur_pln_ird', article: 'RTS Art 4 Table 1',
    size_bounds_eur_millions: [25, 50], maturity_bounds_months: [60, 120, 180],
  },
  eur_ois: {
    category: 'eur_pln_ird', article: 'RTS Art 4 Table 2',
    size_bounds_eur_millions: [25, 100], maturity_bounds_months: [12, 24, 60],
  },
  eur_fra: {
    category: 'eur_pln_ird', article: 'RTS Art 4 Table 3',
    size_bounds_eur_millions: [75, 200], maturity_bounds_months: [6, 12, 18],
  },
  pln_fixed_float: {
    category: 'eur_pln_ird', article: 'RTS Art 5 Table 4',
    size_bounds_eur_millions: null, maturity_bounds_months: null, // any/any -- single bucket.
  },
  pln_fra: {
    category: 'eur_pln_ird', article: 'RTS Art 5 Table 5',
    size_bounds_eur_millions: null, maturity_bounds_months: null,
  },
  eur_stir_euribor: {
    category: 'eur_stir', article: 'RTS Art 6 Table 7',
    size_bounds_eur_millions: null, maturity_bounds_months: [6, 12, 24],
  },
  eur_stir_ester: {
    category: 'eur_stir', article: 'RTS Art 6 Table 8',
    size_bounds_eur_millions: null, maturity_bounds_months: [6, 12, 24],
  },
};
const CLASS_IDS = Object.keys(CLASS_DEFS);

const CITATIONS = {
  active_account_obligation: {
    source: 'Article 7a(1) and 7a(6) EMIR (inserted by Regulation (EU) 2024/2987)',
    detail: 'An in-scope counterparty shall hold at least one active account at an Article-14-authorised CCP for the categories in paragraph 6 (EUR/PLN interest rate derivatives; EUR short-term interest rate derivatives).',
  },
  representativeness_threshold: {
    source: 'Article 7a(4) EMIR',
    detail: 'The representativeness obligation does not apply to counterparties with a notional clearing volume outstanding below EUR 6 billion in the paragraph-6 derivative contracts.',
  },
  representativeness_test: {
    source: 'Article 7a(4) EMIR',
    detail: 'Counterparties above the threshold shall clear, on an annual average basis, at least five trades in each of the most relevant subcategories per class of derivative contracts and per reference period.',
  },
  subcategory_tables: {
    source: 'Commission Delegated Regulation (EU) 2026/305, Articles 4-6 and Annex I',
    detail: 'Defines the size/maturity subcategory bucketing tables per class: EUR fixed-to-float, OIS, FRA (Article 4); PLN fixed-to-float and FRA, single any/any bucket (Article 5); EUR STIR Euribor and euro short-term rate, maturity-only buckets (Article 6).',
  },
  reporting_window: {
    source: 'Commission Delegated Regulation (EU) 2026/305, Article 10',
    detail: 'Reports are due on the last day of January and the last day of July each year. The first submission falls no earlier than six months from the RTS entry into force of 2026-02-26; the spec states the first report as the dated fact 2026-07-31.',
  },
};

const NOT_PROVEN = [
  { item: 'Not legal advice', detail: 'This kernel classifies an Article 7a active-account and representativeness posture from caller-declared facts. It is not a substitute for counsel, ESMA, or the counterparty\'s own compliance review.' },
  { item: 'Most-relevant subcategory designation', detail: 'Which subcategories are the class\'s ESMA-designated "most relevant" ones for a reference period is a market-wide volume ranking published externally, not derivable from one counterparty\'s own trades. This kernel takes it as a caller-declared fact (subcategory_designations[].most_relevant) and does not verify it against any external source.' },
  { item: 'Annualization is a linear simplification', detail: 'A trade count over a reference period shorter than 12 months is annualized by simple linear scaling (count * 12 / reference_period_months). This is a documented simplification, not a seasonally-aware estimate.' },
  { item: 'Trade-level "cleared" status is asserted', detail: 'Whether a declared trade was in fact cleared at an authorised CCP, and its size/maturity/class classification, are caller-supplied and asserted, not independently verified against a CCP or trade repository record.' },
  { item: 'Clearing-threshold exceedance is asserted', detail: 'Whether the counterparty exceeds the Article 4a EMIR clearing threshold for each category is a caller-declared boolean, not independently recomputed here.' },
];

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function isBool(v) { return typeof v === 'boolean'; }

function toIntField(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return null; }
  rejected.push({ where, reason: typeof v === 'number' ? 'not a safe integer' : `expected an integer, got ${typeof v}`, supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v) });
  return null;
}

// Plain Y-M-D integer date math -- no wall-clock read, no timezone ambiguity.
// Accepts only a caller-declared 'YYYY-MM-DD' string; never Date.now().
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseIsoDate(v, where, rejected) {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v.trim())) {
    rejected.push({ where, reason: 'not an ISO YYYY-MM-DD date string', supplied: v === undefined || v === null ? null : String(v) });
    return null;
  }
  const m = ISO_DATE_RE.exec(v.trim());
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    rejected.push({ where, reason: 'month/day out of range', supplied: v });
    return null;
  }
  return { y, m: mo, d, iso: `${m[1]}-${m[2]}-${m[3]}` };
}
function dateToEpochDay(dt) { return Date.UTC(dt.y, dt.m - 1, dt.d) / 86400000; }
function cmpDate(a, b) { return dateToEpochDay(a) - dateToEpochDay(b); }

function lastDayOfJanOrJulOnOrAfter(dt) {
  // Smallest {y,1,31} or {y,7,31} with epoch day >= dt's epoch day.
  const candidates = [];
  for (const yOff of [0, 1]) {
    candidates.push({ y: dt.y + yOff, m: 1, d: 31, iso: `${dt.y + yOff}-01-31` });
    candidates.push({ y: dt.y + yOff, m: 7, d: 31, iso: `${dt.y + yOff}-07-31` });
  }
  candidates.sort(cmpDate);
  for (const c of candidates) { if (cmpDate(c, dt) >= 0) return c; }
  return candidates[candidates.length - 1];
}
function sixMonthsBefore(dt) {
  // Jan 31 -> prior Jul 31 (same year - 1 .. ); Jul 31 -> same-year Jan 31.
  if (dt.m === 1) return { y: dt.y - 1, m: 7, d: 31, iso: `${dt.y - 1}-07-31` };
  return { y: dt.y, m: 1, d: 31, iso: `${dt.y}-01-31` };
}

function bucketIdForTrade(t) {
  const def = CLASS_DEFS[t.class];
  if (!def) return null;
  if (def.size_bounds_eur_millions === null && def.maturity_bounds_months === null) {
    return `${t.class}:any:any`;
  }
  let sizeLabel = 'any';
  if (def.size_bounds_eur_millions !== null) {
    const [b1, b2] = def.size_bounds_eur_millions;
    const sizeMn = t.trade_notional_minor_units / 100 / 1000000;
    sizeLabel = sizeMn <= b1 ? `[0-${b1}M]` : sizeMn <= b2 ? `(${b1}-${b2}M]` : `(${b2}M+)`;
  }
  let maturityLabel = 'any';
  if (def.maturity_bounds_months !== null) {
    const [m1, m2, m3] = def.maturity_bounds_months;
    const mo = t.maturity_months;
    maturityLabel = mo <= m1 ? `[0-${m1}mo]` : mo <= m2 ? `(${m1}-${m2}mo]` : mo <= m3 ? `(${m2}-${m3}mo]` : `(${m3}mo+)`;
  }
  return `${t.class}:${sizeLabel}:${maturityLabel}`;
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const counterparty_ref = str(pp.counterparty_ref, 'UNSTATED');
  const as_of_date = parseIsoDate(pp.as_of_date, 'as_of_date', rejected_inputs);

  const threshExceeded = obj(pp.clearing_threshold_exceeded);
  const eurPlnIrdExceeded = threshExceeded.eur_pln_ird === true;
  const eurStirExceeded = threshExceeded.eur_stir === true;
  const eurPlnIrdDeclared = isBool(threshExceeded.eur_pln_ird);
  const eurStirDeclared = isBool(threshExceeded.eur_stir);
  if (!eurPlnIrdDeclared) rejected_inputs.push({ where: 'clearing_threshold_exceeded.eur_pln_ird', reason: 'absent or not boolean; treated as not exceeded', supplied: threshExceeded.eur_pln_ird === undefined ? null : String(threshExceeded.eur_pln_ird) });
  if (!eurStirDeclared) rejected_inputs.push({ where: 'clearing_threshold_exceeded.eur_stir', reason: 'absent or not boolean; treated as not exceeded', supplied: threshExceeded.eur_stir === undefined ? null : String(threshExceeded.eur_stir) });

  const in_scope_eur_pln_ird = eurPlnIrdExceeded;
  const in_scope_eur_stir = eurStirExceeded;
  const in_scope_any = in_scope_eur_pln_ird || in_scope_eur_stir;

  // ── Obligation 1: active account. ───────────────────────────────────────
  const activeAccount = obj(pp.active_account);
  let active_account_verdict, active_account_reason;
  if (!in_scope_any) {
    active_account_verdict = 'EXEMPT';
    active_account_reason = 'Neither in-scope category (Art 7a(6)(a) EUR/PLN IRD, (b) EUR STIR) is declared as exceeding the clearing threshold, so the Article 7a(1) active-account obligation does not apply.';
  } else if (!isBool(activeAccount.established)) {
    active_account_verdict = 'INDETERMINATE';
    active_account_reason = 'active_account.established was not declared as a boolean, so active-account status cannot be classified.';
    rejected_inputs.push({ where: 'active_account.established', reason: 'absent or not boolean', supplied: activeAccount.established === undefined ? null : String(activeAccount.established) });
  } else if (activeAccount.established === false) {
    active_account_verdict = 'NOT_MET';
    active_account_reason = 'The counterparty is in scope of Article 7a(1) and no active account is declared as established.';
  } else if (!isBool(activeAccount.ccp_article14_authorised)) {
    active_account_verdict = 'INDETERMINATE';
    active_account_reason = 'An active account is declared established but whether the CCP is Article-14-authorised was not declared as a boolean.';
    rejected_inputs.push({ where: 'active_account.ccp_article14_authorised', reason: 'absent or not boolean', supplied: activeAccount.ccp_article14_authorised === undefined ? null : String(activeAccount.ccp_article14_authorised) });
  } else if (activeAccount.ccp_article14_authorised === false) {
    active_account_verdict = 'NOT_MET';
    active_account_reason = 'An active account is declared established, but the CCP holding it is declared NOT Article-14-authorised, so Article 7a(1) is not satisfied.';
  } else {
    active_account_verdict = 'MET';
    active_account_reason = 'An active account is declared established at an Article-14-authorised CCP.';
  }

  // ── Trade bucketing (Annex I tables, deterministic). ────────────────────
  const tradesIn = arr(pp.trades);
  const trades = [];
  for (let i = 0; i < tradesIn.length; i++) {
    const t = obj(tradesIn[i]);
    const trade_id = str(t.trade_id, `TRADE-${i + 1}`);
    const clsSupplied = str(t.class, '');
    const cls = CLASS_IDS.indexOf(clsSupplied) !== -1 ? clsSupplied : null;
    if (cls === null) { rejected_inputs.push({ where: `trades[${i}].class`, reason: clsSupplied === '' ? 'absent' : `not one of ${CLASS_IDS.join(', ')}`, supplied: clsSupplied === '' ? null : clsSupplied }); continue; }
    const def = CLASS_DEFS[cls];
    let notionalMinor = null;
    if (def.size_bounds_eur_millions !== null) {
      notionalMinor = toIntField(t.trade_notional_minor_units, `trades[${i}].trade_notional_minor_units`, rejected_inputs);
      if (notionalMinor === null) continue;
    }
    let maturityMonths = null;
    if (def.maturity_bounds_months !== null) {
      maturityMonths = toIntField(t.maturity_months, `trades[${i}].maturity_months`, rejected_inputs);
      if (maturityMonths === null) continue;
    }
    const cleared = t.cleared === true;
    const bucket_id = bucketIdForTrade({ class: cls, trade_notional_minor_units: notionalMinor, maturity_months: maturityMonths });
    trades.push({ trade_id, class: cls, category: def.category, trade_notional_minor_units: notionalMinor, maturity_months: maturityMonths, cleared, bucket_id });
  }

  const referencePeriodMonths = toIntField(pp.reference_period_months, 'reference_period_months', []) ;
  const referencePeriodMonthsValid = isSafeIntAmount(pp.reference_period_months) && pp.reference_period_months > 0;
  if (!referencePeriodMonthsValid) rejected_inputs.push({ where: 'reference_period_months', reason: 'absent or not a positive integer', supplied: pp.reference_period_months === undefined ? null : String(pp.reference_period_months) });

  // Aggregate cleared-trade counts per bucket_id.
  const bucketCounts = {};
  for (const t of trades) {
    if (!t.cleared) continue;
    bucketCounts[t.bucket_id] = (bucketCounts[t.bucket_id] || 0) + 1;
  }

  const designationsIn = arr(pp.subcategory_designations);
  const designations = [];
  for (let i = 0; i < designationsIn.length; i++) {
    const d = obj(designationsIn[i]);
    const clsSupplied = str(d.class, '');
    const cls = CLASS_IDS.indexOf(clsSupplied) !== -1 ? clsSupplied : null;
    if (cls === null) { rejected_inputs.push({ where: `subcategory_designations[${i}].class`, reason: 'not a recognised class', supplied: clsSupplied === '' ? null : clsSupplied }); continue; }
    const bucket_id = str(d.bucket_id, null);
    if (bucket_id === null) { rejected_inputs.push({ where: `subcategory_designations[${i}].bucket_id`, reason: 'absent', supplied: null }); continue; }
    designations.push({ class: cls, bucket_id, most_relevant: d.most_relevant === true });
  }

  // ── Obligation 2: representativeness (Art 7a(4)). ───────────────────────
  const inScopeCategories = [];
  if (in_scope_eur_pln_ird) inScopeCategories.push('eur_pln_ird');
  if (in_scope_eur_stir) inScopeCategories.push('eur_stir');
  const inScopeClasses = CLASS_IDS.filter((c) => inScopeCategories.indexOf(CLASS_DEFS[c].category) !== -1);

  const notionalVolumeDeclared = isSafeIntAmount(pp.notional_clearing_volume_minor_units);
  const notional_clearing_volume_minor_units = notionalVolumeDeclared ? pp.notional_clearing_volume_minor_units : null;
  if (!notionalVolumeDeclared && in_scope_any) rejected_inputs.push({ where: 'notional_clearing_volume_minor_units', reason: 'absent or not a safe integer', supplied: pp.notional_clearing_volume_minor_units === undefined ? null : String(pp.notional_clearing_volume_minor_units) });

  let representativeness_verdict, representativeness_reason;
  const subcategory_results = [];
  if (!in_scope_any) {
    representativeness_verdict = 'EXEMPT';
    representativeness_reason = 'No in-scope category is declared as exceeding the clearing threshold, so the Article 7a(4) representativeness obligation does not apply.';
  } else if (!notionalVolumeDeclared) {
    representativeness_verdict = 'INDETERMINATE';
    representativeness_reason = 'notional_clearing_volume_minor_units was not declared, so the EUR 6 billion Article 7a(4) threshold gate cannot be evaluated.';
  } else if (notional_clearing_volume_minor_units < SIX_BILLION_EUR_MINOR_UNITS) {
    representativeness_verdict = 'EXEMPT';
    representativeness_reason = `Declared notional clearing volume outstanding is below the EUR 6 billion Article 7a(4) threshold, so the representativeness obligation does not apply.`;
  } else {
    const relevantDesignations = designations.filter((d) => d.most_relevant && inScopeClasses.indexOf(d.class) !== -1);
    if (relevantDesignations.length === 0) {
      representativeness_verdict = 'INDETERMINATE';
      representativeness_reason = 'The counterparty is above the EUR 6 billion threshold and in scope, but no most-relevant subcategory designations were declared for any in-scope class, so representativeness cannot be classified.';
    } else if (!referencePeriodMonthsValid) {
      representativeness_verdict = 'INDETERMINATE';
      representativeness_reason = 'reference_period_months was not declared, so the annual-average trade count cannot be computed.';
    } else {
      let allMet = true;
      for (const d of relevantDesignations) {
        const rawCount = bucketCounts[d.bucket_id] || 0;
        const annualizedCount = (rawCount * 12) / pp.reference_period_months;
        const met = annualizedCount >= 5;
        if (!met) allMet = false;
        subcategory_results.push({
          class: d.class, bucket_id: d.bucket_id, raw_trade_count: rawCount,
          reference_period_months: pp.reference_period_months, annualized_trade_count: annualizedCount,
          met, basis: 'Art 7a(4) EMIR: at least five cleared trades per most-relevant subcategory per class, on an annual average basis, per reference period.',
        });
      }
      representativeness_verdict = allMet ? 'MET' : 'NOT_MET';
      representativeness_reason = allMet
        ? `Every declared most-relevant subcategory across the ${inScopeClasses.filter((c) => relevantDesignations.some((d) => d.class === c)).length} in-scope class(es) with a designation reaches an annualized average of at least five cleared trades.`
        : `At least one declared most-relevant subcategory falls below an annualized average of five cleared trades.`;
    }
  }

  // ── Obligation 3: reporting window (RTS Art 10). ────────────────────────
  const reportingSubmissionDate = pp.reporting_submission_date !== undefined && pp.reporting_submission_date !== null && pp.reporting_submission_date !== ''
    ? parseIsoDate(pp.reporting_submission_date, 'reporting_submission_date', rejected_inputs) : null;

  let reporting_verdict, reporting_reason;
  let applicable_deadline = null, reference_period_start = null, reference_period_end = null;
  if (as_of_date === null) {
    reporting_verdict = 'INDETERMINATE';
    reporting_reason = 'as_of_date was not a usable ISO date, so the applicable RTS Article 10 reporting deadline cannot be located.';
  } else {
    const firstAnchor = parseIsoDate(FIRST_REPORTING_DEADLINE, 'FIRST_REPORTING_DEADLINE', []);
    let nextDeadline = lastDayOfJanOrJulOnOrAfter(as_of_date);
    if (cmpDate(nextDeadline, firstAnchor) < 0) nextDeadline = firstAnchor;
    applicable_deadline = nextDeadline.iso;
    const priorDeadline = cmpDate(nextDeadline, firstAnchor) === 0 ? null : sixMonthsBefore(nextDeadline);
    reference_period_start = priorDeadline ? priorDeadline.iso : REPORTING_DEADLINE_ANCHOR_ISO_DATE;
    reference_period_end = applicable_deadline;

    if (!in_scope_any) {
      reporting_verdict = 'EXEMPT';
      reporting_reason = 'No in-scope category is declared as exceeding the clearing threshold, so no RTS Article 10 reporting obligation applies.';
    } else if (reportingSubmissionDate === null) {
      reporting_verdict = 'INDETERMINATE';
      reporting_reason = `No reporting_submission_date was declared to check against the applicable deadline of ${applicable_deadline}.`;
    } else if (cmpDate(reportingSubmissionDate, nextDeadline) <= 0) {
      reporting_verdict = 'MET';
      reporting_reason = `The declared submission date ${reportingSubmissionDate.iso} is on or before the applicable RTS Article 10 deadline of ${applicable_deadline}.`;
    } else {
      reporting_verdict = 'NOT_MET';
      reporting_reason = `The declared submission date ${reportingSubmissionDate.iso} is after the applicable RTS Article 10 deadline of ${applicable_deadline}.`;
    }
  }

  // ── Rationale. ───────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`EMIR Article 7a Active Account Requirement posture classified for counterparty reference ${counterparty_ref}${as_of_date ? ` as of ${as_of_date.iso}` : ''}.`);
  rationale.push(`In-scope categories: EUR/PLN interest rate derivatives = ${in_scope_eur_pln_ird}, EUR short-term interest rate derivatives = ${in_scope_eur_stir} (Article 7a(6)).`);
  rationale.push(`Active-account obligation (Article 7a(1)): ${active_account_verdict}. ${active_account_reason}`);
  rationale.push(`Representativeness obligation (Article 7a(4)): ${representativeness_verdict}. ${representativeness_reason}`);
  rationale.push(`Reporting window (RTS Article 10): ${reporting_verdict}. ${reporting_reason}`);
  if (rejected_inputs.length > 0) rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as absent or excluded, never silently guessed toward a MET/EXEMPT verdict. Each one is named in rejected_inputs.`);
  rationale.push('This is not legal advice. The most-relevant subcategory designation per class is a caller-declared fact, not derived from market-wide data this kernel does not have access to; whether a trade genuinely cleared is likewise asserted, not independently verified.');

  const compliance_flags = ['EMIR3_AAR_CLASSIFIED'];
  compliance_flags.push(`EMIR3_ACTIVE_ACCOUNT_${active_account_verdict}`);
  compliance_flags.push(`EMIR3_REPRESENTATIVENESS_${representativeness_verdict}`);
  compliance_flags.push(`EMIR3_REPORTING_${reporting_verdict}`);
  if ([active_account_verdict, representativeness_verdict, reporting_verdict].indexOf('NOT_MET') !== -1) compliance_flags.push('ESCALATION_RAISED');
  if (rejected_inputs.length > 0) compliance_flags.push('EMIR3_AAR_INPUTS_REJECTED');

  const output_payload = {
    counterparty_ref,
    as_of_date: as_of_date ? as_of_date.iso : null,
    in_scope: { eur_pln_ird: in_scope_eur_pln_ird, eur_stir: in_scope_eur_stir },
    obligations: {
      active_account: { verdict: active_account_verdict, reason: active_account_reason },
      representativeness: { verdict: representativeness_verdict, reason: representativeness_reason, notional_clearing_volume_minor_units, threshold_minor_units: SIX_BILLION_EUR_MINOR_UNITS, subcategory_results },
      reporting_window: { verdict: reporting_verdict, reason: reporting_reason, applicable_deadline, reference_period_start, reference_period_end, reporting_submission_date: reportingSubmissionDate ? reportingSubmissionDate.iso : null },
    },
    trades_classified: trades.map((t) => ({ trade_id: t.trade_id, class: t.class, category: t.category, bucket_id: t.bucket_id, cleared: t.cleared })),
    bucket_counts: bucketCounts,
    subcategory_designations: designations,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is not legal advice and is not an ESMA or CCP determination. The most-relevant subcategory designation per class is taken as a caller-declared fact; this kernel does not compute it from market-wide data. Whether a declared trade genuinely cleared, and whether the counterparty genuinely exceeds the Article 4a clearing threshold, are asserted by the caller, not independently verified.',
    note: 'Deterministic EMIR Article 7a Active Account Requirement posture classification for one stated point in time. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
