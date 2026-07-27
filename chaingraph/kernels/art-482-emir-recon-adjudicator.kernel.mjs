import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-482-emir-recon-adjudicator';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'adjudicate_emir_reconciliation', mandate_type: 'attestation_mandate', gpu: false };

// EMIR Refit trade-repository reconciliation adjudicator.
//
// Under EMIR Refit, the TRADE REPOSITORY runs the inter-TR reconciliation and returns a daily
// ISO 20022 response naming the matched/unreconciled fields per UTI -- a firm holds THAT
// response (plus its own submitted state), never both counterparties' raw extracts. This
// kernel ingests exactly that pair: `tr_response` (the TR's reported per-field values + its own
// tr_match_status per UTI) and `firm_state` (the firm's submitted per-field values per UTI),
// plus a per-cycle POLICY-SUPPLIED field/tolerance/suppression table (`policy`) -- the field
// list and tolerances are NOT hardcoded here (ESMA74-362-2683 reconciliation-tolerances table
// currently reconciles 87 fields at go-live, +61 more from Phase 2 / 27 Apr 2026 EU, 148 total
// -- a kernel baking that list in would go stale the moment ESMA revises it).
//
// It independently reproduces a per-trade match/dispute verdict field-by-field and compares
// that computed verdict against the TR's own tr_match_status. DISAGREEMENT WITH THE TR IS A
// FIRST-CLASS OUTPUT (verdict_disagrees_with_tr), never an error -- a firm's own recompute
// diverging from the TR's stated status is exactly the signal this tool exists to surface.
// Every non-suppressed field mismatch is emitted with a STABLE per-break key (`uti::field_name`)
// so consecutive cycles can diff cleanly (feeds art-483-emir-break-ageing).
//
// Lifecycle events (amendment, compression, termination) are ordinary inputs -- this kernel
// compares whatever present-state fields the TR response and firm state carry for a UTI; it
// does not special-case the lifecycle_event tag beyond passing it through.
//
// Fields on the SUPPRESSION LIST (regulator- or TR-stood-down rules/fields) are reported with
// status 'suppressed' and excluded from break/verdict computation, so a stood-down rule can
// never manufacture a false break.
//
// Deterministic by construction: string/number/date comparisons only, no transcendentals, no
// Date.now()/random/locale formatting/crypto.subtle in compute(). Date.parse(<ISO string>) is
// used only to compare caller-supplied date fields (same pattern as art-428's parseIsoOrNull),
// never a bare `new Date()`.
//
// Spec: EMIR-RECON-BUILD-SPEC.md Sec 0 + Sec 1.

function isStr(v) { return typeof v === 'string' && v.length > 0; }
function str(v) { return typeof v === 'string' ? v : ''; }
function isFiniteNum(v) { const n = Number(v); return Number.isFinite(n); }
function parseIsoDay(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.floor(t / 86400000) : null;
}
function isAbsent(v) { return v === undefined || v === null || v === ''; }

function normEnum(fieldSpec, v) {
  const eq = (fieldSpec && fieldSpec.enum_equivalence) || {};
  const key = str(v);
  return Object.prototype.hasOwnProperty.call(eq, key) ? String(eq[key]) : key;
}

// Compares one field's TR-reported value against the firm-submitted value under the
// policy-supplied tolerance rule for that field. Returns {agree, delta} -- delta is null for
// non-numeric/non-date comparisons.
function compareField(fieldSpec, trVal, firmVal) {
  const trAbsent = isAbsent(trVal);
  const firmAbsent = isAbsent(firmVal);
  if (trAbsent && firmAbsent) return { agree: true, delta: null };
  if (trAbsent !== firmAbsent) return { agree: false, delta: null };

  const type = (fieldSpec.type === 'numeric' || fieldSpec.type === 'date' || fieldSpec.type === 'enum') ? fieldSpec.type : 'string';

  if (type === 'numeric') {
    if (!isFiniteNum(trVal) || !isFiniteNum(firmVal)) return { agree: false, delta: null };
    const tol = isFiniteNum(fieldSpec.numeric_tolerance) ? Math.abs(Number(fieldSpec.numeric_tolerance)) : 0;
    const delta = Math.abs(Number(trVal) - Number(firmVal));
    return { agree: delta <= tol, delta };
  }
  if (type === 'date') {
    const trDay = parseIsoDay(trVal);
    const firmDay = parseIsoDay(firmVal);
    if (trDay === null || firmDay === null) return { agree: false, delta: null };
    const tol = isFiniteNum(fieldSpec.date_tolerance_days) ? Math.abs(Math.trunc(Number(fieldSpec.date_tolerance_days))) : 0;
    const delta = Math.abs(trDay - firmDay);
    return { agree: delta <= tol, delta };
  }
  if (type === 'enum') {
    return { agree: normEnum(fieldSpec, trVal) === normEnum(fieldSpec, firmVal), delta: null };
  }
  return { agree: str(trVal) === str(firmVal), delta: null };
}

