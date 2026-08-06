/**
 * art-573-section16b-short-swing-profit-recompute.kernel.mjs
 *
 * RECOMP wave (RECOMP-WAVE-BUILD-SPEC.md §8, RECOMP-SEC16-1) — recomputes an
 * Exchange Act Section 16(b) short-swing profit figure from a caller-declared
 * list of an insider's own-company transactions, then (optionally) compares
 * the recomputed figure against a number a demand letter claims.
 *
 * WHO USES THIS. The Section 16(b) demand-letter economy runs on plaintiff
 * firms scanning EDGAR Form 4 filings, computing a lowest-in/highest-out
 * profit figure, and sending the issuer or the insider a demand for
 * disgorgement. The recipient side -- the insider or the issuer's counsel --
 * has no deterministic free tool to independently recompute the number a
 * demand letter asserts. This kernel is that recompute, run on the
 * recipient's own declared transaction data.
 *
 * THE MATCHABLE-PAIR MAXIMAL-RECOVERY CONSTRUCTION (Smolowe v. Delvag
 * Reinsurance Co., 1943, and its "lowest price in, highest price out"
 * successors). Section 16(b) strict liability recovers the corporation's
 * choice of matching, not the insider's actual realized gain: within any
 * eligible pairing of a purchase and a sale of the issuer's equity security
 * that occurred less than six months apart, the LOWEST-PRICED purchase is
 * matched against the HIGHEST-PRICED sale, repeatedly, until no further
 * profitable pairing exists. A pairing that would produce a loss is simply
 * skipped -- losses are NEVER netted against profits from other pairings.
 * This kernel implements exactly that greedy lowest-in/highest-out matching:
 * purchases sorted ascending by price, sales sorted descending by price,
 * paired while a share of each remains, the window test passes, and the sale
 * price exceeds the purchase price.
 *
 * ⚠ ALGORITHM VERIFICATION IS A BUILD-TIME RESEARCH FINDING, NOT AN
 * ESTABLISHED FACT (per RECOMP-SEC16-1's row). The lowest-in/highest-out
 * construction is the widely cited maximal-recovery heuristic from Smolowe
 * and Gratz v. Claughton (2d Cir. 1954), but this kernel does not claim to
 * have re-derived it from primary case text at build time; a reader relying
 * on the figure for a real dispute should independently verify the
 * construction against counsel and the governing case law in the circuit.
 *
 * THE SIX-MONTH WINDOW IS A DAY-COUNT APPROXIMATION, NAMED AS SUCH. Section
 * 16(b) reaches purchases and sales "within any period of less than six
 * months." Courts compute this on the calendar (a purchase on 2026-01-15 and
 * a sale on 2026-07-14 are within the window; 2026-07-15 is not, because that
 * is the six-calendar-month anniversary). This kernel approximates the
 * six-calendar-month boundary with a 183-day threshold (strictly less than
 * 183 days apart) rather than true calendar-month arithmetic, and both the
 * approximation and its boundary-case risk are named in not_proven[] and in
 * every matched pair's window_basis field. NEVER treat a pair straddling the
 * 182/183-day boundary as a settled legal conclusion.
 *
 * EXEMPTIONS ARE CALLER-DECLARED, NEVER INFERRED. A transaction carrying a
 * non-empty exemption_flags[] (e.g. "rule_16b-3", the Rule 16b-3(c)/(d)
 * approved-plan exemptions for certain issuer grants and tax-withholding
 * transactions) is excluded from matching entirely and reported in
 * excluded_transactions[] with the flags that excluded it. This kernel makes
 * no determination of whether an exemption in fact applies -- that
 * determination is asserted by the caller and is counsel's to make.
 *
 * SECTION 16(a) APPLICABILITY + THE HFIAA FOREIGN-PRIVATE-ISSUER ASYMMETRY.
 * The Holding Foreign Insiders Accountable Act (signed 2025-12-18, FY2026
 * NDAA) makes officers and directors of a foreign private issuer Section
 * 16(a) reporting filers for the first time -- historically Rule 3a12-3(b)
 * exempted an FPI and its officers, directors and 10%-owners from Section 16
 * entirely. HFIAA extends ONLY the Section 16(a) reporting obligation to FPI
 * officers/directors; it expressly does NOT extend Section 16(b) short-swing
 * PROFIT-RECOVERY LIABILITY to that population, and it does not disturb the
 * existing Rule 3a12-3(b) exemption for a 10%-owner who is not also an
 * officer or director. This kernel encodes that asymmetry as a purely
 * informational check over the caller-declared insider_status object; it
 * never gates the matched-pair computation on it (the arithmetic runs
 * identically regardless of who the insider is).
 *
 * VERIFY MODE / INDETERMINATE (Common wave doctrine). Whenever no demand
 * letter figure is supplied, or transactions[] is empty, or no matchable
 * pair exists, the verdict is INDETERMINATE, never guessed toward MATCHES.
 *
 * FIXED-POINT MONEY MATH. Every price and profit amount crosses the boundary
 * as an INTEGER NUMBER OF MINOR UNITS (cents). 2dp display strings come from
 * integer division plus string padding, never toFixed() on a float. Share
 * counts are integers.
 *
 * FINITE GATE. Zero transactions, an all-exempt transaction list, and a
 * transaction naming a type this kernel does not recognise each resolve to a
 * DEFINED result. No branch can emit NaN, Infinity, or an undefined state. A
 * value that is not a usable integer is coerced to 0 AND named in
 * rejected_inputs[], never silently dropped.
 *
 * THIS IS NOT LEGAL ADVICE. It is a matchable-pair arithmetic engine over
 * caller-declared facts; it makes no claim that any computed figure resolves
 * a matchability or exemption dispute, which remain counsel's to determine.
 * Rule 144 volume-limitation checking is a NAMED FOLLOW-ON, not this node.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: RECOMP-WAVE-BUILD-SPEC.md §8, §Common.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-573-section16b-short-swing-profit-recompute';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_section16b_profit',
  mandate_type: 'analytics_mandate',
  gpu: false,
};

const TXN_TYPES = ['buy', 'sell'];
const SIX_MONTH_DAY_THRESHOLD = 183; // approximation of "less than six months", see header note.
const MS_PER_DAY = 86400000;

const CITATIONS = {
  section_16b: {
    source: 'Securities Exchange Act of 1934 Sec. 16(b), 15 U.S.C. Sec. 78p(b)',
    detail: 'Strict-liability disgorgement of any profit realized by a Section 16 insider from any purchase and sale, or sale and purchase, of the issuer\'s equity security within a period of less than six months.',
  },
  smolowe_maximal_recovery: {
    source: 'Smolowe v. Delvag Reinsurance Co., 136 F.2d 231 (2d Cir. 1943); Gratz v. Claughton, 187 F.2d 46 (2d Cir. 1951)',
    detail: 'The "lowest price in, highest price out" matching construction, maximizing recovery to the corporation rather than measuring the insider\'s actual realized gain; losses on other pairings are never netted against a profitable pairing. Re-verify against primary case text before relying on it (research finding, not fact).',
  },
  rule_16b3: {
    source: '17 CFR 240.16b-3',
    detail: 'Exempts certain transactions between an issuer and its officers/directors under an approved plan (e.g. grants, tax-withholding transactions) from Section 16(b) matching. This kernel excludes a transaction from matching only when the caller declares an exemption_flags entry for it; it makes no independent exemption determination.',
  },
  section_16a_general: {
    source: 'Securities Exchange Act of 1934 Sec. 16(a), 15 U.S.C. Sec. 78p(a)',
    detail: 'Reporting obligation for officers, directors, and beneficial owners of more than 10% of a registered equity security.',
  },
  rule_3a12_3: {
    source: '17 CFR 240.3a12-3(b)',
    detail: 'Historically exempted a foreign private issuer and its officers, directors, and 10%-owners from Section 16 (both (a) and (b)) entirely.',
  },
  hfiaa: {
    source: 'Holding Foreign Insiders Accountable Act, FY2026 NDAA, signed 2025-12-18',
    detail: 'Makes officers and directors of a foreign private issuer Section 16(a) reporting filers for the first time. Expressly does NOT extend Section 16(b) short-swing profit-recovery liability to that population, and does not disturb the Rule 3a12-3(b) exemption for a 10%-owner who is not also an officer or director. Re-verify against primary text before relying on it (research finding, not fact).',
  },
};

const NOT_PROVEN = [
  { item: 'Not legal advice', detail: 'This kernel recomputes a matchable-pair short-swing profit figure from caller-declared transaction facts. It is not a substitute for counsel, and no computed figure resolves a matchability or exemption dispute.' },
  { item: 'Six-month window is a day-count approximation', detail: 'The statutory "less than six months" boundary is approximated here as strictly less than 183 days apart rather than true calendar-month arithmetic. A pair straddling the 182/183-day boundary needs independent calendar-month verification.' },
  { item: 'Algorithm re-verification', detail: 'The lowest-in/highest-out maximal-recovery construction is the widely cited Smolowe/Gratz heuristic, but this kernel\'s citation of it was not re-derived from primary case text at build time (research finding, not fact per the build row).' },
  { item: 'Exemption determinations are caller-declared', detail: 'A transaction is excluded from matching only because the caller declared an exemption_flags entry for it (e.g. Rule 16b-3). This kernel makes no independent determination that any exemption in fact applies.' },
  { item: 'Rule 144 volume limitation', detail: 'Whether a sale complies with Rule 144 volume limitations is out of scope; it is a named follow-on tool, not computed here.' },
  { item: 'Input accuracy', detail: 'Every transaction\'s date, price, and share count, and the insider_status flags, are caller-supplied and asserted, not independently verified against EDGAR Form 4/5 filings.' },
];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function toShares(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 0) return v;
  rejected.push({ where, reason: typeof v === 'number' ? 'not a non-negative safe integer share count' : `expected a non-negative integer share count, got ${typeof v}`, supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v) });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

function parseDateDaysSinceEpoch(v, where, rejected) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    rejected.push({ where, reason: 'expected an ISO date string YYYY-MM-DD', supplied: v === undefined || v === null ? null : String(v) });
    return null;
  }
  const t = Date.parse(v.trim() + 'T00:00:00Z');
  if (!Number.isFinite(t)) {
    rejected.push({ where, reason: 'unparseable ISO date', supplied: v });
    return null;
  }
  return { date: v.trim(), days: Math.floor(t / MS_PER_DAY) };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const insider_ref = str(pp.insider_ref, 'UNSTATED');
  const issuer_ref = str(pp.issuer_ref, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  // ── Parse and classify every declared transaction. ─────────────────────────
  const txnsIn = arr(pp.transactions);
  const parsed = [];
  const excluded_transactions = [];
  for (let i = 0; i < txnsIn.length; i++) {
    const t = obj(txnsIn[i]);
    const txn_id = str(t.txn_id, `TXN-${i + 1}`);
    const typeSupplied = str(t.type, '');
    const type = TXN_TYPES.indexOf(typeSupplied) !== -1 ? typeSupplied : null;
    if (type === null) {
      rejected_inputs.push({ where: `transactions[${i}].type`, reason: typeSupplied === '' ? 'absent' : 'not one of buy, sell', supplied: typeSupplied === '' ? null : typeSupplied });
    }
    const parsedDate = parseDateDaysSinceEpoch(t.date, `transactions[${i}].date`, rejected_inputs);
    const price_minor_units = toMinorUnits(t.price_minor_units, `transactions[${i}].price_minor_units`, rejected_inputs);
    const shares = toShares(t.shares, `transactions[${i}].shares`, rejected_inputs);
    const exemption_flags = arr(t.exemption_flags).filter((f) => isNonEmptyString(f)).map((f) => f.trim());

    const row = { txn_id, type, date: parsedDate ? parsedDate.date : null, days: parsedDate ? parsedDate.days : null, price_minor_units, price_display: display(price_minor_units), shares, exemption_flags };

    if (type === null || parsedDate === null || shares === 0) {
      excluded_transactions.push({ ...row, exclusion_reason: 'unusable: ' + (type === null ? 'unrecognised type' : parsedDate === null ? 'unparseable date' : 'zero shares') });
      continue;
    }
    if (exemption_flags.length > 0) {
      excluded_transactions.push({ ...row, exclusion_reason: `declared exemption: ${exemption_flags.join(', ')}` });
      continue;
    }
    parsed.push({ ...row, shares_remaining: shares });
  }

  // ── Lowest-in/highest-out matching (Smolowe maximal-recovery construction). ─
  const purchases = parsed.filter((t) => t.type === 'buy').sort((a, b) => a.price_minor_units - b.price_minor_units || a.days - b.days);
  const sales = parsed.filter((t) => t.type === 'sell').sort((a, b) => b.price_minor_units - a.price_minor_units || a.days - b.days);

  const matched_pairs = [];
  let total_profit_minor_units = 0;
  for (const sale of sales) {
    for (const purchase of purchases) {
      if (sale.shares_remaining <= 0) break;
      if (purchase.shares_remaining <= 0) continue;
      if (sale.price_minor_units <= purchase.price_minor_units) continue; // never net a loss.
      const day_gap = Math.abs(sale.days - purchase.days);
      if (day_gap >= SIX_MONTH_DAY_THRESHOLD) continue;
      const shares_matched = Math.min(sale.shares_remaining, purchase.shares_remaining);
      const profit_minor_units = (sale.price_minor_units - purchase.price_minor_units) * shares_matched;
      matched_pairs.push({
        purchase_txn_id: purchase.txn_id, purchase_date: purchase.date, purchase_price_minor_units: purchase.price_minor_units, purchase_price_display: purchase.price_display,
        sale_txn_id: sale.txn_id, sale_date: sale.date, sale_price_minor_units: sale.price_minor_units, sale_price_display: sale.price_display,
        shares_matched,
        profit_minor_units, profit_display: display(profit_minor_units),
        day_gap,
        window_basis: `${day_gap} day(s) apart, matched against a ${SIX_MONTH_DAY_THRESHOLD}-day approximation of the statutory less-than-six-months window (day-count approximation, not calendar-month arithmetic; see not_proven).`,
      });
      total_profit_minor_units += profit_minor_units;
      sale.shares_remaining -= shares_matched;
      purchase.shares_remaining -= shares_matched;
    }
  }

  const unmatched_purchase_shares = purchases.reduce((s, p) => s + p.shares_remaining, 0);
  const unmatched_sale_shares = sales.reduce((s, p) => s + p.shares_remaining, 0);

  // ── Section 16(a)/(b) applicability, incl. the HFIAA FPI asymmetry. ────────
  const insider_status = obj(pp.insider_status);
  const officer_or_director = insider_status.officer_or_director === true;
  const ten_pct_owner = insider_status.ten_pct_owner === true;
  const foreign_private_issuer = insider_status.foreign_private_issuer === true;

  let is_16a_filer, is_16b_liable, applicability_basis;
  if (!foreign_private_issuer) {
    is_16a_filer = officer_or_director || ten_pct_owner;
    is_16b_liable = is_16a_filer;
    applicability_basis = is_16a_filer
      ? 'Domestic insider: officer/director or 10%-owner status makes this insider both a Section 16(a) filer and subject to Section 16(b) short-swing profit-recovery liability.'
      : 'No officer/director or 10%-owner status was declared; this insider is not a Section 16(a) filer or Section 16(b)-liable insider on the facts declared.';
  } else if (officer_or_director) {
    is_16a_filer = true;
    is_16b_liable = false;
    applicability_basis = 'Foreign private issuer officer/director: HFIAA (signed 2025-12-18) makes this insider a Section 16(a) reporting filer for the first time, but expressly does NOT extend Section 16(b) short-swing profit-recovery liability to this population -- the matched-pair figure above is informational only for this insider.';
  } else if (ten_pct_owner) {
    is_16a_filer = false;
    is_16b_liable = false;
    applicability_basis = 'Foreign private issuer 10%-owner who is not an officer or director: Rule 3a12-3(b) exemption from Section 16 (both (a) and (b)) is undisturbed by HFIAA, which reaches only FPI officers and directors.';
  } else {
    is_16a_filer = false;
    is_16b_liable = false;
    applicability_basis = 'No officer/director or 10%-owner status was declared for this foreign private issuer insider; not a Section 16 filer on the facts declared.';
  }

  // ── Verify mode: diff against a demand-letter claimed profit, where supplied. ─
  const claimedSupplied = pp.demand_letter_claimed_profit_minor_units !== undefined && pp.demand_letter_claimed_profit_minor_units !== null && pp.demand_letter_claimed_profit_minor_units !== '';
  const demand_letter_claimed_profit_minor_units = claimedSupplied ? toMinorUnits(pp.demand_letter_claimed_profit_minor_units, 'demand_letter_claimed_profit_minor_units', rejected_inputs) : null;
  const difference_minor_units = claimedSupplied ? total_profit_minor_units - demand_letter_claimed_profit_minor_units : null;

  let verdict, indeterminate_reason;
  if (parsed.length === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No usable, non-exempt transactions were supplied, so no matchable pairs could be computed.';
  } else if (!claimedSupplied) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No demand-letter claimed profit was supplied, so the recomputed matched-pair total has nothing to compare against.';
  } else {
    verdict = difference_minor_units === 0 ? 'MATCHES' : 'DIVERGES';
    indeterminate_reason = null;
  }

  // ── Rationale. ───────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Section 16(b) matchable-pair recompute for insider reference ${insider_ref} on issuer reference ${issuer_ref}.`);
  rationale.push(`${parsed.length} of ${txnsIn.length} declared transaction(s) were usable and non-exempt; ${excluded_transactions.length} were excluded (unusable input or a declared exemption).`);
  rationale.push(`${purchases.length} purchase(s) and ${sales.length} sale(s) were eligible for matching. Matching applied the lowest-in/highest-out construction: the lowest-priced eligible purchase was paired against the highest-priced eligible sale, repeatedly, within a ${SIX_MONTH_DAY_THRESHOLD}-day approximation of the statutory less-than-six-months window, and a pairing that would produce a loss was skipped rather than netted.`);
  rationale.push(matched_pairs.length === 0
    ? 'No profitable, in-window pairing was found.'
    : `${matched_pairs.length} matched pair(s) were found, for a total recomputed profit of ${display(total_profit_minor_units)} ${currency}.`);
  if (unmatched_purchase_shares > 0 || unmatched_sale_shares > 0) {
    rationale.push(`${unmatched_purchase_shares} purchased share(s) and ${unmatched_sale_shares} sold share(s) remained unmatched (no eligible profitable in-window counterparty).`);
  }
  rationale.push(applicability_basis);
  rationale.push(verdict === 'INDETERMINATE'
    ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
    : verdict === 'MATCHES'
      ? `The independently recomputed matched-pair total agrees with the demand letter's claimed profit of ${display(demand_letter_claimed_profit_minor_units)} ${currency}.`
      : `The independently recomputed matched-pair total of ${display(total_profit_minor_units)} ${currency} diverges from the demand letter's claimed profit of ${display(demand_letter_claimed_profit_minor_units)} ${currency} by ${display(difference_minor_units)} ${currency}. This is an arithmetic finding about the transactions supplied here, not a determination of matchability or exemption, which is counsel's.`);
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero, ignored, or excluded. Each one is named in rejected_inputs rather than silently dropped.`);
  }
  rationale.push('This is not legal advice. The six-month window applied here is a day-count approximation of the statutory calendar-month boundary, and no exemption was independently determined -- both are named in not_proven. No computed figure resolves a matchability or exemption dispute.');

  // ── Flags. ───────────────────────────────────────────────────────────────
  const compliance_flags = ['SEC16B_MATCHED_PAIRS_COMPUTED'];
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'SEC16B_INDETERMINATE' : verdict === 'MATCHES' ? 'SEC16B_MATCHES' : 'SEC16B_DIVERGES');
  if (verdict === 'DIVERGES') compliance_flags.push('ESCALATION_RAISED');
  if (matched_pairs.length === 0 && parsed.length > 0) compliance_flags.push('SEC16B_NO_MATCHABLE_PAIR');
  if (excluded_transactions.some((t) => t.exemption_flags && t.exemption_flags.length > 0)) compliance_flags.push('SEC16B_EXEMPT_TRANSACTIONS_EXCLUDED');
  if (foreign_private_issuer && officer_or_director) compliance_flags.push('SEC16B_HFIAA_16A_ONLY_NOT_16B_LIABLE');
  if (rejected_inputs.length > 0) compliance_flags.push('SEC16B_INPUTS_REJECTED');

  const output_payload = {
    insider_ref,
    issuer_ref,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    transaction_count: txnsIn.length,
    usable_transaction_count: parsed.length,
    excluded_transactions,
    purchase_count: purchases.length,
    sale_count: sales.length,
    matched_pairs,
    unmatched_purchase_shares,
    unmatched_sale_shares,
    total_profit_minor_units,
    total_profit_display: display(total_profit_minor_units),
    six_month_window_day_threshold: SIX_MONTH_DAY_THRESHOLD,
    insider_status: { officer_or_director, ten_pct_owner, foreign_private_issuer },
    section_16a_applicability: { is_16a_filer, is_16b_liable, basis: applicability_basis },
    demand_letter_supplied: claimedSupplied,
    demand_letter_claimed_profit_minor_units,
    demand_letter_claimed_profit_display: claimedSupplied ? display(demand_letter_claimed_profit_minor_units) : null,
    comparison_basis: 'The recomputed matched-pair total is derived here from the declared transaction list using the lowest-in/highest-out construction; it is not read from the demand letter. A comparison is only meaningful because the two sides have independent provenance.',
    difference_minor_units,
    difference_display: difference_minor_units === null ? null : display(difference_minor_units),
    verdict,
    indeterminate_reason,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is not legal advice. It does not compute a Rule 144 volume-limitation check (a named follow-on tool). Matching uses the lowest-in/highest-out construction over caller-declared transactions and a day-count approximation of the six-month window; a declared exemption excludes a transaction from matching without this kernel independently determining whether that exemption applies. No computed figure resolves a matchability or exemption dispute, which is counsel\'s.',
    note: 'Deterministic Section 16(b) matchable-pair short-swing profit recompute over a caller-declared transaction list. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing.',
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
