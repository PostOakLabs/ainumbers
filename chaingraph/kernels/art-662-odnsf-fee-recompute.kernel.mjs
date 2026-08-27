/**
 * art-662-odnsf-fee-recompute.kernel.mjs
 *
 * CORE VERIFY wave (CORE-VERIFY-BUILD-SPEC.md Sec3, CORE-VERIFY-ODNSF-1) --
 * independently re-derives overdraft (OD) and non-sufficient-funds (NSF) fee
 * events from a caller-supplied posted-transaction sequence, applies the
 * caller's OWN declared fee schedule and posting-order policy, then (when
 * the caller also supplies what the core actually charged) diffs the
 * recomputed fees against the core-charged figures.
 *
 * POSITIONING (binding, CORE-VERIFY-BUILD-SPEC.md's guardrails). This is an
 * independent recompute-and-receipt tool, never a claim to "find the
 * vendor's bugs" or "audit your vendor", never a core alternative or
 * substitute for any core platform, and never an endorsement claim by or
 * about any core vendor. It makes NO determination of legality about the
 * posting-order policy it is given -- that policy (posting order, fee
 * amounts, caps, dedup rules) is a caller-declared input, never chosen or
 * inferred by this kernel. A difference between the recomputed and
 * core-charged figures is reported as a divergence in the arithmetic, never
 * as an incorrect assessment, an impermissible practice, or an amount owed back -- the interpretation of
 * any divergence belongs to the caller.
 *
 * WHY THIS IS AN INDEPENDENT RECOMPUTATION. Every fee event here is derived
 * from the posted ledger sequence, the declared opening balance, and the
 * declared fee schedule -- never lifted from a core-charged-fees figure. A
 * divergence against core_charged_fees is therefore a genuine arithmetic
 * finding about the figures supplied, not a re-footing of a published total.
 *
 * INPUT CONTRACT (CORE-VERIFY-BUILD-SPEC.md Sec0). Ledger rows carry the
 * Sec0 shape (account_token, post_date, effective_date, txn_type, amount,
 * running_balance, product_code, description_code); this chain's own
 * txn_type lookup table (versioned here, per Sec0's "one lookup table per
 * chain") is: debit_check, debit_ach, debit_card_pos, debit_atm,
 * credit_deposit, credit_transfer, fee, other. account_token is a
 * caller-supplied opaque hash -- never a real account number.
 *
 * POSTING-ORDER POLICY -- CALLER-DECLARED, NEVER CHOSEN OR INFERRED. Same
 * post_date items are re-sequenced only per the caller's declared
 * posting_order_policy:
 *   - as_supplied           -- the order items appear in ledger[] (stable, no reorder).
 *   - high_to_low_amount    -- descending by absolute transaction size (largest debit or
 *                               credit first, by magnitude) -- the disputed pattern that
 *                               drains a balance fastest, since the largest debits clear
 *                               before smaller ones get a chance; modelled exactly as
 *                               declared, with no judgment about its permissibility.
 *   - low_to_high_amount    -- ascending by absolute transaction size (smallest first).
 *   - chronological_by_effective_date -- by effective_date, ties broken by supplied order.
 * Absent a declaration, this kernel defaults to as_supplied (no reordering) as the neutral,
 * non-fee-maximizing choice and flags ODNSF_POSTING_POLICY_DEFAULTED -- it never defaults to
 * a reordering policy.
 *
 * SETTLE-NEGATIVE ALLOWANCE -- PER ITEM, CALLER-DECLARED. Each ledger item may declare
 * settle_negative_allowed: true (the bank pays the item into a negative balance -- an OD
 * event) or false (the item is returned unpaid -- an NSF event). Absent a declaration this
 * kernel defaults to false (returned/NSF, the more conservative non-payment assumption) and
 * flags ODNSF_SETTLE_FLAG_DEFAULTED on every item so defaulted.
 *
 * DAILY FEE CAP. fee_schedule.daily_fee_cap_count (nullable) caps the number of NSF+OD fee
 * events charged per post_date; events beyond the cap still resolve (paid or returned) but
 * are NOT fee-charged, and are flagged ODNSF_CAP_REACHED.
 *
 * REPRESENTMENT DEDUP. An item declaring representment_of (a prior txn_id) skips its own NSF
 * fee, flagged ODNSF_DEDUPED, when that prior item ALSO incurred an NSF fee and the two
 * post_dates are within fee_schedule.representment_dedup_days of each other. Absent a
 * declared representment_dedup_days, no dedup is applied (every representment is fee-eligible
 * on its own terms) and ODNSF_DEDUP_NOT_DECLARED is flagged.
 *
 * EXTENDED-OVERDRAWN FEE -- A NAMED SIMPLIFICATION. When both
 * fee_schedule.extended_overdrawn_days and fee_schedule.extended_overdrawn_fee_minor_units
 * are declared, this kernel counts CONSECUTIVE DISTINCT LEDGER POST_DATES (not true calendar
 * days -- see not_proven[]) on which the end-of-day balance is negative, and charges one
 * extended fee for every such date once the streak exceeds the declared threshold. Absent
 * either field, no extended fee tier is modelled and ODNSF_EXTENDED_TIER_NOT_DECLARED is
 * flagged.
 *
 * DIFF MODE. When core_charged_fees is supplied, recomputed fees are aggregated by
 * (post_date, fee_type) and diffed against the same aggregation of core_charged_fees.
 * Verdict is INDETERMINATE whenever the ledger is empty, the fee schedule lacks either
 * nsf_fee_minor_units or od_fee_minor_units, or core_charged_fees is absent/empty -- never
 * guessed toward MATCHES.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER number of minor
 * units (cents). No floating-point money arithmetic; 2dp display strings come from integer
 * division plus string padding, never toFixed() on a float.
 *
 * FINITE GATE. An empty ledger, a missing fee schedule, and an unrecognised txn_type each
 * resolve to a DEFINED result. No branch can emit NaN, Infinity, or an undefined state. A
 * value that is not a usable integer amount is coerced to 0 AND named in rejected_inputs[],
 * never silently dropped.
 *
 * Citations live in the CITATIONS object below (surfaced in output_payload, never in a kernel
 * comment) and are cited generically, dated -- never a specific enforcement action, since this
 * is a generic recompute tool, not an institution-specific audit.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: CORE-VERIFY-BUILD-SPEC.md Sec0, Sec3.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-662-odnsf-fee-recompute';
const TOOL_VERSION = '1.0.0';
export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_odnsf_fee_recompute',
  mandate_type: 'compliance_control',
  gpu: false,
};

const TXN_TYPES = ['debit_check', 'debit_ach', 'debit_card_pos', 'debit_atm', 'credit_deposit', 'credit_transfer', 'fee', 'other'];
const POSTING_POLICIES = ['as_supplied', 'high_to_low_amount', 'low_to_high_amount', 'chronological_by_effective_date'];
const FEE_TYPES = ['NSF', 'OD', 'EXTENDED_OD'];

const CITATIONS = {
  reg_dd_fee_disclosure: {
    source: 'Truth in Savings Act / Regulation DD, 12 CFR Part 1030',
    detail: 'Requires disclosure of fees that may be imposed on an account, including overdraft and NSF fee amounts. Re-verify against primary text before relying on it (research findings, not facts).',
  },
  reg_e_authorization_hold: {
    source: 'Regulation E, 12 CFR Part 1005',
    detail: 'Governs authorization-hold and electronic-transfer dispute-resolution treatment referenced by the APSN (authorize-positive-settle-negative) fee pattern this kernel recomputes given a declared posting policy -- cited for the authorization-hold concept, not as a determination of any institution\'s compliance.',
  },
};

const NOT_PROVEN = [
  { item: 'Not a legality determination', detail: 'This kernel recomputes fee arithmetic given a caller-declared posting-order policy and fee schedule. It makes no claim about whether that policy or schedule is lawful, disclosed correctly, or matches the account agreement.' },
  { item: 'Extended-overdrawn day counting is ledger-date-based, not calendar-based', detail: 'The extended-overdrawn streak counts consecutive DISTINCT post_date values present in the supplied ledger, not true consecutive calendar days. A ledger with gaps (no transactions on some calendar days) will undercount calendar days negative.' },
  { item: 'Diff aggregation is by (post_date, fee_type), not by individual transaction', detail: 'core_charged_fees is compared against recomputed fees aggregated per day and fee type, not matched one-to-one against a specific triggering item, unless the caller-supplied txn_id happens to align.' },
  { item: 'No per-core export adapter', detail: 'This kernel consumes only the Sec0 generic ledger CSV shape. It does not read any core\'s native export format (Episys, SilverLake, DNA, Premier, or otherwise) and makes no claim about those formats.' },
  { item: 'Input accuracy', detail: 'The posted ledger, fee schedule, and core-charged fees are caller-supplied and asserted, not independently verified against source records.' },
];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toSignedMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function toNonNegMinorUnits(v, where, rejected) {
  const n = toSignedMinorUnits(v, where, rejected);
  if (n < 0) { rejected.push({ where, reason: 'negative value where a non-negative fee/cap amount was expected; treated as 0', supplied: n }); return 0; }
  return n;
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
function isDateStr(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const account_token = str(pp.account_token, 'UNSTATED');
  const period_label = str(pp.period_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  const opening_balance_minor_units = toSignedMinorUnits(pp.opening_balance_minor_units, 'opening_balance_minor_units', rejected_inputs);

  const postingPolicySupplied = isNonEmptyString(pp.posting_order_policy);
  const posting_order_policy = postingPolicySupplied && POSTING_POLICIES.indexOf(pp.posting_order_policy.trim()) !== -1
    ? pp.posting_order_policy.trim()
    : 'as_supplied';
  const posting_policy_defaulted = !postingPolicySupplied || POSTING_POLICIES.indexOf(String(pp.posting_order_policy).trim()) === -1;
  if (postingPolicySupplied && posting_policy_defaulted) {
    rejected_inputs.push({ where: 'posting_order_policy', reason: `not one of ${POSTING_POLICIES.join(', ')}; defaulted to as_supplied`, supplied: pp.posting_order_policy });
  }

  const fee_schedule_in = obj(pp.fee_schedule);
  const nsfFeeSupplied = fee_schedule_in.nsf_fee_minor_units !== undefined && fee_schedule_in.nsf_fee_minor_units !== null;
  const odFeeSupplied = fee_schedule_in.od_fee_minor_units !== undefined && fee_schedule_in.od_fee_minor_units !== null;
  const nsf_fee_minor_units = nsfFeeSupplied ? toNonNegMinorUnits(fee_schedule_in.nsf_fee_minor_units, 'fee_schedule.nsf_fee_minor_units', rejected_inputs) : 0;
  const od_fee_minor_units = odFeeSupplied ? toNonNegMinorUnits(fee_schedule_in.od_fee_minor_units, 'fee_schedule.od_fee_minor_units', rejected_inputs) : 0;
  const daily_fee_cap_count = (fee_schedule_in.daily_fee_cap_count !== undefined && fee_schedule_in.daily_fee_cap_count !== null && Number.isSafeInteger(fee_schedule_in.daily_fee_cap_count) && fee_schedule_in.daily_fee_cap_count >= 0)
    ? fee_schedule_in.daily_fee_cap_count : null;
  const representment_dedup_days = (fee_schedule_in.representment_dedup_days !== undefined && fee_schedule_in.representment_dedup_days !== null && Number.isSafeInteger(fee_schedule_in.representment_dedup_days) && fee_schedule_in.representment_dedup_days >= 0)
    ? fee_schedule_in.representment_dedup_days : null;
  const extended_overdrawn_days = (fee_schedule_in.extended_overdrawn_days !== undefined && fee_schedule_in.extended_overdrawn_days !== null && Number.isSafeInteger(fee_schedule_in.extended_overdrawn_days) && fee_schedule_in.extended_overdrawn_days >= 0)
    ? fee_schedule_in.extended_overdrawn_days : null;
  const extended_overdrawn_fee_minor_units = (fee_schedule_in.extended_overdrawn_fee_minor_units !== undefined && fee_schedule_in.extended_overdrawn_fee_minor_units !== null)
    ? toNonNegMinorUnits(fee_schedule_in.extended_overdrawn_fee_minor_units, 'fee_schedule.extended_overdrawn_fee_minor_units', rejected_inputs) : null;
  const extended_tier_active = extended_overdrawn_days !== null && extended_overdrawn_fee_minor_units !== null;

  // ── Normalize the ledger, preserving original index for as_supplied tie-breaks. ─────────
  const ledgerIn = arr(pp.ledger);
  const ledger = ledgerIn.map((raw, i) => {
    const r = obj(raw);
    const txnTypeSupplied = str(r.txn_type, '');
    const txn_type = TXN_TYPES.indexOf(txnTypeSupplied) !== -1 ? txnTypeSupplied : null;
    if (txn_type === null) {
      rejected_inputs.push({ where: `ledger[${i}].txn_type`, reason: txnTypeSupplied === '' ? 'absent' : `not one of ${TXN_TYPES.join(', ')}`, supplied: txnTypeSupplied === '' ? null : txnTypeSupplied });
    }
    const post_date = isDateStr(r.post_date) ? r.post_date : null;
    if (post_date === null) rejected_inputs.push({ where: `ledger[${i}].post_date`, reason: 'absent or not YYYY-MM-DD; row excluded from recompute', supplied: r.post_date === undefined ? null : String(r.post_date) });
    const effective_date = isDateStr(r.effective_date) ? r.effective_date : post_date;
    const settleSupplied = r.settle_negative_allowed === true || r.settle_negative_allowed === false;
    const settle_negative_allowed = r.settle_negative_allowed === true;
    if (!settleSupplied) rejected_inputs.push({ where: `ledger[${i}].settle_negative_allowed`, reason: 'absent; defaulted to false (item returned/NSF rather than paid-overdrawn)', supplied: null });
    return {
      idx: i,
      txn_id: str(r.txn_id, `TXN-${i + 1}`),
      post_date,
      effective_date,
      txn_type,
      amount_minor_units: toSignedMinorUnits(r.amount, `ledger[${i}].amount`, rejected_inputs),
      settle_negative_allowed,
      settle_negative_allowed_defaulted: !settleSupplied,
      representment_of: isNonEmptyString(r.representment_of) ? r.representment_of.trim() : null,
    };
  }).filter((r) => r.post_date !== null);

  // ── Re-sequence per the declared posting_order_policy, same-post_date items only. ───────
  function sortKey(a, b) {
    if (a.post_date !== b.post_date) return a.post_date < b.post_date ? -1 : 1;
    switch (posting_order_policy) {
      case 'high_to_low_amount': {
        const aAbs = Math.abs(a.amount_minor_units), bAbs = Math.abs(b.amount_minor_units);
        if (aAbs !== bAbs) return bAbs - aAbs;
        return a.idx - b.idx;
      }
      case 'low_to_high_amount': {
        const aAbs = Math.abs(a.amount_minor_units), bAbs = Math.abs(b.amount_minor_units);
        if (aAbs !== bAbs) return aAbs - bAbs;
        return a.idx - b.idx;
      }
      case 'chronological_by_effective_date':
        if (a.effective_date !== b.effective_date) return (a.effective_date || '') < (b.effective_date || '') ? -1 : 1;
        return a.idx - b.idx;
      default: // as_supplied
        return a.idx - b.idx;
    }
  }
  const sequenced = ledger.slice().sort(sortKey);

  // ── Walk the sequenced ledger, deriving OD/NSF events and applying the fee schedule. ────
  let balance = opening_balance_minor_units;
  const events = [];
  const dailyFeeCount = {};
  const nsfFeeByTxnId = {}; // txn_id -> post_date, for representment dedup lookups
  const processed = sequenced.map((row) => {
    const preBalance = balance;
    if (row.amount_minor_units >= 0) {
      balance += row.amount_minor_units;
      return { ...row, pre_balance_minor_units: preBalance, post_balance_minor_units: balance, event_type: null, fee_charged: false, fee_type: null, fee_amount_minor_units: 0, deduped: false, cap_reached: false };
    }
    const projected = balance + row.amount_minor_units;
    if (projected >= 0) {
      balance = projected;
      return { ...row, pre_balance_minor_units: preBalance, post_balance_minor_units: balance, event_type: null, fee_charged: false, fee_type: null, fee_amount_minor_units: 0, deduped: false, cap_reached: false };
    }
    // Would go negative -- OD (paid) or NSF (returned), per the item's declared allowance.
    const fee_type = row.settle_negative_allowed ? 'OD' : 'NSF';
    if (row.settle_negative_allowed) balance = projected; // item paid into negative
    // else: item returned; balance unchanged by this item's amount.

    dailyFeeCount[row.post_date] = dailyFeeCount[row.post_date] || 0;
    const capReached = daily_fee_cap_count !== null && dailyFeeCount[row.post_date] >= daily_fee_cap_count;

    let deduped = false;
    if (!capReached && fee_type === 'NSF' && row.representment_of && representment_dedup_days !== null) {
      const priorDate = nsfFeeByTxnId[row.representment_of];
      if (priorDate) {
        const days = Math.round((Date.parse(row.post_date + 'T00:00:00Z') - Date.parse(priorDate + 'T00:00:00Z')) / 86400000);
        if (days >= 0 && days <= representment_dedup_days) deduped = true;
      }
    }

    const fee_charged = !capReached && !deduped;
    const fee_amount_minor_units = fee_charged ? (fee_type === 'NSF' ? nsf_fee_minor_units : od_fee_minor_units) : 0;
    if (fee_charged) {
      dailyFeeCount[row.post_date] += 1;
      if (fee_type === 'NSF') nsfFeeByTxnId[row.txn_id] = row.post_date;
    }

    return {
      ...row,
      pre_balance_minor_units: preBalance,
      post_balance_minor_units: balance,
      event_type: fee_type,
      fee_charged,
      fee_type: fee_charged ? fee_type : null,
      fee_amount_minor_units,
      deduped,
      cap_reached: capReached,
    };
  });

  // ── Extended-overdrawn fee: consecutive distinct post_dates with a negative end-of-day balance. ─
  const distinctDates = [];
  const eodBalanceByDate = {};
  for (const row of processed) {
    if (distinctDates.indexOf(row.post_date) === -1) distinctDates.push(row.post_date);
    eodBalanceByDate[row.post_date] = row.post_balance_minor_units;
  }
  distinctDates.sort();
  const extended_fee_dates = [];
  if (extended_tier_active) {
    let streak = 0;
    for (const d of distinctDates) {
      if (eodBalanceByDate[d] < 0) {
        streak += 1;
        if (streak > extended_overdrawn_days) extended_fee_dates.push(d);
      } else {
        streak = 0;
      }
    }
  }

  // ── Aggregate recomputed fees by (post_date, fee_type). ─────────────────────────────────
  const recomputedBuckets = {}; // `${date}|${type}` -> { post_date, fee_type, count, amount_minor_units }
  function addToBucket(post_date, fee_type, amount) {
    const key = post_date + '|' + fee_type;
    if (!recomputedBuckets[key]) recomputedBuckets[key] = { post_date, fee_type, count: 0, amount_minor_units: 0 };
    recomputedBuckets[key].count += 1;
    recomputedBuckets[key].amount_minor_units += amount;
  }
  for (const row of processed) {
    if (row.fee_charged) addToBucket(row.post_date, row.fee_type, row.fee_amount_minor_units);
  }
  for (const d of extended_fee_dates) addToBucket(d, 'EXTENDED_OD', extended_overdrawn_fee_minor_units);

  const recomputed_fee_events = Object.keys(recomputedBuckets).sort().map((k) => recomputedBuckets[k]);
  let total_recomputed_fees_minor_units = 0;
  for (const b of recomputed_fee_events) total_recomputed_fees_minor_units += b.amount_minor_units;

  // ── Diff mode against core_charged_fees, aggregated the same way. ───────────────────────
  const coreFeesIn = arr(pp.core_charged_fees);
  const coreSupplied = coreFeesIn.length > 0;
  const coreBuckets = {};
  const core_charged_fees_normalized = coreFeesIn.map((raw, i) => {
    const r = obj(raw);
    const post_date = isDateStr(r.post_date) ? r.post_date : null;
    if (post_date === null) rejected_inputs.push({ where: `core_charged_fees[${i}].post_date`, reason: 'absent or not YYYY-MM-DD; row excluded from diff', supplied: r.post_date === undefined ? null : String(r.post_date) });
    const feeTypeSupplied = str(r.fee_type, '');
    const fee_type = FEE_TYPES.indexOf(feeTypeSupplied) !== -1 ? feeTypeSupplied : null;
    if (fee_type === null) rejected_inputs.push({ where: `core_charged_fees[${i}].fee_type`, reason: feeTypeSupplied === '' ? 'absent' : `not one of ${FEE_TYPES.join(', ')}`, supplied: feeTypeSupplied === '' ? null : feeTypeSupplied });
    const amount_minor_units = toNonNegMinorUnits(r.amount_minor_units, `core_charged_fees[${i}].amount_minor_units`, rejected_inputs);
    return { post_date, fee_type, amount_minor_units };
  }).filter((r) => r.post_date !== null && r.fee_type !== null);
  for (const r of core_charged_fees_normalized) {
    const key = r.post_date + '|' + r.fee_type;
    if (!coreBuckets[key]) coreBuckets[key] = { post_date: r.post_date, fee_type: r.fee_type, count: 0, amount_minor_units: 0 };
    coreBuckets[key].count += 1;
    coreBuckets[key].amount_minor_units += r.amount_minor_units;
  }

  const allKeys = Array.from(new Set([...Object.keys(recomputedBuckets), ...Object.keys(coreBuckets)])).sort();
  const diff = coreSupplied ? allKeys.map((key) => {
    const rec = recomputedBuckets[key] || null;
    const core = coreBuckets[key] || null;
    const [post_date, fee_type] = key.split('|');
    const recomputed_minor_units = rec ? rec.amount_minor_units : 0;
    const core_minor_units = core ? core.amount_minor_units : 0;
    const difference_minor_units = recomputed_minor_units - core_minor_units;
    return {
      post_date, fee_type,
      recomputed_count: rec ? rec.count : 0,
      recomputed_minor_units, recomputed_display: display(recomputed_minor_units),
      core_charged_count: core ? core.count : 0,
      core_charged_minor_units: core_minor_units, core_charged_display: display(core_minor_units),
      difference_minor_units, difference_display: display(difference_minor_units),
      agrees: difference_minor_units === 0 && (rec ? rec.count : 0) === (core ? core.count : 0),
      detail: difference_minor_units === 0 && (rec ? rec.count : 0) === (core ? core.count : 0)
        ? 'The independently recomputed fee total for this date and fee type equals the core-charged figure supplied.'
        : 'The independently recomputed fee total for this date and fee type diverges from the core-charged figure supplied.',
    };
  }) : [];
  const disagreeing = diff.filter((d) => !d.agrees);

  // ── Verdict. INDETERMINATE takes priority whenever a required input is absent. ──────────
  let verdict, indeterminate_reason;
  if (ledger.length === 0) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No usable ledger rows were supplied, so no fee events could be recomputed.';
  } else if (!nsfFeeSupplied || !odFeeSupplied) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'The fee schedule did not declare both nsf_fee_minor_units and od_fee_minor_units, so recomputed fee amounts cannot be established.';
  } else if (!coreSupplied) {
    verdict = 'INDETERMINATE';
    indeterminate_reason = 'No core-charged fees were supplied, so the recomputed fee events have nothing to compare against.';
  } else {
    verdict = disagreeing.length === 0 ? 'MATCHES' : 'DIVERGES';
    indeterminate_reason = null;
  }

  // ── Rationale. ────────────────────────────────────────────────────────────────────────
  const odCount = processed.filter((r) => r.fee_charged && r.fee_type === 'OD').length;
  const nsfCount = processed.filter((r) => r.fee_charged && r.fee_type === 'NSF').length;
  const capReachedCount = processed.filter((r) => r.cap_reached).length;
  const dedupedCount = processed.filter((r) => r.deduped).length;

  const rationale = [];
  rationale.push(`OD/NSF fee events recomputed for account ${account_token}, period ${period_label}, opening balance ${display(opening_balance_minor_units)} ${currency}.`);
  rationale.push(`Same-post_date items were re-sequenced per the declared posting_order_policy "${posting_order_policy}"${posting_policy_defaulted ? ' (defaulted -- none was validly declared)' : ''}. Posting order is a caller-declared input; this kernel infers no default beyond as_supplied and makes no claim about the policy's permissibility.`);
  rationale.push(`${odCount} item${odCount === 1 ? '' : 's'} were paid into a negative balance (OD) and ${nsfCount} item${nsfCount === 1 ? '' : 's'} were returned unpaid (NSF), each per its own settle_negative_allowed declaration.`);
  if (capReachedCount > 0) rationale.push(`${capReachedCount} otherwise fee-eligible event${capReachedCount === 1 ? '' : 's'} were not fee-charged because the declared daily_fee_cap_count of ${daily_fee_cap_count} had already been reached that day.`);
  if (dedupedCount > 0) rationale.push(`${dedupedCount} representment${dedupedCount === 1 ? '' : 's'} were not fee-charged under the declared ${representment_dedup_days}-day representment-dedup rule.`);
  rationale.push(extended_tier_active
    ? `${extended_fee_dates.length} extended-overdrawn fee${extended_fee_dates.length === 1 ? '' : 's'} were charged under the declared ${extended_overdrawn_days}-day threshold, counted over consecutive ledger post_dates with a negative end-of-day balance (a ledger-date proxy, not true calendar days -- see not_proven).`
    : 'No extended-overdrawn fee tier was declared (both extended_overdrawn_days and extended_overdrawn_fee_minor_units are required to activate it), so none was modelled.');
  rationale.push(`Total recomputed fees for the period: ${display(total_recomputed_fees_minor_units)} ${currency} across ${recomputed_fee_events.length} date/fee-type bucket${recomputed_fee_events.length === 1 ? '' : 's'}.`);
  rationale.push(verdict === 'INDETERMINATE'
    ? `Verdict is INDETERMINATE: ${indeterminate_reason}`
    : verdict === 'MATCHES'
      ? `The independently recomputed fee totals agree with the core-charged figures on every one of the ${diff.length} date/fee-type bucket${diff.length === 1 ? '' : 's'} compared. The recomputed side was derived here from the ledger and fee schedule, not lifted from the core-charged figures.`
      : `The independently recomputed fee totals diverge from the core-charged figures on ${disagreeing.length} of ${diff.length} date/fee-type bucket${diff.length === 1 ? '' : 's'}. Each divergence is listed with both figures. A divergence is an arithmetic finding about the ledger, fee schedule, and figures supplied here -- not a determination that any fee was charged incorrectly or impermissibly.`);
  if (rejected_inputs.length > 0) rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero, defaulted, or excluded. Each one is named in rejected_inputs rather than silently dropped.`);
  rationale.push('This tool independently recomputes and receipts fee arithmetic given the caller\'s own declared posting-order policy and fee schedule. It is not a core alternative, does not audit or find bugs in any vendor\'s system, and makes no claim of endorsement by or determination of legality about any core platform or posting-order policy.');

  // ── Flags. ────────────────────────────────────────────────────────────────────────────
  const compliance_flags = ['ODNSF_RECOMPUTED'];
  compliance_flags.push(verdict === 'INDETERMINATE' ? 'ODNSF_INDETERMINATE' : verdict === 'MATCHES' ? 'ODNSF_MATCHES' : 'ODNSF_DIVERGES');
  if (verdict === 'DIVERGES') compliance_flags.push('ESCALATION_RAISED');
  if (posting_policy_defaulted) compliance_flags.push('ODNSF_POSTING_POLICY_DEFAULTED');
  if (processed.some((r) => r.settle_negative_allowed_defaulted)) compliance_flags.push('ODNSF_SETTLE_FLAG_DEFAULTED');
  if (capReachedCount > 0) compliance_flags.push('ODNSF_CAP_REACHED');
  if (dedupedCount > 0) compliance_flags.push('ODNSF_DEDUPED');
  if (fee_schedule_in.representment_dedup_days === undefined || fee_schedule_in.representment_dedup_days === null) compliance_flags.push('ODNSF_DEDUP_NOT_DECLARED');
  if (extended_tier_active) { if (extended_fee_dates.length > 0) compliance_flags.push('ODNSF_EXTENDED_FEE_CHARGED'); } else { compliance_flags.push('ODNSF_EXTENDED_TIER_NOT_DECLARED'); }
  if (rejected_inputs.length > 0) compliance_flags.push('ODNSF_INPUTS_REJECTED');

  const output_payload = {
    account_token,
    period_label,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    opening_balance_minor_units,
    opening_balance_display: display(opening_balance_minor_units),
    posting_order_policy,
    posting_policy_defaulted,
    fee_schedule: {
      nsf_fee_minor_units, nsf_fee_display: display(nsf_fee_minor_units),
      od_fee_minor_units, od_fee_display: display(od_fee_minor_units),
      daily_fee_cap_count,
      representment_dedup_days,
      extended_overdrawn_days,
      extended_overdrawn_fee_minor_units,
      extended_tier_active,
    },
    ledger_row_count: ledger.length,
    events: processed.map((r) => ({
      txn_id: r.txn_id, post_date: r.post_date, effective_date: r.effective_date, txn_type: r.txn_type,
      amount_minor_units: r.amount_minor_units, amount_display: display(r.amount_minor_units),
      pre_balance_minor_units: r.pre_balance_minor_units, pre_balance_display: display(r.pre_balance_minor_units),
      post_balance_minor_units: r.post_balance_minor_units, post_balance_display: display(r.post_balance_minor_units),
      event_type: r.event_type,
      fee_charged: r.fee_charged, fee_type: r.fee_type,
      fee_amount_minor_units: r.fee_amount_minor_units, fee_amount_display: display(r.fee_amount_minor_units),
      deduped: r.deduped, cap_reached: r.cap_reached,
      representment_of: r.representment_of,
    })),
    extended_fee_dates,
    recomputed_fee_events,
    total_recomputed_fees_minor_units,
    total_recomputed_fees_display: display(total_recomputed_fees_minor_units),
    core_supplied: coreSupplied,
    core_charged_fee_events: coreBuckets ? Object.keys(coreBuckets).sort().map((k) => coreBuckets[k]) : [],
    comparison_basis: 'The recomputed side of every comparison is derived here from the posted ledger, the declared opening balance, and the declared fee schedule, aggregated by post_date and fee type. It is not read from the core-charged figures. A comparison is only meaningful because the two sides have independent provenance.',
    diff,
    verdict,
    indeterminate_reason,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'This is an independent recompute and receipt, not a core alternative, not a vendor audit, and not an endorsement claim by any core vendor or platform. Posting order and the fee schedule are caller-declared inputs, never chosen or inferred. A divergence is an arithmetic finding, never a determination that a fee was charged incorrectly or impermissibly, or is owed back -- interpretation belongs to the caller.',
    note: 'Deterministic OD/NSF fee-event recomputation for one stated period. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It performs no core posting integration of any kind (batch, caller-pasted export only).',
  };

  return { output_payload, compliance_flags };
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