export function compute(pp) {
  pp = pp || {};
  const trResponse = pp.tr_response || {};
  const firmState = pp.firm_state || {};
  const policy = pp.policy || {};

  const fieldTable = Array.isArray(policy.fields) ? policy.fields : [];
  const suppressionSet = new Set((Array.isArray(policy.suppression_list) ? policy.suppression_list : []).map(str).filter(isStr));
  const tableVersion = isStr(policy.field_tolerance_table_version) ? policy.field_tolerance_table_version : 'UNVERSIONED';

  const firmByUti = new Map();
  for (const t of (Array.isArray(firmState.trades) ? firmState.trades : [])) {
    if (t && isStr(t.uti)) firmByUti.set(t.uti, t);
  }

  const trades = [];
  const break_set = [];
  let tr_matched_count = 0;
  let tr_disputed_count = 0;
  let verdict_disagrees_with_tr_count = 0;

  for (const trTrade of (Array.isArray(trResponse.trades) ? trResponse.trades : [])) {
    if (!trTrade || !isStr(trTrade.uti)) continue;
    const uti = trTrade.uti;
    const trReported = trTrade.tr_reported || {};
    const trMatchStatus = isStr(trTrade.tr_match_status) ? trTrade.tr_match_status : 'UNKNOWN';
    const lifecycleEvent = isStr(trTrade.lifecycle_event) ? trTrade.lifecycle_event : 'NEW';

    const firmTrade = firmByUti.get(uti) || null;
    const firmSubmitted = firmTrade ? (firmTrade.submitted || {}) : null;

    const field_results = [];
    let tradeHasBreak = false;

    for (const fieldSpec of fieldTable) {
      const fieldName = str(fieldSpec && fieldSpec.field_name);
      if (!fieldName) continue;
      const trVal = Object.prototype.hasOwnProperty.call(trReported, fieldName) ? trReported[fieldName] : null;
      const firmVal = firmSubmitted && Object.prototype.hasOwnProperty.call(firmSubmitted, fieldName) ? firmSubmitted[fieldName] : null;

      if (suppressionSet.has(fieldName)) {
        field_results.push({ field_name: fieldName, status: 'suppressed', tr_value: trVal, firm_value: firmVal });
        continue;
      }
      if (firmSubmitted === null) {
        field_results.push({ field_name: fieldName, status: 'no_firm_record', tr_value: trVal, firm_value: null });
        tradeHasBreak = true;
        break_set.push({ break_key: uti + '::' + fieldName, uti, field_name: fieldName, tr_value: trVal, firm_value: null, reason: 'no_firm_record' });
        continue;
      }

      const cmp = compareField(fieldSpec, trVal, firmVal);
      if (cmp.agree) {
        field_results.push({ field_name: fieldName, status: 'agree', tr_value: trVal, firm_value: firmVal, delta: cmp.delta });
      } else {
        field_results.push({ field_name: fieldName, status: 'disagree', tr_value: trVal, firm_value: firmVal, delta: cmp.delta });
        tradeHasBreak = true;
        break_set.push({ break_key: uti + '::' + fieldName, uti, field_name: fieldName, tr_value: trVal, firm_value: firmVal, reason: 'field_mismatch' });
      }
    }

    const computedVerdict = firmSubmitted === null ? 'UNMATCHED' : (tradeHasBreak ? 'DISPUTED' : 'MATCHED');
    const verdictDisagreesWithTr = computedVerdict !== trMatchStatus;
    if (verdictDisagreesWithTr) verdict_disagrees_with_tr_count++;
    if (trMatchStatus === 'MATCHED') tr_matched_count++;
    if (trMatchStatus === 'DISPUTED') tr_disputed_count++;

    trades.push({
      uti,
      lifecycle_event: lifecycleEvent,
      tr_match_status: trMatchStatus,
      computed_verdict: computedVerdict,
      verdict_disagrees_with_tr: verdictDisagreesWithTr,
      field_results,
    });
  }

  const output_payload = {
    as_of_date: isStr(trResponse.as_of_date) ? trResponse.as_of_date : null,
    field_tolerance_table_version: tableVersion,
    trade_count: trades.length,
    tr_matched_count,
    tr_disputed_count,
    verdict_disagrees_with_tr_count,
    break_count: break_set.length,
    trades,
    break_set,
    note: 'Independently reproduces the EMIR trade-repository reconciliation verdict from the TR ISO 20022 response and the firm submitted state, under a policy-supplied per-cycle field/tolerance/suppression table. Disagreement with the TR verdict is a first-class output, never an error. Lifecycle events (amendment/compression/termination) are ordinary inputs. This tool computes a reconciliation verdict only; it does not itself resubmit, dispute, or file any regulatory report.',
  };

  const compliance_flags = [];
  if (break_set.length > 0) compliance_flags.push('EMIR_RECON_BREAKS_PRESENT');
  if (verdict_disagrees_with_tr_count > 0) compliance_flags.push('EMIR_RECON_VERDICT_DISAGREES_WITH_TR');
  if (fieldTable.length === 0) compliance_flags.push('EMIR_RECON_FIELD_TABLE_EMPTY');

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
