/**
 * art-506-classify-t1-posttrade-timing.kernel.mjs
 * Assurance Waves program (T1-SETTLEMENT-BUILD-SPEC.md §1, T1-K-1) — post-trade timing
 * classifier for the move to a T+1 settlement cycle.
 *
 * THE QUESTION THIS ANSWERS, AND THE ONE IT DOES NOT
 * It answers: which post-trade step breaches its cut-off under the target cycle that did not
 * breach under the baseline cycle. That is the question a readiness programme is actually trying
 * to answer, and it is a TIMING question.
 * ⛔ It does NOT compute settlement penalties. That is art-78 (CSDR penalty kernel) and this
 * kernel deliberately does not rebuild any of it. No penalty arithmetic, no reference price, no
 * FX or funding implication, and no claim about US or any other T+1 market.
 *
 * ⚠ STEP-0 RE-VERIFIED 2026-07-30 (nothing inherited):
 * The UK, the EU, Liechtenstein and Switzerland move from T+2 to T+1 on 11 October 2027. The UK
 * Accelerated Settlement Taskforce, the EU T+1 Industry Committee and the Swiss Securities Post
 * Trade Council T+1 Task Force published a unified Testing and Readiness Plan in March 2026,
 * following a joint Testing and Readiness Workstream established in December 2025. It is the
 * first such plan to span the EU, UK and Swiss markets simultaneously. Liechtenstein's own
 * regulator states the regulation applies there once incorporated into the EEA Agreement, a
 * process already begun, and the Swiss and Liechtenstein markets migrate on the same date.
 * The published phasing is planning and solution finalisation across 2025 and 2026,
 * implementation and readiness in 2026, and industry testing in 2027.
 * These are the only regime facts this kernel states, and it states them as prose. It does not
 * branch on them, so they cannot silently go stale inside the arithmetic.
 *
 * ⛔ NO MAINTAINED CUT-OFF TABLE, BY DESIGN.
 * Every cut-off is a CALLER INPUT. No per-market or per-venue cut-off is shipped as data and no
 * named-venue profile set exists, on the same reasoning that kept chain profiles out of art-492:
 * a table of market cut-offs is a recurring maintenance duty, and a duty that silently becomes
 * false is worse than no table at all. The caller holds the cut-offs because the caller is the
 * one who can keep them true.
 *
 * ⚠ THIS CLASSIFIES SUPPLIED TIMINGS.
 * It does not observe a venue, a CSD or a matching platform, it opens no connection, and it must
 * not be described as monitoring. Every timestamp and every cut-off arrives as an argument.
 *
 * ⛔ NO CLOCK. compute() never reads wall-clock time. Timestamps are parsed from caller strings
 * with a strict ISO 8601 grammar into epoch seconds via Date.UTC, which is a pure function of its
 * arguments. Nothing is compared against "now" and nothing expires on its own.
 *
 * FINITE GATE. Every emitted number passes through finiteOrNull. A missing, blank, malformed or
 * out-of-range timestamp yields null with a named reason and marks the step undetermined; it
 * never yields NaN and never silently reads as on time.
 *
 * ⛔ PII: trades, steps and counterparties are identified by opaque caller-supplied references
 * only. No name, account number or identifier of a natural person is taken. Fixtures are
 * SYNTHETIC (CONTRACT §1.3).
 *
 * Spec: T1-SETTLEMENT-BUILD-SPEC.md §0 + §1 + §2 (T1-K-1, art-506).
 * Shared constraints: SAFEGUARDING-CASS15-BUILD-SPEC.md §5.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-506-classify-t1-posttrade-timing';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'classify_t1_posttrade_timing', mandate_type: 'compliance_mandate', gpu: false };

// Strict ISO 8601: YYYY-MM-DDTHH:MM[:SS] with an optional Z or +HH:MM / -HH:MM offset.
// Deliberately strict: Date.parse accepts a wide and partly implementation-defined grammar, and
// a classifier whose parse depends on the host is not deterministic.
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Every number this kernel emits goes through here. NaN, Infinity and non-numbers become null.
function finiteOrNull(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function finiteOrZero(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * Parse a caller-supplied timestamp to epoch seconds. Pure: no clock, no locale, no host grammar.
 * defaultOffsetMinutes applies only when the string carries no explicit offset of its own.
 */
