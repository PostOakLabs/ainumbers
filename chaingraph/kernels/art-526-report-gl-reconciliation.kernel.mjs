/**
 * art-526-report-gl-reconciliation.kernel.mjs
 * STP-BRANCHABILITY-BUILD-SPEC.md §6 (R3) — ties a caller-declared reported figure to a
 * caller-declared general-ledger figure, by account, against an independent book of record.
 * Clause: BCBS 239 §36(c) (reconcile risk data to accounting data) · ECB RDARR Guide §3.5(1),
 * §3.5(2) (tolerances).
 *
 * THIS IS THE ONLY NODE IN THE STPB WAVE WITH AN INDEPENDENT WITNESS. FC1 and R2 compare
 * declared things against other declared things; here the general ledger is a separate book of
 * record, which is why the designed-plug and cadence rules below are load-bearing, not polish.
 *
 * VERSIONED POLICY INPUTS, art-437 STYLE. `appendix_schedule_version` and
 * `appendix_schedule_source` are caller-declared policy inputs (never hardcoded) so the node
 * does not rot at the next instruction reissue; both fold into `output_payload` and so into the
 * kernel identity via the hash preimage.
 *
 * THE DESIGNED PLUG IS A FIRST-CLASS INPUT, NOT AN ERROR. Some regimes do not require full GAAP
 * tie-out -- for FR 2052a, field S.B.6 "Carrying Value Adjustment" is the designed plug, with
 * Appendix VIII setting alignment firm-by-firm. Each account's `designed_plug_minor_units` is
 * netted against the GL figure before the residual is computed and is reported separately from
 * the residual -- never counted as a break.
 *
 * CADENCE REFUSAL. Refusing a reconciliation run as unsound where the underlying GL supplemental
 * schedule updates less often than the declared reporting cadence is a control decision, not a
 * silent skip -- it emits `did_not_run` with the reason, never a misleading pass and never a
 * break.
 *
 * QUARTER-END: "GL NOT YET CLOSED" vs "GENUINE BREAK" ARE SEPARATE OUTCOMES. `gl_closed` is
 * checked before any residual is computed -- an open GL never produces a break verdict, only a
 * `did_not_run` with reason `gl_not_yet_closed`.
 *
 * DECISION OUTCOME (spec §2.2). Emits a §27.4 `$defs/haGatePolicy` value (`auto_pass` /
 * `review_required`) at the predictable pointer `output_payload.decision.gate_policy`, plus a
 * sibling `output_payload.decision.execution_state` (`ran` / `did_not_run` / `ran_stale`) for the
 * two control-execution states the closed §27.4 enum does not cover. No invented vocabulary, no
 * hash-excluded field -- `decision` lives inside `output_payload`, inside the §4 hash preimage.
 *
 * FIXED-POINT MONEY MATH (CONTRACT money convention). Every amount crosses the boundary as an
 * integer number of minor units. No floating-point arithmetic in compute(): sums, differences,
 * and tolerance comparisons are integer operations; display strings come from integer division,
 * never toFixed() on a float. A non-integer, non-finite, or absent amount is coerced to 0 and
 * named in `rejected_inputs[]`, never silently dropped and never propagated as NaN.
 *
 * FINITE GATE. Zero accounts, zero plugs, and an absent gl_as_of each resolve to a DEFINED
 * verdict. No branch can emit NaN, Infinity, null-as-a-number, or an undefined status.
 *
 * NO CLOCK. `as_of` and `gl_as_of` are caller inputs; compute() never reads a clock.
 *
 * PII: opaque account_id only. No account holder, beneficiary, employee, or citizen identity of
 * any kind enters this kernel.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-526-report-gl-reconciliation';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'reconcile_report_to_general_ledger', mandate_type: 'attestation_mandate', gpu: false };

const CADENCE_RANK = { daily: 0, weekly: 1, monthly: 2, quarterly: 3 };

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
function cadenceOrNull(v) { return isNonEmptyString(v) && Object.prototype.hasOwnProperty.call(CADENCE_RANK, v.trim()) ? v.trim() : null; }

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
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const as_of = isoDateOrNull(pp.as_of);
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  const appendix_schedule_version = isNonEmptyString(pp.appendix_schedule_version) ? pp.appendix_schedule_version.trim() : null;
  if (!appendix_schedule_version) rejected_inputs.push({ where: 'appendix_schedule_version', reason: 'absent -- a versioned policy input citation is required', supplied: null });
  const appendix_schedule_source = isNonEmptyString(pp.appendix_schedule_source) ? pp.appendix_schedule_source.trim() : null;
  if (!appendix_schedule_source) rejected_inputs.push({ where: 'appendix_schedule_source', reason: 'absent -- a source citation is required', supplied: null });

  const reporting_cadence = cadenceOrNull(pp.reporting_cadence);
  if (!reporting_cadence) rejected_inputs.push({ where: 'reporting_cadence', reason: 'absent or not one of daily/weekly/monthly/quarterly', supplied: pp.reporting_cadence ?? null });
  const schedule_cadence = cadenceOrNull(pp.schedule_cadence);
  if (!schedule_cadence) rejected_inputs.push({ where: 'schedule_cadence', reason: 'absent or not one of daily/weekly/monthly/quarterly', supplied: pp.schedule_cadence ?? null });

  const cadence_refused = !!(reporting_cadence && schedule_cadence && CADENCE_RANK[reporting_cadence] < CADENCE_RANK[schedule_cadence]);

  const gl_closed = pp.gl_closed === true;
  const gl_closed_declared = pp.gl_closed === true || pp.gl_closed === false;
  if (!gl_closed_declared) rejected_inputs.push({ where: 'gl_closed', reason: 'absent -- must be explicitly declared true or false, never assumed', supplied: pp.gl_closed === undefined ? null : pp.gl_closed });
  const gl_as_of = isoDateOrNull(pp.gl_as_of);

  const defaultToleranceMinorUnits = (typeof pp.tolerance_minor_units === 'number' && Number.isFinite(pp.tolerance_minor_units) && pp.tolerance_minor_units >= 0)
    ? Math.trunc(pp.tolerance_minor_units) : 0;

  const accountsIn = Array.isArray(pp.accounts) ? pp.accounts : [];
  const accounts = accountsIn.map((a, i) => {
    a = a && typeof a === 'object' ? a : {};
    const account_id = isNonEmptyString(a.account_id) ? a.account_id.trim() : `UNLABELLED-${i + 1}`;
    const reported_figure_minor_units = toMinorUnits(a.reported_figure_minor_units, `accounts[${i}].reported_figure_minor_units`, rejected_inputs);
    const gl_figure_minor_units = toMinorUnits(a.gl_figure_minor_units, `accounts[${i}].gl_figure_minor_units`, rejected_inputs);
    const designed_plug_minor_units = (a.designed_plug_minor_units === undefined || a.designed_plug_minor_units === null)
      ? 0 : toMinorUnits(a.designed_plug_minor_units, `accounts[${i}].designed_plug_minor_units`, rejected_inputs);
    if (designed_plug_minor_units !== 0 && !isNonEmptyString(a.designed_plug_reason_code)) {
      rejected_inputs.push({ where: `accounts[${i}].designed_plug_reason_code`, reason: 'a non-zero designed plug requires a reason_code', supplied: null });
    }
    const designed_plug_reason_code = isNonEmptyString(a.designed_plug_reason_code) ? a.designed_plug_reason_code.trim() : null;
    const tolerance_minor_units = (typeof a.tolerance_minor_units === 'number' && Number.isFinite(a.tolerance_minor_units) && a.tolerance_minor_units >= 0)
      ? Math.trunc(a.tolerance_minor_units) : defaultToleranceMinorUnits;

    const residual_minor_units = reported_figure_minor_units - (gl_figure_minor_units + designed_plug_minor_units);
    const within_tolerance = Math.abs(residual_minor_units) <= tolerance_minor_units;

    return {
      account_id, reported_figure_minor_units, gl_figure_minor_units,
      designed_plug_minor_units, designed_plug_display: display(designed_plug_minor_units), designed_plug_reason_code,
      tolerance_minor_units, residual_minor_units, residual_display: display(residual_minor_units), within_tolerance,
    };
  });

  const breaking_accounts = accounts.filter((a) => !a.within_tolerance);
  const plugged_accounts = accounts.filter((a) => a.designed_plug_minor_units !== 0);
  const gl_stale = !!(accounts.some((a) => a.gl_figure_minor_units !== 0) && !gl_as_of && gl_closed_declared && gl_closed);

  const compliance_flags = [];
  let gate_policy = null;
  let execution_state = 'ran';
  let reason = null;

  if (cadence_refused) {
    execution_state = 'did_not_run';
    reason = `cadence_refused: reconciliation requested at ${reporting_cadence} cadence but the underlying GL supplemental schedule is only produced ${schedule_cadence}`;
    compliance_flags.push('RECON_CADENCE_REFUSED');
  } else if (gl_closed_declared && !gl_closed) {
    execution_state = 'did_not_run';
    reason = 'gl_not_yet_closed: the general ledger for this as-of period has not been declared closed';
    compliance_flags.push('RECON_GL_NOT_YET_CLOSED');
  } else if (gl_stale) {
    execution_state = 'ran_stale';
    reason = 'gl_figure_supplied_without_as_of: one or more accounts carry a non-zero GL figure but no gl_as_of was declared';
    compliance_flags.push('RECON_GL_STALE');
  } else {
    execution_state = 'ran';
    if (accounts.length === 0) {
      gate_policy = 'auto_pass';
      compliance_flags.push('RECON_NO_ACCOUNTS_DECLARED');
    } else if (breaking_accounts.length > 0) {
      gate_policy = 'review_required';
      compliance_flags.push('RECON_BREAK');
    } else {
      gate_policy = 'auto_pass';
      compliance_flags.push('RECON_TIE_OUT_CLEAN');
    }
  }
  if (plugged_accounts.length > 0) compliance_flags.push('RECON_DESIGNED_PLUG_APPLIED');
  if (rejected_inputs.length > 0) compliance_flags.push('RECON_INPUTS_REJECTED');

  const rationale = [];
  rationale.push(`Versioned policy inputs: appendix/schedule version ${appendix_schedule_version || 'MISSING'}, source ${appendix_schedule_source || 'MISSING'}.`);
  rationale.push(`Reporting cadence ${reporting_cadence || 'MISSING'} against underlying schedule cadence ${schedule_cadence || 'MISSING'}.`);
  if (cadence_refused) {
    rationale.push(reason);
  } else if (gl_closed_declared && !gl_closed) {
    rationale.push(reason);
  } else if (gl_stale) {
    rationale.push(reason);
  } else if (accounts.length === 0) {
    rationale.push('No accounts declared; vacuously auto_pass under the finite gate.');
  } else {
    rationale.push(`${accounts.length} account(s) evaluated, ${breaking_accounts.length} outside tolerance after the declared plug, ${plugged_accounts.length} carrying a non-zero designed plug.`);
    rationale.push(breaking_accounts.length === 0
      ? 'Every account ties out within its declared tolerance after netting the designed plug.'
      : `Break account(s): ${breaking_accounts.map((a) => `${a.account_id} (${a.residual_display} ${currency})`).join(', ')}.`);
  }
  rationale.push('This is an arithmetic tie-out over the figures supplied for this cycle against a caller-declared general-ledger figure, the only independent witness in this reconciliation program. It does not itself pull the GL balance and is not a determination that any underlying control has been met.');

  const output_payload = {
    as_of, currency,
    appendix_schedule_version, appendix_schedule_source,
    reporting_cadence, schedule_cadence, cadence_refused,
    gl_closed_declared, gl_closed, gl_as_of,
    account_count: accounts.length, accounts,
    breaking_account_count: breaking_accounts.length,
    plugged_account_count: plugged_accounts.length,
    decision: { gate_policy, execution_state, reason },
    rejected_inputs, rationale,
    note: 'Deterministic tie-out of a caller-declared reported figure to a caller-declared general-ledger figure, by account, against the general ledger as an independent book of record -- unlike sibling nodes in this programme that compare only declared-vs-declared. A designed plug is a first-class declared input, netted before the residual and never counted as a break. A daily-cadence request against a less-frequent underlying schedule, or a GL not yet declared closed, refuses to run rather than emit a misleading pass or a false break; the two are reported as distinct did_not_run reasons.',
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
