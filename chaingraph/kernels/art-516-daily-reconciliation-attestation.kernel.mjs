/**
 * art-516-daily-reconciliation-attestation.kernel.mjs
 * INBOUND-EVIDENCE-BUILD-SPEC.md §6.1 (RFP §4.6, CDGPSS202601) — daily reconciliation
 * attestation.
 *
 * ⛔ THIS DOES NOT MATCH TRANSACTIONS. `565-camt053-reconciliation-workbench`,
 * `09-a2a-reconciliation-workbench`, `55-dvp-reconciliation`, `art-258`, `art-61`, and
 * `art-470` all compute a match. This kernel takes the OUTCOME of a reconciliation run
 * that already happened elsewhere -- a declared population, matched/unmatched/partial
 * counts and totals, an exception list, and the prior period's carried-forward exception
 * set -- and attests whether the daily reconciliation DUTY was discharged: does the
 * population reconcile in BOTH count and value, is every exception aged against a
 * declared tolerance, and did any prior-period exception disappear without a documented
 * resolution. It differs from art-470 (single-axis source-vs-extract completeness for
 * one AML lookback, no exception-continuity dimension), from art-258 (parses one
 * camt.053 statement's balance equation and BkTxCd buckets, no population/exception
 * concept at all), from art-482 (adjudicates a NEW break set field-by-field against a
 * trade repository response) and from art-483 (ages EMIR breaks cycle-to-cycle by
 * diffing break_key sets, but a break absent from `current` is unconditionally
 * `newly_closed` -- it never asks whether that closure was DOCUMENTED, which is exactly
 * the gap RECON_EXCEPTION_VANISHED exists to catch).
 *
 * RECON_EXCEPTION_VANISHED IS THE POINT. A break that ages out of a report without a
 * recorded resolution is the classic public-money audit finding. Detecting it requires
 * the prior period's exception set as an independent input: if that input is ABSENT
 * (undefined/null, not merely an empty array), continuity cannot be evaluated and this
 * kernel emits RECON_CONTINUITY_UNVERIFIABLE rather than a false clean. An empty array
 * is a legitimate declaration of zero carried-forward exceptions and IS verified.
 *
 * REGION-PORTABLE BY CONSTRUCTION (§6.9). No country, currency, scheme, ministry or
 * statute is named anywhere in this file. `currency`, `ageing_tolerance_days`, and every
 * figure are caller-declared policy inputs -- the same kernel runs unchanged for a
 * second, structurally different jurisdiction (see the fixtures for two such cases).
 *
 * FIXED-POINT MONEY MATH (CONTRACT money convention, art-499 pattern). Every amount
 * crosses the boundary as an integer number of minor units. No floating-point arithmetic
 * anywhere in compute(): sums, differences, and tolerance comparisons are integer
 * operations; display strings come from integer division, never toFixed() on a float.
 * A non-integer, non-finite, or absent amount is coerced to 0 and named in
 * `rejected_inputs[]`, never silently dropped and never propagated as NaN.
 *
 * FINITE GATE. An empty exception list, an all-zero population, and an absent prior
 * period each resolve to a DEFINED verdict. No branch can emit NaN, Infinity,
 * null-as-a-number, or an undefined status.
 *
 * NO CLOCK. `as_of` and `reconciliation_date` are caller inputs; compute() never reads
 * a clock. Exception age is computed as declared `as_of` minus the exception's declared
 * `opened_date`, both caller-supplied ISO dates -- never `Date.now()`.
 *
 * PII: opaque exception_id / record refs only. No account holder, beneficiary, employee,
 * or citizen identity of any kind enters this kernel.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: INBOUND-EVIDENCE-BUILD-SPEC.md §6.1 (RFP §4.6).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-516-daily-reconciliation-attestation';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'attest_daily_reconciliation', mandate_type: 'attestation_mandate', gpu: false };

function isStr(v) { return typeof v === 'string' && v.length > 0; }
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

/** Integer coercion with an explicit rejection record. Never a silent drop, never NaN. */
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
function toCount(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  rejected.push({ where, reason: 'expected a non-negative integer count', supplied: typeof v === 'number' ? v : String(v) });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}
/** Whole-day delta between two ISO yyyy-mm-dd strings, no Date.now(), both caller-supplied. */
function isoDayDelta(laterIso, earlierIso) {
  if (!isoDateOrNull(laterIso) || !isoDateOrNull(earlierIso)) return null;
  const later = Date.parse(laterIso + 'T00:00:00Z');
  const earlier = Date.parse(earlierIso + 'T00:00:00Z');
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.max(0, Math.round((later - earlier) / 86400000));
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const reconciliation_date = isoDateOrNull(pp.reconciliation_date);
  const as_of = isoDateOrNull(pp.as_of) || reconciliation_date;
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';
  const ageing_tolerance_days = (typeof pp.ageing_tolerance_days === 'number' && Number.isFinite(pp.ageing_tolerance_days) && pp.ageing_tolerance_days >= 0)
    ? Math.trunc(pp.ageing_tolerance_days) : null;
  if (ageing_tolerance_days === null) rejected_inputs.push({ where: 'ageing_tolerance_days', reason: 'absent or not a non-negative number', supplied: pp.ageing_tolerance_days === undefined ? null : pp.ageing_tolerance_days });

  // --- Declared population (§6.1: count + control total) ---
  const declaredPop = pp.declared_population && typeof pp.declared_population === 'object' ? pp.declared_population : {};
  const declared_record_count = toCount(declaredPop.record_count, 'declared_population.record_count', rejected_inputs);
  const declared_control_total_minor_units = toMinorUnits(declaredPop.control_total_minor_units, 'declared_population.control_total_minor_units', rejected_inputs);

  // --- Matched / unmatched / partially-matched counts and totals ---
  function bucket(name) {
    const b = pp[name] && typeof pp[name] === 'object' ? pp[name] : {};
    return {
      record_count: toCount(b.record_count, `${name}.record_count`, rejected_inputs),
      total_minor_units: toMinorUnits(b.total_minor_units, `${name}.total_minor_units`, rejected_inputs),
    };
  }
  const matched = bucket('matched');
  const unmatched = bucket('unmatched');
  const partially_matched = bucket('partially_matched');

  const reconciled_record_count = matched.record_count + unmatched.record_count + partially_matched.record_count;
  const reconciled_value_minor_units = matched.total_minor_units + unmatched.total_minor_units + partially_matched.total_minor_units;

  const count_break = reconciled_record_count - declared_record_count;
  const value_break_minor_units = reconciled_value_minor_units - declared_control_total_minor_units;
  const population_count_complete = count_break === 0;
  const population_value_complete = value_break_minor_units === 0;
  const population_complete = population_count_complete && population_value_complete;

  // --- Exception list, each with a reason code, ageing against declared tolerance ---
  const exceptionsIn = Array.isArray(pp.exceptions) ? pp.exceptions : [];
  const exceptions = exceptionsIn.map((e, i) => {
    e = e && typeof e === 'object' ? e : {};
    const exception_id = isNonEmptyString(e.exception_id) ? e.exception_id.trim() : `UNLABELLED-${i + 1}`;
    const reason_code = isNonEmptyString(e.reason_code) ? e.reason_code.trim() : null;
    if (!reason_code) rejected_inputs.push({ where: `exceptions[${i}].reason_code`, reason: 'absent', supplied: null });
    const opened_date = isoDateOrNull(e.opened_date);
    const amount_minor_units = toMinorUnits(e.amount_minor_units, `exceptions[${i}].amount_minor_units`, rejected_inputs);
    const age_days = (as_of && opened_date) ? isoDayDelta(as_of, opened_date) : null;
    const aged = (age_days !== null && ageing_tolerance_days !== null) ? age_days > ageing_tolerance_days : false;
    return { exception_id, reason_code: reason_code || 'unclassified', opened_date, amount_minor_units, amount_display: display(amount_minor_units), age_days, aged };
  });
  const aged_exceptions = exceptions.filter((e) => e.aged);

  // --- Carried-forward exception continuity: the ABSENCE-INSTRUMENT rule. ---
  // `prior_period_exceptions` undefined/null (key absent) means continuity cannot be
  // evaluated at all -- distinct from a declared empty array, which means zero
  // carried-forward exceptions and IS a verifiable clean state.
  const priorInputPresent = pp.prior_period_exceptions !== undefined && pp.prior_period_exceptions !== null;
  const priorPeriodExceptions = priorInputPresent && Array.isArray(pp.prior_period_exceptions) ? pp.prior_period_exceptions : [];
  if (priorInputPresent && !Array.isArray(pp.prior_period_exceptions)) {
    rejected_inputs.push({ where: 'prior_period_exceptions', reason: 'present but not an array', supplied: typeof pp.prior_period_exceptions });
  }

  const currentIds = new Set(exceptions.map((e) => e.exception_id));
  // A documented resolution is a caller-supplied record naming the prior exception_id and
  // a resolution reason -- its presence is what distinguishes a legitimately closed
  // exception from one that silently disappeared.
  const resolvedIn = Array.isArray(pp.resolved_exceptions) ? pp.resolved_exceptions : [];
  const resolvedById = new Map();
  for (const r of resolvedIn) {
    if (r && isNonEmptyString(r.exception_id)) {
      const resolution_reason = isNonEmptyString(r.resolution_reason) ? r.resolution_reason.trim() : null;
      resolvedById.set(r.exception_id.trim(), resolution_reason);
    }
  }

  const continuity_verifiable = priorInputPresent;
  const vanished_exceptions = [];
  const documented_resolutions = [];
  if (continuity_verifiable) {
    for (const prior of priorPeriodExceptions) {
      if (!prior || !isNonEmptyString(prior.exception_id)) continue;
      const id = prior.exception_id.trim();
      if (currentIds.has(id)) continue; // still open this period, tracked via `exceptions`
      const resolution = resolvedById.has(id) ? resolvedById.get(id) : undefined;
      if (resolution) {
        documented_resolutions.push({ exception_id: id, resolution_reason: resolution });
      } else {
        vanished_exceptions.push({ exception_id: id, reason_code: isNonEmptyString(prior.reason_code) ? prior.reason_code.trim() : 'unclassified', opened_date: isoDateOrNull(prior.opened_date) });
      }
    }
  }

  const unexplained_exception_total_minor_units = exceptions.reduce((a, e) => a + e.amount_minor_units, 0);
  const unexplained_difference_minor_units = value_break_minor_units - unexplained_exception_total_minor_units;
  const has_unexplained_difference = unexplained_difference_minor_units !== 0;

  const attested = population_complete && aged_exceptions.length === 0 && vanished_exceptions.length === 0 && !has_unexplained_difference;

  const compliance_flags = [];
  if (!population_complete) compliance_flags.push('RECON_POPULATION_INCOMPLETE');
  if (aged_exceptions.length > 0) compliance_flags.push('RECON_EXCEPTION_AGED');
  if (continuity_verifiable && vanished_exceptions.length > 0) compliance_flags.push('RECON_EXCEPTION_VANISHED');
  if (!continuity_verifiable) compliance_flags.push('RECON_CONTINUITY_UNVERIFIABLE');
  if (has_unexplained_difference) compliance_flags.push('RECON_UNEXPLAINED_DIFFERENCE');
  if (rejected_inputs.length > 0) compliance_flags.push('RECON_INPUTS_REJECTED');
  if (attested) compliance_flags.push('RECON_ATTESTED');

  const rationale = [];
  rationale.push(`Declared population: ${declared_record_count} records, control total ${display(declared_control_total_minor_units)} ${currency}. Reconciled (matched+unmatched+partial): ${reconciled_record_count} records, ${display(reconciled_value_minor_units)} ${currency}.`);
  rationale.push(population_complete
    ? 'Population reconciles to the declared count and value.'
    : `Population does NOT reconcile: count break ${count_break}, value break ${display(value_break_minor_units)} ${currency}.`);
  rationale.push(continuity_verifiable
    ? `Continuity evaluated against ${priorPeriodExceptions.length} prior-period exception${priorPeriodExceptions.length === 1 ? '' : 's'}: ${vanished_exceptions.length} vanished without a documented resolution, ${documented_resolutions.length} closed with one.`
    : 'Prior-period exception set was not supplied, so carried-forward continuity cannot be evaluated this cycle. This is reported as unverifiable, never as a clean result.');
  if (aged_exceptions.length > 0) rationale.push(`${aged_exceptions.length} of ${exceptions.length} open exceptions exceed the declared ${ageing_tolerance_days}-day ageing tolerance.`);
  if (has_unexplained_difference) rationale.push(`${display(unexplained_difference_minor_units)} ${currency} of the value break is not accounted for by the declared exception list.`);
  rationale.push('This is an arithmetic attestation over the figures supplied for this cycle. It does not itself perform the reconciliation match and is not a determination that any underlying control has or has not been met.');

  const output_payload = {
    reconciliation_date,
    as_of,
    currency,
    ageing_tolerance_days,
    declared_record_count,
    declared_control_total_minor_units,
    declared_control_total_display: display(declared_control_total_minor_units),
    matched, unmatched, partially_matched,
    reconciled_record_count,
    reconciled_value_minor_units,
    reconciled_value_display: display(reconciled_value_minor_units),
    count_break,
    value_break_minor_units,
    value_break_display: display(value_break_minor_units),
    population_count_complete,
    population_value_complete,
    population_complete,
    exception_count: exceptions.length,
    exceptions,
    aged_exception_count: aged_exceptions.length,
    continuity_verifiable,
    prior_period_exception_count: priorPeriodExceptions.length,
    vanished_exception_count: vanished_exceptions.length,
    vanished_exceptions,
    documented_resolutions,
    unexplained_exception_total_minor_units,
    unexplained_difference_minor_units,
    unexplained_difference_display: display(unexplained_difference_minor_units),
    has_unexplained_difference,
    attested,
    rejected_inputs,
    rationale,
    note: 'Deterministic daily reconciliation attestation over a caller-supplied population, matched/unmatched/partial breakdown, exception list, and prior-period exception set. It attests that the daily reconciliation duty was discharged -- population completeness in count and value, exception ageing against a declared tolerance, and carried-forward exception continuity -- rather than performing the underlying transaction match itself.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