function parseTimestamp(value, defaultOffsetMinutes, offsetWasDeclared) {
  if (!isNonEmptyString(value)) {
    return { ok: false, epoch_seconds: null, offset_source: null, reason: 'No timestamp was supplied for this step.' };
  }
  const m = TS_RE.exec(value.trim());
  if (!m) {
    return { ok: false, epoch_seconds: null, offset_source: null, reason: 'The timestamp is not an ISO 8601 value of the form YYYY-MM-DDTHH:MM:SS with an optional Z or +HH:MM offset.' };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const H = Number(m[4]);
  const Mi = Number(m[5]);
  const S = m[6] ? Number(m[6]) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || H > 23 || Mi > 59 || S > 59) {
    return { ok: false, epoch_seconds: null, offset_source: null, reason: 'The timestamp names a calendar or clock field outside its permitted range.' };
  }
  const baseMs = Date.UTC(y, mo - 1, d, H, Mi, S);
  if (!Number.isFinite(baseMs)) {
    return { ok: false, epoch_seconds: null, offset_source: null, reason: 'The timestamp does not resolve to a representable instant.' };
  }
  // Reject a rolled-over date such as 2027-02-30, which Date.UTC would silently normalise.
  const back = new Date(baseMs);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return { ok: false, epoch_seconds: null, offset_source: null, reason: 'The timestamp names a calendar date that does not exist in that month.' };
  }

  let offsetMinutes;
  let offset_source;
  if (m[7] === 'Z') {
    offsetMinutes = 0;
    offset_source = 'explicit_utc';
  } else if (m[7]) {
    const sign = m[7][0] === '-' ? -1 : 1;
    offsetMinutes = sign * (Number(m[7].slice(1, 3)) * 60 + Number(m[7].slice(4, 6)));
    offset_source = 'explicit_offset';
  } else if (offsetWasDeclared) {
    offsetMinutes = finiteOrZero(defaultOffsetMinutes);
    offset_source = 'declared_time_zone_offset_minutes';
  } else {
    offsetMinutes = 0;
    offset_source = 'no_offset_declared_treated_as_utc';
  }

  const epoch = finiteOrNull(Math.round(baseMs / 1000) - offsetMinutes * 60);
  if (epoch === null) {
    return { ok: false, epoch_seconds: null, offset_source: offset_source, reason: 'The timestamp with its offset applied does not resolve to a finite instant.' };
  }
  return { ok: true, epoch_seconds: epoch, offset_source: offset_source, reason: null };
}

// A step is on time, at risk or breached against ONE cut-off. at_risk is a caller-declared band:
// with no band declared there is no at-risk zone, and that absence is reported rather than
// papered over with a number we invented.
function statusFor(marginSeconds, atRiskBandSeconds) {
  if (marginSeconds === null) return 'undetermined';
  if (marginSeconds < 0) return 'breached';
  if (atRiskBandSeconds > 0 && marginSeconds <= atRiskBandSeconds) return 'at_risk';
  return 'on_time';
}

export function compute(pp) {
  pp = pp || {};

  const trade_ref = isNonEmptyString(pp.trade_ref) ? pp.trade_ref : '';
  const target_cycle = isNonEmptyString(pp.target_cycle) ? pp.target_cycle.trim() : 'T+1';
  const baseline_cycle = isNonEmptyString(pp.baseline_cycle) ? pp.baseline_cycle.trim() : 'T+2';
  const cycle_compared = `${baseline_cycle} to ${target_cycle}`;

  const offsetWasDeclared = typeof pp.time_zone_offset_minutes === 'number' && Number.isFinite(pp.time_zone_offset_minutes);
  const time_zone_offset_minutes = offsetWasDeclared ? pp.time_zone_offset_minutes : null;

  const at_risk_margin_seconds = finiteOrZero(pp.at_risk_margin_seconds) > 0 ? finiteOrZero(pp.at_risk_margin_seconds) : 0;

  const trade_timestamp = isNonEmptyString(pp.trade_timestamp) ? pp.trade_timestamp : '';
  const venue_cutoff = isNonEmptyString(pp.venue_cutoff) ? pp.venue_cutoff : '';

  const suppliedSteps = Array.isArray(pp.steps) ? pp.steps : [];

  // The declared order is the caller's order and is preserved. first_failing_step means the first
  // step in the post-trade chain as the caller declared it, never the earliest by clock, because a
  // chain is a sequence of dependencies rather than a sorted list of instants.
  const workSteps = [];

  // Trade execution against the venue cut-off is synthesised only when the caller supplied both,
  // so the two inputs are actually used rather than merely echoed. The venue cut-off does not
  // differ by settlement cycle, so it is carried into both sides and can never be newly breaching.
  if (trade_timestamp && venue_cutoff) {
    workSteps.push({
      step: 'trade_execution',
      achieved_at: trade_timestamp,
      cutoff_target: venue_cutoff,
      cutoff_baseline: venue_cutoff,
      synthesised_from: 'trade_timestamp and venue_cutoff',
    });
  }

  suppliedSteps.forEach((raw, i) => {
    const s = raw && typeof raw === 'object' ? raw : {};
    workSteps.push({
      step: isNonEmptyString(s.step) ? s.step : `(unnamed-step-${i})`,
      achieved_at: isNonEmptyString(s.achieved_at) ? s.achieved_at : '',
      cutoff_target: isNonEmptyString(s.cutoff_target) ? s.cutoff_target : '',
      cutoff_baseline: isNonEmptyString(s.cutoff_baseline) ? s.cutoff_baseline : '',
      synthesised_from: null,
    });
  });

  const rationale = [];
  const steps = [];
  let offset_undeclared_used = false;

  workSteps.forEach((w) => {
    const achieved = parseTimestamp(w.achieved_at, time_zone_offset_minutes, offsetWasDeclared);
    const cutT = parseTimestamp(w.cutoff_target, time_zone_offset_minutes, offsetWasDeclared);
    const cutB = parseTimestamp(w.cutoff_baseline, time_zone_offset_minutes, offsetWasDeclared);

    [achieved, cutT, cutB].forEach((p) => {
      if (p.offset_source === 'no_offset_declared_treated_as_utc') offset_undeclared_used = true;
    });

    const margin_seconds = achieved.ok && cutT.ok ? finiteOrNull(cutT.epoch_seconds - achieved.epoch_seconds) : null;
    const margin_seconds_baseline = achieved.ok && cutB.ok ? finiteOrNull(cutB.epoch_seconds - achieved.epoch_seconds) : null;

    const status = statusFor(margin_seconds, at_risk_margin_seconds);
    const status_baseline = statusFor(margin_seconds_baseline, at_risk_margin_seconds);

    const undetermined_reason = margin_seconds === null
      ? (!achieved.ok ? achieved.reason : cutT.reason)
      : null;

    // The whole point of the node: breached now, did not breach before.
    const breaches_under_target_only = status === 'breached' && status_baseline === 'on_time';
    const baseline_not_compared = margin_seconds_baseline === null;

    if (status === 'breached' && baseline_not_compared) {
      rationale.push(`Step ${w.step} breaches its ${target_cycle} cut-off, but no usable ${baseline_cycle} cut-off was supplied, so this run cannot say whether the breach is new.`);
    } else if (breaches_under_target_only) {
      rationale.push(`Step ${w.step} breaches its ${target_cycle} cut-off by ${Math.abs(finiteOrZero(margin_seconds))} second(s) and met its ${baseline_cycle} cut-off with ${finiteOrZero(margin_seconds_baseline)} second(s) to spare. The shorter cycle is what breaks it.`);
    } else if (status === 'breached') {
      rationale.push(`Step ${w.step} breaches its ${target_cycle} cut-off and also missed its ${baseline_cycle} cut-off, so the shorter cycle is not the cause.`);
    } else if (status === 'at_risk') {
      rationale.push(`Step ${w.step} clears its ${target_cycle} cut-off by ${finiteOrZero(margin_seconds)} second(s), inside the declared at-risk band of ${at_risk_margin_seconds} second(s).`);
    } else if (status === 'undetermined') {
      rationale.push(`Step ${w.step} could not be classified: ${undetermined_reason}`);
    }

    steps.push({
      step: w.step,
      synthesised_from: w.synthesised_from,
      achieved_at: w.achieved_at,
      achieved_epoch_seconds: achieved.epoch_seconds,
      achieved_offset_source: achieved.offset_source,
      cutoff_target: w.cutoff_target,
      cutoff_target_epoch_seconds: cutT.epoch_seconds,
      cutoff_baseline: w.cutoff_baseline,
      cutoff_baseline_epoch_seconds: cutB.epoch_seconds,
      margin_seconds: margin_seconds,
      margin_seconds_baseline: margin_seconds_baseline,
      status: status,
      status_baseline: status_baseline,
      breaches_under_target_only: breaches_under_target_only,
      baseline_not_compared: baseline_not_compared,
      undetermined_reason: undetermined_reason,
    });
  });

  const breached = steps.filter((s) => s.status === 'breached');
  const at_risk = steps.filter((s) => s.status === 'at_risk');
  const on_time = steps.filter((s) => s.status === 'on_time');
  const undetermined = steps.filter((s) => s.status === 'undetermined');
  const newly_breaching = steps.filter((s) => s.breaches_under_target_only);
  const baseline_gaps = steps.filter((s) => s.baseline_not_compared);

  const first_failing_step = breached.length > 0 ? breached[0].step : null;
  const first_newly_breaching_step = newly_breaching.length > 0 ? newly_breaching[0].step : null;

  const step_count = steps.length;
  const breached_count = breached.length;
  const at_risk_count = at_risk.length;
  const on_time_count = on_time.length;
  const undetermined_count = undetermined.length;
  const newly_breaching_count = newly_breaching.length;
  const baseline_not_compared_count = baseline_gaps.length;

  let verdict;
  let verdict_reason;
  if (step_count === 0) {
    verdict = 'no_steps_supplied';
    verdict_reason = 'No post-trade step was supplied, so there is nothing to classify. Each step needs an achieved timestamp and a cut-off for the target cycle, and a cut-off for the baseline cycle if the run is to say whether a breach is new.';
  } else if (newly_breaching_count > 0) {
    verdict = 'breaches_introduced_by_target_cycle';
    verdict_reason = `${newly_breaching_count} step(s) breach under ${target_cycle} that met their ${baseline_cycle} cut-off. The first is ${first_newly_breaching_step}.`;
  } else if (breached_count > 0 && breached.some((s) => s.baseline_not_compared)) {
    // Never claim the baseline was also missed when the baseline was never compared.
    verdict = 'breached_baseline_not_comparable';
    verdict_reason = `${breached_count} step(s) breach under ${target_cycle}. At least one of them carries no usable ${baseline_cycle} cut-off, so this run cannot say whether the shorter cycle is what breaks it. The first failing step is ${first_failing_step}.`;
  } else if (breached_count > 0) {
    verdict = 'breached_under_both_cycles';
    verdict_reason = `${breached_count} step(s) breach under ${target_cycle}, and none of them met their ${baseline_cycle} cut-off either, so on these timings the shorter cycle is not what breaks them. The first failing step is ${first_failing_step}.`;
  } else if (at_risk_count > 0) {
    verdict = 'at_risk_under_target_cycle';
    verdict_reason = `No step breaches under ${target_cycle}, and ${at_risk_count} step(s) clear their cut-off inside the declared at-risk band of ${at_risk_margin_seconds} second(s).`;
  } else if (undetermined_count > 0 && on_time_count === 0) {
    verdict = 'timings_incomplete';
    verdict_reason = `No step could be classified against ${target_cycle}. Every supplied step is missing a usable achieved timestamp or a usable cut-off.`;
  } else if (undetermined_count > 0) {
    // A partially unclassifiable chain must not read as a clean pass on the top line.
    verdict = 'on_time_with_timings_incomplete';
    verdict_reason = `Every one of the ${on_time_count} step(s) this run could classify clears its ${target_cycle} cut-off, but ${undetermined_count} step(s) could not be classified at all. This is not a ready result.`;
  } else {
    verdict = 'on_time_under_target_cycle';
    verdict_reason = `Every step this run could classify clears its ${target_cycle} cut-off on the timings supplied.`;
  }

  if (undetermined_count > 0 && verdict !== 'timings_incomplete') {
    rationale.push(`${undetermined_count} step(s) could not be classified and are excluded from the on-time count. An unclassified step is not an on-time step.`);
  }
  if (at_risk_margin_seconds === 0 && step_count > 0) {
    rationale.push('No at-risk band was declared, so at_risk_margin_seconds is zero and no step can be classified at risk. A step that clears its cut-off by one second reads as on time. Declare at_risk_margin_seconds to open a band.');
  }
  if (baseline_not_compared_count > 0) {
    rationale.push(`${baseline_not_compared_count} step(s) carry no usable ${baseline_cycle} cut-off, so this run cannot say whether their result is new to ${target_cycle}.`);
  }
  if (offset_undeclared_used) {
    rationale.push('At least one timestamp carried no offset of its own and no time_zone_offset_minutes was declared, so it was read as UTC. Declare the offset if the supplied timestamps are local.');
  }

  const compliance_flags = [];
  if (step_count === 0) compliance_flags.push('T1_NO_STEPS_SUPPLIED');
  if (breached_count > 0) compliance_flags.push('T1_BREACH_PROJECTED');
  if (breached_count === 0 && at_risk_count > 0) compliance_flags.push('T1_AT_RISK');
  if (step_count > 0 && breached_count === 0 && at_risk_count === 0 && undetermined_count === 0) compliance_flags.push('T1_READY');
  if (newly_breaching_count > 0 || breached_count > 0) compliance_flags.push('ESCALATION_RAISED');
  if (newly_breaching_count > 0) compliance_flags.push('T1_BREACHES_INTRODUCED_BY_SHORTER_CYCLE');
  if (undetermined_count > 0) compliance_flags.push('T1_TIMINGS_INCOMPLETE');
  if (baseline_not_compared_count > 0) compliance_flags.push('T1_BASELINE_NOT_COMPARED');
  if (at_risk_margin_seconds === 0 && step_count > 0) compliance_flags.push('T1_AT_RISK_BAND_UNDECLARED');
  if (offset_undeclared_used) compliance_flags.push('T1_TIME_ZONE_OFFSET_UNDECLARED');

  const output_payload = {
    trade_ref: trade_ref,
    target_cycle: target_cycle,
    baseline_cycle: baseline_cycle,
    cycle_compared: cycle_compared,
    time_zone_offset_minutes: time_zone_offset_minutes,
    at_risk_margin_seconds: at_risk_margin_seconds,
    trade_timestamp: trade_timestamp,
    venue_cutoff: venue_cutoff,
    verdict: verdict,
    verdict_reason: verdict_reason,
    first_failing_step: first_failing_step,
    first_newly_breaching_step: first_newly_breaching_step,
    steps: steps,
    step_count: step_count,
    breached_count: breached_count,
    at_risk_count: at_risk_count,
    on_time_count: on_time_count,
    undetermined_count: undetermined_count,
    newly_breaching_count: newly_breaching_count,
    baseline_not_compared_count: baseline_not_compared_count,
    rationale: rationale,
    note: 'Deterministic classification of post-trade step timings the caller supplies, comparing each step against a target-cycle cut-off and a baseline-cycle cut-off to identify which steps the shorter cycle is what breaks. Every cut-off is a caller input: no market or venue cut-off table is shipped, because a table of cut-offs is a maintenance duty that would silently go false. No clock is read and nothing is compared against the present moment. This tool observes no venue, no central securities depository and no matching platform, and it is not monitoring. It computes no settlement penalty, which is a separate concern, and it makes no claim about markets outside the cycle change the caller declares. It is not legal, tax or regulatory advice.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
